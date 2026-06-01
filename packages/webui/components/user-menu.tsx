import { client } from '@/ui/api/client'
import { Avatar, AvatarFallback } from '@/ui/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/ui/components/ui/dropdown-menu'
import { useTeamId } from '@/ui/hooks/use-team-id'
import { signOut } from '@/ui/lib/auth-client'
import { useAuthStore } from '@/ui/stores/auth'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useTheme } from './theme-provider'
import { Check } from 'lucide-react'

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
  const { setTheme, theme } = useTheme()
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
        <Avatar className="rounded-lg w-10 h-10">
          <AvatarFallback className="rounded-lg bg-primary/40 text-foreground">
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
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className="justify-between flex items-center"
                onClick={() => setTheme('light')}
              >
                <span>Light</span>
                {theme === 'light' && <Check className="size-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="justify-between flex items-center"
                onClick={() => setTheme('dark')}
              >
                <span>Dark</span>
                {theme === 'dark' && <Check className="size-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="justify-between flex items-center"
                onClick={() => setTheme('system')}
              >
                <span>System</span>
                {theme === 'system' && <Check className="size-4" />}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
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
