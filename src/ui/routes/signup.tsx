import { client } from '@/ui/api/client'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/ui/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/ui/components/ui/card'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/ui/stores/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { signUp } from '@/ui/lib/auth-client'
import { useState } from 'react'

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
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
      name: data.name,
      inviteCode: data.inviteCode,
      // Cast to any because inviteCode is a custom field handled in Better Auth hooks
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const isFirstUser = signupInfo?.userCount === 0
  const isPublicSignupDisabled = !isFirstUser && !signupInfo?.enablePublicSignup && !inviteCode

  if (isPublicSignupDisabled) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Registration Disabled</CardTitle>
            <CardDescription>
              Public registration is disabled. You need an invite code to join.
            </CardDescription>
          </CardHeader>
          <CardFooter className="text-center text-sm">
            Already have an account?{' '}
            <a href="/login" className="text-blue-500 hover:underline">
              Login
            </a>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen py-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign Up</CardTitle>
          <CardDescription>Create an account to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
          {isFirstUser && (
            <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-md text-sm">
              You will be the owner of the default team.
            </div>
          )}
          {inviteInfo && !('error' in inviteInfo) && (
            <div className="mb-4 p-3 bg-muted rounded-md text-sm">
              <span className="font-semibold">{inviteInfo.inviterName}</span> invited you to join{' '}
              <span className="font-semibold">{inviteInfo.teamName || inviteInfo.projectName}</span>{' '}
              as <span className="font-semibold">{inviteInfo.role}</span>.
            </div>
          )}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...form.register('name')} placeholder="Your name" />
              {form.formState.errors.name && (
                <p className="text-red-500 text-sm">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                {...form.register('email')}
                placeholder="you@example.com"
                type="email"
              />
              {form.formState.errors.email && (
                <p className="text-red-500 text-sm">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...form.register('password')}
                placeholder="Your password"
              />
              {form.formState.errors.password && (
                <p className="text-red-500 text-sm">{form.formState.errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-center text-sm">
          Already have an account?{' '}
          <a href="/login" className="text-blue-500 hover:underline">
            Login
          </a>
        </CardFooter>
      </Card>
    </div>
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
