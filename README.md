# ReviewFlow

Production-ready **Google Business Review Management** SaaS with **Next.js 14**, **Clerk**, **Supabase**, **Cloudflare Workers (Hono)**, **Turborepo**, and **TypeScript** end-to-end.

## Features

- 🔐 **Clerk Auth** - Secure authentication with organizations
- 🏢 **Google Business Profile Integration** - OAuth2 + sync + webhooks
- ⭐ **Review Management** - View, filter, reply, bulk actions, internal notes
- 📊 **Analytics** - Rating distribution, reply rate, trends
- 📱 **Review Collection Campaigns** - SMS (Twilio) + Email (Resend) with tracking
- 💬 **Response Templates** - Saved replies with categories & variables
- 🏪 **Multi-location Support** - Manage 100+ locations from one dashboard
- 👥 **Team Collaboration** - Role-based access (Owner, Admin, Member, Viewer)
- 🔔 **Real-time Webhooks** - Google Pub/Sub, Twilio, Resend, Clerk, Stripe

## Stack

| Layer | Technology |
|-------|------------|
| **Monorepo** | Turborepo + pnpm |
| **Frontend** | Next.js 14 (App Router) + Tailwind CSS |
| **Auth** | Clerk (hosted, Webhooks → Supabase) |
| **Database** | Supabase (Postgres + Realtime + Storage) |
| **API** | Hono on Cloudflare Workers |
| **CI/CD** | GitHub Actions (Vercel + Cloudflare) |
| **Observability** | Sentry + Logtail + Cloudflare Analytics |
| **SMS** | Twilio |
| **Email** | Resend |

## Quick Start

```bash
# 1. Clone and install
git clone <repo> reviewflow
cd reviewflow
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your keys (see Environment Variables below)

# 3. Start local development
./scripts/dev.sh
# → Frontend: http://localhost:3000
# → API: http://localhost:8787
# → Supabase Studio: http://localhost:54323
```

## Project Structure

```
reviewflow/
├── apps/
│   ├── web/          # Next.js 14 frontend
│   │   ├── src/
│   │   │   ├── app/           # Pages: /, /sign-in, /onboarding, /dashboard, /reviews, /locations, /campaigns, /templates, /settings
│   │   │   │   └── api/webhook/  # Clerk, Stripe, Google webhooks
│   │   │   ├── lib/supabase/  # Client (browser) + Server (RSC) clients
│   │   │   └── ...
│   └── api/          # Hono on Cloudflare Workers
│       ├── src/
│       │   ├── index.ts       # All API routes: auth, accounts, locations, reviews, campaigns, templates, analytics
│       └── wrangler.toml
├── packages/
│   ├── config/       # Shared Zod env validation
│   ├── db/           # Supabase client + types + migrations + Edge Functions
│   ├── ui/           # Shared React components (Button, Input, Card, Avatar, Dropdown, Badge, Separator)
│   ├── google/       # Google Business Profile API client + OAuth + encryption
│   ├── communications/ # Twilio SMS + Resend Email + campaign engine
│   └── tsconfig/     # Shared TypeScript configs
├── .github/workflows/ # 6 CI/CD pipelines
├── scripts/          # Dev & deploy scripts
├── runbooks/         # Operational procedures
└── turbo.json        # Turborepo pipeline config
```

## Core Features

### Google Business Profile Integration
1. **OAuth2 Flow** - Secure connection via Clerk middleware
2. **Token Encryption** - AES-256-GCM encrypted tokens in database
3. **Auto-refresh** - Access tokens refreshed automatically
4. **Locations Sync** - Fetches all locations for connected accounts
5. **Reviews Sync** - Full sync + real-time Pub/Sub webhooks
6. **Reply to Google** - Direct API integration for review responses

### Review Management
- **Filterable Table** - By location, status, rating, search
- **Reply Modal** - Rich text, character count, template insertion
- **Bulk Actions** - Assign, change status, archive (up to 100)
- **Internal Notes** - Team-only notes per review
- **Status Tracking** - New, Replied, Flagged, Archived

### Review Collection Campaigns
- **SMS Campaigns** - Via Twilio with delivery tracking
- **Email Campaigns** - Via Resend with open/click tracking
- **Template Variables** - `{{name}}`, `{{business}}`, `{{link}}`, `{{rating}}`
- **Recipient Management** - CSV upload or manual entry
- **Campaign Analytics** - Sent, delivered, clicked, submitted rates

