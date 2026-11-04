import { describe, it, expect } from 'vitest'
import type { AssetInfo } from '@shumai/dtos'
import {
  isImageItem,
  pickClipboardTranscode,
  getCopyOptions,
  formatCopyText,
  getItemInAppUrl,
} from './copy-options'

describe('copy-options', () => {
  const dummyFile: AssetInfo = {
    id: 'file-1',
    name: 'document.pdf',
    type: 'file',
    status: 'processed',
    sizeByte: 1024 * 1024,
    fileCount: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  }

  const dummyImage: AssetInfo = {
    id: 'image-1',
    name: 'photo.jpg',
    type: 'file',
    proxyType: 'image',
    status: 'processed',
    sizeByte: 2 * 1024 * 1024,
    fileCount: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    media: {
      imageTranscodes: [
        { id: 't1', key: 'k1', url: 'https://cdn/1080.webp', width: 1920, height: 1080, size: 200 },
        { id: 't2', key: 'k2', url: 'https://cdn/3000.webp', width: 3000, height: 2000, size: 500 },
      ],
    },
  }

  const dummyFolder: AssetInfo = {
    id: 'folder-1',
    name: 'Assets',
    type: 'folder',
    status: 'processed',
    sizeByte: 0,
    fileCount: 5,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  }

  const dummyVersionStack: AssetInfo = {
    id: 'stack-1',
    name: 'render.png',
    type: 'version_stack',
    proxyType: 'image',
    status: 'processed',
    sizeByte: 5 * 1024 * 1024,
    fileCount: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    versionStack: {
      id: 'stack-1',
      versions: [
        { version: 2, current: true, id: 'child-2' },
        { version: 1, current: false, id: 'child-1' },
      ],
    },
    media: {
      imageTranscodes: [
        {
          id: 't1',
          key: 'k1',
          url: 'https://cdn/render-1080.webp',
          width: 1920,
          height: 1080,
          size: 200,
        },
      ],
    },
  }

  describe('isImageItem', () => {
    it('detects images by proxyType and extension', () => {
      expect(isImageItem(dummyImage)).toBe(true)
      expect(isImageItem({ ...dummyFile, name: 'graphic.png' })).toBe(true)
      expect(isImageItem(dummyVersionStack)).toBe(true)
      expect(isImageItem(dummyFile)).toBe(false)
      expect(isImageItem(dummyFolder)).toBe(false)
    })
  })

  describe('pickClipboardTranscode', () => {
    it('picks largest transcode <= 2048px on long edge', () => {
      const transcode = pickClipboardTranscode(dummyImage.media?.imageTranscodes)
      expect(transcode?.url).toBe('https://cdn/1080.webp')
    })

    it('falls back to smallest available if all > 2048px', () => {
      const transcode = pickClipboardTranscode([
        { url: 'https://cdn/4000.webp', width: 4000, height: 3000 },
        { url: 'https://cdn/2500.webp', width: 2500, height: 2000 },
      ])
      expect(transcode?.url).toBe('https://cdn/2500.webp')
    })

    it('picks transcode by key even without presigned url', () => {
      const transcode = pickClipboardTranscode([
        { key: 'files/asset-768p.webp', width: 768, height: 1376 },
      ])
      expect(transcode?.key).toBe('files/asset-768p.webp')
    })

    it('returns null if empty or missing', () => {
      expect(pickClipboardTranscode([])).toBeNull()
      expect(pickClipboardTranscode(undefined)).toBeNull()
    })
  })

  describe('getCopyOptions', () => {
    it('returns options for single image file with team owner', () => {
      const options = getCopyOptions([dummyImage], { isTeamOwner: true })
      const kinds = options.map((o) => o.kind)
      expect(kinds).toEqual([
        'image',
        'name',
        'link',
        'download-link',
        'id',
        'markdown',
        'storage-path',
      ])
      expect(options.find((o) => o.kind === 'image')?.disabled).toBe(false)
      expect(options.find((o) => o.kind === 'download-link')?.disabled).toBe(false)
    })

    it('enables image option for processed image file with only transcode key and no url', () => {
      const imageWithoutUrls: AssetInfo = {
        ...dummyImage,
        media: {
          imageTranscodes: [
            {
              id: 't1',
              key: 'files/asset-768p.webp',
              url: '',
              width: 768,
              height: 1376,
              size: 200,
            },
          ],
        },
      }
      const options = getCopyOptions([imageWithoutUrls])
      expect(options.find((o) => o.kind === 'image')?.disabled).toBe(false)
    })

    it('hides image option for non-image files', () => {
      const options = getCopyOptions([dummyFile], { isTeamOwner: true })
      const kinds = options.map((o) => o.kind)
      expect(kinds).not.toContain('image')
      expect(kinds).toContain('download-link')
      expect(kinds).toContain('storage-path')
    })

    it('hides download-link and storage-path for single folder', () => {
      const options = getCopyOptions([dummyFolder], { isTeamOwner: true })
      const kinds = options.map((o) => o.kind)
      expect(kinds).toEqual(['name', 'link', 'id', 'markdown'])
      expect(kinds).not.toContain('download-link')
      expect(kinds).not.toContain('storage-path')
    })

    it('handles multi-select with only files', () => {
      const options = getCopyOptions([dummyFile, dummyImage], { isTeamOwner: true })
      const kinds = options.map((o) => o.kind)
      expect(kinds).toEqual([
        'name',
        'link',
        'download-link',
        'id',
        'markdown',
        'tsv',
        'storage-path',
      ])
      expect(kinds).not.toContain('image')
    })

    it('hides download-link and storage-path when all items in multi-select are folders', () => {
      const folder2 = { ...dummyFolder, id: 'folder-2', name: 'Folder 2' }
      const options = getCopyOptions([dummyFolder, folder2], { isTeamOwner: true })
      const kinds = options.map((o) => o.kind)
      expect(kinds).toEqual(['name', 'link', 'id', 'markdown', 'tsv'])
      expect(kinds).not.toContain('download-link')
      expect(kinds).not.toContain('storage-path')
    })

    it('disables download-link if all files in selection are archived', () => {
      const archivedFile: AssetInfo = { ...dummyFile, status: 'archived' }
      const options = getCopyOptions([archivedFile])
      expect(options.find((o) => o.kind === 'download-link')?.disabled).toBe(true)
    })

    it('hides id and storage-path in public share mode', () => {
      const options = getCopyOptions([dummyFile], { isPublicShare: true, isTeamOwner: true })
      const kinds = options.map((o) => o.kind)
      expect(kinds).not.toContain('id')
      expect(kinds).not.toContain('storage-path')
    })
  })

  describe('getItemInAppUrl', () => {
    it('formats URL for file and folder', () => {
      expect(getItemInAppUrl(dummyFile, 'https://shumai.app', 'proj-1')).toBe(
        'https://shumai.app/projects/proj-1/files/file-1',
      )
      expect(getItemInAppUrl(dummyFolder, 'https://shumai.app', 'proj-1')).toBe(
        'https://shumai.app/projects/proj-1/folders/folder-1',
      )
      expect(getItemInAppUrl(dummyVersionStack, 'https://shumai.app', 'proj-1')).toBe(
        'https://shumai.app/projects/proj-1/files/stack-1',
      )
    })
  })

  describe('formatCopyText', () => {
    const ctx = { origin: 'https://shumai.app', projectId: 'proj-1' }

    it('formats name for single and multi-select', () => {
      expect(formatCopyText('name', [dummyFile], ctx)).toBe('document.pdf')
      expect(formatCopyText('name', [dummyFile, dummyFolder], ctx)).toBe('document.pdf\nAssets')
    })

    it('formats link for single and multi-select', () => {
      expect(formatCopyText('link', [dummyFile], ctx)).toBe(
        'https://shumai.app/projects/proj-1/files/file-1',
      )
      expect(formatCopyText('link', [dummyFile, dummyFolder], ctx)).toBe(
        'https://shumai.app/projects/proj-1/files/file-1\nhttps://shumai.app/projects/proj-1/folders/folder-1',
      )
    })

    it('formats id for single and multi-select', () => {
      expect(formatCopyText('id', [dummyFile], ctx)).toBe('file-1')
      expect(formatCopyText('id', [dummyVersionStack], ctx)).toBe('stack-1')
      expect(formatCopyText('id', [dummyFile, dummyFolder], ctx)).toBe('file-1\nfolder-1')
    })

    it('formats markdown link for single and bullet list for multi-select', () => {
      expect(formatCopyText('markdown', [dummyFile], ctx)).toBe(
        '[document.pdf](https://shumai.app/projects/proj-1/files/file-1)',
      )
      expect(formatCopyText('markdown', [dummyFile, dummyFolder], ctx)).toBe(
        '- [document.pdf](https://shumai.app/projects/proj-1/files/file-1)\n- [Assets](https://shumai.app/projects/proj-1/folders/folder-1)',
      )
    })

    it('formats TSV table with header and sizes for multi-select', () => {
      const tsv = formatCopyText('tsv', [dummyFile, dummyFolder], ctx)
      const lines = tsv.split('\n')
      expect(lines[0]).toBe('Name\tType\tSize\tLink\tID')
      expect(lines[1]).toContain(
        'document.pdf\tfile\t1.05 MB\thttps://shumai.app/projects/proj-1/files/file-1\tfile-1',
      )
      expect(lines[2]).toContain(
        'Assets\tfolder\t—\thttps://shumai.app/projects/proj-1/folders/folder-1\tfolder-1',
      )
    })
  })
})
