import type { BunPlugin } from 'bun'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface PdfWorkerPluginOptions {
  /** Source path of the pdf.worker.min.mjs file */
  src?: string
  /** Destination filename in the output directory */
  filename?: string
}

export function pdfWorkerPlugin(options: PdfWorkerPluginOptions = {}): BunPlugin {
  const filename = options.filename ?? 'pdf.worker.min.mjs'
  const defaultSrc = resolve(process.cwd(), 'packages/webui/public/pdf.worker.min.mjs')
  const src = options.src ? resolve(options.src) : defaultSrc

  return {
    name: 'pdf-worker-plugin',
    setup(build) {
      build.onEnd(async () => {
        const outdir = build.config.outdir || 'dist'
        if (outdir.endsWith('/bin') || outdir.endsWith('\\bin')) {
          return
        }
        const dest = join(resolve(process.cwd(), outdir), filename)
        if (existsSync(src)) {
          await Bun.write(dest, Bun.file(src))
        }
      })
    },
  }
}

export default pdfWorkerPlugin
