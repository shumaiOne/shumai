import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/ui/components/ui/dialog'
import { Button } from '@/ui/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { useQuery } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { FolderTree } from '@/ui/components/folder-tree'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { m } from '@/ui/paraglide/messages.js'
import type { AssetInfo, ProjectInfo } from '@shumai/dtos'
import { Loader2, Folder } from 'lucide-react'

interface TaskTargetFolderDialogProps {
  teamId: string
  currentProjectId?: string | null
  currentTargetFolderId?: string | null
  isOpen: boolean
  onClose: () => void
  onSelect: (projectId: string, folderId: string, folderName?: string) => void
}

export function TaskTargetFolderDialog({
  teamId,
  currentProjectId,
  currentTargetFolderId,
  isOpen,
  onClose,
  onSelect,
}: TaskTargetFolderDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProjectId || '')
  const [selectedFolder, setSelectedFolder] = useState<AssetInfo | null>(null)

  const { data: projectsData, isLoading: isLoadingProjects } = useQuery({
    queryKey: ['teams', teamId, 'projects'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].projects.$get({
        param: { teamId },
        query: { first: '100' },
      })
      if (!res.ok) throw new Error('Failed to fetch projects')
      return (await res.json()) as unknown as { data: ProjectInfo[] }
    },
    enabled: !!teamId && isOpen,
  })

  const projects = projectsData?.data || []
  const activeProjectId = selectedProjectId || (projects[0]?.id ?? '')
  const selectedProject = projects.find((p) => p.id === activeProjectId)

  const handleConfirm = () => {
    if (!activeProjectId) return
    const folderId = selectedFolder?.id || selectedProject?.rootFolder
    if (folderId) {
      onSelect(activeProjectId, folderId, selectedFolder?.name || selectedProject?.name)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[720px] flex flex-col h-[580px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-primary" />
            <DialogTitle>{m.select_target_folder()}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 overflow-hidden py-2">
          {/* Project Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {m.select_project()}
            </label>
            <Select
              value={activeProjectId}
              onValueChange={(val) => {
                setSelectedProjectId(val)
                setSelectedFolder(null)
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={m.select_project()} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Folder Tree Scroll Area */}
          <div className="space-y-1.5 flex-1 flex flex-col overflow-hidden">
            <label className="text-xs font-medium text-muted-foreground">{m.target_folder()}</label>
            <div className="border rounded-md flex-1 overflow-hidden bg-sidebar/50">
              <ScrollArea className="h-full">
                {selectedProject && selectedProject.rootFolder ? (
                  <FolderTree
                    teamId={teamId}
                    projectId={selectedProject.id}
                    projectName={selectedProject.name}
                    rootFolderId={selectedProject.rootFolder}
                    onSelect={setSelectedFolder}
                    selectedFolderId={
                      selectedFolder?.id || currentTargetFolderId || selectedProject.rootFolder
                    }
                    hideCollections
                    hideShares
                  />
                ) : (
                  <div className="flex items-center justify-center h-full p-6 text-xs text-muted-foreground">
                    {isLoadingProjects ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : (
                      m.no_project_selected()
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {m.cancel()}
          </Button>
          <Button onClick={handleConfirm} disabled={!activeProjectId}>
            {m.confirm()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
