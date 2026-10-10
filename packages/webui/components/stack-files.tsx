import type { AssetInfo, StackMember } from '@shumai/dtos'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { client } from '@/ui/api/client'
import { stackMemberLabel } from '@/ui/lib/stack-utils'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'

interface StackFilesProps {
  projectId: string
  file: AssetInfo
  /** Public share pages have no session for the stack lookup. */
  isPublic?: boolean
}

/**
 * The other files of a RAW + JPEG shot, as chips that open each file (JPG, RAF). Shown in the file
 * viewer's sidebar whether or not Stack is on in the browser; renders nothing for a lone file.
 */
export function StackFiles({ projectId, file, isPublic }: StackFilesProps) {
  const navigate = useNavigate()
  const { data: members } = useQuery({
    queryKey: ['file-stack', file.id],
    enabled: !isPublic && !!file.id,
    queryFn: async (): Promise<StackMember[]> => {
      const res = await client.api.files[':fileId'].stack.$get({ param: { fileId: file.id } })
      if (!res.ok) throw new Error('failed to load the files of this shot')
      return (await res.json()).data
    },
  })

  if (!members || members.length < 2) return null

  return (
    <div
      className="shrink-0 space-y-1 border-b border-border/50 px-3 pb-3 pt-2 text-xs"
      data-testid="stack-files"
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {m.stack_files_label()}
      </div>
      <div className="flex flex-wrap gap-1">
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            title={member.name}
            onClick={() =>
              member.id !== file.id &&
              navigate({
                to: '/projects/$projectId/files/$fileId',
                params: { projectId, fileId: member.id },
                search: { version: undefined },
              })
            }
            className={cn(
              'rounded border px-1.5 py-0.5 font-mono text-[11px]',
              member.id === file.id
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:border-primary hover:text-foreground',
            )}
          >
            {stackMemberLabel(member.name)}
          </button>
        ))}
      </div>
    </div>
  )
}
