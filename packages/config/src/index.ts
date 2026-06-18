import { z } from 'zod'

/**
 * Shared environment validation schema for ReviewFlow.
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

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),

  // Cloudflare
  CF_ACCOUNT_ID: z.string().min(1).optional(),
  CF_ZONE_ID: z.string().min(1).optional(),
  CF_API_TOKEN: z.string().min(1).optional(),

  // Google Business Profile API
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_OAUTH_SCOPES: z.string().default(
    'https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/plus.business.manage'
  ),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url(),

  // Encryption (for Google tokens)
  ENCRYPTION_KEY: z.string().length(32), // 32 bytes = 256-bit for AES-256-GCM

  // Twilio (SMS)
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().min(1).optional(),
  TWILIO_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Resend (Email)
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PROFESSIONAL: z.string().optional(),
  STRIPE_PRICE_AGENCY: z.string().optional(),

  // Optional Integrations
  SENTRY_DSN: z.string().url().optional(),
  LOGTAIL_SOURCE_TOKEN: z.string().min(1).optional(),
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
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
})

export type ClientEnv = z.infer<typeof clientEnvSchema>