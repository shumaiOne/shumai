import type { APIRequestContext, BrowserContext } from '@playwright/test'

/** Base URL of the fullstack app under test (must match playwright.config.ts). */
export const E2E_APP_URL = process.env.E2E_APP_URL || 'http://localhost:5200'

export const E2E_PASSWORD = 'Password123!'

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@shumai.local`
}

export interface AuthUser {
  id: string
  email: string
  name: string
}

interface SignupResponse {
  token?: string | null
  user?: AuthUser
  error?: { message?: string } | null
}

/**
 * Creates a user through the better-auth API.
 * When passed a `context.request`, the session cookie is stored in the browser
 * context and the user is logged in.
 */
export async function apiSignup(
  request: APIRequestContext,
  email: string,
  password: string,
  options: { inviteCode?: string } = {},
): Promise<AuthUser> {
  const res = await request.post('/api/auth/sign-up/email', {
    data: {
      name: email,
      email,
      password,
      ...(options.inviteCode ? { inviteCode: options.inviteCode } : {}),
    },
  })
  if (!res.ok()) {
    throw new Error(`Signup API failed (${res.status()}): ${await res.text()}`)
  }
  const body = (await res.json()) as SignupResponse
  if (!body.user) {
    throw new Error(`Signup API returned no user: ${JSON.stringify(body)}`)
  }
  return body.user
}

/**
 * Injects the persisted auth state (zustand `auth-storage`) so the app
 * considers the session logged in. The session cookie must already be present
 * in the context (created via `context.request`).
 */
export async function injectAuthState(context: BrowserContext, user: AuthUser): Promise<void> {
  await context.addInitScript((u) => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: { user: u }, version: 0 }))
  }, user)
}

/** Resolves the id of the first team for the authenticated request context. */
export async function resolveTeamId(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/teams')
  if (!res.ok()) {
    throw new Error(`GET /api/teams failed (${res.status()}): ${await res.text()}`)
  }
  const body = (await res.json()) as { data: { id: string }[] }
  const teamId = body.data?.[0]?.id
  if (!teamId) {
    throw new Error(`No team found in /api/teams response: ${JSON.stringify(body)}`)
  }
  return teamId
}
