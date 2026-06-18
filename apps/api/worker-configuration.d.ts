// Cloudflare Workers types
/// <reference types="@cloudflare/workers-types" />

declare module 'hono' {
  interface Env {
    Bindings: {
      CLERK_SECRET_KEY: string
      CLERK_JWKS_URL: string
      SUPABASE_URL: string
      SUPABASE_SERVICE_ROLE_KEY: string
      DATABASE_URL: string
      STRIPE_SECRET_KEY?: string
      STRIPE_WEBHOOK_SECRET?: string
    }
    Variables: {
      userId: string
      sessionId: string
    }
  }
}