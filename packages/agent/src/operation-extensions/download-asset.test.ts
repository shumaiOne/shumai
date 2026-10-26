import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { prisma, type Asset, type StorageKey } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { authzService } from '@shumai/core/src/authz/authz'
import { getOperation } from '@shumai/core/src/operations'
import { toAgentTool } from '../operation-tools'
import './download-asset'

vi.mock('@shumai/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/db')>()
  return {
    ...actual,
    prisma: {
      asset: { findUnique: vi.fn(), findFirst: vi.fn() },
      storageKey: { findFirst: vi.fn(), findUnique: vi.fn() },
    },
  }
})

vi.mock('@shumai/core/src/s3/s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/core/src/s3/s3')>()
  return {
    ...actual,
    s3Service: {
      headObject: vi.fn(),
      downloadToFile: vi.fn(),
      presign: vi.fn().mockResolvedValue('https://signed.example/file'),
    },
  }
})

vi.mock('@shumai/core/src/authz/authz', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/core/src/authz/authz')>()
  return { ...actual, authzService: { hasPermission: vi.fn() } }
})

type Head = Awaited<ReturnType<typeof s3Service.headObject>>
type Saved = { filePath: string; absolutePath: string; contentType: string; size: number }

const piDir = path.join(process.cwd(), '.pi')

function downloadTool(userId = 'user-1') {
  return toAgentTool(getOperation('download_asset')!, { userId })
}

function textOf(result: { content: unknown[] }): string {
  return (result.content[0] as { text: string }).text
}

function mockAssets(...assets: Array<Record<string, unknown>>) {
  vi.mocked(prisma.asset.findUnique).mockImplementation(
    (async (args: { where: { id: string } }) =>
      assets.find((a) => a.id === args.where.id) ?? null) as never,
  )
}

function mockStorage(contentType: string, write = 'bytes') {
  vi.mocked(s3Service.headObject).mockResolvedValue({ size: 1234, contentType } as Head)
  vi.mocked(s3Service.downloadToFile).mockImplementation(async (_bucket, _key, dest) => {
    await fs.promises.writeFile(dest, write)
  })
}

const photo = {
  id: 'img-1',
  name: 'sample_photo.jpg',
  type: 'file',
  isDeleted: false,
  storageKey: { key: 'files/up-1/sample_photo.jpg' },
  media: { proxyType: 'image', imageTranscodes: [{ key: 'files/img-1/proxy.webp' }] },
}

