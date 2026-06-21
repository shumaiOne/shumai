import { getClient } from '../client'

export async function projectLs() {
  const client = getClient()
  try {
    const res = await client.api.projects.$get({
      query: { first: '200' },
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
      console.error(`Error: ${err.error || 'Failed to list projects'}`)
      process.exit(1)
    }

    const { data: projects } = await res.json()

    if (projects.length === 0) {
      console.log('No projects found.')
      return
    }

    const idWidth = 26
    const nameWidth = 30
    const rootWidth = 26

    console.log(
      'ID'.padEnd(idWidth) +
        ' | ' +
        'Name'.padEnd(nameWidth) +
        ' | ' +
        'Root Folder ID'.padEnd(rootWidth),
    )
    console.log('-'.repeat(idWidth + nameWidth + rootWidth + 6))

    for (const p of projects) {
      const id = p.id || ''
      const name = p.name || ''
      const rootFolder = p.rootFolder || ''

      console.log(
        id.padEnd(idWidth) + ' | ' + name.padEnd(nameWidth) + ' | ' + rootFolder.padEnd(rootWidth),
      )
    }
  } catch (err) {
    console.error('Error connecting to API server:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
