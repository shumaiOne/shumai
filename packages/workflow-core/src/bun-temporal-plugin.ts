import { bundleWorkflowCode } from '@temporalio/worker'
import type { BunPlugin } from 'bun'
import { resolve, dirname } from 'node:path'

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

        // The bundleOptions contains raw parameters for Temporal bundleWorkflowCode which uses Webpack.
        // We cast options.bundleOptions to any to check for webpackConfigHook.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const originalHook = (options.bundleOptions as any)?.webpackConfigHook
        const bundleOptions = {
          ...options.bundleOptions,
          // Webpack config is untyped inside Temporal's webpackConfigHook callback.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          webpackConfigHook: (config: any) => {
            config.resolve = config.resolve || {}
            config.resolve.alias = {
              ...config.resolve.alias,
              '@shumai/workflow-core':
                require.resolve('@shumai/workflow-core/src/workflow-utils.ts'),
              '@temporalio/workflow': dirname(
                require.resolve('@temporalio/workflow/package.json'),
              ),
            }
            console.log('Webpack config aliases:', config.resolve.alias)
            if (originalHook) {
              return originalHook(config)
            }
            return config
          },
        }

        const bundle = await bundleWorkflowCode({
          workflowsPath,
          ...bundleOptions,
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
