import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RunnerFiles } from './files'
import { RunnerShell } from './shell'

describe('runner bash execution', () => {
  let cwd: string
  let shell: RunnerShell
  beforeEach(async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'shumai-shell-test-'))
    shell = new RunnerShell(new RunnerFiles(cwd))
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(cwd, { recursive: true, force: true })
  })

  const request = (command: string, executionId = 'test') => ({
    type: 'exec.start' as const,
    executionId,
    command,
  })

  it('streams both outputs, returns the exit code, and saves a log in the runner workspace', async () => {
    const output: string[] = []
    const result = await shell.run(
      request('printf "hello 世界"; printf "failure" >&2; exit 7'),
      new AbortController().signal,
      (stream, data) => output.push(`${stream}:${data}`),
    )
    expect(result).toMatchObject({
      exitCode: 7,
      signal: null,
      timedOut: false,
      fullOutputPath: '.pi/logs/bash-test.log',
    })
    expect(output.join('|')).toContain('stdout:hello 世界')
    expect(output.join('|')).toContain('stderr:failure')
    expect(await readFile(path.join(cwd, result.fullOutputPath!), 'utf8')).toContain('hello 世界')
  })

  it('passes skill env without inheriting runner or unrelated credentials', async () => {
    vi.stubEnv('SHUMAI_RUNNER_KEY', 'runner-secret')
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'aws-secret')
    let output = ''
    await shell.run(
      {
        ...request(
          'printf "%s|%s|%s" "$SKILL_TOKEN" "$SHUMAI_RUNNER_KEY" "$AWS_SECRET_ACCESS_KEY"',
        ),
        env: { SKILL_TOKEN: 'skill-secret' },
      },
      new AbortController().signal,
      (_stream, data) => {
        output += data
      },
    )
    expect(output).toBe('skill-secret||')
  })

  it('times out and terminates background children', async () => {
    const result = await shell.run(
      { ...request('sleep 30 & echo $!; wait'), timeoutSec: 0.1 },
      new AbortController().signal,
      () => {},
    )
    expect(result).toMatchObject({ timedOut: true, signal: 'SIGKILL' })
    const pid = Number((await readFile(path.join(cwd, '.pi/logs/bash-test.log'), 'utf8')).trim())
    expect(() => process.kill(pid, 0)).toThrow()
  })

  it('cancels a running command and never starts an already cancelled one', async () => {
    const controller = new AbortController()
    const running = shell.run(request('echo ready; sleep 30'), controller.signal, () =>
      controller.abort(),
    )
    expect(await running).toMatchObject({ aborted: true, signal: 'SIGKILL' })
    expect(
      await shell.run(request('touch unwanted', 'cancelled'), controller.signal, () => {}),
    ).toMatchObject({ aborted: true })
    await expect(readFile(path.join(cwd, 'unwanted'))).rejects.toThrow()
  })

  it('rejects invalid timeouts and caps runaway output', async () => {
    expect(
      await shell.run(
        { ...request('sleep 30'), timeoutSec: -1 },
        new AbortController().signal,
        () => {},
      ),
    ).toHaveProperty('error')
    expect(
      await shell.run(
        request('head -c 70000000 /dev/zero', 'large'),
        new AbortController().signal,
        () => {},
      ),
    ).toMatchObject({ error: 'Command exceeded the 64 MiB output limit.' })
  })

  it('uses the exact SRT JSON snapshot and validates SRT before connecting', async () => {
    const settings = path.join(cwd, 'sandbox.json')
    const capture = path.join(cwd, 'captured.json')
    const json = JSON.stringify({
      network: { allowedDomains: [] },
      filesystem: { allowWrite: ['.pi'] },
    })
    await writeFile(settings, json)
    await writeFile(
      path.join(cwd, 'srt'),
      `#!/bin/bash\ncp "$2" '${capture}'\nshift 3\nexec "$@"\n`,
      { mode: 0o700 },
    )
    vi.stubEnv('PATH', `${cwd}:${process.env.PATH}`)
    shell = new RunnerShell(new RunnerFiles(cwd), settings)
    await shell.initialize()
    await writeFile(settings, '{}')
    expect(
      await shell.run(request('echo sandboxed'), new AbortController().signal, () => {}),
    ).toMatchObject({ exitCode: 0 })
    expect(await readFile(capture, 'utf8')).toBe(json)
    vi.stubEnv('PATH', '/missing-srt')
    await expect(new RunnerShell(new RunnerFiles(cwd), settings).initialize()).rejects.toThrow(
      'required on the runner machine',
    )
  })

  it('keeps skill PATH and Node startup settings out of the SRT launcher', async () => {
    const settings = path.join(cwd, 'sandbox.json')
    const marker = path.join(cwd, 'injected')
    const evil = path.join(cwd, 'evil.cjs')
    await writeFile(settings, '{}')
    await writeFile(evil, `require('node:fs').writeFileSync('${marker}', 'escaped')`)
    await writeFile(
      path.join(cwd, 'srt'),
      `#!/usr/bin/env node
const {spawnSync} = require('node:child_process');
const result = spawnSync(process.argv[5], process.argv.slice(6), {stdio: 'inherit'});
process.exit(result.status ?? 1);
`,
      { mode: 0o700 },
    )
    vi.stubEnv('PATH', `${cwd}:${process.env.PATH}`)
    shell = new RunnerShell(new RunnerFiles(cwd), settings)
    await shell.initialize()
    const result = await shell.run(
      {
        ...request('printf secure'),
        env: { PATH: '/evil-srt', NODE_OPTIONS: `--require=${evil}` },
      },
      new AbortController().signal,
      () => {},
    )
    expect(result).toMatchObject({ exitCode: 0 })
    await expect(readFile(marker)).rejects.toThrow()
  })

  it('fails closed for missing or malformed SRT settings', async () => {
    const settings = path.join(cwd, 'sandbox.json')
    await expect(new RunnerShell(new RunnerFiles(cwd), settings).initialize()).rejects.toThrow()
    await writeFile(settings, 'invalid json')
    await expect(new RunnerShell(new RunnerFiles(cwd), settings).initialize()).rejects.toThrow()
    await writeFile(settings, '[]')
    await expect(new RunnerShell(new RunnerFiles(cwd), settings).initialize()).rejects.toThrow(
      'JSON object',
    )
  })
})
