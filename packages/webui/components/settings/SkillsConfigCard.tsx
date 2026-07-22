import { client } from '@/ui/api/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Code, Loader2, MoreVertical, Plus, Puzzle, Trash2, Upload, X } from 'lucide-react'
import React, { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { cn } from '@/ui/lib/utils'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
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
import { SkillInfo } from '@shumai/dtos'
import { m } from '@/ui/paraglide/messages.js'
import { usePermissions } from '@/ui/hooks/use-permissions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'

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

interface SkillsConfigCardProps {
  teamId: string
}

export const SkillsConfigCard: React.FC<SkillsConfigCardProps> = ({ teamId }) => {
  const queryClient = useQueryClient()
  const { canAdmin } = usePermissions()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null)

  // Fetch Skills
  const { data, isLoading } = useQuery({
    queryKey: ['teams', teamId, 'skills'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].skills.$get({ param: { teamId } })
      if (!res.ok) throw new Error(m.failed_load_settings())
      return await res.json()
    },
  })

  // Delete Skill
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.skills[':id'].$delete({
        param: { id },
      })
      if (!res.ok) throw new Error(m.failed_to_delete())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'skills'] })
      setIsDeleteDialogOpen(false)
    },
  })

  // Update Skill Permission
  const updatePermissionMutation = useMutation({
    mutationFn: async ({
      id,
      permission,
    }: {
      id: string
      permission: 'owner' | 'editor' | 'reviewer'
    }) => {
      const res = await client.api.skills[':id'].permission.$patch({
        param: { id },
        json: { permission },
      })
      if (!res.ok) throw new Error(m.failed_to_update_permission())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'skills'] })
    },
    onError: (err: Error) => {
      alert(err.message || m.failed_to_update_permission())
    },
  })

  const skills = data?.skills || []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Puzzle className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">{m.skills_management()}</CardTitle>
            <CardDescription>{m.skills_management_description()}</CardDescription>
          </div>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> {m.add_skill()}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : skills.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground">
              <Puzzle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-foreground">{m.no_skills_installed()}</h3>
            <p className="text-muted-foreground mt-1 max-w-xs mx-auto">
              {m.add_skill_to_get_started()}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {skills.map((skill) => (
              <SkillItem
                key={skill.id}
                skill={skill}
                canAdmin={canAdmin}
                onDelete={() => {
                  setSelectedSkill(skill)
                  setIsDeleteDialogOpen(true)
                }}
                onConfigure={() => {
                  setSelectedSkill(skill)
                  setIsConfigDialogOpen(true)
                }}
                onPermissionChange={(permission) =>
                  updatePermissionMutation.mutate({ id: skill.id, permission })
                }
              />
            ))}
          </div>
        )}
      </CardContent>

      <AddSkillDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} teamId={teamId} />

      {selectedSkill && (
        <ConfigSkillDialog
          open={isConfigDialogOpen}
          onOpenChange={(open) => {
            setIsConfigDialogOpen(open)
            if (!open) {
              // Ensure body pointer-events is restored if something stuck it
              setTimeout(() => {
                document.body.style.pointerEvents = 'auto'
              }, 100)
            }
          }}
          teamId={teamId}
          skill={selectedSkill}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.are_you_absolutely_sure()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.delete_skill_confirmation({ name: selectedSkill?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                if (selectedSkill) {
                  deleteMutation.mutate(selectedSkill.id)
                }
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {m.delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

const SkillItem = ({
  skill,
  canAdmin,
  onDelete,
  onConfigure,
  onPermissionChange,
}: {
  skill: SkillInfo
  canAdmin: boolean
  onDelete: () => void
  onConfigure: () => void
  onPermissionChange: (permission: 'owner' | 'editor' | 'reviewer') => void
}) => {
  return (
    <div
      className="p-4 bg-card rounded-xl border border-border flex flex-col justify-between hover:shadow-md transition-all group cursor-pointer"
      onClick={onConfigure}
    >
      <div>
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-bold text-foreground flex items-center gap-2">{skill.name}</h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="text-destructive focus:text-destructive gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> {m.delete()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {skill.description || m.no_description_provided()}
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          {m.updated_date()} {new Date(skill.updatedAt).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Select
            value={skill.permission || 'reviewer'}
            onValueChange={(val) => onPermissionChange(val as 'owner' | 'editor' | 'reviewer')}
            disabled={!canAdmin}
          >
            <SelectTrigger className="h-7 text-xs px-2 bg-background border-border w-[140px]">
              <SelectValue placeholder={m.skill_permission()} />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="reviewer">{m.permission_all_users()}</SelectItem>
              <SelectItem value="editor">{m.permission_owner_and_editor()}</SelectItem>
              <SelectItem value="owner">{m.permission_owner_only()}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

const AddSkillDialog = ({
  open,
  onOpenChange,
  teamId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
}) => {
  const queryClient = useQueryClient()
  const [githubUrl, setGithubUrl] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Need a project ID for the attachment upload
  const { data: projectsData } = useQuery({
    queryKey: ['teams', teamId, 'projects'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].projects.$get({
        param: { teamId },
        query: { first: '1' },
      })
      if (!res.ok) throw new Error('Failed to fetch projects')
      return await res.json()
    },
    enabled: open,
  })

  const installSkill = async (payload: {
    assetId?: string
    githubUrl?: string
    override?: boolean
  }) => {
    setIsProcessing(true)
    try {
      const res = await client.api.teams[':teamId'].skills.$post({
        param: { teamId },
        json: payload,
      })

      if (res.status === 409) {
        const data = (await res.json()) as { error: string }
        if (window.confirm(`${data.error}\n\n${m.override_existing_skill()}`)) {
          await installSkill({ ...payload, override: true })
          return
        }
      } else if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(errorData.error || m.failed_to_install_skill())
      } else {
        queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'skills'] })
        onOpenChange(false)
        setGithubUrl('')
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message)
      } else {
        alert(m.an_unknown_error_occurred())
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const projectId = projectsData?.data?.[0]?.id
    if (!projectId) {
      alert(m.need_project_to_upload_skills())
      return
    }

    const fileToUpload = files[0]
    if (!fileToUpload.name.toLowerCase().endsWith('.zip')) {
      alert(m.only_zip_files_supported())
      return
    }

    setIsProcessing(true)

    try {
      const fileName = fileToUpload.name
      const contentType = fileToUpload.type || 'application/zip'

      // 1. Get Presigned URL and Asset ID
      const attachRes = await client.api.projects[':projectId'].attachments.$post({
        param: { projectId },
        json: {
          fileName: fileName,
          size: fileToUpload.size,
          contentType: contentType,
        },
      })
      if (!attachRes.ok) throw new Error('Failed to get upload URL')
      const { id: assetId, uploadUrl } = (await attachRes.json()) as {
        id: string
        uploadUrl: string
      }

      // 2. Upload to S3
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: fileToUpload,
        headers: { 'Content-Type': contentType },
      })
      if (!uploadRes.ok) throw new Error('Failed to upload file to storage')

      // 3. Install Skill
      await installSkill({ assetId })
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message)
      } else {
        alert(m.an_unknown_error_occurred())
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{m.add_new_skill()}</DialogTitle>
          <DialogDescription>{m.import_skill_description()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* File Upload Section */}
          <div className="space-y-3">
            <Label>{m.package_upload()}</Label>
            <div
              onClick={() => !isProcessing && fileInputRef.current?.click()}
              className={cn(
                'group relative h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer',
                isProcessing
                  ? 'opacity-50 cursor-not-allowed bg-muted/50 border-border'
                  : 'hover:bg-primary/5 hover:border-primary/50 border-border',
              )}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".zip"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <div className="p-3 bg-muted rounded-full group-hover:bg-primary/10 transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="mt-3 text-center">
                <p className="text-sm font-medium text-foreground">{m.select_zip_file()}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                  {m.packages_must_contain_skill_md()}
                </p>
              </div>
            </div>
            {isProcessing && !githubUrl && (
              <div className="flex items-center gap-2 text-sm text-primary justify-center bg-primary/10 py-2 rounded-lg animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                {m.processing_package()}
              </div>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground font-bold">{m.or()}</span>
            </div>
          </div>

          {/* GitHub URL Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="githubUrl">{m.github_repository_url()}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Github className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="githubUrl"
                    placeholder="https://github.com/owner/repo"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    disabled={isProcessing}
                    className="pl-9"
                  />
                </div>
                <Button
                  onClick={() => installSkill({ githubUrl })}
                  disabled={!githubUrl || isProcessing}
                  className="px-6"
                >
                  {isProcessing && githubUrl ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    m.install()
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground italic">{m.github_url_example()}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const ConfigSkillDialog = ({
  open,
  onOpenChange,
  teamId,
  skill,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  skill: SkillInfo
}) => {
  const queryClient = useQueryClient()
  const [config, setConfig] = useState({
    ...(skill.config || {}),
    environmentVariables: skill.config?.environmentVariables || [],
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleEnvVarValueChange = (index: number, value: string) => {
    const newVars = [...config.environmentVariables]
    newVars[index] = { ...newVars[index], default: value }
    setConfig({ ...config, environmentVariables: newVars })
  }

  const handleEnvVarNameChange = (index: number, name: string) => {
    const newVars = [...config.environmentVariables]
    newVars[index] = { ...newVars[index], name }
    setConfig({ ...config, environmentVariables: newVars })
  }

  const addEnvVar = () => {
    setConfig({
      ...config,
      environmentVariables: [...config.environmentVariables, { name: '', default: '' }],
    })
  }

  const removeEnvVar = (index: number) => {
    const newVars = [...config.environmentVariables]
    newVars.splice(index, 1)
    setConfig({ ...config, environmentVariables: newVars })
  }

  const handleSave = async () => {
    // Basic validation: filter out empty names
    const filteredVars = config.environmentVariables.filter((v) => v.name.trim() !== '')
    const finalConfig = { ...config, environmentVariables: filteredVars }

    setIsSaving(true)
    try {
      const res = await client.api.skills[':id'].config.$patch({
        param: { id: skill.id },
        json: { config: finalConfig },
      })
      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(errorData.error || 'Failed to update config')
      }
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'skills'] })
      onOpenChange(false)
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message)
      } else {
        alert(m.an_unknown_error_occurred())
      }
    } finally {
      setIsSaving(false)
    }
  }

  const envVars = config?.environmentVariables || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              {m.configure_skill({ name: skill.name })}
            </DialogTitle>
          </div>
          <DialogDescription>{m.manage_env_vars_description()}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="py-4 space-y-4 pr-4">
            {envVars.length === 0 ? (
              <div className="text-center py-10 bg-muted/50 rounded-xl border border-dashed border-border">
                <p className="text-muted-foreground text-sm italic">{m.no_env_vars_found()}</p>
              </div>
            ) : (
              envVars.map((env: { name: string; default?: string | undefined }, index: number) => (
                <div
                  key={index}
                  className="p-4 bg-muted/50 rounded-xl border border-border space-y-3 relative group"
                >
                  <button
                    onClick={() => removeEnvVar(index)}
                    className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                      {m.variable_name()}
                    </Label>
                    <Input
                      value={env.name}
                      onChange={(e) => handleEnvVarNameChange(index, e.target.value)}
                      placeholder="e.g. API_KEY"
                      className="h-8 bg-background border-border text-sm font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                      {m.default_value()}
                    </Label>
                    <Input
                      value={env.default || ''}
                      onChange={(e) => handleEnvVarValueChange(index, e.target.value)}
                      placeholder={m.optional_default_value_placeholder()}
                      className="h-8 bg-background border-border text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      {m.env_var_empty_note()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={addEnvVar}
            className="h-8 gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
          >
            <Plus className="w-3.5 h-3.5" /> {m.add_variable()}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {m.cancel()}
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="px-8">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {m.save_changes()}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
