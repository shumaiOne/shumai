import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractChangelog } from './extract-changelog'

describe('extractChangelog', () => {
  const sampleChangelog = `# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Some unreleased feature

## [1.2.0] - 2026-09-18

### Added
- New feature A
- New feature B

### Fixed
- Fixed bug 1

## [1.1.0] - 2026-09-01

### Fixed
- Fixed bug 2

## [1.0.0]

### Added
- Initial release
`

  it('extracts notes for version with date header', () => {
    const notes = extractChangelog(sampleChangelog, '1.2.0')
    expect(notes).toBe(`### Added\n- New feature A\n- New feature B\n\n### Fixed\n- Fixed bug 1`)
  })

  it('extracts notes when version is prefixed with "v"', () => {
    const notes = extractChangelog(sampleChangelog, 'v1.2.0')
    expect(notes).toBe(`### Added\n- New feature A\n- New feature B\n\n### Fixed\n- Fixed bug 1`)
  })

  it('extracts notes when version header has no date', () => {
    const notes = extractChangelog(sampleChangelog, '1.0.0')
    expect(notes).toBe(`### Added\n- Initial release`)
  })

  it('extracts notes for the last release at the end of the file', () => {
    const notes = extractChangelog(sampleChangelog, 'v1.0.0')
    expect(notes).toBe(`### Added\n- Initial release`)
  })

  it('extracts notes for middle versions correctly', () => {
    const notes = extractChangelog(sampleChangelog, '1.1.0')
    expect(notes).toBe(`### Fixed\n- Fixed bug 2`)
  })

  it('extracts notes for Unreleased', () => {
    const notes = extractChangelog(sampleChangelog, 'Unreleased')
    expect(notes).toBe(`### Added\n- Some unreleased feature`)
  })

  it('returns null if the version is not found', () => {
    const notes = extractChangelog(sampleChangelog, '9.9.9')
    expect(notes).toBeNull()
  })

  it('returns null for empty or whitespace version', () => {
    expect(extractChangelog(sampleChangelog, '')).toBeNull()
    expect(extractChangelog(sampleChangelog, '   ')).toBeNull()
    expect(extractChangelog(sampleChangelog, 'v')).toBeNull()
  })

  it('returns null for empty content', () => {
    expect(extractChangelog('', '1.0.0')).toBeNull()
  })

  it('handles regex special characters safely in version', () => {
    const weirdChangelog = `## [1.0.0-beta.1] - 2026-01-01\n\n- Beta note\n\n## [1.0.0]`
    const notes = extractChangelog(weirdChangelog, '1.0.0-beta.1')
    expect(notes).toBe('- Beta note')
  })

  it('successfully extracts real releases from repository CHANGELOG.md', () => {
    const realChangelog = readFileSync(resolve(__dirname, '../CHANGELOG.md'), 'utf-8')

    const v046 = extractChangelog(realChangelog, 'v0.4.6')
    expect(v046).not.toBeNull()
    expect(v046).toContain('### Added')
    expect(v046).toContain('Introduce Adobe Premiere Pro UXP plugin for Shumai')
    expect(v046).toContain('https://github.com/shumaiOne/shumai/pull/407')

    const v001 = extractChangelog(realChangelog, '0.0.1')
    expect(v001).not.toBeNull()
    expect(v001).toBe('### Added\n\n- Initial release of Shumai')
  })
})
