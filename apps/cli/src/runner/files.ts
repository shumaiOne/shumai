import { createHash } from 'node:crypto'
import { constants, createWriteStream } from 'node:fs'
import { lstat, mkdir, mkdtemp, open, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import yauzl from 'yauzl'
import type {
  RunnerFileDownloadMessage,
  RunnerFileUploadMessage,
  RunnerFileStatMessage,
  RunnerToServerMessage,
} from '@shumai/dtos'

const MAX_FILE_BYTES = 256 * 1024 * 1024
const MAX_ZIP_ENTRIES = 10_000
export type FileMessage =
  RunnerFileDownloadMessage | RunnerFileUploadMessage | RunnerFileStatMessage

function pathParts(value: string): string[] {
  const parts = value.split('/')
  if (
    value.includes('\\') ||
    value.includes('\0') ||
    parts.some(
      (part) =>
        !part ||
        part === '.' ||
        part === '..' ||
        part.includes(':') ||
        /[. ]$/.test(part) ||
        /^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?: *\.|$)/i.test(part),
    )
  )
    throw new Error('Invalid workspace path.')
  return parts
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function transferUrl(address: string): URL {
  const url = new URL(address)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Invalid transfer URL.')
  return url
}

export class RunnerFiles {
  constructor(readonly cwd: string) {}

  /** Basic workspace validation. Concurrent hostile filesystem mutation is outside v1's scope. */
  private async resolve(relative: string, createParents = false): Promise<string> {
    const parts = pathParts(relative)
    if (parts[0] !== '.pi' || parts.length < 2) throw new Error('File paths must stay inside .pi/.')
    let current = this.cwd
    for (let index = 0; index < parts.length; index++) {
      current = path.join(current, parts[index])
      const parent = index < parts.length - 1
      if (parent && createParents) await mkdir(current, { recursive: true, mode: 0o700 })
      try {
        const info = await lstat(current)
        if (info.isSymbolicLink() || (parent && !info.isDirectory()))
          throw new Error('Workspace paths cannot contain symlinks or non-directory parents.')
      } catch (error) {
        if (!isMissing(error)) throw error
      }
    }
    return current
  }

  async createWriter(relative: string) {
    const file = await open(
      await this.resolve(relative, true),
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    )
    return {
      write: async (data: string) => {
        await file.writeFile(data)
      },
      close: () => file.close(),
    }
  }

  async handle(message: FileMessage, signal: AbortSignal): Promise<RunnerToServerMessage> {
    try {
      signal.throwIfAborted()
      if (message.type === 'file.download')
        return {
          type: 'file.download.result',
          executionId: message.executionId,
          ok: true,
          ...(await this.download(message, signal)),
        }
      const filename = await this.resolve(message.srcPath)
      if (message.type === 'file.upload') return await this.upload(message, filename, signal)
      try {
        const info = await lstat(filename)
        return {
          type: 'file.stat.result',
          executionId: message.executionId,
          ok: true,
          exists: true,
          isFile: info.isFile(),
          size: info.size,
          name: path.basename(filename),
        }
      } catch (error) {
        if (!isMissing(error)) throw error
        return {
          type: 'file.stat.result',
          executionId: message.executionId,
          ok: true,
          exists: false,
        }
      }
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
    filename: string,
    signal: AbortSignal,
  ): Promise<RunnerToServerMessage> {
    const file = await open(
      filename,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    )
    try {
      const info = await file.stat()
      if (!info.isFile() || info.size > MAX_FILE_BYTES)
        throw new Error('Upload must be a regular file no larger than 256 MiB.')
      // Node and Bun declare different DOM stream types for the same fetch-compatible stream.
      const body = info.size
        ? (Readable.toWeb(
            file.createReadStream({ autoClose: false, end: info.size - 1 }),
          ) as unknown as ReadableStream<Uint8Array>)
        : new Uint8Array()
      const response = await fetch(transferUrl(message.url), {
        method: 'PUT',
        body,
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
      return {
        type: 'file.upload.result',
        executionId: message.executionId,
        ok: true,
        size: info.size,
        name: path.basename(filename),
      }
    } finally {
      await file.close()
    }
  }

  private async download(message: RunnerFileDownloadMessage, signal: AbortSignal) {
    const destination = await this.resolve(message.destPath, true)
    const temporary = await mkdtemp(path.join(path.dirname(destination), '.shumai-'))
    let preserveBackup = false
    try {
      const response = await fetch(transferUrl(message.url), { signal, redirect: 'error' })
      if (!response.ok || !response.body) {
        await response.body?.cancel()
        throw new Error(`Download failed (HTTP ${response.status}).`)
      }
      const hash = createHash('sha256')
      let size = 0
      const archive = path.join(temporary, 'download')
      await pipeline(
        response.body,
        new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            size += chunk.length
            if (size > MAX_FILE_BYTES) {
              callback(new Error('Download exceeds 256 MiB.'))
              return
            }
            hash.update(chunk)
            callback(null, chunk)
          },
        }),
        createWriteStream(archive, { flags: 'wx', mode: 0o600 }),
        { signal },
      )
      if (message.expectedHash && hash.digest('hex') !== message.expectedHash)
        throw new Error('Downloaded file hash does not match.')
      let source = archive
      if (message.extractZip) {
        source = path.join(temporary, 'extracted')
        await mkdir(source, { mode: 0o700 })
        await this.extract(archive, source, signal)
      }
      signal.throwIfAborted()
      await this.resolve(message.destPath)
      if (message.extractZip) {
        const backup = path.join(temporary, 'previous')
        let backedUp = false
        try {
          await rename(destination, backup)
          backedUp = true
        } catch (error) {
          if (!isMissing(error)) throw error
        }
        try {
          await rename(source, destination)
        } catch (error) {
          if (backedUp) {
            preserveBackup = true
            await rename(backup, destination)
            preserveBackup = false
          }
          throw error
        }
      } else await rename(source, destination)
      return { size, cached: false }
    } finally {
      if (!preserveBackup) await rm(temporary, { recursive: true, force: true })
    }
  }

  private async extract(archive: string, directory: string, signal: AbortSignal) {
    const zip = await yauzl.openPromise(archive, {
      lazyEntries: true,
      strictFileNames: true,
      autoClose: false,
    })
    let size = 0
    let count = 0
    try {
      signal.throwIfAborted()
      // Let each metadata read finish before cancellation can close the ZIP descriptor.
      for await (const entry of zip.eachEntry()) {
        signal.throwIfAborted()
        if (++count > MAX_ZIP_ENTRIES) throw new Error('ZIP contains too many entries.')
        const parts = pathParts(entry.fileName.replace(/\/$/, ''))
        const mode = entry.externalFileAttributes >>> 16
        const kind = mode & 0o170000
        if (kind && kind !== 0o100000 && kind !== 0o040000)
          throw new Error('ZIP links and special files are forbidden.')
        size += entry.uncompressedSize
        if (size > MAX_FILE_BYTES) throw new Error('Extracted ZIP exceeds 256 MiB.')
        const destination = path.join(directory, ...parts)
        if (entry.fileName.endsWith('/')) await mkdir(destination, { recursive: true, mode: 0o700 })
        else {
          await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 })
          const input = await zip.openReadStreamPromise(entry)
          await pipeline(
            input,
            createWriteStream(destination, { flags: 'wx', mode: 0o600 | (mode & 0o155) }),
            { signal },
          )
        }
      }
    } finally {
      zip.close()
    }
  }
}
