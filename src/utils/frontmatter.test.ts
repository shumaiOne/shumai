import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from './frontmatter'

describe('frontmatter parser', () => {
  it('should parse content with frontmatter', () => {
    const content = `---
name: test-skill
description: simple skill
---
# Body
Hello world`
    const { frontmatter, body } = parseFrontmatter<{ name: string; description: string }>(content)
    expect(frontmatter.name).toBe('test-skill')
    expect(frontmatter.description).toBe('simple skill')
    expect(body).toBe('# Body\nHello world')
  })

  it('should handle content without frontmatter', () => {
    const content = '# No Frontmatter\nJust text'
    const { frontmatter, body } = parseFrontmatter(content)
    expect(frontmatter).toEqual({})
    expect(body).toBe(content)
  })

  it('should handle invalid frontmatter delimiters', () => {
    const content = `---
no-end-delimiter
# Body`
    const { frontmatter, body } = parseFrontmatter(content)
    expect(frontmatter).toEqual({})
    expect(body).toBe(content)
  })

  it('should normalize newlines', () => {
    const content = '---\r\nname: win\r\n---\r\n# Body'
    const { frontmatter, body } = parseFrontmatter<{ name: string }>(content)
    expect(frontmatter.name).toBe('win')
    expect(body).toBe('# Body')
  })
})
