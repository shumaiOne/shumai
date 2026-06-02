import { bundleWorkflowCode } from '@temporalio/worker'
import type { BunPlugin } from 'bun'
import { resolve } from 'node:path'

export interface TemporalWorkflowPluginOptions {
  /** Query param identifier. Default: 'workflow' */
  identifier?: string
  /** Forwarded to bundleWorkflowCode (minus workflowsPath) */
  bundleOptions?: Omit<Parameters<typeof bundleWorkflowCode>[0], 'workflowsPath'>
}

export function temporalWorkflow(options: TemporalWorkflowPluginOptions = {}): BunPlugin {
  return {
    name: 'temporal-workflow',
    setup(build) {
      // Resolve imports with the workflow query parameter
      build.onResolve({ filter: /:::workflow$/ }, (args) => {
        console.log(args)

        const cleanPath = args.path.split(':::')[0]!
        const resolveDir = args.importer
          ? args.importer.replace(/[/\\\\][^/\\\\]*$/, '')
          : (args.resolveDir ?? process.cwd())
        const resolved = resolve(resolveDir, cleanPath)

        return {
          path: resolved,
          namespace: 'temporal-workflow',
        }
      })

      // Load and bundle workflow code
      build.onLoad({ filter: /.*/, namespace: 'temporal-workflow' }, async (args) => {
        const workflowsPath = args.path

        const bundle = await bundleWorkflowCode({
          workflowsPath,
          ...options.bundleOptions,
        })

        return {
          contents: `export default { code: ${JSON.stringify(bundle.code)}, sourceMap: ${JSON.stringify(bundle.sourceMap ?? '')} };`,
          loader: 'js',
        }
      })
    },
  }
}

export default temporalWorkflow
