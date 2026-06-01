import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/ui/components/ui/dialog'
import { Button } from '@/ui/components/ui/button'
import { Checkbox } from '@/ui/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { useQuery } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { FolderTree } from './folder-tree'
import { AssetInfo } from '@shumai/dtos'
import { ProjectInfo } from '@shumai/dtos'
import { ScrollArea } from './ui/scroll-area'
import { Loader2 } from 'lucide-react'

interface MoveCopyDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (targetFolderId: string, withComments: boolean) => void
  mode: 'move' | 'copy'
  teamId: string
  currentProjectId: string
}

export function MoveCopyDialog({
  isOpen,
  onClose,
  onConfirm,
  mode,
  teamId,
  currentProjectId,
}: MoveCopyDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(currentProjectId)
  const [selectedFolder, setSelectedFolder] = useState<AssetInfo | null>(null)
  const [withComments, setWithComments] = useState(false)

  const { data: projectsData, isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects', teamId],
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

  const projects = projectsData?.data ?? []
  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  const handleConfirm = () => {
    if (selectedFolder) {
      onConfirm(selectedFolder.id, withComments)
    } else if (selectedProject?.rootFolder) {
      onConfirm(selectedProject.rootFolder, withComments)
    }
  }

  const title = mode === 'move' ? 'Move to' : 'Copy to'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] flex flex-col h-[600px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Select Project</label>
            <Select
              value={selectedProjectId}
              onValueChange={(val) => {
                setSelectedProjectId(val)
                setSelectedFolder(null)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
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

          <div className="flex flex-col gap-2 flex-1 overflow-hidden">
            <label className="text-sm font-medium">Select Folder</label>
            <div className="border rounded-md flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                {selectedProject && selectedProject.rootFolder ? (
                  <FolderTree
                    teamId={teamId}
                    projectId={selectedProject.id}
                    projectName={selectedProject.name}
                    rootFolderId={selectedProject.rootFolder}
                    onSelect={setSelectedFolder}
                    selectedFolderId={selectedFolder?.id || selectedProject.rootFolder}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full p-4">
                    {isLoadingProjects ? (
                      <Loader2 className="animate-spin h-6 w-6" />
                    ) : (
                      'Select a project first'
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {mode === 'copy' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="copy-comments"
                checked={withComments}
                onCheckedChange={(checked) => setWithComments(!!checked)}
              />
              <label
                htmlFor="copy-comments"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Copy comments
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedProject}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
