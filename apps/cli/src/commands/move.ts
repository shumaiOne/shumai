import { getClient } from '../client'

export async function move(assetIds: string[], parentId: string) {
  if (!assetIds || assetIds.length === 0) {
    console.error(
      'Error: At least one asset ID is required. Usage: shumai-cli move <assetId...> -p <parentId>',
    )
    process.exit(1)
  }
  if (!parentId) {
    console.error('Error: Option -p/--parent <parentId> is required.')
    process.exit(1)
  }

  const client = getClient()

  try {
    // Fetch destination folder to get its projectId
    const parentRes = await client.api.folders[':folderId'].$get({
      param: { folderId: parentId },
    })

    if (!parentRes.ok) {
      const err = (await parentRes.json().catch(() => ({ error: 'Parent folder not found' }))) as {
        error?: string
      }
      console.error(`Error: ${err.error || 'Parent folder not found'}`)
      process.exit(1)
    }

    const parentInfo = await parentRes.json()
    const projectId = parentInfo.projectId
    if (!projectId) {
      console.error('Error: Destination parent folder is not associated with a project.')
      process.exit(1)
    }

    const res = await client.api.projects[':projectId'].reparent.$post({
      param: { projectId },
      json: {
        assetIds,
        newParentId: parentId,
      },
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: 'Failed to move assets' }))) as {
        error?: string
      }
      console.error(`Error: ${err.error || 'Failed to move assets'}`)
      process.exit(1)
    }

    console.log(`Moved ${assetIds.length} asset(s) to parent ${parentId}`)
  } catch (err) {
    console.error('Error connecting to API server:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
