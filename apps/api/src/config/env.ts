import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Signs session tokens. Generate a long random value; never commit it. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SESSION_HOURS: z.coerce.number().int().min(1).max(72).default(10),
  /** Set true when the site is served over HTTPS. Plain-HTTP LAN installs keep it false. */
  COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  /** Browser origins allowed to call the API with the session cookie (comma separated). */
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
})

export type Env = z.infer<typeof schema>

/** Fails fast with a readable message instead of starting half-configured. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment configuration:\n${problems}`)
  }
  return parsed.data
}
