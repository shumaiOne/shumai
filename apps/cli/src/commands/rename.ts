import { getClient } from '../client'

export async function rename(assetId: string, newName: string) {
  if (!assetId) {
    console.error('Error: Asset ID is required. Usage: shumai-cli rename <assetId> <newName>')
    process.exit(1)
  }
  if (!newName) {
    console.error('Error: New name is required. Usage: shumai-cli rename <assetId> <newName>')
    process.exit(1)
  }

  const client = getClient()

  try {
    // Determine whether asset is a folder or a file
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

    const updateRes = isFolder
      ? await client.api.folders[':folderId'].$put({
          param: { folderId: assetId },
          json: { name: newName },
        })
      : await client.api.files[':fileId'].$put({
          param: { fileId: assetId },
          json: { name: newName },
        })

    if (!updateRes.ok) {
      const err = (await updateRes.json().catch(() => ({ error: 'Failed to rename asset' }))) as {
        error?: string
      }
      console.error(`Error: ${err.error || 'Failed to rename asset'}`)
      process.exit(1)
    }

    console.log(`Renamed asset ${assetId} to "${newName}"`)
  } catch (err) {
    console.error('Error connecting to API server:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
