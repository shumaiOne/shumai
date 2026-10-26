import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Input } from '@/ui/components/ui/input'
import { Button } from '@/ui/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/ui/table'
import { Loader2, Plus, Trash2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { copyToClipboard } from '@/ui/lib/clipboard'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import type { ApiTokenResponse, CreateApiTokenResponse } from '@shumai/dtos'
import { m } from '@/ui/paraglide/messages.js'

export function DeveloperSettings({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()
  const [tokenName, setTokenName] = useState('')
  // Plaintext of a just-created token. It is only available in the create response.
  const [createdToken, setCreatedToken] = useState<CreateApiTokenResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: tokens, isLoading } = useQuery<ApiTokenResponse[]>({
    queryKey: ['teams', teamId, 'api-tokens'],
    queryFn: async () => {
      const res = await client.api.teams[':teamId']['api-tokens'].$get({
        param: { teamId },
      })
      if (!res.ok) throw new Error('Failed to fetch API tokens')
      return (await res.json()) as ApiTokenResponse[]
    },
  })

  const { mutate: createToken, isPending: isCreating } = useMutation({
    mutationFn: async (name: string) => {
      const res = await client.api.teams[':teamId']['api-tokens'].$post({
        param: { teamId },
        json: { name },
      })
      if (!res.ok) throw new Error('Failed to create API token')
      return (await res.json()) as CreateApiTokenResponse
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'api-tokens'] })
      setTokenName('')
      setCopied(false)
      setCreatedToken(created)
      toast.success(m.api_token_generated_successfully())
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_generate_token())
    },
  })

  const { mutate: deleteToken } = useMutation({
    mutationFn: async (tokenId: string) => {
      const res = await client.api.teams[':teamId']['api-tokens'][':tokenId'].$delete({
        param: { teamId, tokenId },
      })
      if (!res.ok) throw new Error('Failed to delete API token')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'api-tokens'] })
      toast.success(m.api_token_revoked_successfully())
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : m.failed_to_revoke_token())
    },
  })

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tokenName.trim()) return
    createToken(tokenName.trim())
  }

  const handleCopy = async (token: string) => {
    await copyToClipboard(token)
    setCopied(true)
    toast.success(m.copied_api_token_to_clipboard())
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{m.api_tokens()}</CardTitle>
          <CardDescription>{m.api_tokens_description()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleGenerate} className="flex gap-4 items-end max-w-md">
            <div className="flex-1 space-y-2">
              <label htmlFor="tokenName" className="text-sm font-medium text-muted-foreground">
                {m.token_name()}
              </label>
              <Input
                id="tokenName"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder={m.token_name_placeholder()}
                required
              />
            </div>
            <Button type="submit" disabled={isCreating || !tokenName.trim()}>
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {m.generate()}
            </Button>
          </form>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.name()}</TableHead>
                  <TableHead>{m.token()}</TableHead>
                  <TableHead>{m.created_at()}</TableHead>
                  <TableHead className="w-[100px] text-right">{m.actions()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!tokens || tokens.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-6 text-muted-foreground text-sm"
                    >
                      {m.no_api_tokens_found()}
                    </TableCell>
                  </TableRow>
                ) : (
                  tokens.map((token) => (
                    <TableRow key={token.id}>
                      <TableCell className="font-medium">{token.name}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        …{token.tokenHint}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(token.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => deleteToken(token.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">{m.api_token_hidden_hint()}</p>
        </CardContent>
      </Card>

      <Dialog
        open={createdToken !== null}
        onOpenChange={(open) => {
          if (!open) setCreatedToken(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.api_token_created_title()}</DialogTitle>
            <DialogDescription>{m.api_token_created_description()}</DialogDescription>
          </DialogHeader>
          {createdToken && (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={createdToken.token}
                aria-label={m.token()}
                className="font-mono text-sm"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                variant="outline"
                size="icon"
                aria-label={m.copy()}
                onClick={() => handleCopy(createdToken.token)}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreatedToken(null)}>{m.done()}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
