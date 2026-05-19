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
import { useAuthStore } from '@/ui/stores/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { signIn } from '@/ui/lib/auth-client'

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

  const { data: signupInfo } = useQuery({
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

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Enter your credentials to access your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
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
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-center text-sm">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="text-blue-500 hover:underline">
            Sign up
          </a>
        </CardFooter>
      </Card>
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
