import { newTablePrinter, withTruncate } from '@shumai/tableprinter'
import type { AssetInfo } from '@shumai/dtos'
import { getClient } from '../client'

function formatSize(bytes: number): string {
  if (bytes === 0) return '-'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export async function ls(parentId: string) {
  if (!parentId) {
    console.error('Error: Parent ID (-p/--parent) is required.')
    process.exit(1)
  }

  const client = getClient()

  try {
    const [foldersRes, filesRes] = await Promise.all([
      client.api.folders[':folderId'].children.$get({
        param: { folderId: parentId },
        query: { assetType: 'folder', first: '200' },
      }),
      client.api.folders[':folderId'].children.$get({
        param: { folderId: parentId },
        query: { assetType: 'file', first: '200' },
      }),
    ])

    if (!foldersRes.ok) {
      const err = (await foldersRes.json().catch(() => ({ error: 'Unknown error' }))) as {
        error?: string
      }
      console.error(`Error: ${err.error || 'Failed to list folders'}`)
      process.exit(1)
    }

    if (!filesRes.ok) {
      const err = (await filesRes.json().catch(() => ({ error: 'Unknown error' }))) as {
        error?: string
      }
      console.error(`Error: ${err.error || 'Failed to list files'}`)
      process.exit(1)
    }

    const foldersData = await foldersRes.json()
    const filesData = await filesRes.json()

    const folders = foldersData.data || []
    const files = filesData.data || []

    const items = [
      ...folders.map((f: AssetInfo) => ({ ...f, typeDisplay: 'folder' as const })),
      ...files.map((f: AssetInfo) => ({ ...f, typeDisplay: 'file' as const })),
    ]

    if (items.length === 0) {
      console.log('No assets found in this folder.')
      return
    }

    const isTty = process.stdout.isTTY
    const maxWidth = process.stdout.columns || 80
    const tp = newTablePrinter(process.stdout, isTty, maxWidth)

    tp.addHeader(['ID', 'Name', 'Type', 'Size'])

    for (const item of items) {
      tp.addField(item.id || '', withTruncate(null))
      tp.addField(item.name || '')
      tp.addField(item.typeDisplay, withTruncate(null))
      tp.addField(
        item.typeDisplay === 'folder' ? '-' : formatSize(item.sizeByte || 0),
        withTruncate(null),
      )
      tp.endRow()
    }

    tp.render()
  } catch (err) {
    console.error('Error connecting to API server:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
