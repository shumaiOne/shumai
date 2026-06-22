import { client } from '@/ui/api/client'
import { Card, CardContent } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Badge } from '@/ui/components/ui/badge'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  Plus,
  Trash2,
  Bot,
  MoreVertical,
  MessageSquare,
  Zap,
  Cpu,
  Puzzle,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AgentInfo, AgentType, ThinkingLevel } from '@shumai/dtos'
import { AgentFormDialog } from './AgentFormDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { cn } from '@/ui/lib/utils'
import { ChevronDown } from 'lucide-react'
import { Switch } from '@/ui/components/ui/switch'

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
      toast.success('Agent deleted successfully')
    },
    onError: (error) => {
      toast.error(error.message)
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
        },
      })
      if (!res.ok) throw new Error('failed to update agent')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', teamId] })
      toast.success('Agent updated successfully')
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
          title={editingAgent ? `Edit ${editingAgent.name}` : `Create ${createType} Agent`}
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
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the agent "
              {agentToDelete?.name}" and remove all its data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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
                'Delete Agent'
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
                      {section.label} {isSingleAgentType ? 'Agent' : 'Agents'}
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
                          className="group relative overflow-hidden border-border hover:border-primary/50 transition-all duration-200 cursor-pointer"
                          onClick={() => setAgentToEdit(agent)}
                        >
                          <CardContent className="p-4 flex items-center justify-between">
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
                                    {agent.skills?.length || 0} Skills
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="mr-2" onClick={(e) => e.stopPropagation()}>
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
                                    })
                                  }}
                                />
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
                                    <Trash2 className="w-4 h-4" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>{' '}
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
                            No {section.label} {isSingleAgentType ? 'agent' : 'agents'} found
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
                            Create one now
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
