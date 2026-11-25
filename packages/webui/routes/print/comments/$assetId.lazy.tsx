import { client } from '@/ui/api/client'
import { PrintCommentsView } from '@/ui/components/print-comments/print-comments-view'
import { Button } from '@/ui/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Input } from '@/ui/components/ui/input'
import { m } from '@/ui/paraglide/messages.js'
import type { PrintCommentsResponse } from '@shumai/dtos'
import { useQuery } from '@tanstack/react-query'
import { createLazyFileRoute } from '@tanstack/react-router'
import { AlertCircle, Loader2, Lock } from 'lucide-react'
import React, { useEffect, useState } from 'react'

class PrintAuthError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function PrintCommentsPage() {
  const { assetId } = Route.useParams()
  const { shareId } = Route.useSearch()

  const [sharePassword, setSharePassword] = useState(() => {
    if (!shareId || typeof window === 'undefined') return ''
    return localStorage.getItem(`share_pwd_${shareId}`) || ''
  })
  const [passwordInput, setPasswordInput] = useState('')

  const { data, isLoading, error } = useQuery<PrintCommentsResponse>({
    queryKey: shareId
      ? ['print-comments', 'share', shareId, assetId, sharePassword]
      : ['print-comments', 'file', assetId],
    queryFn: async () => {
      if (shareId) {
        const res = await client.api.shares[':shareId'].files[':fileId'].comments.print.$get(
          {
            param: { shareId, fileId: assetId },
          },
          {
            // A 401 here is a share-password challenge handled by this page.
            fetch,
            headers: sharePassword ? { 'x-share-password': sharePassword } : undefined,
          },
        )
        if (res.status === 401) {
          throw new PrintAuthError(401, 'Unauthorized')
        }
        if (!res.ok) {
          throw new PrintAuthError(res.status, 'Failed to fetch printable comments')
        }
        return (await res.json()) as unknown as PrintCommentsResponse
      }

      const res = await client.api.files[':fileId'].comments.print.$get({
        param: { fileId: assetId },
      })
      if (!res.ok) {
        throw new PrintAuthError(res.status, 'Failed to fetch printable comments')
      }
      return (await res.json()) as unknown as PrintCommentsResponse
    },
    retry: false,
  })

  useEffect(() => {
    if (data?.asset?.name) {
      document.title = `${data.asset.name} - ${m.print_comments()}`
    }
  }, [data?.asset?.name])

  useEffect(() => {
    if (data && shareId && sharePassword) {
      localStorage.setItem(`share_pwd_${shareId}`, sharePassword)
    }
  }, [data, shareId, sharePassword])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!shareId) return
    setSharePassword(passwordInput)
  }

  if (isLoading) {
    return (
      <div
        className="print-sheet flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground"
        data-testid="print-comments-loading"
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{m.print_comments_loading()}</p>
      </div>
    )
  }

  if (shareId && error instanceof PrintAuthError && error.status === 401) {
    return (
      <div className="print-sheet flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" />
              <span>{m.password_protected()}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <Input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder={m.enter_password()}
                autoFocus
              />
              {sharePassword && (
                <p role="alert" className="text-sm text-destructive">
                  {m.incorrect_password()}
                </p>
              )}
              <Button type="submit" className="w-full cursor-pointer">
                {m.confirm()}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div
        className="print-sheet flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center text-foreground"
        data-testid="print-comments-error"
      >
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm font-medium">{m.print_comments_error()}</p>
      </div>
    )
  }

  return (
    <PrintCommentsView
      asset={data.asset}
      breadcrumbs={data.breadcrumbs}
      comments={data.comments}
      shareId={shareId}
      sharePassword={sharePassword || undefined}
    />
  )
}

export const Route = createLazyFileRoute('/print/comments/$assetId')({
  component: PrintCommentsPage,
})
