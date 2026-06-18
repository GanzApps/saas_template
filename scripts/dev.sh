#!/usr/bin/env bash
# Local development orchestrator for ReviewFlow (D1 + Cloudflare Workers + Next.js)
# Runs: D1 local, Cloudflare Workers (wrangler), Next.js concurrently

set -e

echo "🚀 Starting local development environment (D1)..."

# Check for required tools
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm not found. Install with: npm i -g pnpm"; exit 1; }
command -v wrangler >/dev/null 2>&1 || { echo "❌ wrangler not found. Install: npm i -g wrangler"; exit 1; }

# Initialize D1 local database if needed
if [ ! -f ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/reviewflow-db.sqlite" ]; then
  echo "📦 Initializing D1 local database..."
  wrangler d1 execute reviewflow-db --local --file=packages/db/d1/migrations/0001_initial_schema.sql
fi

# Function to cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  # Kill child processes
  jobs -p | xargs -r kill
  exit 0
}
trap cleanup INT TERM

# Run all dev servers concurrently
echo "🔥 Starting dev servers..."
echo "   - Next.js: http://localhost:3000"
echo "   - Cloudflare Workers: http://localhost:8787"
echo "   - D1 Local DB: .wrangler/state/v3/d1/miniflare-D1DatabaseObject/reviewflow-db.sqlite"
echo ""

pnpm --filter @saas/web dev &
WEB_PID=$!

pnpm --filter @saas/api dev &
API_PID=$!

# Wait for any process to exit
wait -n $WEB_PID $API_PID

# If we get here, one process died
cleanup