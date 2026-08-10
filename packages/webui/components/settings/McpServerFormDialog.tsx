import React, { useState, useEffect } from 'react'
import { client } from '@/ui/api/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Switch } from '@/ui/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { Loader2, Server, Info } from 'lucide-react'
import { m } from '@/ui/paraglide/messages.js'
import { toast } from 'sonner'
import {
  McpServerInfo,
  McpTransport,
  McpServerPermission,
  McpServerAuthType,
  CreateMcpServerRequest,
  UpdateMcpServerRequest,
} from '@shumai/dtos'

interface McpServerFormDialogProps {
  isOpen: boolean
  onClose: () => void
  teamId: string
  server?: McpServerInfo | null
}

export const McpServerFormDialog: React.FC<McpServerFormDialogProps> = ({
  isOpen,
  onClose,
  teamId,
  server,
}) => {
  const queryClient = useQueryClient()
  const isEditing = !!server

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [transport, setTransport] = useState<McpTransport>('streamable_http')
  const [permission, setPermission] = useState<McpServerPermission>('reviewer')
  const [enabled, setEnabled] = useState(true)

  // Auth config state
  const [authType, setAuthType] = useState<McpServerAuthType | 'auto'>('auto')
  const [bearerToken, setBearerToken] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [scope, setScope] = useState('')
  const [grantType, setGrantType] = useState<'authorization_code' | 'client_credentials'>(
    'authorization_code',
  )

  // Config state
  const [directTools, setDirectTools] = useState(false)
  const [includeToolsStr, setIncludeToolsStr] = useState('')
  const [excludeToolsStr, setExcludeToolsStr] = useState('')

  useEffect(() => {
    if (server) {
      setName(server.name)
      setUrl(server.url)
      setTransport(server.transport || 'streamable_http')
      setPermission(server.permission || 'reviewer')
      setEnabled(server.enabled ?? true)
      setAuthType(server.authType || 'auto')
      setDirectTools(server.config?.directTools ?? false)
      setIncludeToolsStr(server.config?.includeTools?.join(', ') || '')
      setExcludeToolsStr(server.config?.excludeTools?.join(', ') || '')
    } else {
      setName('')
      setUrl('')
      setTransport('streamable_http')
      setPermission('reviewer')
      setEnabled(true)
      setAuthType('auto')
      setBearerToken('')
      setClientId('')
      setClientSecret('')
      setScope('')
      setGrantType('authorization_code')
      setDirectTools(false)
      setIncludeToolsStr('')
      setExcludeToolsStr('')
    }
  }, [server, isOpen])

  const parseToolList = (str: string): string[] | undefined => {
    const list = str
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return list.length > 0 ? list : undefined
  }

  const buildAuthConfig = () => {
    if (authType === 'none') {
      return { type: 'none' as const }
    }
    if (authType === 'bearer') {
      return { type: 'bearer' as const, bearerToken: bearerToken || undefined }
    }
    if (authType === 'oauth') {
      return {
        type: 'oauth' as const,
        oauth: {
          grantType,
          clientId: clientId || undefined,
          clientSecret: clientSecret || undefined,
          scope: scope || undefined,
        },
      }
    }
    return undefined // 'auto'
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const authConfig = buildAuthConfig()
      const config = {
        directTools,
        includeTools: parseToolList(includeToolsStr),
        excludeTools: parseToolList(excludeToolsStr),
      }

      if (isEditing && server) {
        const updatePayload: UpdateMcpServerRequest = {
          name: name.trim(),
          url: url.trim(),
          transport,
          enabled,
          permission,
          authConfig,
          config,
          refreshTools: true,
        }

        const res = await client.api.mcp.servers[':id'].$patch({
          param: { id: server.id },
          json: updatePayload,
        })
        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(errData.error || m.failed_to_update_permission())
        }
        return await res.json()
      } else {
        const createPayload: CreateMcpServerRequest = {
          name: name.trim(),
          url: url.trim(),
          transport,
          enabled,
          permission,
          authConfig,
          config,
        }

        const res = await client.api.teams[':teamId'].mcp.servers.$post({
          param: { teamId },
          json: createPayload,
        })
        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(errData.error || m.an_unknown_error_occurred())
        }
        const created = await res.json()
        // Auto-refresh tools in background
        if (created && 'id' in created && typeof created.id === 'string') {
          client.api.mcp.servers[':id'].tools.refresh
            .$post({ param: { id: created.id } })
            .catch(() => {})
        }
        return created
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? m.profile_updated() : m.mcp_servers())
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'mcp', 'servers'] })
      onClose()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !url.trim()) return
    saveMutation.mutate()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Server className="w-5 h-5 text-primary" />
            {isEditing ? m.edit_mcp_server() : m.add_mcp_server()}
          </DialogTitle>
          <DialogDescription>{m.mcp_servers_description()}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Server Name & Transport */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{m.mcp_server_name()}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. github, fetch, brave-search"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{m.mcp_transport()}</Label>
              <Select value={transport} onValueChange={(val) => setTransport(val as McpTransport)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="streamable_http">Streamable HTTP (Default)</SelectItem>
                  <SelectItem value="sse">Server-Sent Events (SSE)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">{m.mcp_server_url()}</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mcp.example.com/sse"
              type="url"
              required
            />
          </div>

          {/* Permission & Enabled */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{m.skill_permission()}</Label>
              <Select
                value={permission}
                onValueChange={(val) => setPermission(val as McpServerPermission)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reviewer">{m.permission_all_users()}</SelectItem>
                  <SelectItem value="editor">{m.permission_owner_and_editor()}</SelectItem>
                  <SelectItem value="owner">{m.permission_owner_only()}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg mt-6">
              <span className="text-xs font-medium">{m.enabled()}</span>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>

          {/* Authentication Section */}
          <div className="space-y-3 pt-3 border-t border-border">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>{m.mcp_auth_type()}</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                Configures server connection auth
              </span>
            </Label>

            <Select
              value={authType}
              onValueChange={(val) => setAuthType(val as McpServerAuthType | 'auto')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{m.mcp_auth_auto()}</SelectItem>
                <SelectItem value="none">{m.mcp_auth_none()}</SelectItem>
                <SelectItem value="bearer">{m.mcp_auth_bearer()}</SelectItem>
                <SelectItem value="oauth">{m.mcp_auth_oauth()}</SelectItem>
              </SelectContent>
            </Select>

            {authType === 'bearer' && (
              <div className="space-y-2 pl-1 pt-1">
                <Label className="text-xs">{m.mcp_bearer_token()}</Label>
                <Input
                  type="password"
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  placeholder="Bearer token value"
                />
              </div>
            )}

            {authType === 'oauth' && (
              <div className="space-y-3 pl-1 pt-1 border-l-2 border-primary/20 pl-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{m.mcp_oauth_grant_type()}</Label>
                    <Select
                      value={grantType}
                      onValueChange={(val) =>
                        setGrantType(val as 'authorization_code' | 'client_credentials')
                      }
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="authorization_code">Authorization Code</SelectItem>
                        <SelectItem value="client_credentials">Client Credentials</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">{m.mcp_oauth_client_id()}</Label>
                    <Input
                      className="h-9 text-xs"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="Optional pre-registered Client ID"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{m.mcp_oauth_client_secret()}</Label>
                    <Input
                      className="h-9 text-xs"
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="Optional Client Secret"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">{m.mcp_oauth_scope()}</Label>
                    <Input
                      className="h-9 text-xs"
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                      placeholder="Optional scope (e.g. read,write)"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mode & Filters */}
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between p-3 bg-muted/20 border border-border rounded-lg">
              <div className="flex flex-col">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  {m.mcp_direct_tools_mode()}
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {m.mcp_direct_tools_desc()}
                </span>
              </div>
              <Switch checked={directTools} onCheckedChange={setDirectTools} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{m.included_tools()}</Label>
                <Input
                  className="h-9 text-xs"
                  value={includeToolsStr}
                  onChange={(e) => setIncludeToolsStr(e.target.value)}
                  placeholder={m.include_tools_hint()}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{m.excluded_tools()}</Label>
                <Input
                  className="h-9 text-xs"
                  value={excludeToolsStr}
                  onChange={(e) => setExcludeToolsStr(e.target.value)}
                  placeholder={m.exclude_tools_hint()}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}>
              {m.cancel()}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending || !name || !url}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? m.save_changes() : m.create()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
