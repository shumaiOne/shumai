import { client } from '@/ui/api/client'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/ui/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Loader2, Mail, Lock, ArrowRight, UserPlus } from 'lucide-react'
import { useAuthStore } from '@/ui/stores/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { signUp } from '@/ui/lib/auth-client'
import { useState } from 'react'
import { ShumaiLogo } from '@/ui/components/ui/icons'
import { AuthLayout } from '@/ui/components/auth-layout'

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(3, 'Password must be at least 3 characters'),
  inviteCode: z.string().optional(),
})

type SignupSchema = z.infer<typeof signupSchema>

function SignupPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const inviteCode = (search as { inviteCode?: string }).inviteCode
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { data: inviteInfo } = useQuery({
    queryKey: ['invite', inviteCode],
    queryFn: async () => {
      const res = await client.api.invite[':code'].$get({
        param: { code: inviteCode! },
      })
      if (!res.ok) {
        throw new Error('Failed to fetch invite info')
      }
      return await res.json()
    },
    enabled: !!inviteCode,
  })

  const { data: signupInfo, isLoading: isSignupInfoLoading } = useQuery({
    queryKey: ['/signup-info'],
    queryFn: async () => {
      const res = await client.api['signup-info'].$get()
      if (!res.ok) throw new Error('Failed to fetch signup info')
      return await res.json()
    },
  })

  const setUser = useAuthStore((state) => state.setUser)

  const form = useForm<SignupSchema>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      inviteCode: inviteCode,
    },
  })

  const onSubmit = async (data: SignupSchema) => {
    setLoading(true)
    setError(null)
    const { data: session, error: signUpError } = await signUp.email({
      email: data.email,
      password: data.password,
      name: data.email, // Use email as the username
      inviteCode: data.inviteCode,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    setLoading(false)
    if (signUpError) {
      setError(signUpError.message || 'Signup failed')
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

  const isFirstUser = signupInfo?.userCount === 0
  const isPublicSignupDisabled = !isFirstUser && !inviteCode

  if (isPublicSignupDisabled) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-8 bg-zinc-100/80 dark:bg-black font-sans overflow-hidden relative">
        {/* Background Mesh Blobs */}
        <div className="bg-rose-500/10 dark:bg-rose-600/5 w-[500px] h-[500px] rounded-full blur-[120px] absolute top-[-10%] left-[-10%] animate-drift-slow" />
        <div className="bg-orange-500/10 dark:bg-orange-600/5 w-[500px] h-[500px] rounded-full blur-[120px] absolute bottom-[-10%] right-[-10%] animate-drift-medium" />

        <Card className="w-full max-w-md relative z-10 border border-zinc-200 dark:border-zinc-850 shadow-2xl bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden">
          <CardHeader className="text-center pt-8 pb-4">
            <div className="flex justify-center mb-4">
              <ShumaiLogo className="h-16 w-16 shadow-lg shadow-rose-500/10 rounded-2xl" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-rose-500 to-orange-500 bg-clip-text text-transparent">
              Registration Disabled
            </CardTitle>
            <CardDescription className="mt-2 text-zinc-600 dark:text-zinc-400">
              Public registration is currently disabled. You will need an invite code to join this
              team.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-4 pb-8 text-center text-sm border-t border-zinc-200/30 dark:border-zinc-800/30 pt-6">
            <p className="text-zinc-500 dark:text-zinc-400">
              Already have an account?{' '}
              <a
                href="/login"
                className="font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors hover:underline inline-flex items-center gap-1"
              >
                Login here <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </p>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Create Account
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1 mb-4">
          Start building and organizing your space.
        </p>

        {/* Context Banners (First User / Invite Info) */}
        {isFirstUser && (
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-2xl text-xs leading-relaxed font-medium">
            <span>🎉</span>
            <span>You will be the owner of the default workspace as the first user!</span>
          </div>
        )}
        {inviteInfo && !('error' in inviteInfo) && (
          <div className="flex items-start gap-3 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 rounded-2xl text-xs leading-relaxed font-medium mt-3">
            <span>👋</span>
            <span>
              <strong>{inviteInfo.inviterName}</strong> invited you to join{' '}
              <strong>{inviteInfo.teamName || inviteInfo.projectName}</strong> as a{' '}
              <strong>{inviteInfo.role}</strong>.
            </span>
          </div>
        )}
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
              placeholder="At least 3 characters"
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
              Creating account...
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              Sign Up
            </>
          )}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-zinc-200/30 dark:border-zinc-800/30 text-center text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">Already have an account? </span>
        <a
          href="/login"
          className="font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors hover:underline inline-flex items-center gap-0.5"
        >
          Login <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </AuthLayout>
  )
}

export const Route = createFileRoute('/signup')({
  component: SignupPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      inviteCode: (search.inviteCode as string) || undefined,
    }
  },
  beforeLoad: () => {
    if (useAuthStore.getState().user) {
      throw redirect({
        to: '/',
      })
    }
  },
})
