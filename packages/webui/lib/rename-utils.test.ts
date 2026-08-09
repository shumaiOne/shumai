import { describe, expect, it, vi } from 'vitest'
import { getFileNameBaseRange, selectFileNameWithoutExtension } from './rename-utils'

describe('rename-utils', () => {
  describe('getFileNameBaseRange', () => {
    it('returns range excluding file extension for standard filenames', () => {
      expect(getFileNameBaseRange('test.png')).toEqual([0, 4])
      expect(getFileNameBaseRange('document.pdf')).toEqual([0, 8])
      expect(getFileNameBaseRange('archive.tar.gz')).toEqual([0, 11])
    })

    it('returns full length range for filenames without extension', () => {
      expect(getFileNameBaseRange('README')).toEqual([0, 6])
      expect(getFileNameBaseRange('my-folder')).toEqual([0, 9])
    })

    it('returns full length range for dotfiles starting with dot', () => {
      expect(getFileNameBaseRange('.gitignore')).toEqual([0, 10])
      expect(getFileNameBaseRange('.env')).toEqual([0, 4])
    })

    it('returns range excluding trailing dot for filenames ending with dot', () => {
      expect(getFileNameBaseRange('file.')).toEqual([0, 4])
    })

    it('returns [0, 0] for empty string', () => {
      expect(getFileNameBaseRange('')).toEqual([0, 0])
    })
  })

  describe('selectFileNameWithoutExtension', () => {
    it('calls focus and setSelectionRange on input element', () => {
      const input = {
        focus: vi.fn(),
        value: 'image.png',
        setSelectionRange: vi.fn(),
        select: vi.fn(),
      } as unknown as HTMLInputElement

      selectFileNameWithoutExtension(input)

      expect(input.focus).toHaveBeenCalled()
      expect(input.setSelectionRange).toHaveBeenCalledWith(0, 5)
      expect(input.select).not.toHaveBeenCalled()
    })

    it('falls back to select() if setSelectionRange is not a function', () => {
      const input = {
        focus: vi.fn(),
        value: 'image.png',
        setSelectionRange: undefined,
        select: vi.fn(),
      } as unknown as HTMLInputElement

      selectFileNameWithoutExtension(input)

      expect(input.focus).toHaveBeenCalled()
      expect(input.select).toHaveBeenCalled()
    })
  })
})
