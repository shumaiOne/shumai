import { AuthLayout } from '@/ui/components/auth-layout'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { resetPassword } from '@/ui/lib/auth-client'
import { m } from '@/ui/paraglide/messages.js'
import { zodResolver } from '@hookform/resolvers/zod'
import { createLazyFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AlertCircle, ArrowRight, CheckCircle2, KeyRound, Loader2, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const resetPasswordFormSchema = z
  .object({
    password: z.string().min(3, m.password_min_length()),
    confirmPassword: z.string().min(3, m.password_min_length()),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: m.passwords_do_not_match(),
    path: ['confirmPassword'],
  })

type ResetPasswordFormSchema = z.infer<typeof resetPasswordFormSchema>

export const Route = createLazyFileRoute('/reset-password')({
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const token = search.token || ''

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const form = useForm<ResetPasswordFormSchema>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        navigate({ to: '/login' })
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [success, navigate])

  const onSubmit = async (data: ResetPasswordFormSchema) => {
    if (!token) {
      setError(m.invalid_reset_token())
      return
    }

    setLoading(true)
    setError(null)

    const { error: resetError } = await resetPassword({
      newPassword: data.password,
      token,
    })

    setLoading(false)

    if (resetError) {
      setError(resetError.message || m.invalid_reset_token())
      return
    }

    setSuccess(true)
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{m.reset_password()}</h1>
        <p className="text-muted-foreground text-sm mt-1">{m.reset_password_subtitle()}</p>
      </div>

      {!token ? (
        <div className="space-y-6">
          <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{m.invalid_reset_token()}</p>
              <p className="text-xs text-muted-foreground">{m.invalid_reset_token_description()}</p>
            </div>
          </div>

          <Link to="/login" className="block w-full">
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl flex items-center justify-center gap-2"
            >
              {m.go_to_login()}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      ) : success ? (
        <div className="space-y-6">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{m.password_reset_success()}</p>
              <p className="text-xs text-muted-foreground">
                {m.password_reset_success_description()}
              </p>
            </div>
          </div>

          <Link to="/login" className="block w-full">
            <Button className="w-full h-11 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-md shadow-rose-500/10 hover:shadow-rose-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 border-0">
              {m.go_to_login()}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm text-center font-medium">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-xs font-semibold text-muted-foreground tracking-wide uppercase"
            >
              {m.new_password()}
            </Label>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-rose-500" />
              <Input
                id="password"
                type="password"
                {...form.register('password')}
                placeholder={m.new_password_placeholder()}
                className="pl-10.5 h-11 border-border focus-visible:ring-rose-500/50 focus-visible:border-rose-500 rounded-xl transition-all shadow-sm"
              />
            </div>
            {form.formState.errors.password && (
              <p className="text-destructive text-xs font-medium">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-xs font-semibold text-muted-foreground tracking-wide uppercase"
            >
              {m.confirm_password()}
            </Label>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-rose-500" />
              <Input
                id="confirmPassword"
                type="password"
                {...form.register('confirmPassword')}
                placeholder={m.confirm_password_placeholder()}
                className="pl-10.5 h-11 border-border focus-visible:ring-rose-500/50 focus-visible:border-rose-500 rounded-xl transition-all shadow-sm"
              />
            </div>
            {form.formState.errors.confirmPassword && (
              <p className="text-destructive text-xs font-medium">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-md shadow-rose-500/10 hover:shadow-rose-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 border-0"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {m.resetting_password()}
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                {m.reset_password()}
              </>
            )}
          </Button>

          <div className="pt-2 text-center text-sm">
            <Link
              to="/login"
              className="font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors hover:underline inline-flex items-center gap-1"
            >
              {m.go_to_login()}
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
