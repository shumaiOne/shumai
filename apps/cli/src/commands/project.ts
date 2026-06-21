import { newTablePrinter } from '@shumai/tableprinter'
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

    const isTty = process.stdout.isTTY
    const maxWidth = process.stdout.columns || 80
    const tp = newTablePrinter(process.stdout, isTty, maxWidth)

    tp.addHeader(['ID', 'Name', 'Root Folder ID'])

    for (const p of projects) {
      tp.addField(p.id || '')
      tp.addField(p.name || '')
      tp.addField(p.rootFolder || '')
      tp.endRow()
    }

    tp.render()
  } catch (err) {
    console.error('Error connecting to API server:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