### Response Templates
- **Categories** - Positive, Negative, Neutral, Custom
- **Variables** - Auto-replace `{{name}}`, `{{business}}`, `{{rating}}`, `{{review_text}}`
- **Usage Tracking** - See how often templates are used
- **Default Templates** - Set per-category defaults

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_APP_URL` | Frontend URL | ✅ |
| `NEXT_PUBLIC_API_URL` | API URL | ✅ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key | ✅ |
| `CLERK_SECRET_KEY` | Clerk secret key | ✅ |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role | ✅ |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret | ✅ |
| `DATABASE_URL` | Postgres connection string | ✅ |
| `CF_ACCOUNT_ID` | Cloudflare account ID | ✅ |
| `CF_API_TOKEN` | Cloudflare API token | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | ✅ |
| `GOOGLE_OAUTH_REDIRECT_URI` | OAuth redirect URI | ✅ |
| `ENCRYPTION_KEY` | 32-char key for token encryption | ✅ |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | ✅ |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | ✅ |
| `TWILIO_MESSAGING_SERVICE_SID` | Twilio messaging service | ✅ |
| `TWILIO_WEBHOOK_SECRET` | Twilio webhook secret | ✅ |
| `RESEND_API_KEY` | Resend API key | ✅ |
| `RESEND_WEBHOOK_SECRET` | Resend webhook secret | ✅ |
| `RESEND_FROM_EMAIL` | From email address | ✅ |
| `STRIPE_SECRET_KEY` | Stripe secret key | Optional |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | Optional |
| `SENTRY_DSN` | Sentry DSN | Optional |
| `LOGTAIL_SOURCE_TOKEN` | Logtail source token | Optional |

## Deployment

### Prerequisites
- Vercel project connected to repo
- Cloudflare Workers paid plan (for custom domains)
- Supabase project
- Clerk application
- Google Cloud project with Business Profile API enabled
- Twilio account with Messaging Service
- Resend account with verified domain

### Secrets (GitHub Actions)
```
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
CF_API_TOKEN
CF_ACCOUNT_ID
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
# ... all env vars above
```
### Deploy

```bash
# Automatic on merge to main
git push origin main

# Or manual
./scripts/deploy.sh
```

## Deployment Options

### Option 1: Cloudflare Pages (Recommended)
Full Cloudflare stack - Frontend + API on same platform:
- **Frontend**: Cloudflare Pages (static export)
- **API**: Cloudflare Workers (Hono)
- **DNS/CDN**: Cloudflare
- **Benefits**: Single provider, unified analytics, free tier generous, edge caching

[See Cloudflare Pages Deployment Guide](./CLOUDFLARE_PAGES_DEPLOYMENT.md)

### Option 2: Vercel + Cloudflare Workers
Hybrid approach:
- **Frontend**: Vercel (SSR/ISR support)
- **API**: Cloudflare Workers (edge compute)
- **DNS/CDN**: Cloudflare (proxied)

Both options use the same GitHub Actions workflows.

## CI/CD Pipelines

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push/PR | Lint, typecheck, test, build |
| `preview.yml` | PR | Deploy preview (Vercel + CF Workers) |
| `deploy-frontend.yml` | Merge to main | Vercel production |
| `deploy-api.yml` | Merge to main | Cloudflare Workers production |
| `db-migrate.yml` | Migration file changed | Supabase migrations |
| `nightly.yml` | Daily 02:00 UTC | E2E, load test, dependency audit |

## Database Migrations

```bash
# Create new migration
pnpm --filter @saas/db db:migration:new <name>

# Apply locally
supabase db push

# Apply to production (via GitHub Actions)
# Push migration file to main → db-migrate.yml runs
```

## Testing

```bash
# Unit/Integration
pnpm test

# E2E (Playwright)
cd apps/web && npx playwright test

# Load (k6)
k6 run load-test.js
```

## Runbooks

See `/runbooks/` for operational procedures:
- `rollback-vercel.md`
- `rollback-cloudflare.md`
- `supabase-migration-failure.md`
- `incident-response.md`
- `google-api-quota-exhaustion.md`
- `twilio-resend-delivery-failures.md`

## License

MIT