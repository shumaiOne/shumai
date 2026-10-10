import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const execFileMock = vi.hoisted(() => vi.fn())

vi.mock('child_process', () => ({ execFile: execFileMock }))
vi.mock('@shumai/core/src/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}))

import { logger } from '@shumai/core/src/logger'
import {
  applySharpThreads,
  applyTranscodeNice,
  createExecFileAsync,
  getThreadLimitEnv,
  getTranscodeNice,
  getTranscodeThreads,
  parsePositiveIntEnv,
  resetResourceLimitWarnings,
  resolveFfmpegThreads,
} from './resource-limits'

describe('resource-limits', () => {
  const saved = { threads: process.env.TRANSCODE_THREADS, nice: process.env.TRANSCODE_NICE }

  beforeEach(() => {
    delete process.env.TRANSCODE_THREADS
    delete process.env.TRANSCODE_NICE
    resetResourceLimitWarnings()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (saved.threads === undefined) delete process.env.TRANSCODE_THREADS
    else process.env.TRANSCODE_THREADS = saved.threads
    if (saved.nice === undefined) delete process.env.TRANSCODE_NICE
    else process.env.TRANSCODE_NICE = saved.nice
  })

  describe('parsePositiveIntEnv', () => {
    it('returns undefined silently when unset or empty', () => {
      expect(parsePositiveIntEnv('X', undefined)).toBeUndefined()
      expect(parsePositiveIntEnv('X', '  ')).toBeUndefined()
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('parses positive whole numbers', () => {
      expect(parsePositiveIntEnv('X', '4')).toBe(4)
      expect(parsePositiveIntEnv('X', ' 12 ')).toBe(12)
    })

    it.each(['abc', '0', '-2', '1.5', '2x', '1e3', 'NaN'])(
      'falls back to undefined with a warning for %s',
      (value) => {
        expect(parsePositiveIntEnv('X', value)).toBeUndefined()
        expect(logger.warn).toHaveBeenCalledTimes(1)
      },
    )

    it('warns only once per bad value', () => {
      parsePositiveIntEnv('X', 'bad')
      parsePositiveIntEnv('X', 'bad')
      expect(logger.warn).toHaveBeenCalledTimes(1)
    })
  })

  describe('TRANSCODE_THREADS', () => {
    it('is undefined by default so behaviour is unchanged', () => {
      expect(getTranscodeThreads()).toBeUndefined()
      expect(resolveFfmpegThreads(undefined)).toBeUndefined()
      expect(resolveFfmpegThreads(0)).toBeUndefined()
      expect(getThreadLimitEnv()).toBeUndefined()
    })

    it('is used as the ffmpeg default but never overrides an explicit value', () => {
      process.env.TRANSCODE_THREADS = '3'
      expect(resolveFfmpegThreads(undefined)).toBe(3)
      expect(resolveFfmpegThreads(0)).toBe(3)
      expect(resolveFfmpegThreads(6)).toBe(6)
    })

    it('caps OpenMP based tools', () => {
      process.env.TRANSCODE_THREADS = '2'
      expect(getThreadLimitEnv()).toEqual({ OMP_NUM_THREADS: '2', MAGICK_THREAD_LIMIT: '2' })
    })

    it('limits the sharp thread pool only when set', () => {
      const concurrency = vi.fn()
      applySharpThreads({ concurrency })
      expect(concurrency).not.toHaveBeenCalled()
      process.env.TRANSCODE_THREADS = '2'
      applySharpThreads({ concurrency })
      expect(concurrency).toHaveBeenCalledWith(2)
      expect(() => applySharpThreads({})).not.toThrow()
    })

    it('ignores invalid values', () => {
      process.env.TRANSCODE_THREADS = '0'
      expect(getTranscodeThreads()).toBeUndefined()
      expect(resolveFfmpegThreads(undefined)).toBeUndefined()
    })
  })

  describe('TRANSCODE_NICE', () => {
    it('is off by default and leaves commands untouched', () => {
      expect(getTranscodeNice(process.env, 'linux')).toBeUndefined()
      expect(applyTranscodeNice('ffmpeg', ['-y'])).toEqual(['ffmpeg', ['-y']])
    })

    it('is ignored with a warning off Linux', () => {
      expect(getTranscodeNice({ TRANSCODE_NICE: '10' }, 'win32')).toBeUndefined()
      expect(logger.warn).toHaveBeenCalledTimes(1)
    })

    it('clamps to 19 and rejects invalid input on Linux', () => {
      expect(getTranscodeNice({ TRANSCODE_NICE: '10' }, 'linux')).toBe(10)
      expect(getTranscodeNice({ TRANSCODE_NICE: '99' }, 'linux')).toBe(19)
      expect(getTranscodeNice({ TRANSCODE_NICE: '-5' }, 'linux')).toBeUndefined()
      expect(getTranscodeNice({ TRANSCODE_NICE: 'x' }, 'linux')).toBeUndefined()
    })

    it('wraps spawned commands in nice when active', () => {
      expect(applyTranscodeNice('ffmpeg', ['-y', 'a'], { TRANSCODE_NICE: '10' }, 'linux')).toEqual([
        'nice',
        ['-n', '10', 'ffmpeg', '-y', 'a'],
      ])
    })

    it('does not wrap off Linux', () => {
      expect(applyTranscodeNice('ffmpeg', ['-y'], { TRANSCODE_NICE: '10' }, 'darwin')).toEqual([
        'ffmpeg',
        ['-y'],
      ])
    })
  })

  describe('createExecFileAsync', () => {
    it('passes command, args and options straight through by default', async () => {
      execFileMock.mockImplementation((...a: unknown[]) => {
        const cb = a[a.length - 1] as (e: Error | null, r: { stdout: string }) => void
        cb(null, { stdout: 'ok' })
      })
      const run = createExecFileAsync()
      await run('ffprobe', ['-v', 'error'])
      expect(execFileMock.mock.calls[0].slice(0, 2)).toEqual(['ffprobe', ['-v', 'error']])
      const signal = new AbortController().signal
      await run('ffmpeg', ['-y'], { signal })
      expect(execFileMock.mock.calls[1].slice(0, 3)).toEqual(['ffmpeg', ['-y'], { signal }])
    })

    describe('under TRANSCODE_NICE (injected exec)', () => {
      type Call = { cmd: string; args: readonly string[] }
      const niceMissingError = (cmd: string) =>
        Object.assign(new Error(`Command failed: nice -n 10 ${cmd}`), {
          code: 127,
          stdout: 'partial out',
          stderr: `nice: '${cmd}': No such file or directory\n`,
        })
      const enoent = (path: string) =>
        Object.assign(new Error(`spawn ${path} ENOENT`), { code: 'ENOENT', path })

      /** Fake execFile that behaves like a Linux box with only `installed` binaries on PATH. */
      function fakeExec(installed: string[], niceInstalled = true) {
        const calls: Call[] = []
        const exec = vi.fn(async (cmd: string, args: readonly string[]) => {
          calls.push({ cmd, args })
          if (cmd === 'nice') {
            if (!niceInstalled) throw enoent('nice')
            const target = args[2]
            if (!installed.includes(target)) throw niceMissingError(target)
            return { stdout: `ran ${target}`, stderr: '' }
          }
          if (!installed.includes(cmd)) throw enoent(cmd)
          return { stdout: `ran ${cmd}`, stderr: '' }
        })
        return { exec, calls }
      }

      it('turns a missing wrapped binary into an ENOENT shaped error', async () => {
        const { exec } = fakeExec([])
        const run = createExecFileAsync({ exec, getNice: () => 10 })
        const err = await run('magick', ['a.jpg']).catch((e: unknown) => e)
        expect(err).toMatchObject({
          code: 'ENOENT',
          errno: -2,
          path: 'magick',
          syscall: 'spawn magick',
          stdout: 'partial out',
        })
        expect((err as { stderr: string }).stderr).toContain('No such file or directory')
        expect((err as Error).message).toContain('ENOENT')
      })

      it('passes an existing binary through wrapped in nice', async () => {
        const { exec, calls } = fakeExec(['ffmpeg'])
        const run = createExecFileAsync({ exec, getNice: () => 10 })
        await expect(run('ffmpeg', ['-y'])).resolves.toEqual({ stdout: 'ran ffmpeg', stderr: '' })
        expect(calls[0]).toEqual({ cmd: 'nice', args: ['-n', '10', 'ffmpeg', '-y'] })
      })

      it('does not mistake a wrapped tool failing with 127 for a missing binary', async () => {
        const failure = Object.assign(new Error('boom'), {
          code: 127,
          stderr: 'ffmpeg: some script said: not found',
        })
        const run = createExecFileAsync({
          exec: vi.fn().mockRejectedValue(failure),
          getNice: () => 10,
        })
        await expect(run('ffmpeg', [])).rejects.toBe(failure)
      })

      it('lets the magick to convert fallback work when niced', async () => {
        const { exec, calls } = fakeExec(['convert'])
        const run = createExecFileAsync({ exec, getNice: () => 10 })
        // Same pattern as TranscodeService.execImageMagick.
        const result = await run('magick', ['a.jpg']).catch(async (err: unknown) => {
          if ((err as { code?: unknown }).code === 'ENOENT') return run('convert', ['a.jpg'])
          throw err
        })
        expect(result.stdout).toBe('ran convert')
        expect(calls.map((c) => c.args[2])).toEqual(['magick', 'convert'])
      })

      it('keeps the pdftoppm not-found mapping working', async () => {
        const run = createExecFileAsync({ exec: fakeExec([]).exec, getNice: () => 10 })
        const err = await run('pdftoppm', ['-png']).catch((e: unknown) => e)
        expect((err as { code?: unknown }).code).toBe('ENOENT')
      })

      it('warns once and disables niceness when nice itself is missing', async () => {
        const { exec, calls } = fakeExec(['ffmpeg'], false)
        const run = createExecFileAsync({ exec, getNice: () => 10 })
        await expect(run('ffmpeg', ['-y'])).resolves.toMatchObject({ stdout: 'ran ffmpeg' })
        await run('ffmpeg', ['-y'])
        await run('ffmpeg', ['-y'])
        expect(logger.warn).toHaveBeenCalledTimes(1)
        // First call probed nice and retried plain; later calls skip nice entirely.
        expect(calls.map((c) => c.cmd)).toEqual(['nice', 'ffmpeg', 'ffmpeg', 'ffmpeg'])
        expect(applyTranscodeNice('ffmpeg', [], { TRANSCODE_NICE: '10' }, 'linux')).toEqual([
          'ffmpeg',
          [],
        ])
      })
    })
  })
})
