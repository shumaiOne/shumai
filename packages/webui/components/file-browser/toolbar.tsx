import { client } from '@/ui/api/client'
import { usePermissions } from '@/ui/hooks/use-permissions'
import { m } from '@/ui/paraglide/messages.js'
import type { AssetInfo, CollectionInfo, SearchCondition, SearchSort } from '@shumai/dtos'
import { type FieldInfo as MetadataFieldInfo } from '@shumai/dtos'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { InferRequestType, InferResponseType } from 'hono/client'
import { useState } from 'react'
import { FieldsManager } from '../fields-manager'
import { FolderTree } from '../folder-tree'
import { ManageFieldsDialog } from '../manage-fields-dialog'
import { MembersDialog } from '../members-dialog'
import { FilterPanel } from '../search/filter-panel'
import { SearchFilterDialog } from '../search/search-filter-dialog'
import { SortControl } from '../search/sort-control'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Separator } from '../ui/separator'

type FileBrowserToolbarProps = {
  teamId: string
  projectId: string
  assetId: string
  fields: MetadataFieldInfo[]
  filterConditions: SearchCondition[]
  onFilterChange: (conditions: SearchCondition[]) => void
  sort?: SearchSort
  onSortChange: (sort?: SearchSort) => void
  isRecentlyDeleted?: boolean
  collection?: CollectionInfo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdateCollection?: (updates: { name?: string; filter?: any }) => void
  rootFolderId?: string
}

