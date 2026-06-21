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

    const idWidth = 26
    const nameWidth = 35
    const typeWidth = 10
    const sizeWidth = 12

    console.log(
      'ID'.padEnd(idWidth) +
        ' | ' +
        'Name'.padEnd(nameWidth) +
        ' | ' +
        'Type'.padEnd(typeWidth) +
        ' | ' +
        'Size'.padEnd(sizeWidth),
    )
    console.log('-'.repeat(idWidth + nameWidth + typeWidth + sizeWidth + 9))

    for (const item of items) {
      const id = item.id || ''
      const name = item.name || ''
      const type = item.typeDisplay
      const size = item.typeDisplay === 'folder' ? '-' : formatSize(item.sizeByte || 0)

      console.log(
        id.padEnd(idWidth) +
          ' | ' +
          name.padEnd(nameWidth) +
          ' | ' +
          type.padEnd(typeWidth) +
          ' | ' +
          size.padEnd(sizeWidth),
      )
    }
  } catch (err) {
    console.error('Error connecting to API server:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
