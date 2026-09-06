import { getClient } from '../client'

export async function deleteAsset(assetIds: string[], allowDelete: boolean) {
  if (!allowDelete) {
    console.error('Error: Deleting an asset requires the --allow-delete flag.')
    process.exit(1)
  }

  if (!assetIds || assetIds.length === 0) {
    console.error('Error: Asset ID is required. Usage: shumai-cli delete <assetId> --allow-delete')
    process.exit(1)
  }

  if (assetIds.length > 1) {
    console.error('Error: Can only delete one asset at a time.')
    process.exit(1)
  }

  const assetId = assetIds[0]
  const client = getClient()

  try {
    // Inspect asset to determine whether it is a folder or file
    const getRes = await client.api.folders[':folderId'].$get({
      param: { folderId: assetId },
    })

    if (!getRes.ok) {
      const err = (await getRes.json().catch(() => ({ error: 'Asset not found' }))) as {
        error?: string
      }
      console.error(`Error: ${err.error || 'Asset not found'}`)
      process.exit(1)
    }

    const asset = await getRes.json()
    const isFolder = asset.type === 'folder'

    const res = isFolder
      ? await client.api.folders.$delete({
          json: { ids: [assetId] },
        })
      : await client.api.files.$delete({
          json: { ids: [assetId] },
        })

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: 'Failed to delete asset' }))) as {
        error?: string
      }
      console.error(`Error: ${err.error || 'Failed to delete asset'}`)
      process.exit(1)
    }

    console.log(`Deleted asset ${assetId}`)
  } catch (err) {
    console.error('Error connecting to API server:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
