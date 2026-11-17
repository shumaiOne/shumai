import { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { z } from 'zod'
import type {
  RunnerFileDownloadMessage,
  RunnerFileUploadMessage,
  RunnerFileStatMessage,
  RunnerToServerMessage,
} from '@shumai/dtos'
import { findExecutable, spawnFileHelper } from './filesystem'

export type FileMessage =
  RunnerFileDownloadMessage | RunnerFileUploadMessage | RunnerFileStatMessage
const metadataSchema = z.object({
  exists: z.boolean().optional(),
  isFile: z.boolean().optional(),
  size: z.number().optional(),
  name: z.string().optional(),
  cached: z.boolean().optional(),
  ready: z.boolean().optional(),
})

function transferUrl(address: string): URL {
  const url = new URL(address)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Invalid transfer URL.')
  return url
}

export class RunnerFiles {
  private python?: Promise<string>
  constructor(readonly cwd: string) {}

  async initialize() {
    await (this.python ??= findExecutable('python3'))
  }

  private async helper(operation: string, relative: string, expectedHash = '') {
    await this.initialize()
    const child = spawnFileHelper(await this.python!, this.cwd, operation, relative, expectedHash)
    const control = child.stdio[3]
    if (!(control instanceof Writable)) throw new Error('Missing filesystem commit channel.')
    control.on('error', () => {})
    if (operation === 'read' || operation === 'stat') control.end()
    let stdout = ''
    let stderr = ''
    // Binary reads are consumed by fetch, all other operations return small JSON metadata.
    if (operation !== 'read')
      child.stdout.on('data', (chunk: Buffer) => {
        stdout = (stdout + chunk.toString()).slice(-8192)
      })
    let firstLine: (value: string) => void
    const ready = new Promise<string>((resolve) => {
      firstLine = resolve
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-8192)
      if (stderr.includes('\n')) firstLine(stderr.split('\n')[0]!)
    })
    // A failed helper must not produce an unhandled EPIPE while HTTP is still streaming.
    child.stdin.on('error', () => {})
    const done = new Promise<z.infer<typeof metadataSchema>>((resolve, reject) => {
      child.once('error', (error) => {
        firstLine('')
        reject(error)
      })
      child.once('close', (code) => {
        firstLine(stderr)
        if (code !== 0)
          reject(new Error(stderr.trim().split('\n').at(-1) || 'Runner file operation failed.'))
        else if (operation === 'read') resolve({})
        else {
          try {
            resolve(metadataSchema.parse(JSON.parse(stdout)))
          } catch (error) {
            reject(error)
          }
        }
      })
    })
    void done.catch(() => {})
    let stopping = false
    const stop = () => {
      if (stopping || child.exitCode !== null || child.signalCode !== null) return
      stopping = true
      control.end()
      child.stdin.destroy()
      child.kill('SIGTERM')
      const fallback = setTimeout(() => child.kill('SIGKILL'), 5000)
      void done.finally(() => clearTimeout(fallback)).catch(() => {})
    }
    return { child, done, ready, stop, commit: () => control.end('1') }
  }

  async createWriter(relative: string, expectedHash = '') {
    const task = await this.helper('write', relative, expectedHash)
    try {
      const metadata = metadataSchema.parse(JSON.parse(await task.ready))
      if (!metadata.ready) throw new Error('Runner file writer did not initialize.')
    } catch (error) {
      task.stop()
      await task.done.catch(() => {})
      throw error
    }
    return {
      async write(data: string) {
        await new Promise<void>((resolve, reject) =>
          task.child.stdin.write(data, (error) => {
            if (error) reject(error)
            else resolve()
          }),
        )
      },
      async close() {
        task.child.stdin.end()
        task.commit()
        return await task.done
      },
    }
  }

  async handle(message: FileMessage, signal: AbortSignal): Promise<RunnerToServerMessage> {
    try {
      if (message.type === 'file.stat') {
        const task = await this.helper('stat', message.srcPath)
        task.child.stdin.end()
        const result = await task.done
        return {
          type: 'file.stat.result',
          executionId: message.executionId,
          ok: true,
          exists: result.exists ?? false,
          ...result,
        }
      }
      if (message.type === 'file.download') {
        const response = await fetch(transferUrl(message.url), { signal, redirect: 'error' })
        if (!response.ok || !response.body) {
          await response.body?.cancel()
          throw new Error(`Download failed (HTTP ${response.status}).`)
        }
        const task = await this.helper(
          message.extractZip ? 'extract' : 'write',
          message.destPath,
          message.expectedHash,
        )
        const abort = () => {
          task.stop()
        }
        signal.addEventListener('abort', abort, { once: true })
        try {
          if (signal.aborted) signal.throwIfAborted()
          await pipeline(response.body, task.child.stdin, { signal })
          signal.throwIfAborted()
          task.commit()
          return {
            type: 'file.download.result',
            executionId: message.executionId,
            ok: true,
            ...(await task.done),
          }
        } catch (error) {
          task.stop()
          await task.done.catch(() => {})
          throw error
        } finally {
          signal.removeEventListener('abort', abort)
        }
      }
      return await this.upload(message, signal)
    } catch (error) {
      const result = {
        executionId: message.executionId,
        ok: false,
        error: error instanceof Error ? error.message : 'File operation failed.',
      }
      switch (message.type) {
        case 'file.download':
          return { ...result, type: 'file.download.result' }
        case 'file.upload':
          return { ...result, type: 'file.upload.result' }
        case 'file.stat':
          return { ...result, type: 'file.stat.result', exists: false }
      }
    }
  }

  private async upload(
    message: RunnerFileUploadMessage,
    signal: AbortSignal,
  ): Promise<RunnerToServerMessage> {
    const task = await this.helper('read', message.srcPath)
    task.child.stdin.end()
    const abort = () => {
      task.stop()
    }
    signal.addEventListener('abort', abort, { once: true })
    try {
      const info = metadataSchema.parse(JSON.parse(await task.ready))
      if (!info.isFile || info.size === undefined) throw new Error('Invalid upload file.')
      const response = await fetch(transferUrl(message.url), {
        method: 'PUT',
        body: Readable.toWeb(task.child.stdout) as unknown as ReadableStream<Uint8Array>,
        ...{ duplex: 'half' },
        headers: {
          'content-type': message.contentType ?? 'application/octet-stream',
          'content-length': String(info.size),
        },
        signal,
        redirect: 'error',
      })
      await response.body?.cancel()
      if (!response.ok) throw new Error(`Upload failed (HTTP ${response.status}).`)
      await task.done
      return {
        type: 'file.upload.result',
        executionId: message.executionId,
        ok: true,
        size: info.size,
        name: info.name,
      }
    } finally {
      signal.removeEventListener('abort', abort)
      task.stop()
      await task.done.catch(() => {})
    }
  }
}
