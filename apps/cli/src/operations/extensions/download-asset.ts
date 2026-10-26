import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import * as path from 'node:path'
import { Option } from 'commander'
import type { DownloadAssetOutput } from '@shumai/operations'
import type { CliCommandExtension } from '../generate'
import { formatSize } from '../render'
import { saveUrlToFile } from './save-url'

/** A file name that is safe to create inside the target folder (no paths or control chars). */
export function safeFileName(name: string): string {
  const safe = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f/\\]/g, '_')
    .replace(/^[\s.]+|[\s.]+$/g, '')
  return safe || 'file'
}

/** `name.ext`, or `name (2).ext`, `name (3).ext`, ... if taken on disk or in this download. */
export function uniquePath(dir: string, name: string, taken: Set<string>): string {
  const ext = path.extname(name)
  const stem = ext ? name.slice(0, -ext.length) : name
  for (let n = 1; ; n++) {
    const candidate = path.join(dir, n === 1 ? name : `${stem} (${n})${ext}`)
    if (!taken.has(candidate) && !existsSync(candidate)) {
      taken.add(candidate)
      return candidate
    }
  }
}

/** `download`: saves each file into `--out` (the current folder by default). */
export const downloadAssetExtension: CliCommandExtension = {
  options: () => [
    new Option('-o, --out <dir>', 'Folder to save the files in.').default('.'),
    new Option('--original', 'Download the original uploaded files instead of the web previews.'),
  ],
  toInput: (input, opts) => (opts.original === true ? { ...input, proxy: false } : input),
  async present(raw, { opts, json, output: o }) {
    const output = raw as DownloadAssetOutput
    const dir = typeof opts.out === 'string' ? opts.out : '.'
    await mkdir(dir, { recursive: true })
    const taken = new Set<string>()
    const saved: string[] = []
    for (const file of output.files) {
      const filePath = uniquePath(dir, safeFileName(file.name), taken)
      await saveUrlToFile(file.url, filePath, file.name)
      saved.push(filePath)
      if (!json) {
        o.out.write(`Saved ${filePath} (${formatSize(file.size)}, ${file.kind})\n`)
      }
    }
    if (json) {
      const files = output.files.map((file, i) => ({ ...file, path: saved[i] }))
      o.out.write(`${JSON.stringify({ files }, null, 2)}\n`)
    }
  },
}
