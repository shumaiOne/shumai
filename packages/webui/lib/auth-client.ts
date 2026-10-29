import { createAuthClient } from 'better-auth/react'
import { oauthProviderClient } from '@better-auth/oauth-provider/client'

export const authClient = createAuthClient({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  baseURL: typeof window !== 'undefined' ? window.location.origin : '',
  plugins: [oauthProviderClient()],
})

export const getAuthSession = async () => authClient.getSession()

export const { signIn, signUp, useSession, signOut, resetPassword } = authClient
