import { z } from 'zod'

/**
 * Shared environment validation schema for FileVault.
 * All apps import this and validate their env at startup.
 */
export const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_API_URL: z.string().url(),

  // Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1).optional(),
  CLERK_JWKS_URL: z.string().url().optional(),

  // Cloudflare D1
  CF_D1_DATABASE_ID: z.string().min(1).optional(),
  CF_D1_DATABASE_NAME: z.string().default('filevault-db'),

  // Cloudflare R2
  CF_R2_BUCKET_NAME: z.string().default('filevault-files'),
  CF_R2_PUBLIC_URL: z.string().url().optional(),

  // Cloudflare Workers/Pages
  CF_ACCOUNT_ID: z.string().min(1).optional(),
  CF_ZONE_ID: z.string().min(1).optional(),
  CF_API_TOKEN: z.string().min(1).optional(),

  // Presigned URL signing
  UPLOAD_URL_SECRET: z.string().min(32).optional(),

  // Optional Integrations
  SENTRY_DSN: z.string().url().optional(),
})

export type Env = z.infer<typeof envSchema>

/**
 * Validate environment variables.
 * Throws on failure with detailed error message.
 */
export function validateEnv(env: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const messages = Object.entries(errors).flatMap(([field, errs]) =>
      errs.map((e) => `${field}: ${e}`)
    )
    throw new Error(`Invalid environment variables:\n${messages.join('\n')}`)
  }
  return result.data
}

/**
 * Client-safe env (only NEXT_PUBLIC_* vars).
 * Use in browser bundles.
 */
export const clientEnvSchema = envSchema.pick({
  NODE_ENV: true,
  NEXT_PUBLIC_APP_URL: true,
  NEXT_PUBLIC_API_URL: true,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: true,
})

export type ClientEnv = z.infer<typeof clientEnvSchema>
