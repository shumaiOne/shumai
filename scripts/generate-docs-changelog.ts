import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface ChangelogRelease {
  version: string
  date?: string
  content: string
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into a human-readable string (Month D, YYYY).
 * Returns the original string if parsing fails.
 */
export function formatChangelogDate(dateStr?: string): string {
  if (!dateStr) {
    return ''
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
  if (!match) {
    return dateStr.trim()
  }

  const year = parseInt(match[1], 10)
  const monthIndex = parseInt(match[2], 10) - 1
  const day = parseInt(match[3], 10)

  const date = new Date(Date.UTC(year, monthIndex, day))
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Parses all released versions from a Keep a Changelog markdown string.
 * Skips the ## [Unreleased] section.
 */
export function parseChangelogReleases(changelogContent: string): ChangelogRelease[] {
  if (!changelogContent) {
    return []
  }

  const releases: ChangelogRelease[] = []
  // Matches "## [0.4.7] - 2026-09-19" or "## [v0.4.7]" or "## [Unreleased]"
  const headerRegex = /^## \[(?:v)?([^\]]+)\](?:\s*-\s*([^\n\r]+))?$/gm

  const matches: Array<{ version: string; date?: string; index: number; length: number }> = []
  let match: RegExpExecArray | null

  while ((match = headerRegex.exec(changelogContent)) !== null) {
    matches.push({
      version: match[1].trim(),
      date: match[2]?.trim(),
      index: match.index,
      length: match[0].length,
    })
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]
    if (current.version.toLowerCase() === 'unreleased') {
      continue
    }

    const startIndex = current.index + current.length
    const endIndex = i + 1 < matches.length ? matches[i + 1].index : changelogContent.length
    const content = changelogContent.slice(startIndex, endIndex).trim()

    releases.push({
      version: current.version,
      date: current.date,
      content,
    })
  }

  return releases
}

/**
 * Generates the MDX content for docs/changelog.mdx using Mintlify's <Update> component.
 */
export function generateMdxChangelog(releases: ChangelogRelease[]): string {
  const lines: string[] = [
    '---',
    'title: "Changelog"',
    'description: "Recent updates, new features, and improvements in Shumai"',
    '---',
    '',
  ]

  for (const release of releases) {
    const cleanVersion = release.version.replace(/^v/i, '')
    const label = `v${cleanVersion}`
    const formattedDate = formatChangelogDate(release.date)

    const descAttr = formattedDate ? ` description="${formattedDate}"` : ''
    lines.push(`<Update label="${label}"${descAttr}>`)
    lines.push('')
    if (release.content) {
      lines.push(release.content)
      lines.push('')
    }
    lines.push('</Update>')
    lines.push('')
  }

  return lines.join('\n')
}

export interface SyncOptions {
  changelogPath?: string
  outputPath?: string
  check?: boolean
}

/**
 * Synchronizes docs/changelog.mdx with CHANGELOG.md.
 * If check is true, returns whether the output file already matches the generated content.
 */
export function syncDocsChangelog(options: SyncOptions = {}): boolean {
  const changelogPath = resolve(options.changelogPath ?? 'CHANGELOG.md')
  const outputPath = resolve(options.outputPath ?? 'docs/changelog.mdx')

  if (!existsSync(changelogPath)) {
    throw new Error(`Changelog not found at ${changelogPath}`)
  }

  const changelogContent = readFileSync(changelogPath, 'utf-8')
  const releases = parseChangelogReleases(changelogContent)
  const mdxContent = generateMdxChangelog(releases)

  if (options.check) {
    if (!existsSync(outputPath)) {
      return false
    }
    const currentMdx = readFileSync(outputPath, 'utf-8')
    return currentMdx === mdxContent
  }

  writeFileSync(outputPath, mdxContent, 'utf-8')
  return true
}

function parseCliArgs(args: string[]): {
  check: boolean
  changelogPath?: string
  outputPath?: string
} {
  let check = false
  let changelogPath: string | undefined
  let outputPath: string | undefined

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--check') {
      check = true
    } else if (arg === '--changelog' || arg === '-c') {
      changelogPath = args[++i]
    } else if (arg === '--output' || arg === '-o') {
      outputPath = args[++i]
    }
  }

  return { check, changelogPath, outputPath }
}

export function runCli(argv: string[]): void {
  const { check, changelogPath, outputPath } = parseCliArgs(argv)

  try {
    const targetOut = outputPath ?? 'docs/changelog.mdx'
    if (check) {
      const isUpToDate = syncDocsChangelog({ changelogPath, outputPath, check: true })
      if (!isUpToDate) {
        console.error(
          `Error: ${targetOut} is out of date with changelog. Run: bun run docs:changelog`,
        )
        process.exit(1)
      }
      console.log(`✓ ${targetOut} is up to date.`)
    } else {
      syncDocsChangelog({ changelogPath, outputPath })
      console.log(`✓ Generated ${targetOut} successfully.`)
    }
  } catch (error) {
    console.error('Failed to sync docs changelog:', error)
    process.exit(1)
  }
}

const isDirectlyExecuted =
  Boolean(import.meta.main) ||
  (process.argv[1] ? resolve(process.argv[1]) === resolve(import.meta.filename ?? '') : false)

if (isDirectlyExecuted) {
  runCli(process.argv.slice(2))
}
