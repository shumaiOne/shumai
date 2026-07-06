'use client'

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { client } from '@/ui/api/client'
import { Loader2 } from 'lucide-react'
import { m } from '@/ui/paraglide/messages.js'

interface GuestIdentityPopupProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (guestUserId: string) => void
  children?: React.ReactNode
}

export function GuestIdentityPopup({
  isOpen,
  onClose,
  onSuccess,
  children,
}: GuestIdentityPopupProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await client.api.identify.$post({
        json: { username: name, email: email },
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error || 'Failed to identify')
      }

      const { id } = await res.json()
      localStorage.setItem('guest_user_id', id)
      onSuccess(id)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80" align="end" side="top">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">{m.enter_your_details()}</h4>
            <p className="text-sm text-muted-foreground">{m.provide_name_email_for_comment()}</p>
          </div>
          <div className="grid gap-2">
            <div className="grid gap-1">
              <Label htmlFor="name">{m.name()}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={m.name_placeholder()}
                size={32}
                required
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="email">{m.email()}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={m.email_field_placeholder()}
                required
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {m.cancel()}
            </Button>
            <Button type="submit" size="sm" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {m.confirm()}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
