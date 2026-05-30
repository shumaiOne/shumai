import type { ProjectInfo } from '@/dtos/project'
import { client } from '@/ui/api/client'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { InferRequestType, InferResponseType } from 'hono/client'
import { MembersDialog } from '@/ui/components/members-dialog'
import { ProjectDialog } from '@/ui/components/project-dialog'
import { SortDropdown } from '@/ui/components/sort-dropdown'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/ui/components/ui/avatar'
import { Button } from '@/ui/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { ShumaiLogo } from '@/ui/components/ui/icons'
import { formatDateAgo } from '@/ui/lib/time'
import { cn } from '@/ui/lib/utils'
import { useQuery, useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { MoreHorizontal, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Switch } from '@/ui/components/ui/switch'
import { Input } from '@/ui/components/ui/input'

function TeamPage() {
  const { teamId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // State for clicked project for animation
  const [clickedProjectId, setClickedProjectId] = useState<string | null>(null)

  // State for Project Dialog
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const [projectDialogMode, setProjectDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | undefined>(undefined)

  // State for Delete Alert
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<ProjectInfo | undefined>(undefined)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // State for Members Dialog
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false)

  // Sort State
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const $getProjects = client.api.teams[':teamId'].projects.$get
  const { data: projects } = useSuspenseQuery({
    queryKey: ['teams', teamId, 'projects', sortBy, sortDirection],
    queryFn: async () => {
      const res = await $getProjects({
        param: { teamId: teamId },
        query: { sortBy, sortDirection },
      })
      if (!res.ok) throw new Error('Failed to fetch projects')
      return await res.json()
    },
  })

  const { data: members } = useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].members.$get({
        param: { teamId: teamId },
        query: {},
      })
      if (!res.ok) throw new Error('Failed to fetch members')
      return await res.json()
    },
  })

  const { data: me } = useQuery({
    queryKey: ['teams', teamId, 'me'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].me.$get({
        param: { teamId: teamId },
      })
      if (!res.ok) throw new Error('Failed to fetch me')
      return await res.json()
    },
  })

  const $inviteTeam = client.api.teams[':teamId'].invite.$post
  const inviteMutation = useMutation<
    InferResponseType<typeof $inviteTeam>,
    Error,
    InferRequestType<typeof $inviteTeam>
  >({
    mutationFn: async (args) => {
      const res = await $inviteTeam(args)
      if (!res.ok) {
        throw new Error('Failed to invite')
      }
      return await res.json()
    },
  })

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await client.api.projects[':projectId'].$delete({
        param: { projectId },
      })
      if (!res.ok) throw new Error('Failed to delete project')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'projects'] })
    },
  })

  const toggleProjectNotificationsMutation = useMutation({
    mutationFn: async (project: ProjectInfo) => {
      const res = await client.api.projects[':projectId'].$put({
        param: { projectId: project.id! },
        json: {
          enableNotification: !project.enableNotification,
        },
      })
      if (!res.ok) throw new Error('Failed to update project notification settings')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'projects'] })
      toast.success('Project notification settings updated')
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update project notification settings',
      )
    },
  })

  const handleCreateProjectClick = () => {
    setProjectDialogMode('create')
    setSelectedProject(undefined)
    setIsProjectDialogOpen(true)
  }

  const handleCreateCardClick = () => {
    setClickedProjectId('create')
    setTimeout(() => {
      setClickedProjectId(null)
    }, 100)

    setTimeout(() => {
      handleCreateProjectClick()
    }, 200)
  }

  const handleEditProjectClick = (project: ProjectInfo) => {
    setProjectDialogMode('edit')
    setSelectedProject(project)
    setIsProjectDialogOpen(true)
  }

  const handleDeleteProjectClick = (project: ProjectInfo) => {
    setProjectToDelete(project)
    setDeleteConfirmText('')
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (projectToDelete && deleteConfirmText === 'delete') {
      try {
        await deleteProjectMutation.mutateAsync(projectToDelete.id!)
        setIsDeleteDialogOpen(false)
      } catch (error) {
        console.error(error)
      }
    }
  }

  const handleCardClick = (projectId: string, e: React.MouseEvent) => {
    if (e.detail > 1) return

    setClickedProjectId(projectId)

    // Restore scale after 100ms for "shrink and restore" effect
    setTimeout(() => {
      setClickedProjectId(null)
    }, 100)

    // Navigate after 200ms
    setTimeout(() => {
      navigate({
        to: '/projects/$projectId',
        params: { projectId },
      })
    }, 200)
  }

  const handleInvite = async (role: 'editor' | 'reviewer') => {
    const res = await inviteMutation.mutateAsync({
      param: { teamId: teamId },
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

  const handleSortChange = (newSortBy: string, newSortDirection: 'asc' | 'desc') => {
    setSortBy(newSortBy)
    setSortDirection(newSortDirection)
  }

  const safeMembers = Array.isArray(members) ? members : []

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
        <h1 className="text-2xl font-bold">Projects</h1>
        <div className="flex flex-wrap items-center gap-4">
          <div
            className="flex items-center -space-x-2 cursor-pointer hover:opacity-90"
            onClick={() => setIsMembersDialogOpen(true)}
          >
            {safeMembers.slice(0, 3).map((member) => (
              <Avatar key={member.id} className="border-2 border-background w-8 h-8">
                <AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback>
              </Avatar>
            ))}
            {safeMembers.length > 3 && (
              <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                +{safeMembers.length - 3}
              </div>
            )}
          </div>
          <SortDropdown
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
          />
          <Button
            className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
            onClick={handleCreateProjectClick}
          >
            <PlusIcon className="w-4 h-4" />
            Create Project
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-4">
        {projects.data?.map((project: ProjectInfo) => (
          <div
            key={project.id}
            className={cn(
              'shadow-md relative border rounded-xl overflow-hidden cursor-pointer transition-transform duration-100 ease-in-out',
              clickedProjectId === project.id ? 'scale-95' : 'scale-100',
            )}
            onClick={(e) => handleCardClick(project.id!, e)}
          >
            <div className="flex flex-col">
              <div className="relative w-full h-full aspect-square flex items-center justify-center bg-zinc-400/20">
                {project.coverImage ? (
                  <img
                    src={project.coverImage}
                    alt={project.name}
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <div className="text-center text-muted-foreground font-bold tracking-wider z-10">
                    <ShumaiLogo className="w-8 h-8 text-zinc-400" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 w-full h-[65%] bg-linear-to-t from-black/35 to-black/0" />
                <p className="absolute left-1 bottom-2 text-white">{project.name}</p>
              </div>
              <div className="px-2 h-10 flex justify-between items-center">
                <p className="truncate pr-1 text-xs text-muted-foreground">
                  Updated {formatDateAgo((project.updatedAt as string) ?? '')}
                </p>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button className="hover:bg-muted outline-none flex px-1">
                        <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditProjectClick(project)
                        }}
                      >
                        Project Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center justify-between gap-4 cursor-pointer"
                        onSelect={(e) => {
                          e.preventDefault()
                          toggleProjectNotificationsMutation.mutate(project)
                        }}
                      >
                        <span>Notification</span>
                        <Switch
                          checked={project.enableNotification ?? true}
                          className="pointer-events-none"
                        />
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDeleteProjectClick(project)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div
          className={cn(
            'shadow-md relative border rounded-xl overflow-hidden cursor-pointer transition-transform duration-100 ease-in-out border-dashed hover:border-orange-600/50 group',
            clickedProjectId === 'create' ? 'scale-95' : 'scale-100',
          )}
          onClick={handleCreateCardClick}
        >
          <div className="flex flex-col">
            <div className="relative w-full aspect-square flex items-center justify-center bg-zinc-400/5 group-hover:bg-orange-600/5 transition-colors">
              <PlusIcon className="w-8 h-8 text-zinc-400 group-hover:text-orange-600 transition-colors" />
            </div>
            <div className="px-2 h-10 flex items-center justify-center bg-zinc-400/10 border-t group-hover:bg-orange-600/10 transition-colors">
              <p className="text-sm text-muted-foreground group-hover:text-orange-600 transition-colors">
                Create Project
              </p>
            </div>
          </div>
        </div>
      </div>

      <ProjectDialog
        open={isProjectDialogOpen}
        onOpenChange={setIsProjectDialogOpen}
        mode={projectDialogMode}
        teamId={teamId}
        project={selectedProject}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the project &quot;
              {projectToDelete?.name}&quot; and all its assets.
              <div className="mt-4 flex flex-col gap-2 text-foreground">
                <span className="text-sm font-medium">
                  Type <strong>delete</strong> to confirm:
                </span>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="delete"
                  className="h-9"
                  autoFocus
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProjectMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={deleteConfirmText !== 'delete' || deleteProjectMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MembersDialog
        open={isMembersDialogOpen}
        onOpenChange={setIsMembersDialogOpen}
        title="Team Members"
        members={safeMembers}
        isOwner={me?.role === 'owner'}
        onInvite={handleInvite}
      />
    </div>
  )
}

export const Route = createFileRoute('/teams/$teamId/')({
  component: TeamPage,
})
