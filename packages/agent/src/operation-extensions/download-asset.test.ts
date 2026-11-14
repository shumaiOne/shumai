import { invokeTool } from '@shumai/core/src/agent/tool-test-utils'
import { authzService } from '@shumai/core/src/authz/authz'
import { getOperation } from '@shumai/core/src/operations'
import { runnerService } from '@shumai/core/src/runner'
import { s3Service } from '@shumai/core/src/s3/s3'
import { prisma, type Asset, type StorageKey } from '@shumai/db'
import * as path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

vi.mock('@shumai/core/src/runner', () => ({
  runnerService: {
    requireOnlineRunner: vi.fn(),
    isRunnerConnected: vi.fn(),
    downloadToRunner: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/authz/authz', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/core/src/authz/authz')>()
  return { ...actual, authzService: { hasPermission: vi.fn() } }
})

type Head = Awaited<ReturnType<typeof s3Service.headObject>>
type Saved = { filePath: string; contentType: string; size: number }

function downloadTool(userId = 'user-1') {
  return toAgentTool(getOperation('download_asset')!, {
    userId,
    teamId: 'team-1',
    runnerId: null,
  })
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

function mockStorage(contentType: string, size = 11) {
  vi.mocked(s3Service.headObject).mockResolvedValue({ size, contentType } as Head)
  vi.mocked(runnerService.downloadToRunner).mockResolvedValue({
    type: 'file.download.result',
    executionId: 'exec-dl-1',
    ok: true,
    size,
    mimeType: contentType,
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
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue()
    vi.mocked(runnerService.requireOnlineRunner).mockResolvedValue({
      id: 'runner-1',
      teamId: 'team-1',
      name: 'Local Mac Mini',
      keyPrefix: 'shm_rn_12345678',
      isDefault: true,
      status: 'connected',
      createdAt: '2026-11-14T00:00:00.000Z',
      updatedAt: '2026-11-14T00:00:00.000Z',
    })
  })

  it('offers assetIds, proxy, and the agent-only key parameter', () => {
    const tool = downloadTool()
    const schema = tool.parameters as { properties: Record<string, unknown>; required?: string[] }
    expect(Object.keys(schema.properties)).toEqual(['assetIds', 'proxy', 'key'])
    expect(schema.required ?? []).not.toContain('assetIds')
    expect(tool.description).toContain('.pi directory')
  })

  it('saves the web preview into .pi on the runner by default, named after the asset', async () => {
    mockAssets(photo)
    mockStorage('image/webp', 11)

    const result = await invokeTool(downloadTool(), 'call-1', { assetIds: ['img-1'] })

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      permission: 'Read',
      type: 'asset',
      id: 'img-1',
    })
    expect(runnerService.requireOnlineRunner).toHaveBeenCalledWith('team-1', null)
    expect(runnerService.downloadToRunner).toHaveBeenCalledWith('runner-1', {
      url: 'https://signed.example/file',
      destPath: path.posix.join('.pi', 'img-1_sample_photo.webp'),
    })
    expect(textOf(result)).toBe(
      [
        `Downloaded "sample_photo.webp" (ID: img-1, proxy, image/webp, 11 B) to "${path.posix.join('.pi', 'img-1_sample_photo.webp')}".`,
        'Remember to delete these temporary files when finished.',
      ].join('\n'),
    )
    const details = result.details as { files: Saved[] }
    expect(details.files[0]).toMatchObject({
      filePath: path.posix.join('.pi', 'img-1_sample_photo.webp'),
      contentType: 'image/webp',
      size: 11,
    })
  })

  it('saves the original with proxy false', async () => {
    mockAssets(photo)
    mockStorage('image/jpeg', 1234)

    await invokeTool(downloadTool(), 'call-1', { assetIds: ['img-1'], proxy: false })

    expect(s3Service.presign).toHaveBeenCalledWith(
      'shumai',
      'files/up-1/sample_photo.jpg',
      'GET',
      false,
      undefined,
      false,
      600,
    )
    expect(runnerService.downloadToRunner).toHaveBeenCalledWith('runner-1', {
      url: 'https://signed.example/file',
      destPath: path.posix.join('.pi', 'img-1_sample_photo.jpg'),
    })
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

    const result = await invokeTool(downloadTool(), 'call-1', {
      assetIds: ['img-1', 'stack-1'],
      key: null,
    })

    expect(prisma.asset.findFirst).toHaveBeenCalledWith({
      where: { parentId: 'stack-1', isDeleted: false },
      orderBy: { sortIndex: 'asc' },
      include: { storageKey: true },
    })
    expect(runnerService.downloadToRunner).toHaveBeenCalledTimes(2)
    expect(textOf(result)).toContain('Downloaded "banana_pig.webp" (ID: file-v2, proxy')
  })

  it('rejects folders', async () => {
    mockAssets({ id: 'folder-1', name: 'Renders', type: 'folder', isDeleted: false })
    await expect(invokeTool(downloadTool(), 'call-1', { assetIds: ['folder-1'] })).rejects.toThrow(
      'Asset folder-1 ("Renders") is a folder. Download the files inside it instead.',
    )
    expect(runnerService.downloadToRunner).not.toHaveBeenCalled()
  })

  it('checks Read on every asset before downloading anything', async () => {
    mockAssets(photo)
    vi.mocked(authzService.hasPermission).mockImplementation(async ({ id }) => {
      if (id === 'secret') throw new Error('Forbidden')
    })
    await expect(
      invokeTool(downloadTool(), 'call-1', { assetIds: ['img-1', 'secret'] }),
    ).rejects.toThrow('Forbidden')
    expect(runnerService.downloadToRunner).not.toHaveBeenCalled()
  })

  it('requires assetIds or key', async () => {
    await expect(
      invokeTool(downloadTool(), 'call-1', { assetIds: null, key: null }),
    ).rejects.toThrow('Invalid input for download_asset')
  })

  it('rejects assetIds and key together', async () => {
    await expect(
      invokeTool(downloadTool(), 'call-1', { assetIds: ['img-1'], key: 'files/img-1/a.webp' }),
    ).rejects.toThrow('Provide either "assetIds" or "key", not both.')
  })

  describe('by storage key', () => {
    it('requires a user', async () => {
      await expect(
        invokeTool(downloadTool(''), 'call-1', { key: 'files/ast-1/shot.webp' }),
      ).rejects.toThrow('User ID is required for authorization.')
    })

    it('rejects keys outside files/ and path traversal', async () => {
      await expect(
        invokeTool(downloadTool(), 'call-1', { key: 'avatars/user-1.png' }),
      ).rejects.toThrow('Invalid storage key format: key must start with "files/"')
      await expect(
        invokeTool(downloadTool(), 'call-1', { key: 'files/../../etc/passwd' }),
      ).rejects.toThrow('cannot contain ".."')
    })

    it('rejects keys that belong to no asset', async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.storageKey.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.storageKey.findUnique).mockResolvedValue(null)
      await expect(
        invokeTool(downloadTool(), 'call-1', { key: 'files/nope/shot.webp' }),
      ).rejects.toThrow('does not belong to any valid asset or the asset has been deleted')
    })

    it('checks Read on the owning asset', async () => {
      mockAssets({ id: 'other-project-asset' })
      vi.mocked(authzService.hasPermission).mockRejectedValue(new Error('Forbidden'))
      await expect(
        invokeTool(downloadTool(), 'call-1', { key: 'files/other-project-asset/shots/a.webp' }),
      ).rejects.toThrow('Forbidden')
      expect(authzService.hasPermission).toHaveBeenCalledWith({
        user: { id: 'user-1' },
        permission: 'Read',
        type: 'asset',
        id: 'other-project-asset',
      })
      expect(runnerService.downloadToRunner).not.toHaveBeenCalled()
    })

    it('downloads a read_asset artifact into .pi on the runner', async () => {
      mockAssets({ id: 'ast-123' })
      mockStorage('image/webp', 11)

      const result = await invokeTool(downloadTool(), 'call-1', {
        key: 'files/ast-123/screenshots/shot_5.0s.webp',
      })

      expect(runnerService.downloadToRunner).toHaveBeenCalledWith('runner-1', {
        url: 'https://signed.example/file',
        destPath: path.posix.join('.pi', 'shot_5.0s.webp'),
      })
      expect(textOf(result)).toBe(
        `Downloaded storage key "files/ast-123/screenshots/shot_5.0s.webp" to "${path.posix.join('.pi', 'shot_5.0s.webp')}". Remember to delete this temporary file when finished.`,
      )
      expect(result.details).toMatchObject({
        key: 'files/ast-123/screenshots/shot_5.0s.webp',
        assetId: 'ast-123',
        size: 11,
      })
    })

    it('resolves original upload keys through the storage key', async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.storageKey.findFirst).mockResolvedValue({
        id: 'sk-1',
        key: 'files/upload-ulid-456/photo.png',
        assets: [{ id: 'asset-photo-1' }],
      } as unknown as StorageKey & { assets: Asset[] })
      vi.mocked(s3Service.headObject).mockResolvedValue({
        size: 8,
        contentType: 'application/octet-stream',
      } as Head)
      vi.mocked(runnerService.downloadToRunner).mockResolvedValue({
        type: 'file.download.result',
        executionId: 'exec-dl-2',
        ok: true,
        size: 8,
        mimeType: 'image/png',
      })

      const result = await invokeTool(downloadTool(), 'call-1', {
        key: 'files/upload-ulid-456/photo.png',
      })

      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'asset-photo-1' }),
      )
      expect(result.details).toMatchObject({ assetId: 'asset-photo-1', contentType: 'image/png' })
    })
  })
})
