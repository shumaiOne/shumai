import { TeamSelector } from '@/ui/components/team-selector'
import { useAuthStore } from '@/ui/stores/auth'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

function IndexPage() {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      navigate({
        to: '/login',
      })
    }
  }, [user, navigate])

  if (!user) return null

  return <TeamSelector />
}

export const Route = createFileRoute('/')({
  component: IndexPage,
})
