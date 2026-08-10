import React, { useState } from 'react'
import { client } from '@/ui/api/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Badge } from '@/ui/components/ui/badge'
import { Switch } from '@/ui/components/ui/switch'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { Loader2, RefreshCw, Search, Wrench, ChevronDown, ChevronRight } from 'lucide-react'
import { m } from '@/ui/paraglide/messages.js'
import { toast } from 'sonner'
import { McpServerInfo, McpToolInfo, UpdateMcpServerRequest } from '@shumai/dtos'

interface McpToolsDialogProps {
  isOpen: boolean
  onClose: () => void
  server: McpServerInfo | null
  teamId: string
}

export const McpToolsDialog: React.FC<McpToolsDialogProps> = ({
  isOpen,
  onClose,
  server,
  teamId,
}) => {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})

  // Fetch Tools
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
    enabled: isOpen && !!server?.id,
  })

  // Refresh Tools mutation
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

  // Update Config (Include/Exclude tools)
  const updateConfigMutation = useMutation({
    mutationFn: async ({
      newIncludes,
      newExcludes,
    }: {
      newIncludes?: string[]
      newExcludes?: string[]
    }) => {
      if (!server?.id) return
      const updatePayload: UpdateMcpServerRequest = {
        config: {
          ...server.config,
          includeTools: newIncludes,
          excludeTools: newExcludes,
        },
      }
      const res = await client.api.mcp.servers[':id'].$patch({
        param: { id: server.id },
        json: updatePayload,
      })
      if (!res.ok) throw new Error('Failed to update tool configuration')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'mcp', 'servers'] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const tools = toolsData?.tools || []

  const filteredTools = tools.filter((tool) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      tool.name.toLowerCase().includes(q) ||
      (tool.description && tool.description.toLowerCase().includes(q)) ||
      (tool.title && tool.title.toLowerCase().includes(q))
    )
  })

  const isToolEnabled = (toolName: string) => {
    if (!server?.config) return true
    const { includeTools, excludeTools } = server.config
    if (includeTools && includeTools.length > 0) {
      if (!includeTools.includes(toolName)) return false
    }
    if (excludeTools && excludeTools.length > 0) {
      if (excludeTools.includes(toolName)) return false
    }
    return true
  }

  const toggleToolEnabled = (toolName: string, enabled: boolean) => {
    if (!server) return
    const currentIncludes = server.config?.includeTools
    const currentExcludes = server.config?.excludeTools || []

    if (enabled) {
      // Remove from excludes, add to includes if include array exists
      const newExcludes = currentExcludes.filter((t: string) => t !== toolName)
      const newIncludes = currentIncludes ? [...currentIncludes, toolName] : undefined
      updateConfigMutation.mutate({ newIncludes, newExcludes })
    } else {
      // If include array is active, remove from includes. Otherwise add to excludes.
      let newIncludes = currentIncludes
      const newExcludes = [...currentExcludes]

      if (currentIncludes && currentIncludes.length > 0) {
        newIncludes = currentIncludes.filter((t: string) => t !== toolName)
      } else {
        if (!newExcludes.includes(toolName)) {
          newExcludes.push(toolName)
        }
      }
      updateConfigMutation.mutate({ newIncludes, newExcludes })
    }
  }

  const toggleExpand = (toolName: string) => {
    setExpandedTools((prev) => ({ ...prev, [toolName]: !prev[toolName] }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl h-[80vh] max-h-[750px] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Wrench className="w-5 h-5 text-primary" />
              {server?.name} - {m.mcp_tools()}
            </DialogTitle>
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
          <DialogDescription>{m.mcp_tools_count({ count: tools.length })}</DialogDescription>
        </DialogHeader>

        {/* Search bar */}
        <div className="relative my-3 flex-shrink-0">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={m.search_tools_placeholder()}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        {/* Tool list */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 min-h-0 pr-3">
          {isToolsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredTools.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              {m.no_tools_found()}
            </div>
          ) : (
            <div className="space-y-3 py-1 pr-1">
              {filteredTools.map((tool) => {
                const enabled = isToolEnabled(tool.name)
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
                          onCheckedChange={(checked) => toggleToolEnabled(tool.name, checked)}
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
                          {Object.entries(schemaObj.properties!).map(([propName, propDef]) => {
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
                                    <span className="text-[10px] text-red-500 font-bold">*</span>
                                  )}
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0">
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
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
