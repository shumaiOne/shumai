import React, { useState, useEffect } from 'react'
import { client } from '@/ui/api/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { Badge } from '@/ui/components/ui/badge'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import {
  Loader2,
  Server,
  Info,
  Search,
  RefreshCw,
  Wrench,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { m } from '@/ui/paraglide/messages.js'
import { toast } from 'sonner'
import {
  McpServerInfo,
  McpTransport,
  McpServerPermission,
  McpServerAuthType,
  McpToolInfo,
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

  const [url, setUrl] = useState('')
  const [transport, setTransport] = useState<McpTransport>('streamable_http')
  const [permission, setPermission] = useState<McpServerPermission>('reviewer')

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
  const [excludedTools, setExcludedTools] = useState<string[]>([])

  // Tools inspector state
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (server) {
      setUrl(server.url)
      setTransport(server.transport || 'streamable_http')
      setPermission(server.permission || 'reviewer')
      setAuthType(server.authType || 'auto')
      setDirectTools(server.config?.directTools ?? false)
      setExcludedTools(server.config?.excludeTools ?? [])
      setSearchQuery('')
      setExpandedTools({})
    } else {
      setUrl('')
      setTransport('streamable_http')
      setPermission('reviewer')
      setAuthType('auto')
      setBearerToken('')
      setClientId('')
      setClientSecret('')
      setScope('')
      setGrantType('authorization_code')
      setDirectTools(false)
      setExcludedTools([])
      setSearchQuery('')
      setExpandedTools({})
    }
  }, [server, isOpen])

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

  // Fetch tools (edit mode only)
  const {
    data: toolsData,
    isLoading: isToolsLoading,
    refetch: refetchTools,
  } = useQuery({
    queryKey: ['mcp', 'servers', server?.id, 'tools'],
    queryFn: async () => {
      if (!server?.id) return { tools: [] as McpToolInfo[] }
      const res = await client.api.mcp.servers[':id'].tools.$get({
        param: { id: server.id },
      })
      if (!res.ok) throw new Error('Failed to fetch tools')
      return await res.json()
    },
    enabled: isOpen && isEditing && !!server?.id,
  })

  const refreshMutation = useMutation({
    mutationFn: async () => {
      if (!server?.id) return
      const res = await client.api.mcp.servers[':id'].tools.refresh.$post({
        param: { id: server.id },
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Failed to refresh tools')
      }
      return await res.json()
    },
    onSuccess: () => {
      toast.success(m.mcp_test_success())
      refetchTools()
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'mcp', 'servers'] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const config = {
        directTools,
        excludeTools: excludedTools.length > 0 ? excludedTools : undefined,
      }

      if (isEditing && server) {
        const updatePayload: UpdateMcpServerRequest = {
          transport,
          permission,
          authConfig: buildAuthConfig(),
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
          url: url.trim(),
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
    if (!url.trim()) return
    saveMutation.mutate()
  }

  const tools = toolsData?.tools ?? []

  const filteredTools = tools.filter((tool) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      tool.name.toLowerCase().includes(q) ||
      (tool.description && tool.description.toLowerCase().includes(q)) ||
      (tool.title && tool.title.toLowerCase().includes(q))
    )
  })

  const isToolExcluded = (toolName: string) => excludedTools.includes(toolName)

  const toggleToolEnabled = (toolName: string, enabled: boolean) => {
    setExcludedTools((prev) => (enabled ? prev.filter((n) => n !== toolName) : [...prev, toolName]))
  }

  const toggleExpand = (toolName: string) => {
    setExpandedTools((prev) => ({ ...prev, [toolName]: !prev[toolName] }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {isEditing && server ? (
        /* ------------------------------------------------------------------
         * Edit / config mode: fixed header + footer, scrollable content.
         * Mirrors the skill config dialog layout.
         * ------------------------------------------------------------------ */
        <DialogContent className="sm:max-w-2xl h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-border flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Server className="w-5 h-5 text-primary" />
              {m.edit_mcp_server()}
            </DialogTitle>
            <DialogDescription>{m.mcp_servers_description()}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6 space-y-5">
                {/* Auto-detected identity (read-only) — the endpoint URL is
                    set at creation and immutable here (delete + re-add to
                    change it). */}
                <div className="grid grid-cols-1 gap-3 p-3 bg-muted/30 border border-border rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {m.mcp_server_name()}
                    </span>
                    <span className="text-sm font-medium">{server.name}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {m.mcp_server_url()}
                    </span>
                    <span className="text-sm font-mono text-foreground break-all">
                      {server.url}
                    </span>
                  </div>
                  {server.description && (
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {m.description()}
                      </span>
                      <span className="text-sm text-foreground">{server.description}</span>
                    </div>
                  )}
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                    <Info className="w-3 h-3" />
                    {m.mcp_server_auto_detected()}
                  </span>
                </div>

                {/* Transport & Permission */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">{m.mcp_transport()}</Label>
                    <Select
                      value={transport}
                      onValueChange={(val) => setTransport(val as McpTransport)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="streamable_http">Streamable HTTP (Default)</SelectItem>
                        <SelectItem value="sse">Server-Sent Events (SSE)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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

                {/* Mode */}
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
                </div>

                {/* Tools list (excludeTools management) */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5" />
                      {m.mcp_tools()}
                    </Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refreshMutation.mutate()}
                      disabled={refreshMutation.isPending}
                      className="gap-1.5 text-xs"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
                      />
                      {m.mcp_refresh_tools()}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {m.mcp_tools_count({ count: tools.length })} — {m.mcp_excluded_tools_hint()}
                  </p>

                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={m.search_tools_placeholder()}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    {isToolsLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : filteredTools.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-xs">
                        {m.no_tools_found()}
                      </div>
                    ) : (
                      filteredTools.map((tool) => {
                        const enabled = !isToolExcluded(tool.name)
                        const isExpanded = !!expandedTools[tool.name]
                        const schemaObj = tool.inputSchema as {
                          properties?: Record<string, { type?: string; description?: string }>
                          required?: string[]
                        }
                        const hasProperties =
                          schemaObj?.properties && Object.keys(schemaObj.properties).length > 0

                        return (
                          <div
                            key={tool.name}
                            className={`border border-border rounded-lg p-3 transition-colors ${
                              enabled ? 'bg-card' : 'bg-muted/30 opacity-70'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div
                                className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer"
                                onClick={() => hasProperties && toggleExpand(tool.name)}
                              >
                                {hasProperties ? (
                                  isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                  )
                                ) : (
                                  <div className="w-4 h-4 shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs font-bold text-foreground break-all">
                                      {tool.name}
                                    </span>
                                    {tool.title && (
                                      <Badge variant="outline" className="text-[10px]">
                                        {tool.title}
                                      </Badge>
                                    )}
                                  </div>
                                  {tool.description && (
                                    <p className="text-xs text-muted-foreground mt-1 break-words line-clamp-3">
                                      {tool.description}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Switch
                                  checked={enabled}
                                  onCheckedChange={(checked) =>
                                    toggleToolEnabled(tool.name, checked)
                                  }
                                />
                              </div>
                            </div>

                            {/* Parameters schema expansion */}
                            {isExpanded && hasProperties && (
                              <div className="mt-3 pt-3 border-t border-border/60 pl-6 space-y-2">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                  {m.tool_parameters()}
                                </span>
                                <div className="grid grid-cols-1 gap-1.5">
                                  {Object.entries(schemaObj.properties!).map(
                                    ([propName, propDef]) => {
                                      const isRequired = schemaObj.required?.includes(propName)
                                      return (
                                        <div
                                          key={propName}
                                          className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-2 p-2 bg-muted/20 rounded text-xs min-w-0"
                                        >
                                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                            <span className="font-mono font-semibold break-all">
                                              {propName}
                                            </span>
                                            {isRequired && (
                                              <span className="text-[10px] text-red-500 font-bold">
                                                *
                                              </span>
                                            )}
                                            <Badge
                                              variant="secondary"
                                              className="text-[9px] px-1 py-0"
                                            >
                                              {propDef.type || 'any'}
                                            </Badge>
                                          </div>
                                          {propDef.description && (
                                            <span className="text-[11px] text-muted-foreground break-words sm:max-w-[320px]">
                                              {propDef.description}
                                            </span>
                                          )}
                                        </div>
                                      )
                                    },
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 pt-4 border-t border-border flex-shrink-0">
              <Button type="button" variant="outline" onClick={onClose}>
                {m.cancel()}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending || !url}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {m.save_changes()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : (
        /* ------------------------------------------------------------------
         * Create mode: compact URL-only dialog. Name/description are
         * auto-detected from the server after connecting.
         * ------------------------------------------------------------------ */
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Server className="w-5 h-5 text-primary" />
              {m.add_mcp_server()}
            </DialogTitle>
            <DialogDescription>{m.mcp_servers_description()}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{m.mcp_server_url()}</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://mcp.example.com/mcp"
                type="url"
                required
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                {m.mcp_server_auto_detected()}
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {m.cancel()}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending || !url}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {m.create()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  )
}
