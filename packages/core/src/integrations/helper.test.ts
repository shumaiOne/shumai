import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import {
  IntegrationDefinition,
  resolveIntegrationConfig,
  getIntegrationSettings,
  updateIntegrationSettings,
  resolveTestConnectionConfig,
  getIntegrationBasicAuthHeader,
} from './helper'

const TEST_INTEGRATION_DEF: IntegrationDefinition<'turntable'> = {
  name: 'TestIntegration',
  settingsKey: 'turntable',
  envKeys: {
    url: ['TEST_INTEGRATION_URL', 'FALLBACK_INTEGRATION_URL'],
    username: ['TEST_INTEGRATION_USERNAME'],
    password: ['TEST_INTEGRATION_PASSWORD'],
  },
}

describe('Integration Config Helper', () => {
  setupTestDbHooks()

  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.TEST_INTEGRATION_URL
    delete process.env.FALLBACK_INTEGRATION_URL
    delete process.env.TEST_INTEGRATION_USERNAME
    delete process.env.TEST_INTEGRATION_PASSWORD
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('resolveIntegrationConfig', () => {
    it('prioritizes environment variables over database settings', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Test Team',
          settings: {
            turntable: {
              url: 'http://db-server:1234',
              username: 'db-user',
              password: 'db-password',
            },
          },
        },
      })

      process.env.TEST_INTEGRATION_URL = 'http://env-server:5678/'
      process.env.TEST_INTEGRATION_USERNAME = 'env-user'
      process.env.TEST_INTEGRATION_PASSWORD = 'env-pass'

      const config = await resolveIntegrationConfig(TEST_INTEGRATION_DEF, team.id)
      expect(config).toEqual({
        url: 'http://env-server:5678',
        username: 'env-user',
        password: 'env-pass',
        isEnv: true,
      })
    })

    it('falls back to second env key if first is missing', async () => {
      process.env.FALLBACK_INTEGRATION_URL = 'http://fallback-server:8080'

      const config = await resolveIntegrationConfig(TEST_INTEGRATION_DEF)
      expect(config.url).toBe('http://fallback-server:8080')
      expect(config.isEnv).toBe(true)
    })

    it('reads from team settings when environment variables are not set', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Test Team',
          settings: {
            turntable: {
              url: 'http://db-server:1234/',
              username: 'db-user',
              password: 'db-password',
            },
          },
        },
      })

      const config = await resolveIntegrationConfig(TEST_INTEGRATION_DEF, team.id)
      expect(config).toEqual({
        url: 'http://db-server:1234',
        username: 'db-user',
        password: 'db-password',
        isEnv: false,
      })
    })

    it('returns isEnv: false and undefined fields when neither env nor DB are set', async () => {
      const team = await prisma.team.create({
        data: { name: 'Empty Team' },
      })

      const config = await resolveIntegrationConfig(TEST_INTEGRATION_DEF, team.id)
      expect(config).toEqual({
        isEnv: false,
      })
    })
  })

  describe('getIntegrationSettings', () => {
    it('returns safe response masking password', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Test Team',
          settings: {
            turntable: {
              url: 'http://db-server:1234',
              username: 'db-user',
              password: 'db-password',
            },
          },
        },
      })

      const res = await getIntegrationSettings(TEST_INTEGRATION_DEF, team.id)
      expect(res).toEqual({
        url: 'http://db-server:1234',
        username: 'db-user',
        hasPassword: true,
        isEnvConfigured: false,
      })
    })
  })

  describe('updateIntegrationSettings', () => {
    it('throws error when environment variable is configured', async () => {
      const team = await prisma.team.create({
        data: { name: 'Test Team' },
      })

      process.env.TEST_INTEGRATION_URL = 'http://env-server:5678'

      await expect(
        updateIntegrationSettings(TEST_INTEGRATION_DEF, team.id, {
          url: 'http://new-url:1234',
        }),
      ).rejects.toThrow(
        'TestIntegration settings are configured via environment variables and cannot be edited',
      )
    })

    it('updates settings and preserves existing password when not supplied', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Test Team',
          settings: {
            turntable: {
              url: 'http://original:1234',
              username: 'original-user',
              password: 'secret-password',
            },
          },
        },
      })

      const res = await updateIntegrationSettings(TEST_INTEGRATION_DEF, team.id, {
        url: 'http://updated:5678/',
        username: 'new-user',
      })

      expect(res).toEqual({
        url: 'http://updated:5678',
        username: 'new-user',
        hasPassword: true,
        isEnvConfigured: false,
      })

      const config = await resolveIntegrationConfig(TEST_INTEGRATION_DEF, team.id)
      expect(config.password).toBe('secret-password')
    })

    it('clears settings in database when URL is empty or whitespace', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Test Team',
          settings: {
            turntable: {
              url: 'http://to-be-cleared:1234',
              username: 'user',
              password: 'pwd',
            },
          },
        },
      })

      const res = await updateIntegrationSettings(TEST_INTEGRATION_DEF, team.id, {
        url: '   ',
      })

      expect(res).toEqual({
        url: undefined,
        username: undefined,
        hasPassword: false,
        isEnvConfigured: false,
      })

      const updatedTeam = await prisma.team.findUnique({
        where: { id: team.id },
      })
      // Check that turntable is removed from team settings
      expect((updatedTeam?.settings as Record<string, unknown>)?.turntable).toBeUndefined()
    })
  })

  describe('resolveTestConnectionConfig', () => {
    it('uses provided credentials directly when supplied', async () => {
      const target = await resolveTestConnectionConfig(TEST_INTEGRATION_DEF, {
        url: 'http://direct:1234',
        username: 'direct-user',
        password: 'direct-password',
      })

      expect(target).toEqual({
        resolvedUrl: 'http://direct:1234',
        resolvedUsername: 'direct-user',
        resolvedPassword: 'direct-password',
      })
    })

    it('falls back to saved database settings when testing with partial inputs', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Test Team',
          settings: {
            turntable: {
              url: 'http://db:1234',
              username: 'db-user',
              password: 'db-password',
            },
          },
        },
      })

      const target = await resolveTestConnectionConfig(
        TEST_INTEGRATION_DEF,
        { url: 'http://new-url:9999' },
        team.id,
      )

      expect(target).toEqual({
        resolvedUrl: 'http://new-url:9999',
        resolvedUsername: 'db-user',
        resolvedPassword: 'db-password',
      })
    })
  })

  describe('getIntegrationBasicAuthHeader', () => {
    it('generates base64 basic auth header when username and password are provided', () => {
      const header = getIntegrationBasicAuthHeader({ username: 'admin', password: 'secret' })
      expect(header).toBe(`Basic ${Buffer.from('admin:secret').toString('base64')}`)
    })

    it('returns undefined when username or password is missing', () => {
      expect(getIntegrationBasicAuthHeader({ username: 'admin' })).toBeUndefined()
      expect(getIntegrationBasicAuthHeader({ password: 'secret' })).toBeUndefined()
      expect(getIntegrationBasicAuthHeader({})).toBeUndefined()
    })
  })
})
