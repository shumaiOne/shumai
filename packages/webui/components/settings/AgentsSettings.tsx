import { client } from '@/ui/api/client'
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
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { Card, CardContent } from '@/ui/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'
import { Switch } from '@/ui/components/ui/switch'
import { usePermissions } from '@/ui/hooks/use-permissions'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { AgentInfo, AgentPermission, AgentType, ThinkingLevel } from '@shumai/dtos'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  ChevronDown,
  Cpu,
  Loader2,
  MessageSquare,
  MoreVertical,
  Plus,
  Puzzle,
  Trash2,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AgentFormDialog } from './AgentFormDialog'

interface AgentsSettingsProps {
  teamId: string
}

const AGENT_TYPES: {
  type: AgentType
  label: string
  icon: React.FC<React.SVGProps<SVGSVGElement>>
}[] = [
  { type: 'chat', label: 'Chat', icon: MessageSquare },
  { type: 'autofill', label: 'Autofill', icon: Zap },
  { type: 'embedding', label: 'Embedding', icon: Cpu },
]

export function AgentsSettings({ teamId }: AgentsSettingsProps) {
  const queryClient = useQueryClient()
  const { canAdmin } = usePermissions()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createType, setCreateType] = useState<AgentType>('chat')
  const [editingAgent, setAgentToEdit] = useState<AgentInfo | null>(null)
  const [agentToDelete, setAgentToDelete] = useState<AgentInfo | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    chat: true,
    autofill: true,
    embedding: true,
  })

  const getSectionLabel = (type: AgentType) => {
    if (type === 'chat') return m.agent_type_chat()
    if (type === 'autofill') return m.agent_type_autofill()
    return m.agent_type_embedding()
  }

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents', teamId],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].agents.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error('failed to fetch agents')
      const data = await res.json()
      return [...data].sort((a, b) => b.id.localeCompare(a.id))
    },
  })

  const deleteAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await client.api.agents[':agentId'].$delete({
        param: { agentId },
      })
      if (!res.ok) throw new Error('failed to delete agent')
    },
    onSuccess: () => {
      setIsDeleteDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['agents', teamId] })
      toast.success(m.agent_deleted_successfully())
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const updateAgentPermissionMutation = useMutation({
    mutationFn: async ({
      agentId,
      permission,
    }: {
      agentId: string
      permission: AgentPermission
    }) => {
      const res = await client.api.agents[':agentId'].permission.$patch({
        param: { agentId },
        json: { permission },
      })
      if (!res.ok) throw new Error(m.failed_to_update_permission())
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', teamId] })
    },
    onError: (err: Error) => {
      toast.error(err.message || m.failed_to_update_permission())
    },
  })

  const updateAgentMutation = useMutation({
    mutationFn: async (params: {
      teamId: string
      agentId: string
      name: string
      type: AgentType
      enabled: boolean
      avatar?: string
      providerId?: string
      modelId?: string
      thinkingLevel?: ThinkingLevel
      systemPrompt?: string
      soul?: string
      skills?: string[]
      deniedTools?: string[]
    }) => {
      const res = await client.api.agents[':agentId'].$put({
        param: { agentId: params.agentId },
        json: {
          name: params.name,
          type: params.type,
          enabled: params.enabled,
          avatar: params.avatar,
          providerId: params.providerId,
          modelId: params.modelId,
          thinkingLevel: params.thinkingLevel,
          systemPrompt: params.systemPrompt,
          soul: params.soul,
          skills: params.skills,
          deniedTools: params.deniedTools,
        },
      })
      if (!res.ok) throw new Error('failed to update agent')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', teamId] })
      toast.success(m.agent_updated_successfully())
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const toggleSection = (type: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [type]: !prev[type],
    }))
  }

  return (
    <>
      {(isCreateDialogOpen || editingAgent) && (
        <AgentFormDialog
          isOpen={true}
          title={
            editingAgent
              ? m.edit_item({ name: editingAgent.name })
              : m.create_type_agent({ type: getSectionLabel(createType) })
          }
          onClose={() => {
            setIsCreateDialogOpen(false)
            setAgentToEdit(null)
          }}
          teamId={teamId}
          type={createType}
          initialValues={editingAgent || undefined}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.are_you_absolutely_sure()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.delete_agent_confirmation({ name: agentToDelete?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={(e) => {
                if (deleteAgentMutation.isPending) {
                  e.preventDefault()
                  return
                }
                if (agentToDelete) {
                  deleteAgentMutation.mutate(agentToDelete.id)
                }
              }}
            >
              {deleteAgentMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                m.delete_agent()
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading && agents.length === 0 ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6 max-w-5xl mx-auto relative">
          {isLoading && (
            <div className="absolute top-0 right-0 p-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {AGENT_TYPES.map((section) => {
            const typeAgents = agents.filter((a) => a.type === section.type)
            const Icon = section.icon
            const isSingleAgentType = section.type === 'autofill' || section.type === 'embedding'

            return (
              <div
                key={section.type}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                <div
                  className={cn(
                    'px-6 py-4 flex items-center justify-between',
                    !isSingleAgentType && 'cursor-pointer hover:bg-muted/50 transition-colors',
                  )}
                  onClick={!isSingleAgentType ? () => toggleSection(section.type) : undefined}
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      {section.type === 'chat'
                        ? m.chat_agents()
                        : section.type === 'autofill'
                          ? m.autofill_agent()
                          : m.embedding_agent()}
                    </h3>
                    {!isSingleAgentType && (
                      <Badge variant="secondary" className="h-5 px-1.5 min-w-[1.25rem] text-[10px]">
                        {typeAgents.length}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!(isSingleAgentType && typeAgents.length > 0) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCreateType(section.type)
                          setIsCreateDialogOpen(true)
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}
                    {!isSingleAgentType && (
                      <ChevronDown
                        className={cn(
                          'w-5 h-5 text-muted-foreground transition-transform duration-200',
                          expandedSections[section.type] ? 'rotate-180' : '',
                        )}
                      />
                    )}
                  </div>
                </div>

                {(isSingleAgentType || expandedSections[section.type]) && (
                  <div className="px-6 pb-6 pt-2 space-y-3">
                    <div className="grid grid-cols-1 gap-4">
                      {typeAgents.map((agent) => (
                        <Card
                          key={agent.id}
                          className="group relative overflow-hidden border-border hover:border-primary/50 transition-all duration-200 cursor-pointer pb-1 pt-1"
                          onClick={() => setAgentToEdit(agent)}
                        >
                          <CardContent className="p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                  {agent.avatar ? (
                                    <img
                                      src={agent.avatar}
                                      className="w-full h-full object-cover"
                                      alt=""
                                    />
                                  ) : (
                                    <Bot className="w-6 h-6 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="font-bold text-foreground block truncate">
                                    {agent.name}
                                  </span>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                    <span className="flex items-center gap-1">
                                      <Puzzle className="w-3 h-3" />
                                      {m.skills_count_value({ count: agent.skills?.length || 0 })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-32">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setAgentToDelete(agent)
                                      setIsDeleteDialogOpen(true)
                                    }}
                                    className="text-red-500 focus:text-red-500 gap-2 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" /> {m.delete()}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                              <div>
                                {agent.type === 'chat' ? (
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <Select
                                      value={agent.permission || 'reviewer'}
                                      onValueChange={(permission) => {
                                        updateAgentPermissionMutation.mutate({
                                          agentId: agent.id,
                                          permission: permission as AgentPermission,
                                        })
                                      }}
                                      disabled={!canAdmin}
                                    >
                                      <SelectTrigger className="h-7 text-xs px-2 bg-background border-border w-[140px]">
                                        <SelectValue>
                                          {agent.permission === 'reviewer'
                                            ? m.permission_all_users()
                                            : agent.permission === 'editor'
                                              ? m.permission_owner_and_editor()
                                              : m.permission_owner_only()}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent align="start">
                                        <SelectItem value="reviewer">
                                          {m.permission_all_users()}
                                        </SelectItem>
                                        <SelectItem value="editor">
                                          {m.permission_owner_and_editor()}
                                        </SelectItem>
                                        <SelectItem value="owner">
                                          {m.permission_owner_only()}
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ) : (
                                  <div />
                                )}
                              </div>
                              <div onClick={(e) => e.stopPropagation()}>
                                <Switch
                                  checked={agent.enabled}
                                  onCheckedChange={(enabled) => {
                                    updateAgentMutation.mutate({
                                      teamId,
                                      agentId: agent.id,
                                      name: agent.name,
                                      type: agent.type,
                                      enabled,
                                      avatar: agent.avatar,
                                      providerId: agent.providerId,
                                      modelId: agent.modelId,
                                      thinkingLevel: agent.thinkingLevel,
                                      systemPrompt: agent.systemPrompt,
                                      soul: agent.soul,
                                      skills: agent.skills?.map((s) => s.skillId),
                                      deniedTools: agent.deniedTools,
                                    })
                                  }}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {typeAgents.length === 0 && (
                        <div className="col-span-full py-8 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-muted/30">
                          <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center shadow-sm mb-3">
                            <Icon className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {m.no_agents_found({ type: getSectionLabel(section.type) })}
                          </p>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-primary font-medium h-auto p-0 mt-1"
                            onClick={() => {
                              setCreateType(section.type)
                              setIsCreateDialogOpen(true)
                            }}
                          >
                            {m.create_one_now()}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
