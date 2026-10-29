import { AuthLayout } from '@/ui/components/auth-layout'
import { Button } from '@/ui/components/ui/button'
import { authClient } from '@/ui/lib/auth-client'
import { useAuthStore } from '@/ui/stores/auth'
import { m } from '@/ui/paraglide/messages.js'
import { createLazyFileRoute } from '@tanstack/react-router'
import { Check, Key, Loader2, ShieldCheck, User, X } from 'lucide-react'
import { useState } from 'react'

export const Route = createLazyFileRoute('/consent')({
  component: ConsentPage,
})

function ConsentPage() {
  const search = Route.useSearch()
  const rawUser = useAuthStore((state) => state.user)
  const user =
    rawUser && typeof rawUser === 'object' ? (rawUser as { email?: string; name?: string }) : null
  const [loading, setLoading] = useState<'accept' | 'deny' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clientId = search.client_id || 'MCP Client'
  const scopes = search.scope ? search.scope.split(' ') : ['mcp']

  const handleConsent = async (accept: boolean) => {
    setLoading(accept ? 'accept' : 'deny')
    setError(null)
    try {
      const res = await authClient.oauth2.consent({
        accept,
      })

      if (res.data?.url) {
        window.location.href = res.data.url
      } else if (res.error) {
        setError(res.error.message || m.consent_failed())
        setLoading(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : m.consent_failed())
      setLoading(null)
    }
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-primary">
          <ShieldCheck className="w-6 h-6" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {m.authorize_application()}
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">{m.authorize_application_subtitle()}</p>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm text-center font-medium">
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-card p-4 mb-6 shadow-xs">
        <div className="flex items-center justify-between text-sm pb-3 border-b border-border">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Key className="w-4 h-4" />
            {m.application_client_id()}
          </span>
          <span className="font-mono font-medium text-foreground text-xs bg-muted px-2 py-0.5 rounded">
            {clientId}
          </span>
        </div>

        {user && (
          <div className="flex items-center justify-between text-sm pb-3 border-b border-border">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <User className="w-4 h-4" />
              {m.logged_in_as()}
            </span>
            <span className="font-medium text-foreground text-xs">{user.email || user.name}</span>
          </div>
        )}

        <div className="pt-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
            {m.requested_permissions()}
          </span>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm bg-muted/50 p-2.5 rounded-lg border border-border/50">
              <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground text-xs">{m.mcp_access_scope_desc()}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {scopes.map((s) => (
                    <span
                      key={s}
                      className="font-mono text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1 h-11 rounded-xl cursor-pointer"
          disabled={loading !== null}
          onClick={() => handleConsent(false)}
        >
          {loading === 'deny' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {m.denying()}
            </>
          ) : (
            <>
              <X className="w-4 h-4 mr-1.5" />
              {m.deny()}
            </>
          )}
        </Button>

        <Button
          type="button"
          className="flex-1 h-11 bg-primary text-primary-foreground font-semibold rounded-xl shadow-xs cursor-pointer"
          disabled={loading !== null}
          onClick={() => handleConsent(true)}
        >
          {loading === 'accept' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {m.authorizing()}
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-1.5" />
              {m.authorize()}
            </>
          )}
        </Button>
      </div>
    </AuthLayout>
  )
}
