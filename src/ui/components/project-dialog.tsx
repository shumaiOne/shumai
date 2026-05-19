import { client } from '@/ui/api/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType, InferRequestType } from 'hono/client'
import type { ProjectInfo } from '@/dtos/project'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface ProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  teamId: string
  project?: ProjectInfo
}

export function ProjectDialog({ open, onOpenChange, mode, teamId, project }: ProjectDialogProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')

  // Cover Image State
  const [coverImageKey, setCoverImageKey] = useState<string | undefined>(undefined)
  const [coverImagePreview, setCoverImagePreview] = useState<string | undefined>(undefined)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && project) {
        setName(project.name || '')
        setCoverImageKey(project.coverImageKey)
        setCoverImagePreview(project.coverImage)
      } else {
        setName('')
        setCoverImageKey(undefined)
        setCoverImagePreview(undefined)
      }
    }
  }, [open, mode, project])

  const $post = client.api.teams[':teamId'].projects.$post
  const { mutate: createProject } = useMutation<
    InferResponseType<typeof $post>,
    Error,
    InferRequestType<typeof $post>['json']
  >({
    mutationFn: async (payload) => {
      const res = await $post({ param: { teamId: teamId }, json: payload })
      if (!res.ok) throw new Error('Failed to create project')
      return await res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'projects'],
      })
      onOpenChange(false)
      navigate({
        to: '/projects/$projectId',
        params: { projectId: data.id! },
      })
    },
  })

  const $put = client.api.teams[':teamId'].projects[':projectId'].$put
  const { mutate: updateProject } = useMutation<
    InferResponseType<typeof $put>,
    Error,
    InferRequestType<typeof $put>['json']
  >({
    mutationFn: async (payload) => {
      const res = await $put({
        param: { teamId: teamId, projectId: project!.id! },
        json: payload,
      })
      if (!res.ok) throw new Error('Failed to update project')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['teams', teamId, 'projects'],
      })
      onOpenChange(false)
    },
  })

  const $upload = client.api.teams[':teamId'].files.$post
  const { mutate: uploadFile } = useMutation<
    InferResponseType<typeof $upload>,
    Error,
    { file: File }
  >({
    mutationFn: async ({ file }) => {
      const res = await $upload({
        param: { teamId: teamId },
        form: {
          file: file,
        },
      })
      if (!res.ok) throw new Error('Failed to upload file')
      return await res.json()
    },
    onSuccess: (data) => {
      if (typeof data === 'object' && 'key' in data) {
        setCoverImageKey(data.key)
      }
      setIsUploading(false)
    },
    onError: () => {
      setIsUploading(false)
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setIsUploading(true)
      // Create local preview
      const objectUrl = URL.createObjectURL(file)
      setCoverImagePreview(objectUrl)

      // Upload
      uploadFile({
        file: file,
      })
    }
  }

  const handleImageAreaClick = () => {
    fileInputRef.current?.click()
  }

  const handleSubmit = () => {
    if (!name.trim()) return

    if (mode === 'create') {
      createProject({
        name: name.trim(),
        coverImageKey: coverImageKey,
      })
    } else if (mode === 'edit' && project?.id) {
      updateProject({
        name: name.trim(),
        coverImageKey: coverImageKey,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create Project' : 'Project Settings'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Configure your new project.'
              : 'Update your project configuration.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Cover Image Upload Section */}
          <div className="flex flex-col items-center justify-center gap-2">
            <Label>Cover Image</Label>
            <div
              className="relative w-full h-40 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer overflow-hidden hover:bg-muted/50 transition-colors"
              onClick={handleImageAreaClick}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
              {isUploading ? (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : null}

              {coverImagePreview ? (
                <img
                  src={coverImagePreview}
                  alt="Cover Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Upload className="w-8 h-8" />
                  <span className="text-sm">Upload Image</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={!name.trim() || isUploading}>
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
