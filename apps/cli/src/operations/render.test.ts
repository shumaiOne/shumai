import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { defineOperation, listAssets, renameAsset } from '@shumai/operations'
import { formatSize, renderOutput, type Output } from './render'

function capture(isTty = true): Output & { text: () => string } {
  let text = ''
  return { out: { write: (s) => void (text += s) }, isTty, columns: 120, text: () => text }
}

const page = {
  data: [{ id: 'd1', name: 'Renders', type: 'folder', size: 0, projectId: 'p' }],
  pageInfo: { hasNextPage: true, endCursor: 'CUR' },
  total: 2,
}

describe('renderOutput', () => {
  it('shows the next-page cursor only on a terminal', () => {
    const tty = capture(true)
    renderOutput(listAssets, page, tty)
    expect(tty.text()).toContain('Next page: --after CUR')

    const piped = capture(false)
    renderOutput(listAssets, page, piped)
    expect(piped.text()).toBe('d1\tRenders\tfolder\t-\n')
  })

  it('uses the definition formatter when there is no table renderer', () => {
    const o = capture()
    renderOutput(renameAsset, { id: 'a1', name: 'new', type: 'file', size: 1, projectId: null }, o)
    expect(o.text()).toBe('Renamed asset a1 to "new"\n')
  })

  it('falls back to tables for lists and key/value lines for objects', () => {
    const generic = defineOperation({
      name: 'generic_thing',
      title: 'Generic',
      description: 'Generic output.',
      input: z.object({}),
      output: z.unknown(),
      surfaces: ['agent'],
      annotations: { readOnly: true, destructive: false },
    })

    const list = capture(false)
    renderOutput(generic, { data: [{ id: 'x', tags: ['a'] }] }, list)
    expect(list.text()).toBe('x\t["a"]\n')

    const empty = capture()
    renderOutput(generic, [], empty)
    expect(empty.text()).toBe('No results.\n')

    const object = capture()
    renderOutput(generic, { id: 'x', count: 2, note: null }, object)
    expect(object.text()).toBe('id: x\ncount: 2\nnote: \n')
  })
})

describe('formatSize', () => {
  it.each([
    [0, '-'],
    [512, '512 B'],
    [1536, '1.5 KB'],
    [5 * 1024 * 1024, '5 MB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatSize(bytes)).toBe(expected)
  })
})
