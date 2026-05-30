import type { ProjectInfo } from '@/dtos/project'
import { client } from '@/ui/api/client'
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
import { Switch } from '@/ui/components/ui/switch'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { InferRequestType, InferResponseType } from 'hono/client'
import { Bell, Check, Loader2, Sliders, Sparkles, Upload, X } from 'lucide-react'
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
  const [enableNotification, setEnableNotification] = useState(true)

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
        setEnableNotification(project.enableNotification !== false)
      } else {
        setName('')
        setCoverImageKey(undefined)
        setCoverImagePreview(undefined)
        setEnableNotification(true)
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
      const dataObj = data as Record<string, unknown>
      if (dataObj && typeof dataObj.id === 'string') {
        navigate({
          to: '/projects/$projectId',
          params: { projectId: dataObj.id },
        })
      }
    },
  })

  const $put = client.api.projects[':projectId'].$put
  const { mutate: updateProject } = useMutation<
    InferResponseType<typeof $put>,
    Error,
    InferRequestType<typeof $put>['json']
  >({
    mutationFn: async (payload) => {
      const res = await $put({
        param: { projectId: project!.id! },
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
      const obj = data as Record<string, unknown>
      if (obj && typeof obj.key === 'string') {
        setCoverImageKey(obj.key)
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

  const handleRemoveCover = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCoverImageKey(undefined)
    setCoverImagePreview(undefined)
  }

  const handleSubmit = () => {
    if (!name.trim()) return

    if (mode === 'create') {
      createProject({
        name: name.trim(),
        coverImageKey: coverImageKey,
        enableNotification: enableNotification,
      })
    } else if (mode === 'edit' && project?.id) {
      updateProject({
        name: name.trim(),
        coverImageKey: coverImageKey,
        enableNotification: enableNotification,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] overflow-hidden rounded-2xl border border-border/60 bg-background/95 backdrop-blur-md shadow-2xl p-0 gap-0">
        {/* Beautiful Glowing Header */}
        <DialogHeader className="relative overflow-hidden bg-gradient-to-br from-primary/5 to-transparent p-6 border-b border-border/40">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-10 w-32 h-12 bg-primary/5 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center gap-3">
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                {mode === 'create' ? 'Create New Project' : 'Project Settings'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground/80 mt-1">
                {mode === 'create'
                  ? 'Configure your new project workspace and appearance.'
                  : 'Manage and update your project workspace configurations.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Form Content */}
        <div className="space-y-6 p-6 max-h-[75vh] overflow-y-auto">
          {/* Project Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold tracking-tight text-foreground">
              Project Name
            </Label>
            <div className="relative">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Marketing, Q3 Product Launch..."
                className="h-11 px-4 rounded-xl border-border/80 focus-visible:ring-ring/25 focus-visible:border-primary transition-all shadow-xs pr-10"
              />
              {name.trim() && (
                <div className="absolute inset-y-0 right-3 flex items-center">
                  <Check className="w-4 h-4 text-primary" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              A clear, concise name to identify your project space.
            </p>
          </div>

          {/* Cover Image & Branding Section */}
          <div className="space-y-3 border-t border-border/40 pt-5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                Project Cover
              </Label>
              {coverImagePreview && (
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 font-medium"
                >
                  <X className="w-3.5 h-3.5" />
                  Remove Cover
                </button>
              )}
            </div>

            {/* Centered Square 1:1 Preview Area */}
            <div
              className="relative aspect-square w-48 mx-auto rounded-2xl border border-dashed border-border flex items-center justify-center cursor-pointer overflow-hidden group shadow-inner bg-muted/20 transition-all duration-300 hover:border-primary/50 hover:bg-muted/40"
              onClick={handleImageAreaClick}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />

              {/* Uploading Spinner */}
              {isUploading && (
                <div className="absolute inset-0 bg-background/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-background border rounded-full shadow-lg">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-xs font-semibold text-foreground">Uploading...</span>
                  </div>
                </div>
              )}

              {coverImagePreview ? (
                <>
                  <img
                    src={coverImagePreview}
                    alt="Cover Preview"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-1.5 text-white z-10">
                    <Upload className="w-5 h-5 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300" />
                    <span className="text-xs font-semibold">Upload Image</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center p-4">
                  <div className="p-2.5 rounded-full bg-background border shadow-xs group-hover:scale-110 transition-transform duration-300">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Upload cover</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[140px] mx-auto leading-normal">
                      Drag and drop, or browse. Recommended 1:1 (400×400px).
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preferences Section */}
          <div className="space-y-3 border-t border-border/40 pt-5">
            <Label className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-primary" />
              Project Preferences
            </Label>

            <div className="flex items-start justify-between rounded-xl border border-border/50 bg-muted/10 p-4 transition-all duration-300 hover:bg-muted/20">
              <div className="space-y-1 pr-4">
                <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Bell className="w-4 h-4 text-primary" />
                  Activity Notifications
                </div>
                <p className="text-xs text-muted-foreground leading-normal">
                  Receive in-app updates for comments, uploads, and automated background analysis
                  tasks inside this project.
                </p>
              </div>
              <Switch
                checked={enableNotification}
                onCheckedChange={setEnableNotification}
                disabled={isUploading}
                className="mt-0.5"
              />
            </div>
          </div>
        </div>

        {/* Beautiful Footer with Premium Buttons */}
        <DialogFooter className="flex items-center justify-end gap-3 px-6 py-4 bg-muted/20 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
            className="rounded-xl h-10 px-4 hover:bg-muted font-medium text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={!name.trim() || isUploading}
            className="rounded-xl h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm shadow-lg shadow-primary/10 hover:shadow-primary/20 active:scale-98 transition-all flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : mode === 'create' ? (
              'Create Project'
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
