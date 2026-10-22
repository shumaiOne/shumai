import { prisma } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'
import { logger } from '@shumai/core/src/logger'

export interface IntegrationEnvKeys {
  url: string[]
  username?: string[]
  password?: string[]
}

export interface IntegrationDefinition<TKey extends keyof PrismaJson.Settings> {
  name: string
  settingsKey: TKey
  envKeys: IntegrationEnvKeys
}

export interface ResolvedIntegrationConfig {
  url?: string
  username?: string
  password?: string
  isEnv: boolean
}

export interface IntegrationSettingsResponse {
  url?: string
  username?: string
  hasPassword: boolean
  isEnvConfigured: boolean
}

export interface UpdateIntegrationSettingsRequest {
  url?: string
  username?: string
  password?: string
}

function getFirstEnvValue(keys?: string[]): string | undefined {
  if (!keys) return undefined
  for (const key of keys) {
    const val = process.env[key]?.trim()
    if (val) return val
  }
  return undefined
}

export async function resolveIntegrationConfig<TKey extends keyof PrismaJson.Settings>(
  def: IntegrationDefinition<TKey>,
  teamId?: string,
): Promise<ResolvedIntegrationConfig> {
  const envUrl = getFirstEnvValue(def.envKeys.url)
  const envUsername = getFirstEnvValue(def.envKeys.username)
  const envPassword = getFirstEnvValue(def.envKeys.password)

  if (envUrl) {
    return {
      url: envUrl.replace(/\/+$/, ''),
      username: envUsername || undefined,
      password: envPassword || undefined,
      isEnv: true,
    }
  }

  if (teamId) {
    try {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { settings: true },
      })
      const teamSettings = team?.settings as PrismaJson.Settings | null
      const serviceSettings = teamSettings?.[def.settingsKey] as
        { url?: string; username?: string; password?: string } | undefined

      if (serviceSettings?.url?.trim()) {
        return {
          url: serviceSettings.url.trim().replace(/\/+$/, ''),
          username: serviceSettings.username?.trim() || undefined,
          password: serviceSettings.password?.trim() || undefined,
          isEnv: false,
        }
      }
    } catch (err) {
      logger.error({ err, teamId }, `Failed to load team ${def.name} settings`)
    }
  }

  return {
    isEnv: false,
  }
}

export async function getIntegrationSettings<TKey extends keyof PrismaJson.Settings>(
  def: IntegrationDefinition<TKey>,
  teamId: string,
): Promise<IntegrationSettingsResponse> {
  const config = await resolveIntegrationConfig(def, teamId)
  return {
    url: config.url,
    username: config.username,
    hasPassword: Boolean(config.password),
    isEnvConfigured: config.isEnv,
  }
}

export async function updateIntegrationSettings<TKey extends keyof PrismaJson.Settings>(
  def: IntegrationDefinition<TKey>,
  teamId: string,
  req: UpdateIntegrationSettingsRequest,
): Promise<IntegrationSettingsResponse> {
  const currentConfig = await resolveIntegrationConfig(def, teamId)
  if (currentConfig.isEnv) {
    throw new Error(
      `${def.name} settings are configured via environment variables and cannot be edited`,
    )
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { settings: true },
  })
  const settings = { ...((team?.settings || {}) as PrismaJson.Settings) }
  const prevSettings = (settings[def.settingsKey] || {}) as {
    url?: string
    username?: string
    password?: string
  }

  const trimmedUrl = req.url?.trim()
  if (!trimmedUrl) {
    // If URL is empty/unset, clear the integration settings
    delete settings[def.settingsKey]
  } else {
    const updatedServiceSettings: { url: string; username?: string; password?: string } = {
      url: trimmedUrl.replace(/\/+$/, ''),
      username:
        req.username !== undefined ? req.username.trim() || undefined : prevSettings.username,
      password: req.password !== undefined ? req.password : prevSettings.password,
    }
    settings[def.settingsKey] = updatedServiceSettings as unknown as PrismaJson.Settings[TKey]
  }

  await prisma.team.update({
    where: { id: teamId },
    data: { settings },
  })

  return getIntegrationSettings(def, teamId)
}

export async function resolveTestConnectionConfig<TKey extends keyof PrismaJson.Settings>(
  def: IntegrationDefinition<TKey>,
  config?: UpdateIntegrationSettingsRequest,
  teamId?: string,
): Promise<{ resolvedUrl?: string; resolvedUsername?: string; resolvedPassword?: string }> {
  let resolvedUrl = config?.url?.trim()
  let resolvedUsername = config?.username?.trim()
  let resolvedPassword = config?.password

  if (teamId && (!resolvedUrl || resolvedPassword === undefined)) {
    const savedConfig = await resolveIntegrationConfig(def, teamId)
    if (!resolvedUrl) {
      resolvedUrl = savedConfig.url
    }
    if (!resolvedUsername && savedConfig.username) {
      resolvedUsername = savedConfig.username
    }
    if (resolvedPassword === undefined) {
      resolvedPassword = savedConfig.password
    }
  }

  return {
    resolvedUrl,
    resolvedUsername,
    resolvedPassword,
  }
}

export function getIntegrationBasicAuthHeader(config: {
  username?: string
  password?: string
}): string | undefined {
  if (config.username && config.password) {
    const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64')
    return `Basic ${credentials}`
  }
  return undefined
}
