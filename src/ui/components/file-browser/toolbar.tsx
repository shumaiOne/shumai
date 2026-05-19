import type { SearchCondition, SearchSort } from '@/dtos/search'
import { type FieldInfo as MetadataFieldInfo } from '@/dtos/metadata'
import { client } from '@/ui/api/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { InferRequestType, InferResponseType } from 'hono/client'
import { FieldsManager } from '../fields-manager'
import { ManageFieldsDialog } from '../manage-fields-dialog'
import { MembersDialog } from '../members-dialog'
import { FilterPanel } from '../search/filter-panel'
import { SortControl } from '../search/sort-control'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { ListFilter, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Separator } from '../ui/separator'

type FileBrowserToolbarProps = {
  projectId: string
  fields: MetadataFieldInfo[]
  filterConditions: SearchCondition[]
  onFilterChange: (conditions: SearchCondition[]) => void
  sort?: SearchSort
  onSortChange: (sort?: SearchSort) => void
  isRecentlyDeleted?: boolean
}

export function FileBrowserToolbar({
  projectId,
  fields,
  filterConditions,
  onFilterChange,
  sort,
  onSortChange,
  isRecentlyDeleted,
}: FileBrowserToolbarProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [manageDialogOpen, setManageDialogOpen] = useState(false)
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false)

  const { data: members } = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].members.$get({
        param: { projectId: projectId },
        query: {},
      })
      if (!res.ok) throw new Error('Failed to fetch members')
      return await res.json()
    },
  })

  const { data: teamInfo } = useQuery({
    queryKey: ['projects', projectId, 'team'],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].team.$get({
        param: { projectId: projectId },
      })
      if (!res.ok) throw new Error('Failed to fetch team info')
      return await res.json()
    },
  })

  const { data: me } = useQuery({
    queryKey: ['teams', teamInfo?.teamId, 'me'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].me.$get({
        param: { teamId: teamInfo?.teamId || '' },
      })
      if (!res.ok) throw new Error('Failed to fetch me')
      return await res.json()
    },
    enabled: !!teamInfo?.teamId,
  })

  const $inviteProject = client.api.projects[':projectId'].invite.$post
  const inviteMutation = useMutation<
    InferResponseType<typeof $inviteProject>,
    Error,
    InferRequestType<typeof $inviteProject>
  >({
    mutationFn: async (args) => {
      const res = await $inviteProject(args)
      if (!res.ok) {
        throw new Error('Failed to invite')
      }
      return await res.json()
    },
  })

  const handleManageFields = () => {
    setPopoverOpen(false)
    setManageDialogOpen(true)
  }

  const handleInvite = async (role: 'editor' | 'reviewer') => {
    const res = await inviteMutation.mutateAsync({
      param: { projectId: projectId },
      json: { role },
    })
    return res.code
  }

  const getInitials = (name?: string) => {
    if (!name) return '??'
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <div className="flex items-center justify-between p-2 border-b sticky top-0 bg-background z-10">
      <div className="flex items-center gap-2 h-full">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <div>
              <Button variant="ghost" size="sm">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Fields
              </Button>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <FieldsManager
              projectId={projectId}
              onManageFields={handleManageFields}
              onSave={() => setPopoverOpen(false)}
            />
          </PopoverContent>
        </Popover>
        <Separator orientation="vertical" />

        <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={filterConditions.length > 0 ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8"
              disabled={isRecentlyDeleted}
            >
              <ListFilter className="h-4 w-4 mr-1" />
              Filter
              {filterConditions.length > 0 && (
                <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px]">
                  {filterConditions.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <FilterPanel fields={fields} conditions={filterConditions} onChange={onFilterChange} />
          </PopoverContent>
        </Popover>
        <Separator orientation="vertical" />
        <SortControl
          fields={fields}
          sort={sort}
          onSortChange={onSortChange}
          disabled={isRecentlyDeleted}
        />
      </div>

      <div className="flex items-center gap-2">
        {!isRecentlyDeleted && (
          <div
            className="flex items-center -space-x-2 cursor-pointer hover:opacity-90"
            onClick={() => setIsMembersDialogOpen(true)}
          >
            {members?.slice(0, 3).map((member) => (
              <Avatar key={member.id} className="border-2 border-background w-8 h-8">
                <AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback>
              </Avatar>
            ))}
            {members && members.length > 3 && (
              <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                +{members.length - 3}
              </div>
            )}
          </div>
        )}
      </div>

      <ManageFieldsDialog
        projectId={projectId}
        open={manageDialogOpen}
        onOpenChange={setManageDialogOpen}
      />

      <MembersDialog
        open={isMembersDialogOpen}
        onOpenChange={setIsMembersDialogOpen}
        title="Project Members"
        members={members || []}
        isOwner={me?.role === 'owner'}
        onInvite={handleInvite}
      />
    </div>
  )
}
