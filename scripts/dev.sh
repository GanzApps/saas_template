#!/usr/bin/env bash
# Local development orchestrator
# Runs: Supabase local, Cloudflare Workers (wrangler), Next.js concurrently

set -e

echo "🚀 Starting local development environment..."

# Check for required tools
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm not found. Install with: npm i -g pnpm"; exit 1; }
command -v supabase >/dev/null 2>&1 || { echo "❌ supabase CLI not found. Install: https://supabase.com/docs/guides/cli"; exit 1; }
command -v wrangler >/dev/null 2>&1 || { echo "❌ wrangler not found. Install: npm i -g wrangler"; exit 1; }

# Start Supabase local
echo "📦 Starting Supabase local..."
supabase start

# Generate types
echo "🔧 Generating database types..."
supabase gen types typescript --local > packages/db/src/types.ts

# Function to cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  supabase stop
  exit 0
}
trap cleanup INT TERM

# Run all dev servers concurrently
echo "🔥 Starting dev servers..."
echo "   - Next.js: http://localhost:3000"
echo "   - Cloudflare Workers: http://localhost:8787"
echo "   - Supabase Studio: http://localhost:54323"
echo ""

# Use concurrently or run in background
pnpm --filter @saas/web dev &
WEB_PID=$!

pnpm --filter @saas/api dev &
API_PID=$!

# Wait for any process to exit
wait -n $WEB_PID $API_PID

# If we get here, one process died
cleanup