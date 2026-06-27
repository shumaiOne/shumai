import { client } from '@/ui/api/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { useTeamId } from '@/ui/hooks/use-team-id'
import { signOut } from '@/ui/lib/auth-client'
import { useAuthStore } from '@/ui/stores/auth'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { APP_VERSION } from '../version'
import { useTheme } from './theme-provider'
import { m } from '@/ui/paraglide/messages.js'

const Github = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
)

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
          {me?.image && (
            <AvatarImage
              src={me.image}
              alt={me.name}
              className="object-cover rounded-lg w-10 h-10"
            />
          )}
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
          <DropdownMenuSubTrigger>{m.theme()}</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className="justify-between flex items-center"
                onClick={() => setTheme('light')}
              >
                <span>{m.light()}</span>
                {theme === 'light' && <Check className="size-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="justify-between flex items-center"
                onClick={() => setTheme('dark')}
              >
                <span>{m.dark()}</span>
                {theme === 'dark' && <Check className="size-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="justify-between flex items-center"
                onClick={() => setTheme('system')}
              >
                <span>{m.system()}</span>
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
          {m.settings()}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={handleLogout}>
          {m.log_out()}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-xs text-muted-foreground flex items-center gap-2 cursor-pointer focus:bg-accent focus:text-accent-foreground justify-center bg-accent border"
          onClick={() =>
            window.open('https://github.com/shumaiOne/shumai', '_blank', 'noopener,noreferrer')
          }
        >
          <Github className="size-3.5" />
          <span>{m.version({ version: APP_VERSION })}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
