import { createAuthClient } from 'better-auth/react'
import { oauthProviderClient } from '@better-auth/oauth-provider/client'

export const authClient = createAuthClient({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  baseURL: window.location.origin,
  plugins: [oauthProviderClient()],
})

export const { signIn, signUp, useSession, signOut, resetPassword } = authClient
