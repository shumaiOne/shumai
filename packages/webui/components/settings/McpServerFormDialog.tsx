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
import { ToggleGroup, ToggleGroupItem } from '@/ui/components/ui/toggle-group'
import { Badge } from '@/ui/components/ui/badge'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { Loader2, Server, Info, RefreshCw, Wrench, ChevronDown, ChevronRight } from 'lucide-react'
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
  const [directTools, setDirectTools] = useState<string[]>([])
  const [excludedTools, setExcludedTools] = useState<string[]>([])

  // Tools inspector state
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})
  const [isInstructionsExpanded, setIsInstructionsExpanded] = useState(false)

  useEffect(() => {
    if (server) {
      setUrl(server.url)
      setTransport(server.transport || 'streamable_http')
      setPermission(server.permission || 'reviewer')
      setAuthType(server.authType || 'auto')
      setDirectTools(Array.isArray(server.config?.directTools) ? server.config.directTools : [])
      setExcludedTools(server.config?.excludeTools ?? [])
      setExpandedTools({})
      setIsInstructionsExpanded(false)
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
      setDirectTools([])
      setExcludedTools([])
      setExpandedTools({})
      setIsInstructionsExpanded(false)
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
      const res = await client.api.mcp.servers[':id'].refresh.$post({
        param: { id: server.id },
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || 'Failed to refresh server')
      }
      return await res.json()
    },
    onSuccess: () => {
      toast.success(m.mcp_refresh_server_success())
      // The tool list is refetched and the toggles re-enable; the server cards
      // re-fetch the updated record (name, description, instructions, status).
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
        directTools: directTools.length > 0 ? directTools : undefined,
        excludeTools: excludedTools.length > 0 ? excludedTools : undefined,
      }

      if (isEditing && server) {
        const updatePayload: UpdateMcpServerRequest = {
          transport,
          permission,
          authConfig: buildAuthConfig(),
          config,
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

  const getToolState = (toolName: string): 'off' | 'on' | 'direct' => {
    if (excludedTools.includes(toolName)) return 'off'
    if (directTools.includes(toolName)) return 'direct'
    return 'on'
  }

  const setToolState = (toolName: string, state: 'off' | 'on' | 'direct') => {
    if (state === 'off') {
      setExcludedTools((prev) => (prev.includes(toolName) ? prev : [...prev, toolName]))
      setDirectTools((prev) => prev.filter((n) => n !== toolName))
    } else if (state === 'on') {
      setExcludedTools((prev) => prev.filter((n) => n !== toolName))
      setDirectTools((prev) => prev.filter((n) => n !== toolName))
    } else if (state === 'direct') {
      setExcludedTools((prev) => prev.filter((n) => n !== toolName))
      setDirectTools((prev) => (prev.includes(toolName) ? prev : [...prev, toolName]))
    }
  }

  const handleBulkSetState = (state: 'off' | 'on' | 'direct') => {
    const allToolNames = tools.map((t) => t.name)
    if (state === 'off') {
      setExcludedTools(allToolNames)
      setDirectTools([])
    } else if (state === 'on') {
      setExcludedTools([])
      setDirectTools([])
    } else if (state === 'direct') {
      setExcludedTools([])
      setDirectTools(allToolNames)
    }
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
          {refreshMutation.isPending && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex flex-col items-center justify-center z-50 rounded-lg">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
              <span className="text-xs font-medium text-muted-foreground">
                {m.mcp_refresh_server()}...
              </span>
            </div>
          )}

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

                {server.instructions && (
                  <div className="p-3 bg-muted/20 border border-border rounded-lg space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                      {m.mcp_server_instructions()}
                    </span>
                    <p
                      onClick={() => setIsInstructionsExpanded((prev) => !prev)}
                      className={`text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed cursor-pointer transition-all ${
                        isInstructionsExpanded ? '' : 'line-clamp-2'
                      }`}
                      title={isInstructionsExpanded ? undefined : 'Click to expand instructions'}
                    >
                      {server.instructions}
                    </p>
                  </div>
                )}

                {/* Transport & Permission */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{m.mcp_transport()}</Label>
                    <Select
                      value={transport}
                      onValueChange={(val: McpTransport) => setTransport(val)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="streamable_http">Streamable HTTP</SelectItem>
                        <SelectItem value="sse">Server-Sent Events (SSE)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">{m.skill_permission()}</Label>
                    <Select
                      value={permission}
                      onValueChange={(val: McpServerPermission) => setPermission(val)}
                    >
                      <SelectTrigger className="h-9 text-xs">
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

                {/* Authentication Configuration */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{m.mcp_auth_type()}</Label>
                    <Select
                      value={authType}
                      onValueChange={(val: McpServerAuthType | 'auto') => setAuthType(val)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">{m.mcp_auth_auto()}</SelectItem>
                        <SelectItem value="none">{m.mcp_auth_none()}</SelectItem>
                        <SelectItem value="bearer">{m.mcp_auth_bearer()}</SelectItem>
                        <SelectItem value="oauth">{m.mcp_auth_oauth()}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {authType === 'bearer' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">{m.mcp_bearer_token()}</Label>
                      <Input
                        className="h-9 text-xs font-mono"
                        type="password"
                        value={bearerToken}
                        onChange={(e) => setBearerToken(e.target.value)}
                        placeholder="Enter token string"
                      />
                    </div>
                  )}

                  {authType === 'oauth' && (
                    <div className="p-3 bg-muted/20 border border-border rounded-lg space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">{m.mcp_oauth_grant_type()}</Label>
                          <Select
                            value={grantType}
                            onValueChange={(val: 'authorization_code' | 'client_credentials') =>
                              setGrantType(val)
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
                            placeholder="Optional Client ID"
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
                            placeholder="Optional Secret"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{m.mcp_oauth_scope()}</Label>
                          <Input
                            className="h-9 text-xs"
                            value={scope}
                            onChange={(e) => setScope(e.target.value)}
                            placeholder="Optional scope"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tools list */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5" />
                        {m.mcp_tools()} ({tools.length})
                      </Label>
                      <div className="text-[11px] text-muted-foreground mt-1.5 space-y-0.5">
                        <p>
                          <span className="font-semibold text-foreground">
                            {m.mcp_tool_state_disabled()}:
                          </span>{' '}
                          {m.mcp_tool_hint_off()}
                        </p>
                        <p>
                          <span className="font-semibold text-foreground">
                            {m.mcp_tool_state_proxy()}:
                          </span>{' '}
                          {m.mcp_tool_hint_proxy()}
                        </p>
                        <p>
                          <span className="font-semibold text-foreground">
                            {m.mcp_tool_state_direct()}:
                          </span>{' '}
                          {m.mcp_tool_hint_direct()}
                        </p>
                      </div>
                    </div>
                    {tools.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] px-2"
                          onClick={() => handleBulkSetState('off')}
                          disabled={refreshMutation.isPending || isToolsLoading}
                        >
                          {m.mcp_bulk_all_off()}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] px-2"
                          onClick={() => handleBulkSetState('on')}
                          disabled={refreshMutation.isPending || isToolsLoading}
                        >
                          {m.mcp_bulk_all_proxy()}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] px-2"
                          onClick={() => handleBulkSetState('direct')}
                          disabled={refreshMutation.isPending || isToolsLoading}
                        >
                          {m.mcp_bulk_all_direct()}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {isToolsLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : tools.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-xs">
                        {m.no_tools_found()}
                      </div>
                    ) : (
                      tools.map((tool) => {
                        const currentState = getToolState(tool.name)
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
                              currentState !== 'off' ? 'bg-card' : 'bg-muted/30 opacity-70'
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
                                <ToggleGroup
                                  type="single"
                                  value={currentState}
                                  onValueChange={(val) => {
                                    if (val) setToolState(tool.name, val as 'off' | 'on' | 'direct')
                                  }}
                                  size="sm"
                                  variant="outline"
                                  disabled={refreshMutation.isPending || isToolsLoading}
                                >
                                  <ToggleGroupItem value="off" className="text-[11px] px-2 h-7">
                                    {m.mcp_tool_state_disabled()}
                                  </ToggleGroupItem>
                                  <ToggleGroupItem value="on" className="text-[11px] px-2 h-7">
                                    {m.mcp_tool_state_proxy()}
                                  </ToggleGroupItem>
                                  <ToggleGroupItem value="direct" className="text-[11px] px-2 h-7">
                                    {m.mcp_tool_state_direct()}
                                  </ToggleGroupItem>
                                </ToggleGroup>
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
              <Button
                type="button"
                variant="outline"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending || isToolsLoading || saveMutation.isPending}
                className="gap-1.5 mr-auto"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
                />
                {m.mcp_refresh_server()}
              </Button>
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
