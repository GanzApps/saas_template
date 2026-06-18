#!/usr/bin/env bash
# Production deployment script for ReviewFlow (D1 + Cloudflare Workers + Cloudflare Pages)
# Supports Cloudflare Pages for frontend, D1 for database

set -e

DEPLOY_TARGET="${DEPLOY_TARGET:-cloudflare-pages}"  # cloudflare-pages | vercel

echo "🚀 Deploying to production (target: $DEPLOY_TARGET)..."

# Common required secrets
required_secrets=(
  "CF_API_TOKEN"
  "CF_ACCOUNT_ID"
)

# Vercel-specific secrets
if [ "$DEPLOY_TARGET" = "vercel" ]; then
  required_secrets+=(
    "VERCEL_TOKEN"
    "VERCEL_ORG_ID"
    "VERCEL_PROJECT_ID"
  )
fi

for secret in "${required_secrets[@]}"; do
  if [ -z "${!secret}" ]; then
    echo "❌ Missing required secret: $secret"
    exit 1
  fi
done

# Run CI checks first
echo "🔍 Running CI checks..."
pnpm lint && pnpm typecheck && pnpm test:ci

# Build everything
echo "🏗️ Building..."
pnpm build

# Deploy API first (needed by frontend)
echo "☁️ Deploying Cloudflare Workers (API)..."
cd apps/api
npx wrangler deploy --env production
cd ../..

# Deploy frontend based on target
if [ "$DEPLOY_TARGET" = "cloudflare-pages" ]; then
  echo "☁️ Deploying to Cloudflare Pages..."
  cd apps/web
  NEXT_PUBLIC_DEPLOY_TARGET=cloudflare-pages pnpm build
  npx wrangler pages deploy out --project-name=reviewflow-frontend --branch=main
  cd ../..
elif [ "$DEPLOY_TARGET" = "vercel" ]; then
  echo "▲ Deploying to Vercel..."
  cd apps/web
  npx vercel --prod --token=$VERCEL_TOKEN
  cd ../..
fi

# Run D1 migrations
echo "🗄️ Running D1 migrations..."
for file in packages/db/d1/migrations/*.sql; do
  echo "Applying $file..."
  wrangler d1 execute reviewflow-db --remote --file="$file"
done

# Generate types (optional - currently manual)
echo "🔧 Type generation: types are maintained manually in packages/db-d1/src/types.ts"

echo "✅ Deployment complete!"
if [ "$DEPLOY_TARGET" = "cloudflare-pages" ]; then
  echo "   Frontend: https://reviewflow-frontend.pages.dev (or your custom domain)"
else
  echo "   Frontend: https://${VERCEL_PROJECT_ID}.vercel.app"
fi
echo "   API: https://reviewflow-api.${CF_ACCOUNT_ID}.workers.dev"
echo "   D1 Database: reviewflow-db"
echo "   R2 Bucket: reviewflow-assets"