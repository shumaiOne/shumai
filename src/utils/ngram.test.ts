import { describe, it, expect } from 'vitest'
import { generateNgrams } from './ngram'

describe('generateNgrams', () => {
  it('should generate 1-3 grams for simple English words', () => {
    const tokens = generateNgrams('apple')
    const expected = ['a', 'p', 'l', 'e', 'ap', 'pp', 'pl', 'le', 'app', 'ppl', 'ple']
    expect(tokens.sort()).toEqual(expected.sort())
  })

  it('should handle multiple words and separators as single stream', () => {
    const tokens = generateNgrams('foo-bar')
    // f, o, o, -, b, a, r
    // fo, oo, o-, -b, ba, ar
    // foo, oo-, o-b, -ba, bar
    const expected = [
      'f',
      'o',
      '-',
      'b',
      'a',
      'r',
      'fo',
      'oo',
      'o-',
      '-b',
      'ba',
      'ar',
      'foo',
      'oo-',
      'o-b',
      '-ba',
      'bar',
    ]
    expect(tokens.sort()).toEqual(expected.sort())
  })

  it('should handle CJK characters correctly', () => {
    const tokens = generateNgrams('北京大学')
    // 北, 京, 大, 学
    // 北京, 京大, 大学
    // 北京大, 京大学
    const expected = ['北', '京', '大', '学', '北京', '京大', '大学', '北京大', '京大学']
    expect(tokens.sort()).toEqual(expected.sort())
  })

  it('should be case-insensitive', () => {
    const tokens = generateNgrams('Apple')
    expect(tokens).toEqual(generateNgrams('apple'))
  })

  it('should NOT ignore non-alphanumeric characters', () => {
    const tokens = generateNgrams('apple!!!')
    expect(tokens).toContain('e!!')
    expect(tokens).toContain('!!!')
  })

  it('should return empty array for empty input', () => {
    expect(generateNgrams('')).toEqual([])
  })
})
