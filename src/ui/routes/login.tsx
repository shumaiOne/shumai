import { client } from '@/ui/api/client'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { useAuthStore } from '@/ui/stores/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { signIn } from '@/ui/lib/auth-client'
import { Loader2, Mail, Lock, ArrowRight, LogIn, CheckCircle2 } from 'lucide-react'
import { ShumaiLogo } from '@/ui/components/ui/icons'

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
    <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-8 bg-zinc-100/80 dark:bg-black font-sans overflow-hidden relative font-sans">
      {/* Drifting Background Mesh Blobs */}
      <div className="bg-rose-500/10 dark:bg-rose-600/5 w-[600px] h-[600px] rounded-full blur-[140px] absolute top-[-10%] left-[-10%] animate-drift-slow" />
      <div className="bg-orange-500/10 dark:bg-orange-600/5 w-[600px] h-[600px] rounded-full blur-[140px] absolute bottom-[-10%] right-[-10%] animate-drift-medium" />

      {/* Main Glassmorphic Split-Pane Card */}
      <div className="relative max-w-4xl w-full flex flex-col md:flex-row rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl bg-white dark:bg-zinc-900 overflow-hidden min-h-[580px] z-10 transition-all duration-300 hover:shadow-rose-500/5">
        {/* Left Pane (Brand Showcase) */}
        <div className="w-full md:w-1/2 bg-gradient-to-br from-rose-500/15 via-orange-500/10 to-amber-500/5 dark:from-rose-950/30 dark:via-orange-950/15 dark:to-zinc-900/40 p-8 md:p-12 flex flex-col justify-between border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
          {/* Subtle Grid Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

          {/* Logo & Brand */}
          <div className="relative flex items-center gap-3">
            <ShumaiLogo className="h-12 w-12 shadow-lg shadow-rose-500/10 rounded-2xl transition-transform duration-500 hover:scale-105" />
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">
              Shumai
            </span>
          </div>

          {/* Marketing Copy / Feature Points */}
          <div className="relative my-8 md:my-0 space-y-6">
            <h2 className="text-3xl font-extrabold tracking-tight leading-tight text-zinc-900 dark:text-zinc-50">
              One workspace
              <br />
              for all your
              <br />
              <span className="bg-gradient-to-r from-rose-500 to-orange-500 bg-clip-text text-transparent">
                creative assets.
              </span>
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed max-w-sm">
              Upload and index your files, enrich them with custom metadata schemas, draw
              annotations directly on media, and gather instant feedback — all in one modern
              workspace built for creators.
            </p>

            <ul className="space-y-3.5 pt-4">
              {[
                'Instant asset uploads & high-fidelity media players',
                'Custom metadata schemas & drawing canvas reviews',
                'Frictionless team workspaces & secure sharing',
              ].map((text, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300 font-medium"
                >
                  <CheckCircle2 className="w-5 h-5 text-rose-500 flex-shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer Label */}
          <div className="relative pt-4 border-t border-zinc-200/30 dark:border-zinc-800/30">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Join our community of developers and designers.
            </p>
          </div>
        </div>

        {/* Right Pane (Form Container) */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Welcome Back
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
              Enter your credentials to access your account.
            </p>
          </div>

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
        </div>
      </div>
    </div>
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
