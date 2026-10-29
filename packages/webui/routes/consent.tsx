import { createFileRoute, redirect } from '@tanstack/react-router'
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
  beforeLoad: () => {
    if (!useAuthStore.getState().user) {
      if (typeof window !== 'undefined') {
        window.location.href = `/login${window.location.search}`
      }
      throw redirect({
        to: '/login',
      })
    }
  },
})
