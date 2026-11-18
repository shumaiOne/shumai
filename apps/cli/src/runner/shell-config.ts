import { spawnSync } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import { win32 } from 'node:path'

export interface RunnerShellConfig {
  executable: string
  commandTransport: 'shell' | 'argv' | 'stdin'
}

// Windows Bash discovery and legacy WSL detection adapted from pi-mono.
// See apps/cli/THIRD-PARTY-NOTICES.txt.
function isLegacyWslBashPath(executable: string, systemRoot: string | undefined): boolean {
  const normalized = win32.normalize(executable).toLowerCase()
  if (systemRoot) {
    if (!/^[a-z]:[\\/]/i.test(systemRoot)) return false
    return ['System32', 'Sysnative'].some(
      (directory) => normalized === win32.join(systemRoot, directory, 'bash.exe').toLowerCase(),
    )
  }
  return /^[a-z]:\\windows\\(?:system32|sysnative)\\bash\.exe$/.test(normalized)
}

function shellPathExists(executable: string): boolean {
  // access(F_OK) accepts runnable Windows Store aliases that fail an extra stat check.
  try {
    accessSync(executable, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function findWindowsBash(system32: string): string | undefined {
  for (const directory of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
    if (!directory || !win32.isAbsolute(directory)) continue
    const executable = win32.join(directory, 'Git', 'bin', 'bash.exe')
    if (shellPathExists(executable)) return executable
  }

  // Use the system tool and limit its search to PATH. The workspace may contain a bash.exe.
  const found = spawnSync(win32.join(system32, 'where.exe'), ['$PATH:bash.exe'], {
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true,
  })
  if (found.status !== 0 || !found.stdout) return
  return found.stdout
    .trim()
    .split(/\r?\n/)
    .find((executable) => win32.isAbsolute(executable) && shellPathExists(executable))
}

export function resolveRunnerShell(platform = process.platform): RunnerShellConfig {
  if (platform !== 'win32') return { executable: '/bin/sh', commandTransport: 'shell' }

  const systemRoot = process.env.SystemRoot
  const system32 = win32.join(systemRoot ?? 'C:\\Windows', 'System32')
  const executable = findWindowsBash(system32)
  if (!executable) return { executable: win32.join(system32, 'cmd.exe'), commandTransport: 'shell' }
  return {
    executable,
    commandTransport: isLegacyWslBashPath(executable, systemRoot) ? 'stdin' : 'argv',
  }
}
