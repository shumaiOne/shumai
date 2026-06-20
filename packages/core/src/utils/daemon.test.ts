import { describe, expect, it, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { existsSync, writeFileSync, readFileSync, rmSync, mkdirSync, createWriteStream } from 'node:fs'
import { join } from 'node:path'
import { handleDaemonCommands } from './daemon'
import { spawn } from 'node:child_process'
import { Writable } from 'node:stream'

// Mock os.homedir to return a temporary directory for test isolation
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>()
  const mockTempDir = `${actual.tmpdir()}/shumai-test-daemon-${Math.random().toString(36).substring(2)}`
  return {
    ...actual,
    homedir: () => mockTempDir,
  }
})

// Mock node:child_process for spawn tests
vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn(() => {
      return {
        pid: 99999,
        unref: vi.fn(),
      }
    }),
  }
})

// Mock node:fs to mock createWriteStream for ESM safety
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const { Writable } = require('node:stream')
  return {
    ...actual,
    createWriteStream: vi.fn(() => {
      return new Writable({
        write(_chunk: unknown, _encoding: string, callback: (error?: Error | null) => void) {
          callback()
        },
      })
    }),
  }
})

import { homedir } from 'node:os'

describe('handleDaemonCommands', () => {
  const appName = 'test-app'
  const mockTempDir = homedir()
  const pidFile = join(mockTempDir, '.shumai', 'pids', `${appName}.pid`)

  let mockExit: MockInstance<typeof process.exit>
  let mockKill: MockInstance<typeof process.kill>
  const originalArgv = process.argv

  beforeEach(() => {
    mkdirSync(mockTempDir, { recursive: true })
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    mockKill = vi.spyOn(process, 'kill').mockImplementation(() => true)
    
    vi.mocked(spawn).mockClear()
    vi.mocked(createWriteStream).mockClear()
  })

  afterEach(() => {
    process.argv = originalArgv
    vi.restoreAllMocks()
    try {
      rmSync(mockTempDir, { recursive: true, force: true })
    } catch {
      // Ignore
    }
  })

  it('runs the runFn on normal startup', async () => {
    process.argv = ['node', 'script.js']
    const runFn = vi.fn().mockResolvedValue(undefined)

    await handleDaemonCommands(appName, runFn)

    expect(runFn).toHaveBeenCalled()
    expect(existsSync(pidFile)).toBe(true)
    expect(readFileSync(pidFile, 'utf8').trim()).toBe(process.pid.toString())
  })

  it('stops the process if stop command is passed', async () => {
    process.argv = ['node', 'script.js', 'stop']
    const runFn = vi.fn().mockResolvedValue(undefined)

    // Write a dummy PID file
    mkdirSync(join(mockTempDir, '.shumai', 'pids'), { recursive: true })
    writeFileSync(pidFile, '12345')

    await expect(handleDaemonCommands(appName, runFn)).rejects.toThrow('process.exit')

    expect(runFn).not.toHaveBeenCalled()
    expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM')
    expect(mockExit).toHaveBeenCalledWith(0)
    expect(createWriteStream).not.toHaveBeenCalled()
  })

  it('daemonizes the process if -d is passed', async () => {
    process.argv = ['node', 'script.js', '-d']
    const runFn = vi.fn().mockResolvedValue(undefined)

    await expect(handleDaemonCommands(appName, runFn)).rejects.toThrow('process.exit')

    expect(runFn).not.toHaveBeenCalled()
    expect(spawn).toHaveBeenCalled()
    expect(existsSync(pidFile)).toBe(true)
    expect(readFileSync(pidFile, 'utf8').trim()).toBe('99999')
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it('restarts the process if restart command is passed', async () => {
    process.argv = ['node', 'script.js', 'restart']
    const runFn = vi.fn().mockResolvedValue(undefined)

    // Write a dummy PID file
    mkdirSync(join(mockTempDir, '.shumai', 'pids'), { recursive: true })
    writeFileSync(pidFile, '12345')

    await expect(handleDaemonCommands(appName, runFn)).rejects.toThrow('process.exit')

    expect(runFn).not.toHaveBeenCalled()
    expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM')
    expect(spawn).toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(0)
  })
})
