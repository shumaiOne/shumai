export interface SandboxNetworkConfig {
  allowedDomains: string[]
  deniedDomains: string[]
}

export interface SandboxFilesystemConfig {
  denyRead: string[]
  allowWrite: string[]
  denyWrite: string[]
}

export interface SandboxConfig {
  network: SandboxNetworkConfig
  filesystem: SandboxFilesystemConfig
  enableWeakerNestedSandbox?: boolean
}

export type SandboxAskCallback = (params: { host: string; port?: number }) => Promise<boolean>

export interface WrapCommandOptions {
  commandId?: string
}

export interface SandboxProvider {
  initialize(config: SandboxConfig, callback?: SandboxAskCallback): Promise<void>
  wrapCommand(command: string, options?: WrapCommandOptions): Promise<string>
  updateConfig(config: Partial<SandboxConfig>): Promise<void>
  reset(): Promise<void>
  isInitialized(): boolean
  getBlockedHostForCommand(commandId: string): string | null
}
