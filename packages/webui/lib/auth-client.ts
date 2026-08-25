import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  baseURL: window.location.origin,
})

export const { signIn, signUp, useSession, signOut, resetPassword } = authClient
