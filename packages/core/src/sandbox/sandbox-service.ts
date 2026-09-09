import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { logger } from '../logger'
import { prisma } from '@shumai/db'
import type {
  SandboxProvider,
  SandboxConfig,
  SandboxAskCallback,
  WrapCommandOptions,
} from './types'
import { LocalSandboxProvider } from './providers/local-provider'

export class SandboxService {
  private provider: SandboxProvider
  private isInit = false
  private initPromise: Promise<void> | null = null
  private currentAllowedDomains: string[] = []
  private teamId: string | null = null
  private lastBlockedHost = ''
  private syncQueue: Promise<void> = Promise.resolve()

  constructor(provider?: SandboxProvider) {
    this.provider = provider ?? new LocalSandboxProvider()
  }

  setProvider(provider: SandboxProvider): void {
    this.provider = provider
    this.isInit = false
    this.initPromise = null
    this.currentAllowedDomains = []
    this.lastBlockedHost = ''
    this.syncQueue = Promise.resolve()
  }

  getProvider(): SandboxProvider {
    return this.provider
  }

  isInitialized(): boolean {
    return this.isInit && this.provider.isInitialized()
  }

  getCurrentAllowedDomains(): string[] {
    return [...this.currentAllowedDomains]
  }

  async ensureInitialized(initialConfig?: {
    allowedDomains?: string[]
    teamId?: string
  }): Promise<void> {
    if (this.isInitialized()) return

    if (this.initPromise) {
      await this.initPromise
      return
    }

    this.initPromise = (async () => {
      try {
        let teamId = initialConfig?.teamId ?? this.teamId
        if (!teamId) {
          const defaultTeam = await prisma.team.findFirst({ select: { id: true } })
          teamId = defaultTeam?.id ?? null
        }
        this.teamId = teamId

        let allowedDomains = initialConfig?.allowedDomains
        if (!allowedDomains && teamId) {
          const sandbox = await prisma.sandbox.findUnique({
            where: { teamId },
          })
          allowedDomains = sandbox?.networkSandboxEnabled ? sandbox.allowedDomains : ['*']
        }
        allowedDomains = allowedDomains ?? ['*']

        const piDir = path.join(process.cwd(), '.pi')
        if (!fs.existsSync(piDir)) fs.mkdirSync(piDir, { recursive: true })

        const callback: SandboxAskCallback = async ({ host }) => {
          return this.handleAskCallback(host)
        }

        const config: SandboxConfig = {
          network: {
            allowedDomains,
            deniedDomains: [],
          },
          filesystem: {
            denyRead: ['.env', '.env.*', '*.pem', '*.key'],
            allowWrite: [piDir, os.tmpdir()],
            denyWrite: ['.env', '.env.*', '*.pem', '*.key'],
          },
          enableWeakerNestedSandbox: process.env.ENABLE_WEAKER_NESTED_SANDBOX === 'true',
        }

        await this.provider.initialize(config, callback)
        this.currentAllowedDomains = [...allowedDomains]
        this.isInit = true
        logger.debug({ allowedDomains }, 'Sandbox initialized successfully')
      } catch (err) {
        logger.error({ err }, 'Failed to initialize sandbox')
        throw err
      } finally {
        this.initPromise = null
      }
    })()

    await this.initPromise
  }

  async syncAllowedDomains(incomingDomains: string[], teamId?: string): Promise<void> {
    const runSync = async () => {
      if (teamId) {
        this.teamId = teamId
      }

      if (!this.isInitialized()) {
        await this.ensureInitialized({ allowedDomains: incomingDomains, teamId })
      }

      if (this.areDomainsEqual(this.currentAllowedDomains, incomingDomains)) {
        return
      }

      try {
        await this.provider.updateConfig({
          network: {
            allowedDomains: incomingDomains,
            deniedDomains: [],
          },
        })
        this.currentAllowedDomains = [...incomingDomains]
        logger.debug({ incomingDomains }, 'Sandbox allowed domains hot-reloaded successfully')
      } catch (err) {
        logger.error({ err, incomingDomains }, 'Failed to hot-reload sandbox allowed domains')
        throw err
      }
    }

    const previous = this.syncQueue
    const current = (async () => {
      try {
        await previous
      } catch {
        // Ignore errors from previous syncs so subsequent calls proceed
      }
      return runSync()
    })()

    this.syncQueue = current
    await current
  }

  async wrapCommand(command: string, options?: WrapCommandOptions): Promise<string> {
    if (!this.isInitialized()) {
      await this.ensureInitialized()
    }
    return this.provider.wrapCommand(command, options)
  }

  getBlockedHost(commandId?: string): string {
    if (commandId) {
      return this.provider.getBlockedHostForCommand(commandId) ?? ''
    }
    return this.lastBlockedHost
  }

  clearBlockedHost(): void {
    this.lastBlockedHost = ''
  }

  async reset(): Promise<void> {
    await this.provider.reset()
    this.isInit = false
    this.initPromise = null
    this.currentAllowedDomains = []
    this.lastBlockedHost = ''
    this.teamId = null
    this.syncQueue = Promise.resolve()
  }

  private async handleAskCallback(host: string): Promise<boolean> {
    const teamId = this.teamId
    if (teamId) {
      try {
        const sandbox = await prisma.sandbox.findUnique({
          where: { teamId },
        })
        if (sandbox && !sandbox.networkSandboxEnabled) {
          return true
        }
        const pendingDomains = sandbox?.pendingDomains || []
        if (!pendingDomains.includes(host)) {
          await prisma.sandbox.upsert({
            where: { teamId },
            create: {
              teamId,
              pendingDomains: [host],
            },
            update: {
              pendingDomains: {
                push: host,
              },
            },
          })
        }
      } catch (err) {
        logger.error({ err, host, teamId }, 'Failed to update sandbox pending domains')
      }
    }

    this.lastBlockedHost = host
    return false
  }

  private areDomainsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    const setA = new Set(a)
    return b.every((domain) => setA.has(domain))
  }
}

export const sandboxService = new SandboxService()
