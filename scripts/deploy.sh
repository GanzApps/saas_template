#!/usr/bin/env bash
# Production deployment script for FileVault (D1 + Cloudflare Workers + Cloudflare Pages)

set -e

DEPLOY_TARGET="${DEPLOY_TARGET:-cloudflare-pages}"  # cloudflare-pages | vercel

echo "🚀 Deploying to production (target: $DEPLOY_TARGET)..."

required_secrets=(
  "CF_API_TOKEN"
  "CF_ACCOUNT_ID"
)

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

echo "🔍 Running CI checks..."
pnpm lint && pnpm typecheck && pnpm test:ci

echo "🏗️ Building..."
pnpm build

echo "☁️ Deploying Cloudflare Workers (API)..."
cd apps/api
npx wrangler deploy --env production
cd ../..

if [ "$DEPLOY_TARGET" = "cloudflare-pages" ]; then
  echo "☁️ Deploying to Cloudflare Pages..."
  cd apps/web
  NEXT_PUBLIC_DEPLOY_TARGET=cloudflare-pages pnpm build
  npx wrangler pages deploy out --project-name=filevault-frontend --branch=main
  cd ../..
elif [ "$DEPLOY_TARGET" = "vercel" ]; then
  echo "▲ Deploying to Vercel..."
  cd apps/web
  npx vercel --prod --token=$VERCEL_TOKEN
  cd ../..
fi

echo "🗄️ Running D1 migrations..."
for file in packages/db-d1/migrations/*.sql; do
  echo "Applying $file..."
  wrangler d1 execute filevault-db --remote --file="$file"
done

echo "✅ Deployment complete!"
if [ "$DEPLOY_TARGET" = "cloudflare-pages" ]; then
  echo "   Frontend: https://filevault-frontend.pages.dev (or your custom domain)"
else
  echo "   Frontend: https://${VERCEL_PROJECT_ID}.vercel.app"
fi
echo "   API: https://filevault-api.${CF_ACCOUNT_ID}.workers.dev"
echo "   D1 Database: filevault-db"
echo "   R2 Bucket: filevault-files"
