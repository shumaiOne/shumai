import { Avatar, AvatarFallback } from '@/ui/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { useTeamId } from '@/ui/hooks/use-team-id'
import { useAuthStore } from '@/ui/stores/auth'
import { useNavigate } from '@tanstack/react-router'
import { useTheme } from './theme-provider'
import { client } from '@/ui/api/client'
import { useQuery } from '@tanstack/react-query'
import { signOut } from '@/ui/lib/auth-client'

export function UserMenu() {
  const { clearAuth } = useAuthStore()
  const teamId = useTeamId()

  const { data: me } = useQuery({
    queryKey: ['teams', teamId, 'me'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].me.$get({
        param: { teamId: teamId! },
      })
      if (!res.ok) throw new Error('Failed to fetch me')
      return await res.json()
    },
    enabled: !!teamId,
  })
  const { setTheme } = useTheme()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    clearAuth()
    navigate({ to: '/login' })
  }

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    const names = name.split(' ')
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar>
          <AvatarFallback className="text-black bg-orange-500/80">
            {getInitials(me?.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        {me && (
          <>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{me.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{me.role}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('light')}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>System</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            navigate({
              to: '/teams/$teamId/settings',
              params: { teamId: teamId! },
            })
          }
          disabled={!teamId}
        >
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={handleLogout}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
