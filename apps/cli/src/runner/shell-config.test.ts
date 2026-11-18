import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveRunnerShell } from './shell-config'

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }))
vi.mock('node:fs', { spy: true })

const access = vi.mocked(accessSync)
const where = vi.mocked(spawnSync)
const gitBash = 'D:\\Program Files\\Git\\bin\\bash.exe'
const gitBashX86 = 'D:\\Program Files (x86)\\Git\\bin\\bash.exe'

function whereResult(stdout = '', status = 0): SpawnSyncReturns<string> {
  return { stdout, stderr: '', status, output: [null, stdout, ''], pid: 1, signal: null }
}

function available(...paths: string[]) {
  access.mockImplementation((executable) => {
    if (!paths.some((path) => executable === path)) throw new Error('File not found')
  })
}

beforeEach(() => {
  vi.stubEnv('ProgramFiles', 'D:\\Program Files')
  vi.stubEnv('ProgramFiles(x86)', 'D:\\Program Files (x86)')
  vi.stubEnv('SystemRoot', 'E:\\WinNT')
  available()
  where.mockReturnValue(whereResult('', 1))
})

afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
})

describe('runner shell selection', () => {
  it.each(['linux', 'darwin'] as const)('uses /bin/sh on %s', (platform) => {
    expect(resolveRunnerShell(platform)).toEqual({
      executable: '/bin/sh',
      commandTransport: 'shell',
    })
    expect(where).not.toHaveBeenCalled()
  })

  it.each([
    [gitBash, [gitBash, gitBashX86]],
    [gitBashX86, [gitBashX86]],
  ] as const)('prefers installed Git Bash at %s before PATH', (executable, paths) => {
    available(...paths)
    expect(resolveRunnerShell('win32')).toEqual({ executable, commandTransport: 'argv' })
    expect(where).not.toHaveBeenCalled()
  })

  // Adapted from Pi's shell-path-exists.test.ts. See apps/cli/THIRD-PARTY-NOTICES.txt.
  it('accepts a Windows Store Bash alias found on PATH via access(F_OK)', () => {
    const alias = 'D:\\Users\\runner\\AppData\\Local\\Microsoft\\WindowsApps\\bash.exe'
    available(alias)
    where.mockReturnValue(whereResult(alias + '\r\n'))
    expect(resolveRunnerShell('win32')).toEqual({ executable: alias, commandTransport: 'argv' })
    expect(access).toHaveBeenCalledWith(alias, constants.F_OK)
    expect(where).toHaveBeenCalledWith('E:\\WinNT\\System32\\where.exe', ['$PATH:bash.exe'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    })
  })

  it('skips relative and inaccessible PATH results', () => {
    const executable = 'D:\\MSYS2\\usr\\bin\\bash.exe'
    available(executable)
    where.mockReturnValue(
      whereResult(['bash.exe', 'D:\\missing\\bash.exe', executable].join('\r\n')),
    )
    expect(resolveRunnerShell('win32')).toEqual({ executable, commandTransport: 'argv' })
  })

  it.each([
    ['E:\\WinNT', 'E:\\WinNT\\System32\\cmd.exe'],
    [undefined, 'C:\\Windows\\System32\\cmd.exe'],
  ] as const)(
    'falls back to cmd.exe when no Bash is available (SystemRoot %s)',
    (root, executable) => {
      vi.stubEnv('SystemRoot', root)
      expect(resolveRunnerShell('win32')).toEqual({ executable, commandTransport: 'shell' })
    },
  )

  // Adapted from Pi's windows-shell-config.test.ts.
  it.each([
    ['D:\\WinNT\\', 'd:/WINNT/System32/BASH.EXE', 'stdin'],
    ['D:\\WinNT', 'D:\\WinNT\\Sysnative\\bash.exe', 'stdin'],
    [undefined, 'E:\\Windows\\System32\\bash.exe', 'stdin'],
    ['D:\\WinNT', 'D:\\Git\\bin\\bash.exe', 'argv'],
    ['D:\\WinNT', 'E:\\Windows\\System32\\bash.exe', 'argv'],
    ['WinNT', 'C:\\Windows\\System32\\bash.exe', 'argv'],
  ] as const)(
    'uses the correct command transport for SystemRoot %s and %s',
    (root, executable, commandTransport) => {
      vi.stubEnv('SystemRoot', root)
      available(executable)
      where.mockReturnValue(whereResult(executable + '\r\n'))
      expect(resolveRunnerShell('win32')).toEqual({ executable, commandTransport })
    },
  )
})
