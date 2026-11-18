import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadSandbox } from './srt'

describe('runner SRT configuration', () => {
  let directory: string
  let settings: string
  const config = {
    network: { allowedDomains: [], deniedDomains: [] },
    filesystem: { denyRead: [], allowWrite: ['.pi'], denyWrite: [] },
  }
  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'shumai-srt-settings-'))
    settings = path.join(directory, 'sandbox.json')
  })
  afterEach(() => rm(directory, { recursive: true, force: true }))

  it('validates upstream settings, supplies packaged helpers, and removes them on cleanup', async () => {
    await writeFile(settings, JSON.stringify(config))
    const sandbox = await loadSandbox(settings)
    const helper = sandbox.config.javaAgentJarPath!
    expect(sandbox.config).toMatchObject(config)
    expect((await readFile(helper)).subarray(0, 2).toString()).toBe('PK')
    if (process.platform === 'linux')
      expect(await stat(sandbox.config.seccomp!.applyPath!)).toHaveProperty(
        'size',
        expect.any(Number),
      )
    if (process.platform === 'win32')
      expect(await stat(sandbox.config.windows!.srtWin!.path!)).toHaveProperty(
        'size',
        expect.any(Number),
      )
    await sandbox.cleanup()
    await expect(stat(helper)).rejects.toThrow()
  })

  it('preserves explicit upstream helper paths', async () => {
    await writeFile(
      settings,
      JSON.stringify({
        ...config,
        javaAgentJarPath: '/custom/proxy.jar',
        seccomp: { applyPath: '/custom/seccomp' },
        windows: { srtWin: { path: 'C:\\custom\\srt-win.exe' } },
      }),
    )
    const sandbox = await loadSandbox(settings)
    try {
      expect(sandbox.config.javaAgentJarPath).toBe('/custom/proxy.jar')
      expect(sandbox.config.seccomp?.applyPath).toBe('/custom/seccomp')
      expect(sandbox.config.windows?.srtWin?.path).toBe('C:\\custom\\srt-win.exe')
    } finally {
      await sandbox.cleanup()
    }
  })
})
