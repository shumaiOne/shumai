import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { CliError } from '../operations/errors'

export interface RunnerOptions {
  url?: string
  key?: string
  cwd?: string
  srt?: string
  verbose?: boolean
}

export interface RunnerConfig {
  url: URL
  key: string
  cwd: string
  srt?: string
  verbose?: boolean
}

export async function resolveRunnerConfig(options: RunnerOptions): Promise<RunnerConfig> {
  const address = options.url ?? process.env.SHUMAI_API_SERVER
  const key = options.key ?? process.env.SHUMAI_RUNNER_KEY
  if (!address) throw new CliError('Set SHUMAI_API_SERVER or pass --url.')
  if (!key?.trim()) throw new CliError('Set SHUMAI_RUNNER_KEY or pass --key with a runner key.')
  let url: URL
  try {
    url = new URL(address)
  } catch {
    throw new CliError('Invalid Shumai server URL.')
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['http:', 'https:'].includes(url.protocol)
  ) {
    throw new CliError(
      'Use an http:// or https:// server URL without credentials, query, or fragment.',
    )
  }
  const localHosts = ['localhost', '127.0.0.1', '[::1]', 'host.docker.internal']
  if (url.protocol === 'http:' && !localHosts.includes(url.hostname)) {
    throw new CliError(
      'Remote runners require HTTPS. HTTP is only supported for local development.',
    )
  }
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/api/runners/ws`
  const cwd = await realpath(path.resolve(options.cwd ?? process.cwd()))
  if (!(await stat(cwd)).isDirectory()) throw new CliError('Runner workspace must be a directory.')
  return {
    url,
    key: key.trim(),
    cwd,
    srt: options.srt ? path.resolve(options.srt) : undefined,
    verbose: Boolean(options.verbose),
  }
}

/** Commands inherit baseline OS settings and explicitly supplied skill variables, never CLI credentials. */
export function commandEnv(extra: Record<string, string> = {}, inherit = true): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(inherit ? process.env : {})) {
    if (
      /^(PATH|PATHEXT|HOME|USER|LOGNAME|LANG|TERM|TMPDIR|TEMP|TMP|SYSTEMROOT|SYSTEMDRIVE|COMSPEC|USERPROFILE|USERNAME|APPDATA|LOCALAPPDATA|PROGRAMDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|LC_.*)$/i.test(
        key,
      )
    )
      env[key] = value
  }
  for (const [key, value] of Object.entries(extra)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
      throw new Error('Invalid skill environment variable name.')
    if (['SHUMAI_RUNNER_KEY', 'SHUMAI_API_KEY'].includes(key.toUpperCase())) continue
    // Windows treats environment names as case-insensitive.
    for (const existing of Object.keys(env)) {
      if (existing.toUpperCase() === key.toUpperCase()) delete env[existing]
    }
    env[key] = value
  }
  return env
}
