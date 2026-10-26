import { newTablePrinter, withTruncate, type Writer } from '@shumai/tableprinter'
import type {
  AnyOperationDefinition,
  AssetSummary,
  PageInfo,
  ProjectSummary,
} from '@shumai/operations'

export interface Output {
  out: Writer
  isTty: boolean
  columns: number
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return '-'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function renderAssets(output: { data: AssetSummary[]; pageInfo: PageInfo }, o: Output): void {
  if (output.data.length === 0) {
    o.out.write('No assets found in this folder.\n')
    return
  }
  // Folders first, as in the file browser's default listing
  const items = [...output.data].sort(
    (a, b) => Number(b.type === 'folder') - Number(a.type === 'folder'),
  )
  const tp = newTablePrinter(o.out, o.isTty, o.columns)
  tp.addHeader(['ID', 'Name', 'Type', 'Size'])
  for (const item of items) {
    const isFolder = item.type === 'folder'
    tp.addField(item.id, withTruncate(null))
    tp.addField(item.name)
    tp.addField(isFolder ? 'folder' : 'file', withTruncate(null))
    tp.addField(isFolder ? '-' : formatSize(item.size), withTruncate(null))
    tp.endRow()
  }
  tp.render()
  // Piped output is TSV for scripts (use --json for pagination metadata); keep it clean.
  if (o.isTty && output.pageInfo.hasNextPage && output.pageInfo.endCursor) {
    o.out.write(`\nMore assets available. Next page: --after ${output.pageInfo.endCursor}\n`)
  }
}

function renderProjects(output: { data: ProjectSummary[] }, o: Output): void {
  if (output.data.length === 0) {
    o.out.write('No projects found.\n')
    return
  }
  const tp = newTablePrinter(o.out, o.isTty, o.columns)
  tp.addHeader(['ID', 'Name', 'Root Folder ID'])
  for (const p of output.data) {
    tp.addField(p.id)
    tp.addField(p.name)
    tp.addField(p.rootFolderId ?? '')
    tp.endRow()
  }
  tp.render()
}

/** Table renderers for list Operations; other Operations use their `cli.format` or the fallback. */
const tableRenderers = new Map<string, (output: never, o: Output) => void>([
  ['list_assets', renderAssets],
  ['list_projects', renderProjects],
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

/** Generic rendering: `{ data: [...] }` and arrays as tables, objects as `key: value` lines. */
function renderFallback(output: unknown, o: Output): void {
  const rows = Array.isArray(output)
    ? output
    : isRecord(output) && Array.isArray(output.data)
      ? output.data
      : null
  if (rows) {
    if (rows.length === 0) {
      o.out.write('No results.\n')
      return
    }
    const keys = Object.keys(isRecord(rows[0]) ? rows[0] : { value: rows[0] })
    const tp = newTablePrinter(o.out, o.isTty, o.columns)
    tp.addHeader(keys)
    for (const row of rows) {
      for (const key of keys) tp.addField(cell(isRecord(row) ? row[key] : row))
      tp.endRow()
    }
    tp.render()
    return
  }
  if (isRecord(output)) {
    for (const [key, value] of Object.entries(output)) o.out.write(`${key}: ${cell(value)}\n`)
    return
  }
  o.out.write(`${cell(output)}\n`)
}

/** Writes an Operation's output in human-friendly form. */
export function renderOutput(definition: AnyOperationDefinition, output: unknown, o: Output): void {
  const table = tableRenderers.get(definition.name)
  if (table) {
    table(output as never, o)
    return
  }
  if (definition.cli?.format) {
    o.out.write(`${definition.cli.format(output)}\n`)
    return
  }
  renderFallback(output, o)
}
