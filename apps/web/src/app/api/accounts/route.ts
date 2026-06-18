import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@saas/db'
import { validateEnv } from '@saas/config'

const env = validateEnv(process.env)

export async function GET() {
  // This endpoint is called from client-side to check if user has connected accounts
  // The user is authenticated via Clerk middleware, so we get org from session
  // For now, return empty array - in production, get orgId from auth session
  return NextResponse.json([])
}