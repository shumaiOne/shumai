import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * Extracts the release notes for a given version from the markdown content of a changelog.
 *
 * @param content The full text content of CHANGELOG.md
 * @param version The version string to search for (e.g. "0.4.6" or "v0.4.6")
 * @returns The extracted markdown text, or null if the version is not found.
 */
export function extractChangelog(content: string, version: string): string | null {
  if (!content || !version) {
    return null
  }

  const cleanVersion = version.trim().replace(/^v/i, '')
  if (!cleanVersion) {
    return null
  }

  const escapedVersion = cleanVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const headerRegex = new RegExp(`^## \\[(?:v)?${escapedVersion}\\](?:\\s*-\\s*.*)?$`, 'm')

  const match = headerRegex.exec(content)
  if (!match || match.index === undefined) {
    return null
  }

  const startIndex = match.index + match[0].length
  const remainingContent = content.slice(startIndex)

  // Look for the next release header starting with "## ["
  const nextHeaderRegex = /^## \[/m
  const nextMatch = nextHeaderRegex.exec(remainingContent)

  const sectionContent =
    nextMatch && nextMatch.index !== undefined
      ? remainingContent.slice(0, nextMatch.index)
      : remainingContent

  return sectionContent.trim()
}

interface CliOptions {
  version: string
  output?: string
  changelogPath: string
}

function parseCliArgs(args: string[]): CliOptions {
  let version = ''
  let output: string | undefined
  let changelogPath = 'CHANGELOG.md'

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--output' || arg === '-o') {
      output = args[++i]
    } else if (arg === '--changelog' || arg === '-c') {
      changelogPath = args[++i]
    } else if (!arg.startsWith('-') && !version) {
      version = arg
    }
  }

  return { version, output, changelogPath }
}

export function runCli(argv: string[]): void {
  const { version, output, changelogPath } = parseCliArgs(argv)

  if (!version) {
    console.error(
      'Usage: bun run scripts/extract-changelog.ts <version> [--output <path>] [--changelog <path>]',
    )
    process.exit(1)
  }

  const resolvedChangelog = resolve(changelogPath)
  if (!existsSync(resolvedChangelog)) {
    console.error(`Changelog file not found at: ${resolvedChangelog}`)
    process.exit(1)
  }

  const content = readFileSync(resolvedChangelog, 'utf-8')
  const notes = extractChangelog(content, version)

  if (output) {
    const resolvedOutput = resolve(output)
    mkdirSync(dirname(resolvedOutput), { recursive: true })
    writeFileSync(resolvedOutput, notes ?? '', 'utf-8')
    if (notes) {
      console.log(`Extracted release notes for ${version} to ${resolvedOutput}`)
    } else {
      console.warn(
        `No changelog entry found for version ${version}; wrote empty file to ${resolvedOutput}`,
      )
    }
  } else {
    if (notes) {
      process.stdout.write(notes + '\n')
    } else {
      console.warn(`No changelog entry found for version ${version}`)
    }
  }
}

// Run CLI when invoked directly
const isDirectlyExecuted =
  Boolean(import.meta.main) ||
  (process.argv[1] ? resolve(process.argv[1]) === resolve(import.meta.filename ?? '') : false)

if (isDirectlyExecuted) {
  runCli(process.argv.slice(2))
}
