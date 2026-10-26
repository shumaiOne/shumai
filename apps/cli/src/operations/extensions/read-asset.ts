import { mkdir, writeFile } from 'node:fs/promises'
import * as path from 'node:path'
import { Option } from 'commander'
import type { AssetReadOutput } from '@shumai/operations'
import { CliError } from '../errors'
import type { CliCommandExtension } from '../generate'
import type { Output } from '../render'

const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'image'
  )
}

/** File name for the n-th image of a read, e.g. `01ABC-1-frame-at-2s.webp`. */
export function imageFileName(
  assetId: string,
  index: number,
  image: AssetReadOutput['images'][number],
): string {
  const ext = EXTENSIONS[image.mimeType] ?? image.mimeType.split('/')[1] ?? 'bin'
  return `${assetId}-${index + 1}-${slug(image.label).replace(/\.+$/, '')}.${ext}`
}

/** Downloads every image of a ready read into `dir`; returns the saved paths in order. */
export async function downloadImages(output: AssetReadOutput, dir: string): Promise<string[]> {
  await mkdir(dir, { recursive: true })
  const saved: string[] = []
  for (const [index, image] of output.images.entries()) {
    if (!image.url) {
      throw new CliError(`No download link was returned for "${image.label}".`)
    }
    let res: Response
    try {
      res = await fetch(image.url)
    } catch (err) {
      throw new CliError(
        `Failed to download "${image.label}": ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    if (!res.ok) {
      throw new CliError(`Failed to download "${image.label}" (status ${res.status}).`)
    }
    const filePath = path.join(dir, imageFileName(output.asset.id, index, image))
    await writeFile(filePath, Buffer.from(await res.arrayBuffer()))
    saved.push(filePath)
  }
  return saved
}

function renderCommand(taskId: string, out: unknown): string {
  const outArg = typeof out === 'string' ? ` --out ${JSON.stringify(out)}` : ''
  return `shumai-cli render ${taskId}${outArg}`
}

function writeReady(output: AssetReadOutput, paths: string[] | null, o: Output): void {
  const lines = [output.summary, ...output.details]
  output.images.forEach((image, i) => {
    lines.push(`- ${image.label}: ${paths ? paths[i] : (image.url ?? '')}`)
  })
  o.out.write(`${lines.join('\n')}\n`)
  if (output.text) {
    o.out.write(`\n${output.text.content}`)
    if (!output.text.content.endsWith('\n')) o.out.write('\n')
    if (output.text.truncated) {
      o.out.write(
        `\n[Content truncated: showing the first part of a ${output.text.size}-byte file.]\n`,
      )
    }
  }
}

/**
 * `read` and `render`: images are printed as links (valid for about an hour) or downloaded
 * with `--out`; a render that takes longer than the wait prints the `render` command to run.
 */
function readExtension(noWaitHelp: string): CliCommandExtension {
  return {
    options: () => [
      new Option('-o, --out <dir>', 'Download the images into this folder and print their paths.'),
      new Option('--no-wait', noWaitHelp),
    ],
    toInput: (input, opts) => (opts.wait === false ? { ...input, maxWaitSeconds: 0 } : input),
    async present(raw, { opts, json, output: o }) {
      const output = raw as AssetReadOutput
      if (output.status === 'pending') {
        if (json) {
          o.out.write(`${JSON.stringify(output, null, 2)}\n`)
          return
        }
        o.out.write(
          `${output.summary}\nRun this to get the result: ${renderCommand(output.taskId ?? '', opts.out)}\n`,
        )
        return
      }

      const paths = typeof opts.out === 'string' ? await downloadImages(output, opts.out) : null
      if (json) {
        const images = output.images.map((image, i) =>
          paths ? { ...image, path: paths[i] } : image,
        )
        o.out.write(`${JSON.stringify({ ...output, images }, null, 2)}\n`)
        return
      }
      writeReady(output, paths, o)
    },
  }
}

export const readAssetExtension = readExtension(
  'Return right away with a task ID if the asset needs rendering.',
)
export const getAssetRenderExtension = readExtension(
  'Check once and return right away if the render is still running.',
)
