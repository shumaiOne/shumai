import { describe, expect, it } from 'vitest'
import { isRawImage } from './raw'
import {
  STACK_PREVIEW_EXTENSIONS,
  STACK_RAW_EXTENSIONS,
  groupPhotoStacks,
  stackBaseName,
  stackExtension,
  stackRole,
  type StackCandidate,
} from './photo-stack'

const file = (id: string, name: string, parentId: string | null = 'f1'): StackCandidate => ({
  id,
  name,
  parentId,
})

describe('stack name helpers', () => {
  it('reads the last extension case-insensitively', () => {
    expect(stackExtension('DSCF1234.RAF')).toBe('raf')
    expect(stackExtension('a.b.JpG')).toBe('jpg')
    expect(stackExtension('README')).toBe('')
    expect(stackExtension('.jpg')).toBe('')
  })

  it('strips only the last extension and lowercases', () => {
    expect(stackBaseName('DSCF1234.RAF')).toBe('dscf1234')
    expect(stackBaseName('a.b.jpg')).toBe('a.b')
    expect(stackBaseName('NOEXT')).toBe('noext')
  })

  it('classifies RAW and JPEG/HEIF names, and nothing else', () => {
    expect(stackRole('x.RAF')).toBe('raw')
    expect(stackRole('x.dng')).toBe('raw')
    expect(stackRole('x.JPG')).toBe('preview')
    expect(stackRole('x.heic')).toBe('preview')
    expect(stackRole('x.png')).toBeNull()
    expect(stackRole('x.xmp')).toBeNull()
    expect(stackRole('x.mp4')).toBeNull()
  })

  it('uses the shared RAW list', () => {
    for (const ext of STACK_RAW_EXTENSIONS) expect(isRawImage(`x.${ext}`)).toBe(true)
    expect(STACK_RAW_EXTENSIONS).toContain('raf')
    expect(STACK_PREVIEW_EXTENSIONS.some((ext) => STACK_RAW_EXTENSIONS.includes(ext))).toBe(false)
  })
})

describe('groupPhotoStacks', () => {
  it('pairs a RAW with its JPEG and puts the JPEG first', () => {
    const stacks = groupPhotoStacks([file('raf', 'DSCF1234.RAF'), file('jpg', 'DSCF1234.JPG')])
    expect(stacks).toHaveLength(1)
    expect(stacks[0]!.cover.id).toBe('jpg')
    expect(stacks[0]!.members.map((m) => m.id)).toEqual(['jpg', 'raf'])
  })

  it('matches names and extensions case-insensitively', () => {
    const stacks = groupPhotoStacks([file('a', 'img_0001.cr3'), file('b', 'IMG_0001.Jpeg')])
    expect(stacks).toHaveLength(1)
    expect(stacks[0]!.members.map((m) => m.id)).toEqual(['b', 'a'])
  })

  it('keeps several JPEG/HEIF variants in one stack, JPG ahead of HEIF', () => {
    const stacks = groupPhotoStacks([
      file('raf', 'DSCF1234.RAF'),
      file('hif', 'DSCF1234.HIF'),
      file('jpg', 'DSCF1234.JPG'),
      file('heic', 'dscf1234.heic'),
    ])
    expect(stacks).toHaveLength(1)
    expect(stacks[0]!.cover.id).toBe('jpg')
    expect(stacks[0]!.members.map((m) => m.id)).toEqual(['jpg', 'heic', 'hif', 'raf'])
  })

  it('keeps several RAW files of one shot together', () => {
    const stacks = groupPhotoStacks([
      file('dng', 'A.DNG'),
      file('raf', 'A.RAF'),
      file('jpg', 'A.JPG'),
    ])
    expect(stacks[0]!.members.map((m) => m.id)).toEqual(['jpg', 'dng', 'raf'])
  })

  it('leaves an orphan RAW alone', () => {
    expect(groupPhotoStacks([file('raf', 'DSCF1234.RAF')])).toEqual([])
  })

  it('leaves an orphan JPEG alone', () => {
    expect(groupPhotoStacks([file('jpg', 'DSCF1234.JPG')])).toEqual([])
  })

  it('does not stack JPEG variants without a RAW', () => {
    expect(groupPhotoStacks([file('a', 'A.JPG'), file('b', 'A.HEIC')])).toEqual([])
  })

  it('does not pair files from different folders', () => {
    const stacks = groupPhotoStacks([
      file('raf', 'DSCF1234.RAF', 'folder-a'),
      file('jpg', 'DSCF1234.JPG', 'folder-b'),
    ])
    expect(stacks).toEqual([])
  })

  it('does not pair different base names or ignore extra dots', () => {
    expect(groupPhotoStacks([file('a', 'DSCF1234.RAF'), file('b', 'DSCF1235.JPG')])).toEqual([])
    expect(groupPhotoStacks([file('a', 'DSCF1234.RAF'), file('b', 'DSCF1234-edit.JPG')])).toEqual(
      [],
    )
    expect(groupPhotoStacks([file('a', 'A.B.RAF'), file('b', 'A.JPG')])).toEqual([])
  })

  it('ignores sidecars, videos and other files with the same base name', () => {
    const stacks = groupPhotoStacks([
      file('raf', 'A.RAF'),
      file('jpg', 'A.JPG'),
      file('xmp', 'A.RAF.xmp'),
      file('xmp2', 'A.xmp'),
      file('mov', 'A.MOV'),
      file('png', 'A.PNG'),
    ])
    expect(stacks).toHaveLength(1)
    expect(stacks[0]!.members.map((m) => m.id)).toEqual(['jpg', 'raf'])
  })

  it('ignores files without a folder and builds one stack per shot', () => {
    const stacks = groupPhotoStacks([
      file('r0', 'Z.RAF', null),
      file('j0', 'Z.JPG', null),
      file('r1', 'A.RAF'),
      file('j1', 'A.JPG'),
      file('r2', 'B.NEF'),
      file('j2', 'B.JPG'),
    ])
    expect(stacks.map((s) => s.cover.id).sort()).toEqual(['j1', 'j2'])
  })
})
