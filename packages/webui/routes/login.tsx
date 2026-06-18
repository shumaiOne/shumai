import { client } from '@/ui/api/client'
import { AuthLayout } from '@/ui/components/auth-layout'
import { Button } from '@/ui/components/ui/button'
import { ShumaiLogo } from '@/ui/components/ui/icons'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { signIn } from '@/ui/lib/auth-client'
import { useAuthStore } from '@/ui/stores/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Loader2, Lock, LogIn, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginSchema = z.infer<typeof loginSchema>

function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  let isDemoEnv
  try {
    isDemoEnv = process.env.PUBLIC_DEMO_MODE === '1'
  } catch {
    isDemoEnv = false
  }

  const { data: signupInfo, isLoading: isSignupInfoLoading } = useQuery({
    queryKey: ['/signup-info'],
    queryFn: async () => {
      const res = await client.api['signup-info'].$get()
      if (!res.ok) throw new Error('Failed to fetch signup info')
      return await res.json()
    },
  })

  useEffect(() => {
    if (signupInfo?.userCount === 0) {
      navigate({ to: '/signup', search: { inviteCode: '' } })
    }
  }, [signupInfo, navigate])

  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginSchema) => {
    setLoading(true)
    setError(null)
    const { data: session, error: signInError } = await signIn.email({
      email: data.email,
      password: data.password,
    })

    setLoading(false)
    if (signInError) {
      setError(signInError.message || 'Invalid credentials')
      return
    }

    if (session) {
      setUser(session.user)
      navigate({ to: '/' })
    }
  }

  if (isSignupInfoLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-100/80 dark:bg-black">
        <div className="relative flex flex-col items-center">
          <ShumaiLogo className="h-16 w-16 animate-pulse mb-4 text-rose-500 shadow-xl rounded-2xl" />
          <Loader2 className="h-6 w-6 animate-spin text-rose-500/70" />
        </div>
      </div>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome Back
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Enter your credentials to access your account.
        </p>
      </div>

      {isDemoEnv && (
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 rounded-xl text-sm leading-relaxed">
          <p>
            <strong>Demo Access:</strong> Use <strong>"foo@bar.com"</strong> as the email and{' '}
            <strong>"foo"</strong> as the password to login.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm text-center font-medium">
          {error}
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label
            htmlFor="email"
            className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 tracking-wide uppercase"
          >
            Email Address
          </Label>
          <div className="relative group">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-600 transition-colors group-focus-within:text-rose-500" />
            <Input
              id="email"
              {...form.register('email')}
              placeholder="you@example.com"
              type="email"
              className="pl-10.5 h-11 border-zinc-200 dark:border-zinc-800 focus-visible:ring-rose-500/50 focus-visible:border-rose-500 rounded-xl transition-all shadow-sm"
            />
          </div>
          {form.formState.errors.email && (
            <p className="text-red-500 text-xs font-medium">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 tracking-wide uppercase"
          >
            Password
          </Label>
          <div className="relative group">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-600 transition-colors group-focus-within:text-rose-500" />
            <Input
              id="password"
              type="password"
              {...form.register('password')}
              placeholder="Your password"
              className="pl-10.5 h-11 border-zinc-200 dark:border-zinc-800 focus-visible:ring-rose-500/50 focus-visible:border-rose-500 rounded-xl transition-all shadow-sm"
            />
          </div>
          {form.formState.errors.password && (
            <p className="text-red-500 text-xs font-medium">
              {form.formState.errors.password.message}
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
              Logging in...
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              Login
            </>
          )}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-zinc-200/30 dark:border-zinc-800/30 text-center text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">Don't have an account? </span>
        <a
          href="/signup"
          className="font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors hover:underline inline-flex items-center gap-0.5"
        >
          Sign up <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </AuthLayout>
  )
}

export const Route = createFileRoute('/login')({
  component: LoginPage,
  beforeLoad: () => {
    if (useAuthStore.getState().user) {
      throw redirect({
        to: '/',
      })
    }
  },
})
