import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Input } from '@/ui/components/ui/input'
import { Button } from '@/ui/components/ui/button'
import { Loader2, Plus, X, Globe, Check, Trash2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'

export function SandboxSettings({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()
  const [newDomain, setNewDomain] = useState('')

  const { data: sandbox, isLoading } = useQuery({
    queryKey: ['teams', teamId, 'sandbox'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].sandbox.$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error(m.failed_load_settings())
      return await res.json()
    },
  })

  const { mutate: updateSandbox, isPending: isUpdating } = useMutation({
    mutationFn: async (params: { allowedDomains: string[]; pendingDomains: string[] }) => {
      const res = await client.api.teams[':teamId'].sandbox.$put({
        param: { teamId },
        json: params,
      })
      if (!res.ok) throw new Error(m.failed_to_update_sandbox_settings())
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'sandbox'] })
      toast.success(m.sandbox_settings_updated())
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_update_sandbox_settings())
    },
  })

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDomain.trim()) return
    if (sandbox?.allowedDomains.includes(newDomain.trim())) {
      toast.error(m.domain_already_exists())
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
              <CardTitle>{m.network_sandbox()}</CardTitle>
            </div>
            <CardDescription>{m.network_sandbox_description()}</CardDescription>
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
                {m.add_domain()}
              </Button>
            </form>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {m.allowed_domains()}
              </h4>
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
                    {m.no_custom_domains_allowed()}
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
              <CardTitle>{m.pending_domain_approvals()}</CardTitle>
            </div>
            <CardDescription>{m.pending_domains_description()}</CardDescription>
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
                          {m.approve()}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-destructive/20 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeletePendingDomain(domain)}
                          disabled={isUpdating}
                        >
                          <Trash2 className="w-4 h-4 mr-1.5" />
                          {m.delete()}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic py-2">
                  {m.no_pending_domains()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{m.filesystem_restriction()}</CardTitle>
            <CardDescription>{m.filesystem_restriction_description()}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </ScrollArea>
  )
}
