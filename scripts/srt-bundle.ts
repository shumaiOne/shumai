import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

/** Keep SRT's native helpers available in both standalone binaries and the Node bundle. */
export function srtBundlePlugin(platform?: string, arch?: string): Bun.BunPlugin {
  return {
    name: 'srt-vendor',
    setup(build) {
      build.onLoad({ filter: /[/\\]runner[/\\]srt-vendor\.ts$/ }, async () => {
        const packageJson = createRequire(
          new URL('../apps/cli/package.json', import.meta.url),
        ).resolve('@anthropic-ai/sandbox-runtime/package.json')
        const names = ['java-proxy-agent/srt-proxy-agent.jar']
        for (const cpu of arch ? [arch] : ['x64', 'arm64']) {
          if (!platform || platform === 'linux') names.push(`seccomp/${cpu}/apply-seccomp`)
          if (!platform || platform === 'windows') names.push(`srt-win/${cpu}/srt-win.exe`)
        }
        const assets = Object.fromEntries(
          await Promise.all(
            names.map(async (name) => [
              name,
              (await readFile(path.join(path.dirname(packageJson), 'vendor', name))).toString(
                'base64',
              ),
            ]),
          ),
        )
        return {
          contents: `export const bundledSrtVendor = ${JSON.stringify(assets)}`,
          loader: 'js',
        }
      })
    },
  }
}
