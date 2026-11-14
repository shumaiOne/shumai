import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { Card, CardContent } from '@/ui/components/ui/card'
import { Input } from '@/ui/components/ui/input'
import { Button } from '@/ui/components/ui/button'
import { Badge } from '@/ui/components/ui/badge'
import { Label } from '@/ui/components/ui/label'
import { Switch } from '@/ui/components/ui/switch'
import { Textarea } from '@/ui/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import {
  Check,
  Copy,
  Edit2,
  KeyRound,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Star,
  Terminal,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'
import type { RunnerInfo } from '@shumai/dtos'

export function RunnerSettings({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()

  // Create Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newIsDefault, setNewIsDefault] = useState(false)

  // Edit Dialog state
  const [editingRunner, setEditingRunner] = useState<RunnerInfo | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')

  // Rotate & Delete Confirm Dialog state
  const [runnerToRotate, setRunnerToRotate] = useState<RunnerInfo | null>(null)
  const [runnerToDelete, setRunnerToDelete] = useState<RunnerInfo | null>(null)

  // One-time Key Reveal Dialog state
  const [revealedKeyData, setRevealedKeyData] = useState<{
    name: string
    key: string
  } | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['teams', teamId, 'runners'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].runners.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error(m.failed_to_load_runners())
      return await res.json()
    },
    refetchInterval: 5000,
  })

  const runners = data ?? []

  const createRunnerMutation = useMutation({
    mutationFn: async (params: { name: string; description?: string; isDefault?: boolean }) => {
      const res = await client.api.teams[':teamId'].runners.$post({
        param: { teamId },
        json: params,
      })
      if (!res.ok) throw new Error(m.failed_to_create_runner())
      return await res.json()
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'runners'] })
      setIsCreateOpen(false)
      setNewName('')
      setNewDescription('')
      setNewIsDefault(false)
      setRevealedKeyData({ name: created.runner.name, key: created.key })
      toast.success(m.runner_created_successfully())
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_create_runner())
    },
  })

  const updateRunnerMutation = useMutation({
    mutationFn: async (params: {
      runnerId: string
      name?: string
      description?: string | null
      isDefault?: boolean
    }) => {
      const res = await client.api.teams[':teamId'].runners[':runnerId'].$patch({
        param: { teamId, runnerId: params.runnerId },
        json: {
          name: params.name,
          description: params.description,
          isDefault: params.isDefault,
        },
      })
      if (!res.ok) throw new Error(m.failed_to_update_runner())
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'runners'] })
      setEditingRunner(null)
      toast.success(m.runner_updated_successfully())
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_update_runner())
    },
  })

  const rotateKeyMutation = useMutation({
    mutationFn: async (runnerId: string) => {
      const res = await client.api.teams[':teamId'].runners[':runnerId']['rotate-key'].$post({
        param: { teamId, runnerId },
      })
      if (!res.ok) throw new Error(m.failed_to_rotate_runner_key())
      return await res.json()
    },
    onSuccess: (rotated) => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'runners'] })
      setRunnerToRotate(null)
      setRevealedKeyData({ name: rotated.runner.name, key: rotated.key })
      toast.success(m.runner_key_rotated_successfully())
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_rotate_runner_key())
    },
  })

  const deleteRunnerMutation = useMutation({
    mutationFn: async (runnerId: string) => {
      const res = await client.api.teams[':teamId'].runners[':runnerId'].$delete({
        param: { teamId, runnerId },
      })
      if (!res.ok) throw new Error(m.failed_to_delete_runner())
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'runners'] })
      setRunnerToDelete(null)
      toast.success(m.runner_deleted_successfully())
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_delete_runner())
    },
  })

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success(m.runner_copied_to_clipboard())
      setTimeout(() => {
        setCopiedField((prev) => (prev === field ? null : prev))
      }, 2000)
    } catch {
      // Ignore clipboard failure
    }
  }

  const serverOrigin = typeof window !== 'undefined' ? window.location.origin : ''

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="space-y-4 pr-4 pb-8">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {runners.length > 0 ? `${runners.length} ${m.runners()}` : ''}
            </div>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {m.create_runner()}
            </Button>
          </div>

          {runners.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Terminal className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">
                  {m.runner_empty_title()}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  {m.runner_empty_description()}
                </p>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {m.create_runner()}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {runners.map((runner) => {
                const isOnline = runner.status === 'connected'
                return (
                  <Card key={runner.id} className="border-border">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground truncate">
                            {runner.name}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              isOnline
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5'
                                : 'bg-muted text-muted-foreground border-border gap-1.5'
                            }
                          >
                            <span
                              className={
                                isOnline
                                  ? 'w-1.5 h-1.5 rounded-full bg-emerald-500'
                                  : 'w-1.5 h-1.5 rounded-full bg-muted-foreground'
                              }
                            />
                            {isOnline
                              ? m.runner_status_connected()
                              : m.runner_status_disconnected()}
                          </Badge>
                          {runner.isDefault && (
                            <Badge
                              variant="secondary"
                              className="bg-primary/10 text-primary border-primary/20 gap-1"
                            >
                              <Star className="w-3 h-3 fill-current" />
                              {m.runner_default_badge()}
                            </Badge>
                          )}
                        </div>
                        {runner.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {runner.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                          <span className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border">
                            {m.runner_key_prefix_label()}: {runner.keyPrefix}...
                          </span>
                          <span>
                            {runner.lastConnectedAt
                              ? m.runner_last_seen_label({
                                  time: new Date(runner.lastConnectedAt).toLocaleString(),
                                })
                              : m.runner_never_connected()}
                          </span>
                        </div>
                      </div>

                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {!runner.isDefault && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateRunnerMutation.mutate({
                                  runnerId: runner.id,
                                  isDefault: true,
                                })
                              }
                              className="gap-2 cursor-pointer"
                            >
                              <Star className="w-4 h-4" />
                              {m.runner_set_default_action()}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingRunner(runner)
                              setEditName(runner.name)
                              setEditDescription(runner.description || '')
                            }}
                            className="gap-2 cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                            {m.runner_edit_action()}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setRunnerToRotate(runner)}
                            className="gap-2 cursor-pointer"
                          >
                            <RefreshCw className="w-4 h-4" />
                            {m.runner_rotate_key_action()}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setRunnerToDelete(runner)}
                            className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            {m.delete()}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create Runner Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{m.create_runner()}</DialogTitle>
            <DialogDescription>{m.create_runner_description()}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!newName.trim()) return
              createRunnerMutation.mutate({
                name: newName.trim(),
                description: newDescription.trim() || undefined,
                isDefault: newIsDefault || runners.length === 0,
              })
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="runner-name">{m.runner_name()}</Label>
              <Input
                id="runner-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={m.runner_name_placeholder()}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="runner-description">{m.runner_description()}</Label>
              <Textarea
                id="runner-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder={m.runner_description_placeholder()}
                rows={2}
              />
            </div>
            {runners.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
                <Label htmlFor="runner-default-switch" className="cursor-pointer text-sm">
                  {m.runner_set_as_default()}
                </Label>
                <Switch
                  id="runner-default-switch"
                  checked={newIsDefault}
                  onCheckedChange={setNewIsDefault}
                />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                {m.cancel()}
              </Button>
              <Button type="submit" disabled={!newName.trim() || createRunnerMutation.isPending}>
                {createRunnerMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {m.create_runner()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Runner Dialog */}
      <Dialog open={!!editingRunner} onOpenChange={(open) => !open && setEditingRunner(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{m.runner_edit_action()}</DialogTitle>
            <DialogDescription>{m.runner_edit_description()}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!editingRunner || !editName.trim()) return
              updateRunnerMutation.mutate({
                runnerId: editingRunner.id,
                name: editName.trim(),
                description: editDescription.trim() || null,
              })
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-runner-name">{m.runner_name()}</Label>
              <Input
                id="edit-runner-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={m.runner_name_placeholder()}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-runner-description">{m.runner_description()}</Label>
              <Textarea
                id="edit-runner-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={m.runner_description_placeholder()}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingRunner(null)}>
                {m.cancel()}
              </Button>
              <Button type="submit" disabled={!editName.trim() || updateRunnerMutation.isPending}>
                {updateRunnerMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {m.save_changes()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* One-Time Key Reveal Modal */}
      <Dialog open={!!revealedKeyData} onOpenChange={(open) => !open && setRevealedKeyData(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              {m.runner_key_dialog_title()}
            </DialogTitle>
            <DialogDescription>{m.runner_key_dialog_description()}</DialogDescription>
          </DialogHeader>
          {revealedKeyData && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{m.runner_key_label()}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={revealedKeyData.key}
                    className="font-mono text-xs bg-muted"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(revealedKeyData.key, 'key')}
                  >
                    {copiedField === 'key' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {m.runner_quickstart_command_label()}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`shumai runner start --url ${serverOrigin} --key ${revealedKeyData.key}`}
                    className="font-mono text-xs bg-muted"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      handleCopy(
                        `shumai runner start --url ${serverOrigin} --key ${revealedKeyData.key}`,
                        'cmd',
                      )
                    }
                  >
                    {copiedField === 'cmd' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {m.runner_quickstart_sandbox_label()}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`shumai runner start --url ${serverOrigin} --key ${revealedKeyData.key} --sandbox`}
                    className="font-mono text-xs bg-muted"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      handleCopy(
                        `shumai runner start --url ${serverOrigin} --key ${revealedKeyData.key} --sandbox`,
                        'sandboxCmd',
                      )
                    }
                  >
                    {copiedField === 'sandboxCmd' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setRevealedKeyData(null)}>
              {m.close()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotate Key Confirmation */}
      <AlertDialog
        open={!!runnerToRotate}
        onOpenChange={(open) => !open && setRunnerToRotate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.runner_rotate_key_confirm_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.runner_rotate_key_confirm_description({ name: runnerToRotate?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                if (rotateKeyMutation.isPending) {
                  e.preventDefault()
                  return
                }
                if (runnerToRotate) {
                  rotateKeyMutation.mutate(runnerToRotate.id)
                }
              }}
            >
              {rotateKeyMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                m.runner_rotate_key_action()
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Runner Confirmation */}
      <AlertDialog
        open={!!runnerToDelete}
        onOpenChange={(open) => !open && setRunnerToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.runner_delete_confirm_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.runner_delete_confirm_description({ name: runnerToDelete?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={(e) => {
                if (deleteRunnerMutation.isPending) {
                  e.preventDefault()
                  return
                }
                if (runnerToDelete) {
                  deleteRunnerMutation.mutate(runnerToDelete.id)
                }
              }}
            >
              {deleteRunnerMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                m.delete()
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
