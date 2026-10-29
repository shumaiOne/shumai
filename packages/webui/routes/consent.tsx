import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAuthSession } from '@/ui/lib/auth-client'
import { useAuthStore } from '@/ui/stores/auth'
import { z } from 'zod'

const searchSchema = z
  .object({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    client_id: z.string().optional().catch(''),
    scope: z.string().optional().catch(''),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    redirect_uri: z.string().optional().catch(''),
  })
  .passthrough()

export const Route = createFileRoute('/consent')({
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: async () => {
    let currentUser = useAuthStore.getState().user
    if (!currentUser) {
      try {
        const sessionData = await getAuthSession()
        if (sessionData?.data?.user) {
          useAuthStore.getState().setUser(sessionData.data.user)
          currentUser = sessionData.data.user
        }
      } catch {
        // Fall through to redirect
      }
    }

    if (!currentUser) {
      throw redirect({
        to: '/login',
      })
    }
  },
})
