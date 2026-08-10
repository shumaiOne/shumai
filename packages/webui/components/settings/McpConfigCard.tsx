import React, { useState } from 'react'
import { client } from '@/ui/api/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Server,
  Loader2,
  MoreVertical,
  Plus,
  Trash2,
  Edit,
  Wrench,
  RefreshCw,
  Zap,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Key,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Badge } from '@/ui/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { McpServerInfo, McpServerPermission } from '@shumai/dtos'
import { m } from '@/ui/paraglide/messages.js'
import { usePermissions } from '@/ui/hooks/use-permissions'
import { toast } from 'sonner'
import { McpServerFormDialog } from './McpServerFormDialog'

interface McpConfigCardProps {
  teamId: string
}

export const McpConfigCard: React.FC<McpConfigCardProps> = ({ teamId }) => {
  const queryClient = useQueryClient()
  const { canAdmin } = usePermissions()

  const [isAddFormOpen, setIsAddFormOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<McpServerInfo | null>(null)
  const [deletingServer, setDeletingServer] = useState<McpServerInfo | null>(null)
  const [authenticatingServerId, setAuthenticatingServerId] = useState<string | null>(null)

  // Fetch MCP Servers
  const { data, isLoading } = useQuery({
    queryKey: ['teams', teamId, 'mcp', 'servers'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].mcp.servers.$get({ param: { teamId } })
      if (!res.ok) throw new Error(m.failed_load_settings())
      return await res.json()
    },
  })

  // Delete Server Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.mcp.servers[':id'].$delete({ param: { id } })
      if (!res.ok) throw new Error(m.failed_to_delete())
    },
    onSuccess: () => {
      toast.success(m.delete())
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'mcp', 'servers'] })
      setDeletingServer(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  // Update Permission Mutation
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ id, permission }: { id: string; permission: McpServerPermission }) => {
      const res = await client.api.mcp.servers[':id'].permission.$patch({
        param: { id },
        json: { permission },
      })
      if (!res.ok) throw new Error(m.failed_to_update_permission())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'mcp', 'servers'] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  // Enable/Disable Mutation
  // (Removed: enable/disable now happens per-agent via AgentMcpServer assignment.)

  // Test Server Mutation
  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.mcp.servers[':id'].test.$post({ param: { id } })
      if (!res.ok) throw new Error('Failed to test server connection')
      return await res.json()
    },
    onSuccess: (res) => {
      if (res && typeof res === 'object' && 'success' in res && res.success) {
        toast.success(m.mcp_test_success())
      } else {
        const errorMsg =
          res && typeof res === 'object' && 'error' in res ? String(res.error) : m.mcp_test_failed()
        toast.error(errorMsg)
      }
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'mcp', 'servers'] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  // Disconnect Auth Mutation
  const disconnectAuthMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.mcp.servers[':id'].auth.$delete({ param: { id } })
      if (!res.ok) throw new Error('Failed to disconnect auth')
    },
    onSuccess: () => {
      toast.success(m.mcp_disconnect_auth())
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'mcp', 'servers'] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  // Start Auth Flow (OAuth Popup / Bearer)
  const handleStartAuth = async (serverId: string) => {
    setAuthenticatingServerId(serverId)
    try {
      const res = await client.api.mcp.servers[':id'].auth.start.$post({
        param: { id: serverId },
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || m.mcp_auth_failed())
      }
      const data = (await res.json()) as { authorizationUrl?: string; status?: string }
      if (data.status === 'authenticated') {
        toast.success(m.mcp_auth_success())
        queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'mcp', 'servers'] })
        setAuthenticatingServerId(null)
        return
      }

      if (data.authorizationUrl) {
        // Open OAuth popup window
        const width = 600
        const height = 700
        const left = window.screenX + (window.outerWidth - width) / 2
        const top = window.screenY + (window.outerHeight - height) / 2
        const popup = window.open(
          data.authorizationUrl,
          'mcp_oauth_popup',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`,
        )

        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'mcp-oauth-callback') {
            window.removeEventListener('message', handleMessage)
            setAuthenticatingServerId(null)
            if (event.data.ok) {
              toast.success(m.mcp_auth_success())
              queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'mcp', 'servers'] })
            } else {
              toast.error(event.data.message || m.mcp_auth_failed())
            }
          }
        }

        window.addEventListener('message', handleMessage)

        // Monitor popup closure
        const checkClosed = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(checkClosed)
            window.removeEventListener('message', handleMessage)
            setAuthenticatingServerId(null)
            queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'mcp', 'servers'] })
          }
        }, 1000)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.mcp_auth_failed())
      setAuthenticatingServerId(null)
    }
  }

  const servers = data?.servers || []

  const renderStatusBadge = (server: McpServerInfo) => {
    switch (server.status) {
      case 'connected':
        return (
          <Badge
            variant="secondary"
            className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]"
          >
            <CheckCircle2 className="w-3 h-3" />
            {m.mcp_status_connected()}
          </Badge>
        )
      case 'needs_auth':
        return (
          <Badge
            variant="secondary"
            className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]"
          >
            <Key className="w-3 h-3" />
            {m.mcp_status_needs_auth()}
          </Badge>
        )
      case 'failed':
        return (
          <Badge
            variant="secondary"
            className="gap-1 bg-red-500/10 text-red-600 border-red-500/20 text-[10px]"
          >
            <AlertCircle className="w-3 h-3" />
            {m.mcp_status_failed()}
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Clock className="w-3 h-3 text-muted-foreground" />
            {m.mcp_status_not_connected()}
          </Badge>
        )
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">{m.mcp_servers()}</CardTitle>
            <CardDescription>{m.mcp_servers_description()}</CardDescription>
          </div>
        </div>
        {canAdmin && (
          <Button onClick={() => setIsAddFormOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> {m.add_mcp_server()}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground">
              <Server className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold">{m.no_mcp_servers_installed()}</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {m.add_mcp_server_to_get_started()}
            </p>
            {canAdmin && (
              <Button
                onClick={() => setIsAddFormOpen(true)}
                className="mt-4 gap-2"
                variant="outline"
              >
                <Plus className="w-4 h-4" /> {m.add_mcp_server()}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {servers.map((server) => {
              const isDirectMode = server.config?.directTools
              const isAuthenticating = authenticatingServerId === server.id
              const needsAuth =
                server.status === 'needs_auth' ||
                (!server.hasCredential && server.authType !== 'none')

              return (
                <div
                  key={server.id}
                  onClick={() => canAdmin && setEditingServer(server)}
                  className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-border rounded-xl gap-4 transition-all ${
                    canAdmin ? 'cursor-pointer hover:border-primary/50 hover:shadow-sm' : ''
                  } bg-card`}
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="p-2.5 bg-muted rounded-lg text-foreground mt-0.5">
                      <Server className="w-5 h-5" />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-foreground truncate">
                          {server.name}
                        </span>
                        {renderStatusBadge(server)}
                        {isDirectMode ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-primary/5 text-primary border-primary/20"
                          >
                            <Zap className="w-3 h-3 mr-1" />
                            {m.mcp_direct_tools_mode()}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Proxy Tool
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {server.transport}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground truncate">
                        <span className="truncate max-w-md font-mono">{server.url}</span>
                        <span>•</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (canAdmin) setEditingServer(server)
                          }}
                          className="hover:underline font-semibold text-primary flex items-center gap-1"
                        >
                          <Wrench className="w-3 h-3" />
                          {m.mcp_tools_count({ count: server.toolCount ?? 0 })}
                        </button>
                      </div>

                      {server.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-lg">
                          {server.description}
                        </p>
                      )}

                      {server.lastError && (
                        <p className="text-xs text-red-500/90 truncate max-w-lg font-mono">
                          {server.lastError}
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-border"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Prominent Connect button if needs authentication */}
                    {needsAuth && canAdmin && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartAuth(server.id)
                        }}
                        disabled={isAuthenticating}
                        className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                      >
                        {isAuthenticating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Key className="w-3.5 h-3.5" />
                        )}
                        {m.mcp_connect_auth()}
                      </Button>
                    )}

                    {/* Permission Selector */}
                    {canAdmin ? (
                      <Select
                        value={server.permission}
                        onValueChange={(permission) =>
                          updatePermissionMutation.mutate({
                            id: server.id,
                            permission: permission as McpServerPermission,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reviewer">{m.permission_all_users()}</SelectItem>
                          <SelectItem value="editor">{m.permission_owner_and_editor()}</SelectItem>
                          <SelectItem value="owner">{m.permission_owner_only()}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {server.permission === 'reviewer'
                          ? m.permission_all_users()
                          : server.permission === 'editor'
                            ? m.permission_owner_and_editor()
                            : m.permission_owner_only()}
                      </Badge>
                    )}

                    {/* Action Dropdown Menu */}
                    {canAdmin && (
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingServer(server)}>
                            <Wrench className="w-4 h-4 mr-2" />
                            {m.view_tools()}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => testMutation.mutate(server.id)}
                            disabled={testMutation.isPending}
                          >
                            <RefreshCw
                              className={`w-4 h-4 mr-2 ${
                                testMutation.isPending ? 'animate-spin' : ''
                              }`}
                            />
                            {m.mcp_test_connection()}
                          </DropdownMenuItem>

                          {server.authType !== 'none' || server.hasCredential ? (
                            <DropdownMenuItem onClick={() => handleStartAuth(server.id)}>
                              <Key className="w-4 h-4 mr-2" />
                              {m.mcp_connect_auth()}
                            </DropdownMenuItem>
                          ) : null}

                          {server.hasCredential && (
                            <DropdownMenuItem
                              onClick={() => disconnectAuthMutation.mutate(server.id)}
                              className="text-amber-600"
                            >
                              <ShieldCheck className="w-4 h-4 mr-2" />
                              {m.mcp_disconnect_auth()}
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setEditingServer(server)}>
                            <Edit className="w-4 h-4 mr-2" />
                            {m.edit()}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingServer(server)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {m.delete()}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Form Dialog for Add / Edit */}
      <McpServerFormDialog
        isOpen={isAddFormOpen || !!editingServer}
        onClose={() => {
          setIsAddFormOpen(false)
          setEditingServer(null)
        }}
        teamId={teamId}
        server={editingServer}
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog
        open={!!deletingServer}
        onOpenChange={(open) => !open && setDeletingServer(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.delete_mcp_server()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.delete_mcp_server_confirmation({ name: deletingServer?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingServer && deleteMutation.mutate(deletingServer.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {m.delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
