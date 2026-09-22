import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import {
  formatChangelogDate,
  generateMdxChangelog,
  parseChangelogReleases,
  syncDocsChangelog,
} from './generate-docs-changelog'

describe('generate-docs-changelog', () => {
  describe('formatChangelogDate', () => {
    it('formats YYYY-MM-DD into Month D, YYYY', () => {
      expect(formatChangelogDate('2026-09-19')).toBe('September 19, 2026')
      expect(formatChangelogDate('2026-01-05')).toBe('January 5, 2026')
      expect(formatChangelogDate('2025-12-31')).toBe('December 31, 2025')
    })

    it('returns empty string for undefined or empty date', () => {
      expect(formatChangelogDate(undefined)).toBe('')
      expect(formatChangelogDate('')).toBe('')
    })

    it('returns original string if format is not YYYY-MM-DD', () => {
      expect(formatChangelogDate('September 2026')).toBe('September 2026')
    })
  })

  describe('parseChangelogReleases', () => {
    const sampleChangelog = `# Changelog

All notable changes documented here.

## [Unreleased]

### Added
- In progress feature

## [0.4.7] - 2026-09-19

### Added
- Feature 1
- Feature 2

### Fixed
- Bug 1

## [0.4.6] - 2026-09-17

### Added
- Feature 3

## [0.0.1]

### Added
- Initial release
`

    it('parses releases and skips [Unreleased]', () => {
      const releases = parseChangelogReleases(sampleChangelog)
      expect(releases).toHaveLength(3)

      expect(releases[0]).toEqual({
        version: '0.4.7',
        date: '2026-09-19',
        content: '### Added\n- Feature 1\n- Feature 2\n\n### Fixed\n- Bug 1',
      })

      expect(releases[1]).toEqual({
        version: '0.4.6',
        date: '2026-09-17',
        content: '### Added\n- Feature 3',
      })

      expect(releases[2]).toEqual({
        version: '0.0.1',
        date: undefined,
        content: '### Added\n- Initial release',
      })
    })

    it('returns empty array for empty changelog', () => {
      expect(parseChangelogReleases('')).toEqual([])
    })
  })

  describe('generateMdxChangelog', () => {
    it('generates valid Mintlify MDX with <Update> tags', () => {
      const releases = [
        {
          version: '0.4.7',
          date: '2026-09-19',
          content: '### Added\n- Feature A',
        },
        {
          version: '0.4.6',
          content: '### Fixed\n- Bug B',
        },
      ]

      const mdx = generateMdxChangelog(releases)

      expect(mdx).toContain('title: "Changelog"')
      expect(mdx).toContain(
        'description: "Recent updates, new features, and improvements in Shumai"',
      )
      expect(mdx).toContain('<Update label="v0.4.7" description="September 19, 2026">')
      expect(mdx).toContain('### Added\n- Feature A')
      expect(mdx).toContain('<Update label="v0.4.6">')
      expect(mdx).toContain('### Fixed\n- Bug B')
      expect(mdx).toContain('</Update>')
    })
  })

  describe('syncDocsChangelog', () => {
    const tempDir = join(tmpdir(), `test-sync-docs-changelog-${Date.now()}`)
    const changelogPath = join(tempDir, 'CHANGELOG.md')
    const outputPath = join(tempDir, 'changelog.mdx')

    it('generates MDX and supports check mode', () => {
      const sample = `## [0.1.0] - 2026-01-01\n\n- First version`
      // Create temp dir
      mkdirSync(tempDir, { recursive: true })
      writeFileSync(changelogPath, sample, 'utf-8')

      // Check before generating should return false
      expect(syncDocsChangelog({ changelogPath, outputPath, check: true })).toBe(false)

      // Sync should generate output
      syncDocsChangelog({ changelogPath, outputPath })
      expect(existsSync(outputPath)).toBe(true)

      const content = readFileSync(outputPath, 'utf-8')
      expect(content).toContain('<Update label="v0.1.0" description="January 1, 2026">')

      // Check after generating should return true
      expect(syncDocsChangelog({ changelogPath, outputPath, check: true })).toBe(true)

      // Clean up
      rmSync(tempDir, { recursive: true, force: true })
    })
  })

  describe('Integration with repository CHANGELOG.md', () => {
    it('successfully parses the actual repository CHANGELOG.md', () => {
      const changelogPath = resolve(__dirname, '../CHANGELOG.md')
      const content = readFileSync(changelogPath, 'utf-8')
      const releases = parseChangelogReleases(content)

      expect(releases.length).toBeGreaterThan(40)
      expect(releases[0].version).toBe('0.4.7')
      expect(releases[0].date).toBe('2026-09-19')
      expect(releases[0].content).toContain('Introduce Keep a Changelog support')

      const mdx = generateMdxChangelog(releases)
      expect(mdx).toContain('<Update label="v0.4.7" description="September 19, 2026">')
      expect(mdx).toContain('<Update label="v0.0.1" description="June 12, 2026">')
    })
  })
})
