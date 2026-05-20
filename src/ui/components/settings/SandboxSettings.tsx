import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Input } from '@/ui/components/ui/input'
import { Button } from '@/ui/components/ui/button'
import { Loader2, Plus, X, Globe } from 'lucide-react'
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
    mutationFn: async (allowedDomains: string[]) => {
      const res = await client.api.teams[':teamId'].sandbox.$put({
        param: { teamId },
        json: { allowedDomains },
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
    const updated = [...(sandbox?.allowedDomains || []), newDomain.trim()]
    updateSandbox(updated)
    setNewDomain('')
  }

  const handleRemoveDomain = (domain: string) => {
    const updated = (sandbox?.allowedDomains || []).filter((d) => d !== domain)
    updateSandbox(updated)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto space-y-6 pr-1">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" />
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
            <h4 className="text-sm font-medium text-slate-500 mb-3">Allowed Domains</h4>
            <div className="flex flex-wrap gap-2">
              {sandbox?.allowedDomains.map((domain) => (
                <div
                  key={domain}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-sm border border-slate-200 dark:border-slate-700 transition-all hover:border-slate-300 dark:hover:border-slate-600"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-300">{domain}</span>
                  <button
                    onClick={() => handleRemoveDomain(domain)}
                    className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                    disabled={isUpdating}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {sandbox?.allowedDomains.length === 0 && (
                <div className="text-sm text-slate-400 italic">No custom domains allowed</div>
              )}
            </div>
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
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span>
                Allow Write: <code>.pi</code>, <code>/tmp</code>
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span>Deny Read: All other paths</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
