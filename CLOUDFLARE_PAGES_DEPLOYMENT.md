# Cloudflare Pages Deployment Configuration

## Project Setup in Cloudflare Dashboard

1. Go to **Pages** → **Create a project** → **Connect to Git**
2. Select your GitHub repository
3. Configure build settings:
   - **Project name**: `reviewflow-frontend`
   - **Production branch**: `main`
   - **Build command**: `cd apps/web && pnpm build:cloudflare`
   - **Build output directory**: `apps/web/out`
   - **Root directory**: `/` (repository root)

## Environment Variables (Cloudflare Pages Dashboard)

Add these in **Settings** → **Environment variables**:

```
# Required
NEXT_PUBLIC_APP_URL=https://reviewflow.pages.dev
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Optional (for preview deployments)
NEXT_PUBLIC_DEPLOY_TARGET=cloudflare-pages
```

## Custom Domain

1. Go to **Custom domains** → **Add custom domain**
2. Enter your domain (e.g., `app.yourdomain.com`)
3. Cloudflare will automatically configure DNS if using Cloudflare nameservers
4. If using external DNS, add the CNAME record provided

## Preview Deployments

Each PR gets a unique preview URL:
- Format: `preview-{pr-number}.reviewflow-frontend.pages.dev`
- Automatically created via GitHub Actions on PR open/update
- Cleaned up when PR is merged/closed

## Build Configuration Notes

### Static Export Requirements
The Next.js app is configured for static export (`output: 'export'`) when `NEXT_PUBLIC_DEPLOY_TARGET=cloudflare-pages`:
- All pages are pre-rendered at build time
- No SSR/ISR - fully static
- Clerk authentication works via client-side only

### Clerk Compatibility
For static export with Clerk:
- Use `@clerk/nextjs` v5+ with client-side auth only
- `<SignIn />` and `<SignUp />` components work client-side
- Protected routes use `useAuth()` hook (client-side redirect)
- Middleware is disabled for static export

### API Routes
API routes are NOT included in static export:
- Frontend calls Cloudflare Workers API directly (`NEXT_PUBLIC_API_URL`)
- Webhook endpoints remain on Cloudflare Workers (not Next.js)

## Wrangler Alternative (If Not Using Pages UI)

```bash
# Install wrangler
npm i -g wrangler

# Login
wrangler login

# Deploy manually
cd apps/web
NEXT_PUBLIC_DEPLOY_TARGET=cloudflare-pages pnpm build
wrangler pages deploy out --project-name=reviewflow-frontend --branch=main
```

## GitHub Actions Integration

The workflow uses `cloudflare/pages-action@v1` which:
- Requires `CF_API_TOKEN` (Pages + Workers permissions)
- Requires `CF_ACCOUNT_ID`
- Automatically creates preview deployments for PRs
- Deploys to production on main branch merge

## Troubleshooting

### Build Fails with "Module not found"
- Ensure all dependencies are in `dependencies` (not `devDependencies`) in `package.json`
- Run `pnpm install` locally first

### Clerk Redirect Issues
- Static export doesn't support middleware
- Use client-side auth checks with `useAuth()`
- Redirects handled in React components

### Images Not Loading
- Set `images.unoptimized: true` in `next.config.js`
- Use external image URLs (Clerk, Supabase) directly

### Preview URL Not Working
- Check Cloudflare Pages project name matches workflow
- Ensure branch name format: `preview-{PR_NUMBER}`
- Verify Pages project has "Build preview deployments" enabled