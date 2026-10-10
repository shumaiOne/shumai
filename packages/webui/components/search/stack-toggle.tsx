import { Layers } from 'lucide-react'
import { Button } from '@/ui/components/ui/button'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { useUserMetadataStore } from '@/ui/stores/user-metadata'

/** Whether RAW + JPEG shots show as one stacked card, per user, per project. Off by default. */
export const stackMetadataKey = (projectId: string) => `project:${projectId}:stack`

interface StackToggleProps {
  teamId: string
  projectId: string
  disabled?: boolean
}

/** Show each RAW + JPEG shot (DSCF1234.JPG and DSCF1234.RAF) as one card, or every file alone. */
export function StackToggle({ teamId, projectId, disabled }: StackToggleProps) {
  const { metadata, setMetadata } = useUserMetadataStore()
  const key = stackMetadataKey(projectId)
  const on = metadata[key] === true
  return (
    <Button
      variant={on ? 'secondary' : 'ghost'}
      size="sm"
      disabled={disabled}
      aria-pressed={on}
      title={on ? m.stack_toggle_on_hint() : m.stack_toggle_off_hint()}
      className={cn('gap-1.5', !on && 'text-muted-foreground')}
      onClick={() => setMetadata(teamId, key, !on)}
      data-testid="stack-toggle"
    >
      <Layers className="h-4 w-4" />
      <span>{m.stack_toggle()}</span>
    </Button>
  )
}
