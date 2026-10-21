import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/ui/stores/auth'
import { z } from 'zod'

const searchSchema = z.object({
  token: z.string().catch(''),
})

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: ({ search }) => {
    // If a reset token is present in the URL, prioritize password recovery
    // and clear any stale local auth state so the user can cleanly reset and log in
    if (search.token) {
      if (useAuthStore.getState().user) {
        useAuthStore.getState().clearAuth()
      }
      return
    }

    if (useAuthStore.getState().user) {
      throw redirect({
        to: '/',
      })
    }
  },
})
