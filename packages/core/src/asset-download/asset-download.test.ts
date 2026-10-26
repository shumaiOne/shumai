import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetType, prisma, type Prisma, type User } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { projectService } from '@shumai/core/src/project/project'
import { s3Service } from '@shumai/core/src/s3/s3'
import { downloadAssetOp, runOperation, type OperationContext } from '@shumai/core/src/operations'
import { READ_URL_EXPIRES_SECONDS } from '@shumai/core/src/asset-read/asset-read'
import { proxyKeyOf } from './asset-download'

type Head = Awaited<ReturnType<typeof s3Service.headObject>>

describe('download_asset Operation', () => {
  setupTestDbHooks()

  let owner: User
  let reviewer: User
  let outsider: User
  let projectId: string
  let rootFolderId: string

  const as = (user: User, via: OperationContext['via'] = 'cli'): OperationContext => ({
    userId: user.id,
    via,
  })

  beforeEach(async () => {
    owner = await prisma.user.create({
      data: { name: 'Owner', email: 'dl-owner@test.com', password: 'pw' },
    })
    reviewer = await prisma.user.create({
      data: { name: 'Reviewer', email: 'dl-reviewer@test.com', password: 'pw' },
    })
    outsider = await prisma.user.create({
      data: { name: 'Outsider', email: 'dl-outsider@test.com', password: 'pw' },
    })
    const team = await prisma.team.create({ data: { name: 'Download Team' } })
    await prisma.teamMember.create({ data: { teamId: team.id, userId: owner.id, role: 'owner' } })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: reviewer.id, role: 'reviewer' },
    })
    const project = await projectService.createProject(owner, {
      teamId: team.id,
      name: 'Download Project',
    })
    projectId = project.id
    rootFolderId = project.rootFolder!

    vi.spyOn(s3Service, 'presign').mockImplementation(
      async (_bucket, key) => `https://signed.example/${key}`,
    )
    vi.spyOn(s3Service, 'headObject').mockImplementation(
      async (_bucket, key) => ({ key, size: 100, contentType: 'application/octet-stream' }) as Head,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function createFile(
    name: string,
    data: Partial<Prisma.AssetUncheckedCreateInput> & { key?: string } = {},
  ) {
    const { key, ...rest } = data
    const storageKey = key ? await prisma.storageKey.create({ data: { key } }) : null
    return prisma.asset.create({
      data: {
        name,
        type: AssetType.file,
        status: 'uploaded',
        projectId,
        parentId: rootFolderId,
        storageKeyId: storageKey?.id,
        ...rest,
      },
    })
  }

  const media = (value: Record<string, unknown>) => value as unknown as PrismaJson.MediaInfo

  it('returns the web preview by default and the original with proxy false', async () => {
    const photo = await createFile('photo.jpg', {
      key: 'files/up-1/photo.jpg',
      media: media({ proxyType: 'image', imageTranscodes: [{ key: 'files/p-1/web.webp' }] }),
    })

    const preview = await runOperation(downloadAssetOp, as(reviewer), { assetIds: [photo.id] })
    expect(preview).toEqual({
      files: [
        {
          assetId: photo.id,
          name: 'photo.webp',
          kind: 'proxy',
          size: 100,
          mimeType: 'image/webp',
          url: 'https://signed.example/files/p-1/web.webp',
        },
      ],
    })
    expect(s3Service.presign).toHaveBeenCalledWith(
      expect.any(String),
      'files/p-1/web.webp',
      'GET',
      true,
      'photo.webp',
      false,
      READ_URL_EXPIRES_SECONDS,
    )

    const original = await runOperation(downloadAssetOp, as(reviewer), {
      assetIds: [photo.id],
      proxy: false,
    })
    expect(original.files[0]).toMatchObject({
      name: 'photo.jpg',
      kind: 'original',
      mimeType: 'image/jpeg',
      url: 'https://signed.example/files/up-1/photo.jpg',
    })
  })

  it('renames a video proxy to its extension and falls back to the original without one', async () => {
    const clip = await createFile('clip.mov', {
      key: 'files/up-2/clip.mov',
      media: media({ proxyType: 'video', videoTranscodes: [{ key: 'files/c-1/720p.mp4' }] }),
    })
    const song = await createFile('song.wav', {
      key: 'files/up-3/song.wav',
      media: media({ proxyType: 'audio', original: { key: 'files/up-3/song.wav' } }),
    })
    const archive = await createFile('bundle.zip', { key: 'files/up-4/bundle.zip' })

    const { files } = await runOperation(downloadAssetOp, as(owner), {
      assetIds: [clip.id, song.id, archive.id, clip.id],
    })

    expect(files.map((f) => [f.name, f.kind])).toEqual([
      ['clip.mp4', 'proxy'],
      ['song.wav', 'original'],
      ['bundle.zip', 'original'],
    ])
  })

  it('downloads the latest version of a version stack', async () => {
    const stack = await prisma.asset.create({
      data: {
        name: 'diagram',
        type: AssetType.version_stack,
        status: 'uploaded',
        projectId,
        parentId: rootFolderId,
      },
    })
    await createFile('diagram_v1.png', {
      parentId: stack.id,
      sortIndex: 'b',
      key: 'files/v1/diagram_v1.png',
    })
    const v2 = await createFile('diagram_v2.png', {
      parentId: stack.id,
      sortIndex: 'a',
      key: 'files/v2/diagram_v2.png',
    })

    const { files } = await runOperation(downloadAssetOp, as(owner), { assetIds: [stack.id] })

    expect(files).toEqual([expect.objectContaining({ assetId: v2.id, name: 'diagram_v2.png' })])
  })

  it('only gives storage keys to the built-in agent', async () => {
    const doc = await createFile('notes.md', { key: 'files/up-5/notes.md' })
    for (const via of ['mcp', 'cli', 'api'] as const) {
      const { files } = await runOperation(downloadAssetOp, as(owner, via), { assetIds: [doc.id] })
      expect(files[0]).not.toHaveProperty('key')
    }
    const { files } = await runOperation(downloadAssetOp, as(owner, 'agent'), {
      assetIds: [doc.id],
    })
    expect(files[0].key).toBe('files/up-5/notes.md')
  })

  it('rejects folders', async () => {
    const folder = await prisma.asset.create({
      data: {
        name: 'Renders',
        type: AssetType.folder,
        status: 'uploaded',
        projectId,
        parentId: rootFolderId,
      },
    })
    await expect(
      runOperation(downloadAssetOp, as(owner), { assetIds: [folder.id] }),
    ).rejects.toMatchObject({
      status: 400,
      message: `Asset ${folder.id} ("Renders") is a folder. Download the files inside it instead.`,
    })
  })

  it('rejects users without Read access before resolving anything', async () => {
    const doc = await createFile('notes.md', { key: 'files/up-6/notes.md' })
    await expect(
      runOperation(downloadAssetOp, as(outsider), { assetIds: [doc.id] }),
    ).rejects.toMatchObject({ status: 403 })
    expect(s3Service.headObject).not.toHaveBeenCalled()
    expect(s3Service.presign).not.toHaveBeenCalled()
  })

  it('reports files missing from storage', async () => {
    const doc = await createFile('notes.md', { key: 'files/up-7/notes.md' })
    vi.mocked(s3Service.headObject).mockRejectedValue(new Error('NotFound'))
    await expect(
      runOperation(downloadAssetOp, as(owner), { assetIds: [doc.id] }),
    ).rejects.toMatchObject({
      status: 404,
      message: `The file for asset ${doc.id} ("notes.md") is missing from storage.`,
    })
  })

  it.each([[[]], [Array.from({ length: 51 }, (_, i) => `a-${i}`)]])(
    'rejects %# asset ID lists outside 1 to 50',
    async (assetIds) => {
      await expect(runOperation(downloadAssetOp, as(owner), { assetIds })).rejects.toMatchObject({
        status: 400,
      })
    },
  )
})

describe('proxyKeyOf', () => {
  it.each([
    [{ proxyType: 'image', imageTranscodes: [{ key: 'i.webp' }] }, 'i.webp'],
    [{ proxyType: '3d', imageTranscodes: [{ key: 'views.webp' }] }, 'views.webp'],
    [{ proxyType: 'video', videoTranscodes: [{ key: 'v.mp4' }] }, 'v.mp4'],
    [{ proxyType: 'video', videoTranscodes: [], videoPreview: { key: 'p.mp4' } }, 'p.mp4'],
    [{ proxyType: 'pdf', original: { key: 'doc.pdf' } }, 'doc.pdf'],
    [{ proxyType: 'image', imageTranscodes: [] }, undefined],
  ])('%o → %s', (value, expected) => {
    expect(proxyKeyOf(value as unknown as PrismaJson.MediaInfo)).toBe(expected)
  })

  it('has no proxy without media', () => {
    expect(proxyKeyOf(null)).toBeUndefined()
  })
})
