import { Hono } from 'hono'
import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { validateEnv, Env } from '@saas/config'
import {
  createOAuthClient,
  getAuthUrl,
  getTokensFromCode,
  listAccounts,
  listLocations,
  listReviews,
  getLocation,
  replyToReview,
  registerNotifications,
  encryptTokens,
  decryptTokens,
  isTokenExpired,
  getValidAccessToken,
  createMyBusinessClient,
  createMyBusinessInfoClient,
} from '@saas/google'
import { encrypt, decrypt } from '@saas/google'
import { sendEmail, sendSMS } from '@saas/communications'

type Bindings = Env

const app = new Hono<{ Bindings: Bindings }>()

// Clerk auth middleware
app.use('*', clerkMiddleware({
  jwksUrl: (c) => c.env.CLERK_JWKS_URL || `https://${new URL(c.env.NEXT_PUBLIC_APP_URL).hostname}/.well-known/jwks.json`,
}))

// Supabase client factory
function getSupabase(c: any) {
  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Get user's organization ID
async function getUserOrgId(c: any): Promise<string> {
  const auth = getAuth(c)
  if (!auth?.userId) throw new Error('Unauthorized')

  const supabase = getSupabase(c)
  const { data: user } = await supabase
    .from('users')
    .select('organization_id')
    .eq('clerk_id', auth.userId)
    .single()

  if (!user?.organization_id) throw new Error('No organization found')
  return user.organization_id
}

// ============================================
// GOOGLE OAUTH FLOW
// ============================================

// GET /api/auth/google - Redirect to Google OAuth
app.get('/api/auth/google', async (c) => {
  const orgId = await getUserOrgId(c)
  const oauthClient = createOAuthClient(c.env)

  // Generate state with org ID for security
  const state = Buffer.from(JSON.stringify({ orgId, nonce: crypto.randomUUID() })).toString('base64url')

  const authUrl = getAuthUrl(oauthClient, state)
  return c.redirect(authUrl)
})

// GET /api/auth/google/callback - Handle OAuth callback
app.get('/api/auth/google/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')

  if (error) {
    return c.redirect(`${c.env.NEXT_PUBLIC_APP_URL}/settings?google_error=${error}`)
  }

  if (!code || !state) {
    return c.json({ error: 'Missing code or state' }, 400)
  }

  try {
    const { orgId } = JSON.parse(Buffer.from(state, 'base64url').toString())
    const oauthClient = createOAuthClient(c.env)
    const tokens = await getTokensFromCode(oauthClient, code)

    // Fetch account info
    const accountInfo = await fetchGoogleAccountInfo(c.env.GOOGLE_CLIENT_ID, tokens.access_token)

    // Encrypt tokens for storage
    const encrypted = encryptTokens(tokens, c.env)

    const supabase = getSupabase(c)

    // Upsert Google account
    const { data: account, error } = await supabase
      .from('google_accounts')
      .upsert({
        organization_id: orgId,
        google_account_email: accountInfo.email,
        access_token_encrypted: encrypted.access_token_encrypted,
        refresh_token_encrypted: encrypted.refresh_token_encrypted,
        token_expires_at: encrypted.token_expires_at,
        account_name: accountInfo.name,
        account_type: 'BUSINESS',
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,google_account_email' })
      .select()
      .single()

    if (error) throw error

    // Sync locations for this account
    await syncLocationsForAccount(c.env, supabase, account.id, tokens.access_token)

    return c.redirect(`${c.env.NEXT_PUBLIC_APP_URL}/dashboard?connected=true`)
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return c.redirect(`${c.env.NEXT_PUBLIC_APP_URL}/settings?google_error=callback_failed`)
  }
})

// POST /api/auth/google/disconnect - Disconnect Google account
app.post('/api/auth/google/disconnect', async (c) => {
  const orgId = await getUserOrgId(c)
  const { accountId } = await c.req.json()

  const supabase = getSupabase(c)

  // Verify ownership
  const { data: account } = await supabase
    .from('google_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('organization_id', orgId)
    .single()

  if (!account) return c.json({ error: 'Account not found' }, 404)

  // Deactivate instead of delete (preserve review history)
  await supabase
    .from('google_accounts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', accountId)

  return c.json({ success: true })
})

// Import fetchGoogleAccountInfo from google package
async function fetchGoogleAccountInfo(clientId: string, accessToken: string) {
  const { google } = await import('googleapis')
  const oauth2 = google.oauth2({ version: 'v2', auth: accessToken })
  const { data } = await oauth2.userinfo.get()
  return { email: data.email!, name: data.name! }
}

// ============================================
// ACCOUNTS & LOCATIONS
// ============================================

// GET /api/accounts - List connected Google accounts
app.get('/api/accounts', async (c) => {
  const orgId = await getUserOrgId(c)
  const supabase = getSupabase(c)

  const { data, error } = await supabase
    .from('google_accounts')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// GET /api/accounts/:id/locations - List locations for an account
app.get('/api/accounts/:id/locations', async (c) => {
  const orgId = await getUserOrgId(c)
  const accountId = c.req.param('id')
  const supabase = getSupabase(c)

  // Verify account ownership
  const { data: account } = await supabase
    .from('google_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('organization_id', orgId)
    .single()

  if (!account) return c.json({ error: 'Account not found' }, 404)

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('google_account_id', accountId)
    .eq('is_active', true)
    .order('name')

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// POST /api/accounts/:id/sync - Manual sync locations & reviews
app.post('/api/accounts/:id/sync', async (c) => {
  const orgId = await getUserOrgId(c)
  const accountId = c.req.param('id')
  const supabase = getSupabase(c)

  // Verify account ownership
  const { data: account } = await supabase
    .from('google_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('organization_id', orgId)
    .single()

  if (!account) return c.json({ error: 'Account not found' }, 404)

  // Get valid access token
  const tokens = decryptTokens({
    access_token_encrypted: account.access_token_encrypted,
    refresh_token_encrypted: account.refresh_token_encrypted,
    token_expires_at: account.token_expires_at,
  }, c.env)

  let accessToken = tokens.access_token
  if (isTokenExpired(tokens.expiry_date)) {
    accessToken = await getValidAccessToken(
      createOAuthClient(c.env),
      account.refresh_token_encrypted,
      c.env
    )
    // Update stored tokens (in background, don't block)
    // TODO: Update tokens in DB
  }

  const myBusinessInfo = createMyBusinessInfoClient(createOAuthClient(c.env))
  myBusinessInfo.auth?.setCredentials({ access_token: accessToken })

  // Sync locations
  const locations = await listLocations(myBusinessInfo, `accounts/${account.google_account_email}`)
  let syncedLocations = 0

  for (const loc of locations) {
    const { error } = await supabase
      .from('locations')
      .upsert({
        google_account_id: accountId,
        organization_id: orgId,
        google_location_id: loc.name!,
        name: loc.title!,
        address: loc.location?.address?.addressLines?.[0] || '',
        phone: loc.phoneNumbers?.primaryPhone || null,
        website: loc.websiteUri || null,
        primary_category: loc.primaryCategory?.displayName || null,
        place_id: loc.metadata?.placeId || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'google_location_id' })
    if (!error) syncedLocations++
  }

  // Sync reviews for each location
  let syncedReviews = 0
  const { data: allLocations } = await supabase
    .from('locations')
    .select('id, google_location_id')
    .eq('google_account_id', accountId)

  for (const loc of allLocations || []) {
    const reviewsResult = await listReviews(myBusinessInfo, loc.google_location_id, 200)
    for (const review of reviewsResult.reviews) {
      const { error } = await supabase
        .from('reviews')
        .upsert({
          location_id: loc.id,
          organization_id: orgId,
          google_review_id: review.name!,
          google_reviewer_id: review.reviewer?.name,
          reviewer_name: review.reviewer?.displayName,
          reviewer_profile_photo: review.reviewer?.profilePhotoUrl,
          star_rating: googleStarRatingToNumber(review.starRating!),
          comment: review.comment,
          review_time: review.createTime!,
          reply_text: review.reviewReply?.comment || null,
          reply_time: review.reviewReply?.updateTime || null,
          has_reply: !!review.reviewReply?.comment,
          raw_json: review,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'google_review_id' })
      if (!error) syncedReviews++
    }
    // Update location sync time
    await supabase
      .from('locations')
      .update({ last_review_sync_at: new Date().toISOString() })
      .eq('id', loc.id)
  }

  // Update account last sync
  await supabase
    .from('google_accounts')
    .update({ last_sync_at: new Date().toISOString(), sync_error: null })
    .eq('id', accountId)

  return c.json({ synced: { locations: syncedLocations, reviews: syncedReviews } })
})

function googleStarRatingToNumber(rating: string): number {
  const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }
  return map[rating] || 0
}

function decryptTokens(
  stored: { access_token_encrypted: string; refresh_token_encrypted: string; token_expires_at: string },
  env: Pick<Env, 'ENCRYPTION_KEY'>
) {
  return {
    access_token: decrypt(stored.access_token_encrypted, env.ENCRYPTION_KEY),
    refresh_token: decrypt(stored.refresh_token_encrypted, env.ENCRYPTION_KEY),
    expiry_date: new Date(stored.token_expires_at).getTime(),
  }
}

// ============================================
// REVIEWS
// ============================================

// GET /api/reviews - List reviews with filters
app.get('/api/reviews', async (c) => {
  const orgId = await getUserOrgId(c)
  const supabase = getSupabase(c)

  const locationId = c.req.query('locationId')
  const status = c.req.query('status')
  const rating = c.req.query('rating')
  const page = parseInt(c.req.query('page') || '1')
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
  const from = (page - 1) * limit

  let query = supabase
    .from('reviews')
    .select('*, locations(name)', { count: 'exact' })
    .eq('organization_id', orgId)
    .order('review_time', { ascending: false })
    .range(from, from + limit - 1)

  if (locationId) query = query.eq('location_id', locationId)
  if (status) query = query.eq('status', status)
  if (rating) query = query.eq('star_rating', parseInt(rating))

  const { data, error, count } = await query

  if (error) return c.json({ error: error.message }, 500)

  return c.json({
    data,
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  })
})

// GET /api/reviews/:id - Get single review
app.get('/api/reviews/:id', async (c) => {
  const orgId = await getUserOrgId(c)
  const reviewId = c.req.param('id')
  const supabase = getSupabase(c)

  const { data, error } = await supabase
    .from('reviews')
    .select('*, locations(name)')
    .eq('id', reviewId)
    .eq('organization_id', orgId)
    .single()

  if (error || !data) return c.json({ error: 'Review not found' }, 404)
  return c.json(data)
})

// POST /api/reviews/:id/reply - Reply to a review
const replySchema = z.object({ text: z.string().min(1).max(4000) })

app.post('/api/reviews/:id/reply', zValidator('json', replySchema), async (c) => {
  const orgId = await getUserOrgId(c)
  const reviewId = c.req.param('id')
  const { text } = c.req.valid('json')
  const supabase = getSupabase(c)

  // Get review with location and account info
  const { data: review } = await supabase
    .from('reviews')
    .select('*, locations(google_location_id, google_accounts(google_account_email))')
    .eq('id', reviewId)
    .eq('organization_id', orgId)
    .single()

  if (!review) return c.json({ error: 'Review not found' }, 404)

  const googleAccount = review.locations.google_accounts
  const locationName = `${googleAccount.google_account_email}/locations/${review.locations.google_location_id}/reviews/${review.google_review_id}`

  // Get valid access token
  const tokens = decryptTokens({
    access_token_encrypted: googleAccount.access_token_encrypted,
    refresh_token_encrypted: googleAccount.refresh_token_encrypted,
    token_expires_at: googleAccount.token_expires_at,
  }, c.env)

  let accessToken = tokens.access_token
  if (isTokenExpired(tokens.expiry_date)) {
    accessToken = await getValidAccessToken(
      createOAuthClient(c.env),
      googleAccount.refresh_token_encrypted,
      c.env
    )
  }

  const myBusinessInfo = createMyBusinessInfoClient(createOAuthClient(c.env))
  myBusinessInfo.auth?.setCredentials({ access_token: accessToken })

  // Reply via Google API
  await replyToReview(myBusinessInfo, locationName, text)

  // Update local record
  const { data, error } = await supabase
    .from('reviews')
    .update({
      reply_text: text,
      reply_time: new Date().toISOString(),
      has_reply: true,
      is_replied_by_us: true,
      status: 'replied',
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)

  // Increment template usage if this was a template
  // TODO: Track template usage

  return c.json(data)
})

// PATCH /api/reviews/:id - Update review (status, assignment, notes)
const updateReviewSchema = z.object({
  status: z.enum(['new', 'replied', 'flagged', 'archived']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  internalNotes: z.string().optional(),
})

app.patch('/api/reviews/:id', zValidator('json', updateReviewSchema), async (c) => {
  const orgId = await getUserOrgId(c)
  const reviewId = c.req.param('id')
  const { status, assignedTo, internalNotes } = c.req.valid('json')
  const supabase = getSupabase(c)

  const updates: any = { updated_at: new Date().toISOString() }
  if (status) updates.status = status
  if (assignedTo !== undefined) updates.assigned_to = assignedTo
  if (internalNotes !== undefined) updates.internal_notes = internalNotes

  const { data, error } = await supabase
    .from('reviews')
    .update(updates)
    .eq('id', reviewId)
    .eq('organization_id', orgId)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// POST /api/reviews/bulk - Bulk actions
const bulkActionSchema = z.object({
  action: z.enum(['assign', 'status', 'archive']),
  ids: z.array(z.string().uuid()).min(1).max(100),
  data: z.object({
    assignedTo: z.string().uuid().nullable().optional(),
    status: z.enum(['new', 'replied', 'flagged', 'archived']).optional(),
  }).optional(),
})

app.post('/api/reviews/bulk', zValidator('json', bulkActionSchema), async (c) => {
  const orgId = await getUserOrgId(c)
  const { action, ids, data } = c.req.valid('json')
  const supabase = getSupabase(c)

  const updates: any = { updated_at: new Date().toISOString() }
  if (action === 'assign' && data?.assignedTo !== undefined) updates.assigned_to = data.assignedTo
  if (action === 'status' && data?.status) updates.status = data.status
  if (action === 'archive') updates.status = 'archived'

  const { data: updated, error } = await supabase
    .from('reviews')
    .update(updates)
    .in('id', ids)
    .eq('organization_id', orgId)
    .select('id')

  if (error) return c.json({ error: error.message }, 500)

  return c.json({ updated: updated?.length || 0 })
})

// ============================================
// CAMPAIGNS
// ============================================

// GET /api/campaigns - List campaigns
app.get('/api/campaigns', async (c) => {
  const orgId = await getUserOrgId(c)
  const supabase = getSupabase(c)

  const { data, error } = await supabase
    .from('campaigns')
    .select('*, locations(name)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// POST /api/campaigns - Create campaign
const createCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  locationId: z.string().uuid().optional(),
  type: z.enum(['sms', 'email', 'both']),
  templateSms: z.string().optional(),
  templateEmailSubject: z.string().optional(),
  templateEmailBody: z.string().optional(),
  triggerType: z.enum(['manual', 'webhook', 'api']).default('manual'),
})

app.post('/api/campaigns', zValidator('json', createCampaignSchema), async (c) => {
  const orgId = await getUserOrgId(c)
  const body = c.req.valid('json')
  const supabase = getSupabase(c)

  const { data, error } = await supabase
    .from('campaigns')
    .insert({ ...body, organization_id: orgId })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

// GET /api/campaigns/:id - Get campaign with recipients
app.get('/api/campaigns/:id', async (c) => {
  const orgId = await getUserOrgId(c)
  const campaignId = c.req.param('id')
  const supabase = getSupabase(c)

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('organization_id', orgId)
    .single()

  if (!campaign) return c.json({ error: 'Campaign not found' }, 404)

  const { data: recipients, error } = await supabase
    .from('campaign_recipients')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return c.json({ error: error.message }, 500)

  return c.json({ ...campaign, recipients: recipients || [] })
})

// POST /api/campaigns/:id/send - Send campaign
const sendCampaignSchema = z.object({
  recipients: z.array(z.object({
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    customerEmail: z.string().email().optional(),
  })).min(1).max(1000),
})

app.post('/api/campaigns/:id/send', zValidator('json', sendCampaignSchema), async (c) => {
  const orgId = await getUserOrgId(c)
  const campaignId = c.req.param('id')
  const { recipients: recipientList } = c.req.valid('json')
  const supabase = getSupabase(c)

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('organization_id', orgId)
    .single()

  if (!campaign) return c.json({ error: 'Campaign not found' }, 404)
  if (!campaign.is_active) return c.json({ error: 'Campaign is not active' }, 400)

  let queued = 0

  for (const recipient of recipientList) {
    // Insert recipient record
    const { data: newRecipient } = await supabase
      .from('campaign_recipients')
      .insert({
        campaign_id: campaignId,
        organization_id: orgId,
        customer_name: recipient.customerName,
        customer_phone: recipient.customerPhone,
        customer_email: recipient.customerEmail,
        status: 'pending',
      })
      .select()
      .single()

    if (!newRecipient) continue

    // Send SMS
    if ((campaign.type === 'sms' || campaign.type === 'both') && recipient.customerPhone) {
      try {
        await sendSMS(c.env, {
          to: recipient.customerPhone,
          body: campaign.template_sms || '',
          statusCallback: `${c.env.NEXT_PUBLIC_API_URL}/api/webhook/twilio`,
        })
        await supabase
          .from('campaign_recipients')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', newRecipient.id)
        queued++
      } catch (err) {
        await supabase
          .from('campaign_recipients')
          .update({ status: 'failed', error_message: (err as Error).message })
          .eq('id', newRecipient.id)
      }
    }

    // Send Email
    if ((campaign.type === 'email' || campaign.type === 'both') && recipient.customerEmail) {
      try {
        await sendEmail(c.env, {
          to: recipient.customerEmail,
          subject: campaign.template_email_subject || 'We\'d love your feedback!',
          html: campaign.template_email_body || '',
        })
        await supabase
          .from('campaign_recipients')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', newRecipient.id)
        queued++
      } catch (err) {
        await supabase
          .from('campaign_recipients')
          .update({ status: 'failed', error_message: (err as Error).message })
          .eq('id', newRecipient.id)
      }
    }
  }

  return c.json({ queued })
})

// ============================================
// TEMPLATES
// ============================================

app.get('/api/templates', async (c) => {
  const orgId = await getUserOrgId(c)
  const supabase = getSupabase(c)

  const { data, error } = await supabase
    .from('response_templates')
    .select('*')
    .eq('organization_id', orgId)
    .order('category', { ascending: true })

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(4000),
  category: z.enum(['positive', 'negative', 'neutral', 'custom']).optional(),
})

app.post('/api/templates', zValidator('json', createTemplateSchema), async (c) => {
  const orgId = await getUserOrgId(c)
  const body = c.req.valid('json')
  const supabase = getSupabase(c)

  // If this is default, unset other defaults in same category
  if (body.category) {
    await supabase
      .from('response_templates')
      .update({ is_default: false })
      .eq('organization_id', orgId)
      .eq('category', body.category)
  }

  const { data, error } = await supabase
    .from('response_templates')
    .insert({ ...body, organization_id: orgId })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

// ============================================
// ANALYTICS
// ============================================

app.get('/api/analytics/overview', async (c) => {
  const orgId = await getUserOrgId(c)
  const locationId = c.req.query('locationId')
  const days = parseInt(c.req.query('days') || '30')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const supabase = getSupabase(c)

  let query = supabase
    .from('reviews')
    .select('star_rating, has_reply, review_time')
    .eq('organization_id', orgId)
    .gte('review_time', since)

  if (locationId) query = query.eq('location_id', locationId)

  const { data: reviews } = await query

  const totalReviews = reviews?.length || 0
  const averageRating = reviews?.reduce((sum, r) => sum + r.star_rating, 0) / totalReviews || 0
  const replyRate = reviews?.filter(r => r.has_reply).length / totalReviews || 0
  const ratingDistribution = [1, 2, 3, 4, 5].map(star => ({
    star,
    count: reviews?.filter(r => r.star_rating === star).length || 0,
  }))

  return c.json({
    totalReviews,
    averageRating: Number(averageRating.toFixed(2)),
    replyRate: Number((replyRate * 100).toFixed(1)),
    ratingDistribution,
    periodDays: days,
  })
})

// ============================================
// WEBHOOKS
// ============================================

// Google Pub/Sub webhook
app.post('/api/webhook/google', async (c) => {
  const body = await c.req.json()

  // Log webhook
  const supabase = getSupabase(c)
  await supabase
    .from('webhook_logs')
    .insert({ source: 'google', event_type: 'notification', payload: body, status: 'received' })

  // Verify OIDC token from Google (simplified - implement full verification in production)
  // TODO: Verify Google Pub/Sub OIDC token

  const message = body.message
  if (!message) return c.json({ received: true })

  try {
    const { decodePubSubMessage, parseReviewNotification, getLocationIdFromReviewName, googleStarRatingToNumber } =
      await import('@saas/google')

    const notification = parseReviewNotification(message)
    if (!notification) return c.json({ received: true })

    const locationGoogleId = getLocationIdFromReviewName(notification.review.name)
    if (!locationGoogleId) return c.json({ received: true })

    // Find location in our DB
    const { data: location } = await supabase
      .from('locations')
      .select('id, organization_id, google_account_id')
      .eq('google_location_id', locationGoogleId)
      .single()

    if (!location) return c.json({ received: true })

    const starRating = googleStarRatingToNumber(notification.review.starRating)

    if (notification.notificationType === 'REVIEW_DELETED') {
      await supabase
        .from('reviews')
        .update({ status: 'archived' })
        .eq('google_review_id', notification.review.name)
      return c.json({ received: true })
    }

    // Upsert review
    await supabase
      .from('reviews')
      .upsert({
        location_id: location.id,
        organization_id: location.organization_id,
        google_review_id: notification.review.name,
        google_reviewer_id: notification.review.reviewer?.name,
        reviewer_name: notification.review.reviewer?.displayName,
        reviewer_profile_photo: notification.review.reviewer?.profilePhotoUrl,
        star_rating: starRating,
        comment: notification.review.comment,
        review_time: notification.review.createTime,
        reply_text: notification.review.reviewReply?.comment || null,
        reply_time: notification.review.reviewReply?.updateTime || null,
        has_reply: !!notification.review.reviewReply?.comment,
        is_replied_by_us: !!notification.review.reviewReply?.comment,
        raw_json: notification.review,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'google_review_id' })

    // Update webhook log
    await supabase
      .from('webhook_logs')
      .update({ status: 'processed' })
      .eq('source', 'google')
      .eq('payload->message->messageId', message.messageId)

  } catch (err) {
    console.error('Google webhook error:', err)
    await supabase
      .from('webhook_logs')
      .update({ status: 'failed', error_message: (err as Error).message })
      .eq('source', 'google')
      .eq('payload->message->messageId', message.messageId)
  }

  return c.json({ received: true })
})

// Twilio status callback
app.post('/api/webhook/twilio', async (c) => {
  const formData = await c.req.formData()
  const params = Object.fromEntries(formData)

  if (!verifyTwilioSignature(c.env, c.req.url, params, c.req.header('X-Twilio-Signature') || '')) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  const supabase = getSupabase(c)
  await supabase
    .from('webhook_logs')
    .insert({ source: 'twilio', event_type: params.MessageStatus, payload: params, status: 'received' })

  const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = params as any

  await supabase
    .from('campaign_recipients')
    .update({
      status: MessageStatus === 'delivered' ? 'delivered' :
              MessageStatus === 'failed' || MessageStatus === 'undelivered' ? 'failed' : 'sent',
      delivered_at: MessageStatus === 'delivered' ? new Date().toISOString() : null,
      error_message: ErrorMessage || null,
    })
    .eq('external_id', MessageSid)

  await supabase
    .from('webhook_logs')
    .update({ status: 'processed' })
    .eq('source', 'twilio')
    .eq('payload->MessageSid', MessageSid)

  return c.json({ received: true })
})

// Resend webhook
app.post('/api/webhook/resend', async (c) => {
  const body = await c.req.json()
  const signature = c.req.header('Resend-Signature') || ''

  if (!verifyResendSignature(c.env, signature)) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  const supabase = getSupabase(c)
  await supabase
    .from('webhook_logs')
    .insert({ source: 'resend', event_type: body.type, payload: body, status: 'received' })

  // Update recipient status based on event
  const emailId = body.data?.email_id
  if (emailId) {
    const statusMap: Record<string, string> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.bounced': 'failed',
      'email.clicked': 'clicked',
    }
    await supabase
      .from('campaign_recipients')
      .update({ status: statusMap[body.type] || 'sent' })
      .eq('external_id', emailId)
  }

  await supabase
    .from('webhook_logs')
    .update({ status: 'processed' })
    .eq('source', 'resend')
    .eq('payload->data->email_id', emailId)

  return c.json({ received: true })
})

// Import verification functions
function verifyTwilioSignature(
  env: Pick<Env, 'TWILIO_WEBHOOK_SECRET'>,
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  if (!env.TWILIO_WEBHOOK_SECRET) return false
  const twilio = await import('twilio')
  return twilio.default.validateRequest(env.TWILIO_WEBHOOK_SECRET, signature, url, params)
}

function verifyResendSignature(
  env: Pick<Env, 'RESEND_WEBHOOK_SECRET'>,
  signature: string
): boolean {
  if (!env.RESEND_WEBHOOK_SECRET) return false
  return signature === env.RESEND_WEBHOOK_SECRET
}

// ============================================
// HEALTH
// ============================================

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

export default app