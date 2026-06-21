import { getClient } from '../client'

export async function mkdir(name: string, parentId: string) {
  if (!name) {
    console.error('Error: Folder name is required.')
    process.exit(1)
  }
  if (!parentId) {
    console.error('Error: Parent ID (-p/--parent) is required.')
    process.exit(1)
  }

  const client = getClient()

  try {
    const res = await client.api.folders.$post({
      json: { name, parentId },
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
      console.error(`Error: ${err.error || 'Failed to create folder'}`)
      process.exit(1)
    }

    const created = await res.json()
    console.log(`Created folder with ID: ${created.id}`)
  } catch (err) {
    console.error('Error connecting to API server:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
