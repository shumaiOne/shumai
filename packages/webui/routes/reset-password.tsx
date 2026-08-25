import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/ui/stores/auth'
import { z } from 'zod'

const searchSchema = z.object({
  token: z.string().catch(''),
})

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: () => {
    if (useAuthStore.getState().user) {
      throw redirect({
        to: '/',
      })
    }
  },
})
