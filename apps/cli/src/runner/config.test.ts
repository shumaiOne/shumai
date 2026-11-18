import { afterEach, describe, expect, it, vi } from 'vitest'
import { commandEnv, resolveRunnerConfig } from './config'

afterEach(() => vi.unstubAllEnvs())

describe('runner configuration', () => {
  it('preserves Windows OS settings, normalizes explicit overrides, and excludes credentials', () => {
    vi.stubEnv('Path', 'C:\\Windows\\System32')
    vi.stubEnv('SystemRoot', 'C:\\Windows')
    vi.stubEnv('USERPROFILE', 'C:\\Users\\runner')
    const env = commandEnv({ PATH: 'C:\\tools', ['shumai_runner_key']: 'secret' })
    expect(env).toMatchObject({
      PATH: 'C:\\tools',
      SystemRoot: 'C:\\Windows',
      USERPROFILE: 'C:\\Users\\runner',
    })
    expect(env).not.toHaveProperty('Path')
    expect(env).not.toHaveProperty('shumai_runner_key')
  })
  it('uses a dedicated runner key and preserves a server path prefix', async () => {
    vi.stubEnv('SHUMAI_API_SERVER', 'https://example.com/shumai/')
    vi.stubEnv('SHUMAI_RUNNER_KEY', 'runner-secret')
    const config = await resolveRunnerConfig({})
    expect(config.url.href).toBe('wss://example.com/shumai/api/runners/ws')
    expect(config.key).toBe('runner-secret')
    expect(config.cwd).toBe(process.cwd())
    expect(config.verbose).toBe(false)
    expect((await resolveRunnerConfig({ verbose: true })).verbose).toBe(true)
  })

  it.each([
    'http://example.com',
    'ftp://localhost',
    'https://user:secret@example.com',
    'https://example.com/?key=secret',
    'not a URL',
  ])('rejects unsafe server URL %s', async (url) => {
    await expect(resolveRunnerConfig({ url, key: 'key' })).rejects.toThrow()
  })

  it('allows the Docker host development address', async () => {
    expect(
      (await resolveRunnerConfig({ url: 'http://host.docker.internal:3000', key: 'key' })).url.href,
    ).toBe('ws://host.docker.internal:3000/api/runners/ws')
  })

  it('does not accept a personal API token in place of a missing runner key', async () => {
    vi.stubEnv('SHUMAI_RUNNER_KEY', '')
    vi.stubEnv('SHUMAI_API_KEY', 'personal-secret')
    await expect(resolveRunnerConfig({ url: 'https://example.com' })).rejects.toThrow(
      'SHUMAI_RUNNER_KEY',
    )
  })

  it('inherits only baseline environment and explicit skill variables', () => {
    vi.stubEnv('SHUMAI_RUNNER_KEY', 'runner-secret')
    vi.stubEnv('SHUMAI_API_KEY', 'personal-secret')
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'aws-secret')
    vi.stubEnv('BASH_ENV', '/malicious-startup')
    expect(
      commandEnv({ SKILL_TOKEN: 'skill-secret', SHUMAI_RUNNER_KEY: 'injected' }),
    ).toMatchObject({ SKILL_TOKEN: 'skill-secret' })
    for (const name of ['SHUMAI_RUNNER_KEY', 'SHUMAI_API_KEY', 'AWS_SECRET_ACCESS_KEY', 'BASH_ENV'])
      expect(commandEnv()).not.toHaveProperty(name)
  })
})
