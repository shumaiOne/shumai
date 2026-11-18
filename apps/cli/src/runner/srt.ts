import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  SandboxRuntimeConfigSchema,
  type SandboxRuntimeConfig,
} from '@anthropic-ai/sandbox-runtime'
import { bundledSrtVendor } from './srt-vendor'

/** Load the upstream JSON format and supply the helpers bundled with this CLI. */
export async function loadSandbox(configPath: string) {
  const config = SandboxRuntimeConfigSchema.parse(JSON.parse(await readFile(configPath, 'utf8')))
  const directory = await mkdtemp(path.join(tmpdir(), 'shumai-srt-'))
  const cleanup = () => rm(directory, { recursive: true, force: true })
  const asset = async (name: string) => {
    const encoded = bundledSrtVendor?.[name]
    const bytes =
      encoded !== undefined
        ? Buffer.from(encoded, 'base64')
        : await readFile(
            path.join(
              path.dirname(
                createRequire(import.meta.url).resolve(
                  '@anthropic-ai/sandbox-runtime/package.json',
                ),
              ),
              'vendor',
              name,
            ),
          )
    const destination = path.join(directory, path.basename(name))
    await writeFile(destination, bytes, { mode: 0o500 })
    return destination
  }
  try {
    if (process.platform === 'linux' && !config.seccomp?.applyPath) {
      config.seccomp = {
        ...config.seccomp,
        applyPath: await asset(`seccomp/${process.arch}/apply-seccomp`),
      }
    }
    if (process.platform === 'win32' && !config.windows?.srtWin?.path) {
      config.windows = {
        ...config.windows,
        srtWin: {
          ...config.windows?.srtWin,
          path: await asset(`srt-win/${process.arch}/srt-win.exe`),
        },
      }
    }
    if (!config.javaAgentJarPath)
      config.javaAgentJarPath = await asset('java-proxy-agent/srt-proxy-agent.jar')
    return { config: config satisfies SandboxRuntimeConfig, cleanup }
  } catch (error) {
    await cleanup()
    throw error
  }
}
