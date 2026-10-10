import { describe, expect, it } from 'vitest'
import { expandStackIds, isStacked, stackDeleteIds, stackMemberLabel } from './stack-utils'

const jpg = {
  id: 'jpg',
  stack: {
    count: 2,
    members: [
      { id: 'jpg', name: 'DSCF5543.JPG' },
      { id: 'raf', name: 'DSCF5543.RAF' },
    ],
  },
}

describe('expandStackIds', () => {
  it('keeps plain items as they are', () => {
    expect(expandStackIds([{ id: 'a' }, { id: 'b' }])).toEqual(['a', 'b'])
  })

  it('expands a stacked card to every file of its shot, once each', () => {
    expect(expandStackIds([jpg, { id: 'other' }])).toEqual(['jpg', 'raf', 'other'])
  })
})

describe('stackDeleteIds', () => {
  it('deletes only the ticked files of a stack, and plain items as they are', () => {
    expect(stackDeleteIds([jpg, { id: 'other' }], new Set(['raf']))).toEqual(['raf', 'other'])
  })

  it('deletes both files when both are ticked', () => {
    expect(stackDeleteIds([jpg], new Set(['jpg', 'raf']))).toEqual(['jpg', 'raf'])
  })

  it('deletes nothing of a stack when every file is unticked', () => {
    expect(stackDeleteIds([jpg], new Set())).toEqual([])
  })

  it('treats a one-file stack as a plain item', () => {
    const single = { id: 'jpg2', stack: { count: 1, members: [{ id: 'jpg2', name: 'A.JPG' }] } }
    expect(isStacked(single)).toBe(false)
    expect(stackDeleteIds([single], new Set())).toEqual(['jpg2'])
  })
})

describe('stackMemberLabel', () => {
  it('shows the upper-case extension', () => {
    expect(stackMemberLabel('DSCF5543.jpg')).toBe('JPG')
    expect(stackMemberLabel('dscf5543.raf')).toBe('RAF')
    expect(stackMemberLabel('noext')).toBe('NOEXT')
  })
})