describe('download_asset agent tool', () => {
  const created: string[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue()
  })

  afterEach(() => {
    for (const file of created.splice(0)) fs.rmSync(file, { force: true })
  })

  it('offers assetIds, proxy, and the agent-only key parameter', () => {
    const tool = downloadTool()
    const schema = tool.parameters as { properties: Record<string, unknown>; required?: string[] }
    expect(Object.keys(schema.properties)).toEqual(['assetIds', 'proxy', 'key'])
    expect(schema.required ?? []).not.toContain('assetIds')
    expect(tool.description).toContain('.pi directory')
  })

  it('saves the web preview into .pi by default, named after the asset', async () => {
    mockAssets(photo)
    mockStorage('image/webp', 'proxy-bytes')

    const result = await downloadTool().execute('call-1', { assetIds: ['img-1'] })

    const expectedPath = path.join(piDir, 'img-1_sample_photo.webp')
    created.push(expectedPath)
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      permission: 'Read',
      type: 'asset',
      id: 'img-1',
    })
    expect(s3Service.downloadToFile).toHaveBeenCalledWith(
      'shumai',
      'files/img-1/proxy.webp',
      expectedPath,
    )
    expect(fs.readFileSync(expectedPath, 'utf-8')).toBe('proxy-bytes')
    expect(textOf(result)).toBe(
      [
        `Downloaded "sample_photo.webp" (ID: img-1, proxy, image/webp, 11 B) to "${path.join('.pi', 'img-1_sample_photo.webp')}".`,
        'Remember to delete these temporary files when finished.',
      ].join('\n'),
    )
    const details = result.details as { files: Saved[] }
    expect(details.files[0]).toMatchObject({
      filePath: path.join('.pi', 'img-1_sample_photo.webp'),
      contentType: 'image/webp',
      size: 11,
    })
  })

  it('saves the original with proxy false', async () => {
    mockAssets(photo)
    mockStorage('image/jpeg')

    await downloadTool().execute('call-1', { assetIds: ['img-1'], proxy: false })

    const expectedPath = path.join(piDir, 'img-1_sample_photo.jpg')
    created.push(expectedPath)
    expect(s3Service.downloadToFile).toHaveBeenCalledWith(
      'shumai',
      'files/up-1/sample_photo.jpg',
      expectedPath,
    )
  })

  it('downloads several files and the latest version of a version stack', async () => {
    mockAssets(photo, { id: 'stack-1', name: 'banana', type: 'version_stack', isDeleted: false })
    vi.mocked(prisma.asset.findFirst).mockResolvedValue({
      id: 'file-v2',
      name: 'banana_pig.png',
      type: 'file',
      isDeleted: false,
      storageKey: { key: 'files/up-2/banana_pig.png' },
      media: { proxyType: 'image', imageTranscodes: [{ key: 'files/file-v2/proxy.webp' }] },
    } as unknown as Asset)
    mockStorage('image/webp')

    const result = await downloadTool().execute('call-1', {
      assetIds: ['img-1', 'stack-1'],
      key: null,
    })

    created.push(
      path.join(piDir, 'img-1_sample_photo.webp'),
      path.join(piDir, 'file-v2_banana_pig.webp'),
    )
    expect(prisma.asset.findFirst).toHaveBeenCalledWith({
      where: { parentId: 'stack-1', isDeleted: false },
      orderBy: { sortIndex: 'asc' },
      include: { storageKey: true },
    })
    expect(s3Service.downloadToFile).toHaveBeenCalledTimes(2)
    expect(textOf(result)).toContain('Downloaded "banana_pig.webp" (ID: file-v2, proxy')
  })

  it('rejects folders', async () => {
    mockAssets({ id: 'folder-1', name: 'Renders', type: 'folder', isDeleted: false })
    await expect(downloadTool().execute('call-1', { assetIds: ['folder-1'] })).rejects.toThrow(
      'Asset folder-1 ("Renders") is a folder. Download the files inside it instead.',
    )
    expect(s3Service.downloadToFile).not.toHaveBeenCalled()
  })

  it('checks Read on every asset before downloading anything', async () => {
    mockAssets(photo)
    vi.mocked(authzService.hasPermission).mockImplementation(async ({ id }) => {
      if (id === 'secret') throw new Error('Forbidden')
    })
    await expect(
      downloadTool().execute('call-1', { assetIds: ['img-1', 'secret'] }),
    ).rejects.toThrow('Forbidden')
    expect(s3Service.downloadToFile).not.toHaveBeenCalled()
  })

  it('requires assetIds or key', async () => {
    await expect(downloadTool().execute('call-1', { assetIds: null, key: null })).rejects.toThrow(
      'Invalid input for download_asset',
    )
  })

  it('rejects assetIds and key together', async () => {
    await expect(
      downloadTool().execute('call-1', { assetIds: ['img-1'], key: 'files/img-1/a.webp' }),
    ).rejects.toThrow('Provide either "assetIds" or "key", not both.')
  })

  describe('by storage key', () => {
    it('requires a user', async () => {
      await expect(
        downloadTool('').execute('call-1', { key: 'files/ast-1/shot.webp' }),
      ).rejects.toThrow('User ID is required for authorization.')
    })

    it('rejects keys outside files/ and path traversal', async () => {
      await expect(downloadTool().execute('call-1', { key: 'avatars/user-1.png' })).rejects.toThrow(
        'Invalid storage key format: key must start with "files/"',
      )
      await expect(
        downloadTool().execute('call-1', { key: 'files/../../etc/passwd' }),
      ).rejects.toThrow('cannot contain ".."')
    })

    it('rejects keys that belong to no asset', async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.storageKey.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.storageKey.findUnique).mockResolvedValue(null)
      await expect(
        downloadTool().execute('call-1', { key: 'files/nope/shot.webp' }),
      ).rejects.toThrow('does not belong to any valid asset or the asset has been deleted')
    })

    it('checks Read on the owning asset', async () => {
      mockAssets({ id: 'other-project-asset' })
      vi.mocked(authzService.hasPermission).mockRejectedValue(new Error('Forbidden'))
      await expect(
        downloadTool().execute('call-1', { key: 'files/other-project-asset/shots/a.webp' }),
      ).rejects.toThrow('Forbidden')
      expect(authzService.hasPermission).toHaveBeenCalledWith({
        user: { id: 'user-1' },
        permission: 'Read',
        type: 'asset',
        id: 'other-project-asset',
      })
      expect(s3Service.downloadToFile).not.toHaveBeenCalled()
    })

    it('downloads a read_asset artifact into .pi', async () => {
      mockAssets({ id: 'ast-123' })
      mockStorage('image/webp', 'frame-bytes')

      const result = await downloadTool().execute('call-1', {
        key: 'files/ast-123/screenshots/shot_5.0s.webp',
      })

      const expectedPath = path.join(piDir, 'shot_5.0s.webp')
      created.push(expectedPath)
      expect(fs.readFileSync(expectedPath, 'utf-8')).toBe('frame-bytes')
      expect(textOf(result)).toBe(
        `Downloaded storage key "files/ast-123/screenshots/shot_5.0s.webp" to "${path.join('.pi', 'shot_5.0s.webp')}". Remember to delete this temporary file when finished.`,
      )
      expect(result.details).toMatchObject({
        key: 'files/ast-123/screenshots/shot_5.0s.webp',
        assetId: 'ast-123',
        size: Buffer.from('frame-bytes').length,
      })
    })

    it('resolves original upload keys through the storage key', async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.storageKey.findFirst).mockResolvedValue({
        id: 'sk-1',
        key: 'files/upload-ulid-456/photo.png',
        assets: [{ id: 'asset-photo-1' }],
      } as unknown as StorageKey & { assets: Asset[] })
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      vi.mocked(s3Service.headObject).mockResolvedValue({
        size: 8,
        contentType: 'application/octet-stream',
      } as Head)
      vi.mocked(s3Service.downloadToFile).mockImplementation(async (_b, _k, dest) => {
        await fs.promises.writeFile(dest, pngHeader)
      })

      const result = await downloadTool().execute('call-1', {
        key: 'files/upload-ulid-456/photo.png',
      })

      created.push(path.join(piDir, 'photo.png'))
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'asset-photo-1' }),
      )
      // Falls back to detecting the type from the bytes
      expect(result.details).toMatchObject({ assetId: 'asset-photo-1', contentType: 'image/png' })
    })
  })
})
