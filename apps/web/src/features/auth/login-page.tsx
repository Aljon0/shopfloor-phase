import { zodResolver } from '@hookform/resolvers/zod'
import { Factory } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { useState } from 'react'
import { describeApiError } from '@/lib/api-client'
import { isApiMode } from '@/lib/config'
import { getDefaultPathForRole } from '@/lib/navigation'
import { ROLES, ROLE_LABELS } from '@/types/roles'

const loginSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name'),
  role: z.enum(['administrator', 'manager', 'supervisor', 'operator']),
})

type LoginValues = z.infer<typeof loginSchema>

const apiLoginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email'),
  password: z.string().min(1, 'Enter your password'),
})
type ApiLoginValues = z.infer<typeof apiLoginSchema>

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))

export function LoginPage() {
  return isApiMode ? <ApiLoginPage /> : <MockLoginPage />
}

function Shell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Factory className="h-6 w-6 text-primary" aria-hidden="true" />
            <div className="leading-tight">
              <h1 className="text-lg font-semibold">ShopFloor</h1>
              <p className="text-xs text-muted">{subtitle}</p>
            </div>
          </div>
          {children}
        </CardContent>
      </Card>
    </div>
  )
}

function ApiLoginPage() {
  const { user, signInWithPassword } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string>()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ApiLoginValues>({ resolver: zodResolver(apiLoginSchema), defaultValues: { email: '', password: '' } })

  if (user) return <Navigate to={getDefaultPathForRole(user.role)} replace />

  const onSubmit = async (values: ApiLoginValues) => {
    setServerError(undefined)
    try {
      const signedIn = await signInWithPassword(values.email, values.password)
      navigate(getDefaultPathForRole(signedIn.role), { replace: true })
    } catch (error) {
      setServerError(describeApiError(error).message)
    }
  }

  return (
    <Shell subtitle="Northstar Metalworks">
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
        <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" invalid={!!errors.email} {...register('email')} />
        </FormField>
        <FormField label="Password" htmlFor="password" required error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" invalid={!!errors.password} {...register('password')} />
        </FormField>
        {serverError ? (
          <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
            {serverError}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Shell>
  )
}

function MockLoginPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { name: '', role: 'supervisor' },
  })

  if (user) return <Navigate to={getDefaultPathForRole(user.role)} replace />

  const onSubmit = (values: LoginValues) => {
    signIn(values.name, values.role)
    navigate(getDefaultPathForRole(values.role), { replace: true })
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Factory className="h-6 w-6 text-primary" aria-hidden="true" />
            <div className="leading-tight">
              <h1 className="text-lg font-semibold">ShopFloor</h1>
              <p className="text-xs text-muted">Northstar Metalworks (demo)</p>
            </div>
          </div>
          <p className="rounded-md bg-warning-bg px-3 py-2 text-xs text-warning">
            Demo sign-in: no password and no server. Real authentication arrives with the backend phase.
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField label="Your name" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" autoComplete="name" invalid={!!errors.name} {...register('name')} />
            </FormField>
            <FormField label="Role" htmlFor="role" required error={errors.role?.message}>
              <Select id="role" options={ROLE_OPTIONS} {...register('role')} />
            </FormField>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
