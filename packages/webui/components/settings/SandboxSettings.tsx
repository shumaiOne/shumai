import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Input } from '@/ui/components/ui/input'
import { Button } from '@/ui/components/ui/button'
import { Loader2, Plus, X, Globe, Check, Trash2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

export function SandboxSettings({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()
  const [newDomain, setNewDomain] = useState('')

  const { data: sandbox, isLoading } = useQuery({
    queryKey: ['teams', teamId, 'sandbox'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].sandbox.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error('Failed to fetch sandbox settings')
      return await res.json()
    },
  })

  const { mutate: updateSandbox, isPending: isUpdating } = useMutation({
    mutationFn: async (params: { allowedDomains: string[]; pendingDomains: string[] }) => {
      const res = await client.api.teams[':teamId'].sandbox.$put({
        param: { teamId },
        json: params,
      })
      if (!res.ok) throw new Error('Failed to update sandbox settings')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'sandbox'] })
      toast.success('Sandbox settings updated')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update sandbox settings')
    },
  })

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDomain.trim()) return
    if (sandbox?.allowedDomains.includes(newDomain.trim())) {
      toast.error('Domain already exists')
      return
    }
    const updatedAllowed = [...(sandbox?.allowedDomains || []), newDomain.trim()]
    const updatedPending = sandbox?.pendingDomains || []
    updateSandbox({ allowedDomains: updatedAllowed, pendingDomains: updatedPending })
    setNewDomain('')
  }

  const handleRemoveDomain = (domain: string) => {
    const updatedAllowed = (sandbox?.allowedDomains || []).filter((d) => d !== domain)
    const updatedPending = sandbox?.pendingDomains || []
    updateSandbox({ allowedDomains: updatedAllowed, pendingDomains: updatedPending })
  }

  const handleApproveDomain = (domain: string) => {
    const updatedAllowed = [...(sandbox?.allowedDomains || []), domain]
    const updatedPending = (sandbox?.pendingDomains || []).filter((d) => d !== domain)
    updateSandbox({ allowedDomains: updatedAllowed, pendingDomains: updatedPending })
  }

  const handleDeletePendingDomain = (domain: string) => {
    const updatedPending = (sandbox?.pendingDomains || []).filter((d) => d !== domain)
    updateSandbox({ allowedDomains: sandbox?.allowedDomains || [], pendingDomains: updatedPending })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 pr-4 pb-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              <CardTitle>Network Sandbox</CardTitle>
            </div>
            <CardDescription>
              Configure allowed domains for the sandboxed agent. By default, only essential domains
              are allowed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddDomain} className="flex gap-2 mb-6">
              <Input
                placeholder="e.g. api.openai.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                disabled={isUpdating}
              />
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Add Domain
              </Button>
            </form>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Allowed Domains</h4>
              <div className="flex flex-wrap gap-2">
                {sandbox?.allowedDomains.map((domain) => (
                  <div
                    key={domain}
                    className="flex items-center gap-1 px-3 py-1.5 bg-muted rounded-full text-sm border border-border transition-all hover:border-muted-foreground/50"
                  >
                    <span className="font-medium text-foreground">{domain}</span>
                    <button
                      onClick={() => handleRemoveDomain(domain)}
                      className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                      disabled={isUpdating}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {sandbox?.allowedDomains.length === 0 && (
                  <div className="text-sm text-muted-foreground italic">
                    No custom domains allowed
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Domains Section */}
        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-orange-500" />
              <CardTitle>Pending Domain Approvals</CardTitle>
            </div>
            <CardDescription>
              These domains were blocked during agent execution. You can approve them to allow
              future network requests, or delete them from this list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sandbox?.pendingDomains && sandbox.pendingDomains.length > 0 ? (
                <div className="divide-y divide-border">
                  {sandbox.pendingDomains.map((domain) => (
                    <div
                      key={domain}
                      className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                    >
                      <span className="font-mono text-sm text-foreground bg-muted px-2 py-1 rounded break-all">
                        {domain}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                          onClick={() => handleApproveDomain(domain)}
                          disabled={isUpdating}
                        >
                          <Check className="w-4 h-4 mr-1.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-destructive/20 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeletePendingDomain(domain)}
                          disabled={isUpdating}
                        >
                          <Trash2 className="w-4 h-4 mr-1.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic py-2">
                  No pending domains requiring approval
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Filesystem Restriction</CardTitle>
            <CardDescription>
              The agent is restricted to reading and writing only within the <code>.pi</code> and{' '}
              <code>/tmp</code> folders. These settings are currently hardcoded for security.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </ScrollArea>
  )
}