export function FileBrowserToolbar({
  teamId,
  projectId,
  assetId,
  fields,
  filterConditions,
  onFilterChange,
  sort,
  onSortChange,
  isRecentlyDeleted,
  collection,
  onUpdateCollection,
  rootFolderId,
}: FileBrowserToolbarProps) {
  const { canEdit } = usePermissions(projectId)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [manageDialogOpen, setManageDialogOpen] = useState(false)
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false)
  const [isFolderSelectorOpen, setIsFolderSelectorOpen] = useState(false)

  const navigate = useNavigate()
  const activeFiltersCount = filterConditions.length
  const isCollection = !!collection
  const queryClient = useQueryClient()

  const { data: folderInfo } = useQuery({
    queryKey: ['folders', assetId],
    queryFn: async () => {
      const res = await client.api.folders[':folderId'].$get({
        param: { folderId: assetId },
      })
      if (!res.ok) throw new Error('failed to fetch folder')
      return (await res.json()) as unknown as AssetInfo
    },
    enabled: !!assetId && !isRecentlyDeleted,
  })

  const handleOpenAgentsMd = () => {
    if (assetId === rootFolderId) {
      navigate({
        to: '/projects/$projectId/agents/md',
        params: { projectId },
      })
    } else {
      navigate({
        to: '/projects/$projectId/folders/$folderId/agents/md',
        params: { projectId, folderId: assetId },
      })
    }
  }

  const { data: members, refetch: refetchProjectMembers } = useQuery({
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

  const { data: teamMembers } = useQuery({
    queryKey: ['teams', teamInfo?.teamId, 'members'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].members.$get({
        param: { teamId: teamInfo?.teamId || '' },
        query: {},
      })
      if (!res.ok) throw new Error('Failed to fetch team members')
      return await res.json()
    },
    enabled: !!teamInfo?.teamId && isMembersDialogOpen,
  })

  const { data: me, refetch: refetchMe } = useQuery({
    queryKey: ['projects', projectId, 'me'],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].me.$get({
        param: { projectId },
      })
      if (!res.ok) throw new Error('Failed to fetch project me')
      return await res.json()
    },
    enabled: !!projectId,
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

  const $addProjectMember = client.api.projects[':projectId'].members.$post
  const addProjectMemberMutation = useMutation<
    InferResponseType<typeof $addProjectMember>,
    Error,
    InferRequestType<typeof $addProjectMember>
  >({
    mutationFn: async (args) => {
      const res = await $addProjectMember(args)
      if (!res.ok) throw new Error('Failed to add project member')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'me'] })
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

  const handleOpenMembersDialog = (open: boolean) => {
    setIsMembersDialogOpen(open)
    if (open) {
      refetchProjectMembers()
      refetchMe()
    }
  }

  const safeProjectMembers = Array.isArray(members) ? members : []
  const safeTeamMembers = Array.isArray(teamMembers) ? teamMembers : []
  const availableMembersToAdd = safeTeamMembers.filter(
    (tm) => !safeProjectMembers.some((pm) => pm.id === tm.id),
  )

  const handleAddProjectMember = async (userId: string, role: 'editor' | 'reviewer' | 'owner') => {
    await addProjectMemberMutation.mutateAsync({
      param: { projectId },
      json: { userId, role },
    })
  }

  const updateMemberRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'editor' | 'reviewer' }) => {
      const res = await client.api.projects[':projectId'].members[':userId'].$patch({
        param: { projectId, userId },
        json: { role },
      })
      if (!res.ok) throw new Error('Failed to update member role')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await client.api.projects[':projectId'].members[':userId'].$delete({
        param: { projectId, userId },
      })
      if (!res.ok) throw new Error('Failed to remove member')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] })
    },
  })

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
                {m.field()}
              </Button>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <FieldsManager
              projectId={projectId}
              onManageFields={canEdit ? handleManageFields : undefined}
              onSave={() => setPopoverOpen(false)}
            />
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" />
        <SortControl
          fields={fields}
          sort={sort}
          onSortChange={onSortChange}
          disabled={isRecentlyDeleted}
        />

        <Separator orientation="vertical" />

        {isCollection ? (
          <>
            <Popover open={isFolderSelectorOpen} onOpenChange={setIsFolderSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="inline-flex items-center gap-2 px-3 py-2 hover:bg-primary/10 font-semibold rounded-xl cursor-pointer h-8 text-muted-foreground"
                >
                  <span className="truncate max-w-[150px]">{folderInfo?.name || 'Loading...'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <div className="h-[400px] flex flex-col">
                  <div className="p-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Select Source Folder
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <FolderTree
                      teamId={teamId}
                      projectId={projectId}
                      projectName="Assets"
                      rootFolderId={rootFolderId!}
                      onSelect={(folder: AssetInfo) => {
                        onUpdateCollection?.({
                          filter: {
                            ...collection.filter,
                            sourceFolderId: folder.id,
                          },
                        })
                        setIsFolderSelectorOpen(false)
                      }}
                      selectedFolderId={collection.filter.sourceFolderId}
                      hideCollections
                      hideShares
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" />

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={activeFiltersCount > 0 ? 'secondary' : 'ghost'}
                  size="sm"
                  className="inline-flex items-center gap-2 px-4 py-2 hover:bg-primary/10 font-semibold rounded-xl cursor-pointer h-8"
                >
                  <span>Filter</span>
                  {activeFiltersCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/50 border border-primary-foreground/20">
                      {activeFiltersCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0 overflow-hidden" align="start">
                <div className="max-h-[80vh] overflow-y-auto">
                  <FilterPanel
                    fields={fields}
                    conditions={filterConditions}
                    onChange={(newConditions) => {
                      onFilterChange(newConditions)
                      onUpdateCollection?.({
                        filter: {
                          ...collection.filter,
                          searchFilter: {
                            ...collection.filter.searchFilter,
                            conditions: newConditions,
                          },
                        },
                      })
                    }}
                    excludeFields={[]}
                    hidePrefix
                  />
                </div>
              </PopoverContent>
            </Popover>
          </>
        ) : (
          <>
            <Button
              onClick={() => setSearchDialogOpen(true)}
              disabled={isRecentlyDeleted}
              variant={activeFiltersCount > 0 ? 'secondary' : 'ghost'}
              size="sm"
              className="inline-flex items-center gap-2 px-4 py-2 hover:bg-primary/10 font-semibold rounded-xl cursor-pointer h-8"
            >
              <span>{m.search()}</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/50 border border-primary-foreground/20">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            {!isRecentlyDeleted && (
              <>
                <Separator orientation="vertical" />
                <Button
                  onClick={handleOpenAgentsMd}
                  variant="ghost"
                  size="sm"
                  className="inline-flex items-center gap-1.5 px-3 py-2 hover:bg-primary/10 font-semibold rounded-xl cursor-pointer h-8"
                  title="AGENTS.md"
                >
                  <span>{m.agents_md()}</span>
                  {folderInfo?.hasAgentsMd && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </Button>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!isRecentlyDeleted && (
          <div
            className="flex items-center -space-x-2 cursor-pointer hover:opacity-90"
            data-testid="project-members-trigger"
            onClick={() => handleOpenMembersDialog(true)}
          >
            {members?.slice(0, 3).map((member) => (
              <Avatar key={member.id} className="border-2 border-background w-8 h-8">
                {member.image && (
                  <AvatarImage src={member.image} alt={member.name} className="object-cover" />
                )}
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
        onOpenChange={handleOpenMembersDialog}
        title={m.project_members()}
        type="project"
        members={members || []}
        isOwner={me?.role === 'owner'}
        onInvite={handleInvite}
        onUpdateRole={async (memberId, role) => {
          await updateMemberRoleMutation.mutateAsync({ userId: memberId, role })
        }}
        onRemoveMember={async (memberId) => {
          await removeMemberMutation.mutateAsync(memberId)
        }}
        currentUserId={me?.id}
        availableMembersToAdd={availableMembersToAdd}
        onAddMember={handleAddProjectMember}
      />

      <SearchFilterDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        teamId={teamId}
        projectId={projectId}
        assetId={assetId}
        fields={fields}
        initialConditions={filterConditions}
        onApply={onFilterChange}
      />
    </div>
  )
}
