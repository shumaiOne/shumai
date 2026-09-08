import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import type {
  SandboxProvider,
  SandboxConfig,
  SandboxAskCallback,
  WrapCommandOptions,
} from '../types'

export class LocalSandboxProvider implements SandboxProvider {
  private initialized = false

  async initialize(config: SandboxConfig, callback?: SandboxAskCallback): Promise<void> {
    await SandboxManager.initialize(
      {
        network: config.network,
        filesystem: config.filesystem,
        enableWeakerNestedSandbox: config.enableWeakerNestedSandbox,
      },
      callback,
    )
    this.initialized = true
  }

  async wrapCommand(command: string, options?: WrapCommandOptions): Promise<string> {
    return SandboxManager.wrapWithSandbox(
      command,
      undefined,
      undefined,
      undefined,
      options?.commandId ? { commandId: options.commandId } : undefined,
    )
  }

  async updateConfig(config: Partial<SandboxConfig>): Promise<void> {
    const current = SandboxManager.getConfig()
    if (!current) {
      throw new Error('Cannot update sandbox config before initialization')
    }
    const updated = {
      ...current,
      ...(config.network && {
        network: {
          ...current.network,
          ...config.network,
        },
      }),
      ...(config.filesystem && {
        filesystem: {
          ...current.filesystem,
          ...config.filesystem,
        },
      }),
      ...(config.enableWeakerNestedSandbox !== undefined && {
        enableWeakerNestedSandbox: config.enableWeakerNestedSandbox,
      }),
    }
    SandboxManager.updateConfig(updated)
  }

  async reset(): Promise<void> {
    await SandboxManager.reset()
    this.initialized = false
  }

  isInitialized(): boolean {
    return this.initialized && SandboxManager.isSandboxingEnabled()
  }

  getBlockedHostForCommand(commandId: string): string | null {
    try {
      const store = SandboxManager.getSandboxViolationStore()
      const violations = store.getViolationsForCommand(commandId)
      for (let i = violations.length - 1; i >= 0; i--) {
        const line = violations[i]?.line
        if (!line) continue
        const m1 = line.match(/deny network-outbound ([^:\s]+)/)
        if (m1?.[1]) return m1[1]
        const m2 = line.match(/https?:\/\/([^:/\s]+)/)
        if (m2?.[1]) return m2[1]
      }
    } catch {
      // Violation store query failed or not available
    }
    return null
  }
}
