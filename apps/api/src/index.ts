import { Hono } from 'hono'
import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { validateEnv, Env } from '@saas/config'
import { D1Client, createD1Client } from '@saas/db-d1'
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
  decodePubSubMessage,
  parseReviewNotification,
  getLocationIdFromReviewName,
  googleStarRatingToNumber,
} from '@saas/google'
import { sendEmail, sendSMS } from '@saas/communications'
import { encrypt, decrypt } from '@saas/google'

type Bindings = Env & {
  DB: D1Database
  REVIEWFLOW_BUCKET: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

// Clerk auth middleware
app.use('*', clerkMiddleware({
  jwksUrl: (c) => c.env.CLERK_JWKS_URL || `https://${new URL(c.env.NEXT_PUBLIC_APP_URL).hostname}/.well-known/jwks.json`,
}))

// D1 Client factory
function getDB(c: any): D1Client {
  return createD1Client(c.env.DB)
}

// Get user's organization ID from Clerk JWT + D1
async function getUserOrgId(c: any): Promise<string> {
  const auth = getAuth(c)
  if (!auth?.userId) throw new Error('Unauthorized')

  const db = getDB(c)
  const user = await db.getUserByClerkId(auth.userId)
  
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

    const accountInfo = await fetchGoogleAccountInfo(c.env.GOOGLE_CLIENT_ID, tokens.access_token)
    const encrypted = encryptTokens(tokens, c.env)

    const db = getDB(c)

    // Upsert Google account
    const account = await db.insert('google_accounts', {
      id: D1Client.uuid(),
      organization_id: orgId,
      google_account_email: accountInfo.email,
      access_token_encrypted: encrypted.access_token_encrypted,
      refresh_token_encrypted: encrypted.refresh_token_encrypted,
      token_expires_at: encrypted.token_expires_at,
      account_name: accountInfo.name,
      account_type: 'BUSINESS',
      is_active: 1,
      created_at: D1Client.now(),
      updated_at: D1Client.now(),
    })

    // Sync locations for this account
    await syncLocationsForAccount(c.env, db, account.id, tokens.access_token)

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

  const db = getDB(c)

  // Verify ownership
  const account = await db.findFirst('google_accounts', 'id = ? AND organization_id = ?', [accountId, orgId])
  if (!account) return c.json({ error: 'Account not found' }, 404)

  // Deactivate instead of delete
  await db.update('google_accounts', accountId, {
    is_active: 0,
    updated_at: D1Client.now(),
  })

  return c.json({ success: true })
})

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
  const db = getDB(c)

  const accounts = await db.findMany('google_accounts', {
    where: 'organization_id = ? AND is_active = 1',
    bindings: [orgId],
    orderBy: 'created_at DESC',
  })

  return c.json(accounts)
})

// GET /api/accounts/:id/locations - List locations for an account
app.get('/api/accounts/:id/locations', async (c) => {
  const orgId = await getUserOrgId(c)
  const accountId = c.req.param('id')
  const db = getDB(c)

  // Verify account ownership
  const account = await db.findFirst('google_accounts', 'id = ? AND organization_id = ?', [accountId, orgId])
  if (!account) return c.json({ error: 'Account not found' }, 404)

  const locations = await db.findMany('locations', {
    where: 'google_account_id = ? AND is_active = 1',
    bindings: [accountId],
    orderBy: 'name ASC',
  })

  return c.json(locations)
})

// POST /api/accounts/:id/sync - Manual sync locations & reviews
app.post('/api/accounts/:id/sync', async (c) => {
  const orgId = await getUserOrgId(c)
  const accountId = c.req.param('id')
  const db = getDB(c)

  // Verify account ownership
  const account = await db.findFirst('google_accounts', 'id = ? AND organization_id = ?', [accountId, orgId])
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
  }

  const myBusinessInfo = createMyBusinessInfoClient(createOAuthClient(c.env))
  myBusinessInfo.auth?.setCredentials({ access_token: accessToken })

  // Sync locations
  const locations = await listLocations(myBusinessInfo, `accounts/${account.google_account_email}`)
  let syncedLocations = 0

  for (const loc of locations) {
    const existing = await db.findFirst('locations', 'google_location_id = ?', [loc.name!])
    if (existing) {
      await db.update('locations', existing.id, {
        name: loc.title!,
        address: loc.location?.address?.addressLines?.[0] || '',
        phone: loc.phoneNumbers?.primaryPhone || null,
        website: loc.websiteUri || null,
        primary_category: loc.primaryCategory?.displayName || null,
        place_id: loc.metadata?.placeId || null,
        is_active: 1,
        updated_at: D1Client.now(),
      })
    } else {
      await db.insert('locations', {
        id: D1Client.uuid(),
        google_account_id: accountId,
        organization_id: orgId,
        google_location_id: loc.name!,
        name: loc.title!,
        address: loc.location?.address?.addressLines?.[0] || '',
        phone: loc.phoneNumbers?.primaryPhone || null,
        website: loc.websiteUri || null,
        primary_category: loc.primaryCategory?.displayName || null,
        place_id: loc.metadata?.placeId || null,
        is_active: 1,
        created_at: D1Client.now(),
        updated_at: D1Client.now(),
      })
    }
    syncedLocations++
  }

  // Sync reviews for each location
  let syncedReviews = 0
  const allLocations = await db.findMany('locations', {
    where: 'google_account_id = ?',
    bindings: [accountId],
  })

  for (const loc of allLocations) {
    const reviewsResult = await listReviews(myBusinessInfo, loc.google_location_id, 200)
    for (const review of reviewsResult.reviews) {
      const existingReview = await db.findFirst('reviews', 'google_review_id = ?', [review.name!])
      if (existingReview) {
        await db.update('reviews', existingReview.id, {
          star_rating: googleStarRatingToNumber(review.starRating!),
          comment: review.comment,
          reply_text: review.reviewReply?.comment || null,
          reply_time: review.reviewReply?.updateTime || null,
          has_reply: !!review.reviewReply?.comment ? 1 : 0,
          is_replied_by_us: !!review.reviewReply?.comment ? 1 : 0,
          raw_json: D1Client.json(review),
          updated_at: D1Client.now(),
        })
      } else {
        await db.insert('reviews', {
          id: D1Client.uuid(),
          location_id: loc.id,
          organization_id: orgId,
          google_review_id: review.name!,
          google_reviewer_id: review.reviewer?.name || null,
          reviewer_name: review.reviewer?.displayName || null,
          reviewer_profile_photo: review.reviewer?.profilePhotoUrl || null,
          star_rating: googleStarRatingToNumber(review.starRating!),
          comment: review.comment || null,
          review_time: review.createTime!,
          reply_text: review.reviewReply?.comment || null,
          reply_time: review.reviewReply?.updateTime || null,
          has_reply: !!review.reviewReply?.comment ? 1 : 0,
          is_replied_by_us: !!review.reviewReply?.comment ? 1 : 0,
          raw_json: D1Client.json(review),
          created_at: D1Client.now(),
          updated_at: D1Client.now(),
        })
      }
      syncedReviews++
    }
    await db.update('locations', loc.id, {
      last_review_sync_at: D1Client.now(),
      updated_at: D1Client.now(),
    })
  }

  await db.update('google_accounts', accountId, {
    last_sync_at: D1Client.now(),
    sync_error: null,
    updated_at: D1Client.now(),
  })

  return c.json({ synced: { locations: syncedLocations, reviews: syncedReviews } })
})

// ============================================
// REVIEWS
// ============================================

// GET /api/reviews - List reviews with filters
app.get('/api/reviews', async (c) => {
  const orgId = await getUserOrgId(c)
  const db = getDB(c)

  const locationId = c.req.query('locationId')
  const status = c.req.query('status')
  const rating = c.req.query('rating')
  const page = parseInt(c.req.query('page') || '1')
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
  const offset = (page - 1) * limit

  const reviews = await db.getReviewsByOrganization(orgId, {
    location_id: locationId || undefined,
    status: status as any,
    star_rating: rating ? parseInt(rating) : undefined,
    limit,
    offset,
  })

  // Get total count for pagination
  const totalResult = await db.queryFirst<{ count: number }>(
    `SELECT COUNT(*) as count FROM reviews WHERE organization_id = ?`,
    [orgId]
  )
  const total = totalResult?.count || 0

  return c.json({
    data: reviews,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

// GET /api/reviews/:id - Get single review
app.get('/api/reviews/:id', async (c) => {
  const orgId = await getUserOrgId(c)
  const reviewId = c.req.param('id')
  const db = getDB(c)

  const review = await db.findFirst('reviews', 'id = ? AND organization_id = ?', [reviewId, orgId])
  if (!review) return c.json({ error: 'Review not found' }, 404)

  return c.json(review)
})

// POST /api/reviews/:id/reply - Reply to a review
const replySchema = z.object({ text: z.string().min(1).max(4000) })

app.post('/api/reviews/:id/reply', zValidator('json', replySchema), async (c) => {
  const orgId = await getUserOrgId(c)
  const reviewId = c.req.param('id')
  const { text } = c.req.valid('json')
  const db = getDB(c)

  // Get review with location and account info
  const review = await db.queryFirst<any>(
    `SELECT r.*, l.google_location_id, ga.google_account_email, ga.access_token_encrypted, ga.refresh_token_encrypted, ga.token_expires_at
     FROM reviews r
     JOIN locations l ON r.location_id = l.id
     JOIN google_accounts ga ON l.google_account_id = ga.id
     WHERE r.id = ? AND r.organization_id = ?`,
    [reviewId, orgId]
  )

  if (!review) return c.json({ error: 'Review not found' }, 404)

  const locationName = `${review.google_account_email}/locations/${review.google_location_id}/reviews/${review.google_review_id}`

  // Get valid access token
  const tokens = decryptTokens({
    access_token_encrypted: review.access_token_encrypted,
    refresh_token_encrypted: review.refresh_token_encrypted,
    token_expires_at: review.token_expires_at,
  }, c.env)

  let accessToken = tokens.access_token
  if (isTokenExpired(tokens.expiry_date)) {
    accessToken = await getValidAccessToken(
      createOAuthClient(c.env),
      review.refresh_token_encrypted,
      c.env
    )
  }

  const myBusinessInfo = createMyBusinessInfoClient(createOAuthClient(c.env))
  myBusinessInfo.auth?.setCredentials({ access_token: accessToken })

  // Reply via Google API
  await replyToReview(myBusinessInfo, locationName, text)

  // Update local record
  const data = await db.update('reviews', reviewId, {
    reply_text: text,
    reply_time: D1Client.now(),
    has_reply: 1,
    is_replied_by_us: 1,
    status: 'replied',
    updated_at: D1Client.now(),
  })

  if (!data) return c.json({ error: 'Failed to update review' }, 500)

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
  const db = getDB(c)

  // Verify ownership
  const review = await db.findFirst('reviews', 'id = ? AND organization_id = ?', [reviewId, orgId])
  if (!review) return c.json({ error: 'Review not found' }, 404)

  const updates: any = { updated_at: D1Client.now() }
  if (status) updates.status = status
  if (assignedTo !== undefined) updates.assigned_to = assignedTo
  if (internalNotes !== undefined) updates.internal_notes = internalNotes

  const data = await db.update('reviews', reviewId, updates)
  if (!data) return c.json({ error: 'Failed to update review' }, 500)

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
  const { action, ids, data: actionData } = c.req.valid('json')
  const db = getDB(c)

  const updates: any = { updated_at: D1Client.now() }
  if (action === 'assign' && actionData?.assignedTo !== undefined) updates.assigned_to = actionData.assignedTo
  if (action === 'status' && actionData?.status) updates.status = actionData.status
  if (action === 'archive') updates.status = 'archived'

  const placeholders = ids.map(() => '?').join(',')
  const sql = `UPDATE reviews SET ${Object.entries(updates).map(([k]) => `${k} = ?`).join(', ')} WHERE id IN (${placeholders}) AND organization_id = ?`
  const bindings = [...Object.values(updates), ...ids, orgId]

  const result = await db.run(sql, bindings)

  return c.json({ updated: result.changes || 0 })
})

// ============================================
// CAMPAIGNS
// ============================================

// GET /api/campaigns - List campaigns
app.get('/api/campaigns', async (c) => {
  const orgId = await getUserOrgId(c)
  const db = getDB(c)

  const campaigns = await db.getCampaignsByOrganization(orgId)

  return c.json(campaigns)
})

// POST /api/campaigns - Create campaign
const createCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  locationId: z.string().uuid().optional(),
  type: z.enum(['sms', 'email', 'qr', 'link']),
  templateSms: z.string().optional(),
  templateEmailSubject: z.string().optional(),
  templateEmailBody: z.string().optional(),
  triggerType: z.enum(['manual', 'automatic', 'scheduled']).default('manual'),
})

app.post('/api/campaigns', zValidator('json', createCampaignSchema), async (c) => {
  const orgId = await getUserOrgId(c)
  const body = c.req.valid('json')
  const db = getDB(c)

  const campaign = await db.insert('campaigns', {
    id: D1Client.uuid(),
    organization_id: orgId,
    location_id: body.locationId || null,
    name: body.name,
    type: body.type,
    template_sms: body.templateSms || null,
    template_email_subject: body.templateEmailSubject || null,
    template_email_body: body.templateEmailBody || null,
    trigger_type: body.triggerType,
    is_active: 1,
    settings: '{}',
    created_at: D1Client.now(),
    updated_at: D1Client.now(),
  })

  return c.json(campaign, 201)
})

// GET /api/campaigns/:id - Get campaign with recipients
app.get('/api/campaigns/:id', async (c) => {
  const orgId = await getUserOrgId(c)
  const campaignId = c.req.param('id')
  const db = getDB(c)

  const campaign = await db.findFirst('campaigns', 'id = ? AND organization_id = ?', [campaignId, orgId])
  if (!campaign) return c.json({ error: 'Campaign not found' }, 404)

  const recipients = await db.findMany('campaign_recipients', {
    where: 'campaign_id = ?',
    bindings: [campaignId],
    orderBy: 'created_at DESC',
    limit: 500,
  })

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
  const db = getDB(c)

  const campaign = await db.findFirst('campaigns', 'id = ? AND organization_id = ?', [campaignId, orgId])
  if (!campaign) return c.json({ error: 'Campaign not found' }, 404)
  if (!campaign.is_active) return c.json({ error: 'Campaign is not active' }, 400)

  let queued = 0

  for (const recipient of recipientList) {
    const newRecipient = await db.insert('campaign_recipients', {
      id: D1Client.uuid(),
      campaign_id: campaignId,
      organization_id: orgId,
      customer_name: recipient.customerName || null,
      customer_phone: recipient.customerPhone || null,
      customer_email: recipient.customerEmail || null,
      status: 'pending',
      created_at: D1Client.now(),
      updated_at: D1Client.now(),
    })

    // Send SMS
    if ((campaign.type === 'sms' || campaign.type === 'both') && recipient.customerPhone) {
      try {
        await sendSMS(c.env, {
          to: recipient.customerPhone,
          body: campaign.template_sms || '',
          statusCallback: `${c.env.NEXT_PUBLIC_API_URL}/api/webhook/twilio`,
        })
        await db.update('campaign_recipients', newRecipient.id, {
          status: 'sent',
          sent_at: D1Client.now(),
          updated_at: D1Client.now(),
        })
        queued++
      } catch (err) {
        await db.update('campaign_recipients', newRecipient.id, {
          status: 'failed',
          error_message: (err as Error).message,
          updated_at: D1Client.now(),
        })
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
        await db.update('campaign_recipients', newRecipient.id, {
          status: 'sent',
          sent_at: D1Client.now(),
          updated_at: D1Client.now(),
        })
        queued++
      } catch (err) {
        await db.update('campaign_recipients', newRecipient.id, {
          status: 'failed',
          error_message: (err as Error).message,
          updated_at: D1Client.now(),
        })
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
  const db = getDB(c)

  const templates = await db.getTemplatesByOrganization(orgId)
  return c.json(templates)
})

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(4000),
  category: z.enum(['positive', 'negative', 'neutral', 'custom']).optional(),
})

app.post('/api/templates', zValidator('json', createTemplateSchema), async (c) => {
  const orgId = await getUserOrgId(c)
  const body = c.req.valid('json')
  const db = getDB(c)

  // If this is default, unset other defaults in same category
  if (body.category) {
    await db.run(
      `UPDATE response_templates SET is_default = 0, updated_at = ? WHERE organization_id = ? AND category = ?`,
      [D1Client.now(), orgId, body.category]
    )
  }

  const template = await db.insert('response_templates', {
    id: D1Client.uuid(),
    organization_id: orgId,
    name: body.name,
    content: body.content,
    category: body.category || null,
    is_default: body.category ? 1 : 0,
    usage_count: 0,
    created_at: D1Client.now(),
    updated_at: D1Client.now(),
  })

  return c.json(template, 201)
})

// ============================================
// ANALYTICS
// ============================================

app.get('/api/analytics/overview', async (c) => {
  const orgId = await getUserOrgId(c)
  const locationId = c.req.query('locationId')
  const days = parseInt(c.req.query('days') || '30')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const db = getDB(c)

  const reviews = await db.getReviewsByOrganization(orgId, {
    location_id: locationId || undefined,
    date_from: since,
    limit: 10000,
  })

  const totalReviews = reviews.length
  const averageRating = reviews.reduce((sum, r) => sum + r.star_rating, 0) / totalReviews || 0
  const replyRate = reviews.filter(r => r.has_reply).length / totalReviews || 0
  const ratingDistribution = [1, 2, 3, 4, 5].map(star => ({
    star,
    count: reviews.filter(r => r.star_rating === star).length,
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
  const db = getDB(c)

  // Log webhook
  await db.insert('webhook_logs', {
    id: D1Client.uuid(),
    organization_id: null,
    source: 'google',
    event_type: 'notification',
    payload: D1Client.json(body),
    status: 'received',
    created_at: D1Client.now(),
  })

  const message = body.message
  if (!message) return c.json({ received: true })

  try {
    const notification = parseReviewNotification(message)
    if (!notification) return c.json({ received: true })

    const locationGoogleId = getLocationIdFromReviewName(notification.review.name)
    if (!locationGoogleId) return c.json({ received: true })

    // Find location in our DB
    const location = await db.findFirst('locations', 'google_location_id = ?', [locationGoogleId])
    if (!location) return c.json({ received: true })

    const starRating = googleStarRatingToNumber(notification.review.starRating)

    if (notification.notificationType === 'REVIEW_DELETED') {
      await db.run(
        `UPDATE reviews SET status = 'archived', updated_at = ? WHERE google_review_id = ?`,
        [D1Client.now(), notification.review.name]
      )
      return c.json({ received: true })
    }

    // Upsert review
    const existing = await db.findFirst('reviews', 'google_review_id = ?', [notification.review.name])
    if (existing) {
      await db.update('reviews', existing.id, {
        google_reviewer_id: notification.review.reviewer?.name || null,
        reviewer_name: notification.review.reviewer?.displayName || null,
        reviewer_profile_photo: notification.review.reviewer?.profilePhotoUrl || null,
        star_rating: starRating,
        comment: notification.review.comment || null,
        reply_text: notification.review.reviewReply?.comment || null,
        reply_time: notification.review.reviewReply?.updateTime || null,
        has_reply: !!notification.review.reviewReply?.comment ? 1 : 0,
        is_replied_by_us: !!notification.review.reviewReply?.comment ? 1 : 0,
        raw_json: D1Client.json(notification.review),
        updated_at: D1Client.now(),
      })
    } else {
      await db.insert('reviews', {
        id: D1Client.uuid(),
        location_id: location.id,
        organization_id: location.organization_id,
        google_review_id: notification.review.name,
        google_reviewer_id: notification.review.reviewer?.name || null,
        reviewer_name: notification.review.reviewer?.displayName || null,
        reviewer_profile_photo: notification.review.reviewer?.profilePhotoUrl || null,
        star_rating: starRating,
        comment: notification.review.comment || null,
        review_time: notification.review.createTime,
        reply_text: notification.review.reviewReply?.comment || null,
        reply_time: notification.review.reviewReply?.updateTime || null,
        has_reply: !!notification.review.reviewReply?.comment ? 1 : 0,
        is_replied_by_us: !!notification.review.reviewReply?.comment ? 1 : 0,
        raw_json: D1Client.json(notification.review),
        created_at: D1Client.now(),
        updated_at: D1Client.now(),
      })
    }

    await db.run(
      `UPDATE webhook_logs SET status = 'processed' WHERE source = 'google' AND json_extract(payload, '$.message.messageId') = ?`,
      [message.messageId]
    )

  } catch (err) {
    console.error('Google webhook error:', err)
    await db.run(
      `UPDATE webhook_logs SET status = 'failed', error_message = ? WHERE source = 'google' AND json_extract(payload, '$.message.messageId') = ?`,
      [(err as Error).message, message.messageId]
    )
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

  const db = getDB(c)
  await db.insert('webhook_logs', {
    id: D1Client.uuid(),
    organization_id: null,
    source: 'twilio',
    event_type: params.MessageStatus as string,
    payload: D1Client.json(params),
    status: 'received',
    created_at: D1Client.now(),
  })

  const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = params as any

  await db.run(
    `UPDATE campaign_recipients SET 
      status = ?, 
      delivered_at = ?, 
      error_message = ?, 
      updated_at = ? 
     WHERE external_id = ?`,
    [
      MessageStatus === 'delivered' ? 'delivered' :
      MessageStatus === 'failed' || MessageStatus === 'undelivered' ? 'failed' : 'sent',
      MessageStatus === 'delivered' ? D1Client.now() : null,
      ErrorMessage || null,
      D1Client.now(),
      MessageSid,
    ]
  )

  await db.run(
    `UPDATE webhook_logs SET status = 'processed' WHERE source = 'twilio' AND json_extract(payload, '$.MessageSid') = ?`,
    [MessageSid]
  )

  return c.json({ received: true })
})

// Resend webhook
app.post('/api/webhook/resend', async (c) => {
  const body = await c.req.json()
  const signature = c.req.header('Resend-Signature') || ''

  if (!verifyResendSignature(c.env, signature)) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  const db = getDB(c)
  await db.insert('webhook_logs', {
    id: D1Client.uuid(),
    organization_id: null,
    source: 'resend',
    event_type: body.type,
    payload: D1Client.json(body),
    status: 'received',
    created_at: D1Client.now(),
  })

  const emailId = body.data?.email_id
  if (emailId) {
    const statusMap: Record<string, string> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.bounced': 'failed',
      'email.clicked': 'clicked',
    }
    await db.run(
      `UPDATE campaign_recipients SET status = ?, updated_at = ? WHERE external_id = ?`,
      [statusMap[body.type] || 'sent', D1Client.now(), emailId]
    )
  }

  await db.run(
    `UPDATE webhook_logs SET status = 'processed' WHERE source = 'resend' AND json_extract(payload, '$.data.email_id') = ?`,
    [emailId]
  )

  return c.json({ received: true })
})

// Clerk webhook - sync users and organizations
app.post('/api/webhook/clerk', async (c) => {
  const body = await c.req.json()
  const db = getDB(c)

  // Log webhook
  await db.insert('webhook_logs', {
    id: D1Client.uuid(),
    organization_id: null,
    source: 'clerk',
    event_type: body.type,
    payload: D1Client.json(body),
    status: 'received',
    created_at: D1Client.now(),
  })

  try {
    const { type, data } = body

    if (type === 'user.created' || type === 'user.updated') {
      const clerkUser = data
      const existing = await db.getUserByClerkId(clerkUser.id)
      
      if (existing) {
        await db.update('users', existing.id, {
          email: clerkUser.email_addresses?.[0]?.email_address || null,
          raw_json: D1Client.json(clerkUser),
          updated_at: D1Client.now(),
        })
      } else {
        await db.insert('users', {
          id: D1Client.uuid(),
          clerk_id: clerkUser.id,
          organization_id: null, // Will be set when they join an org
          email: clerkUser.email_addresses?.[0]?.email_address || null,
          role: 'member',
          raw_json: D1Client.json(clerkUser),
          created_at: D1Client.now(),
          updated_at: D1Client.now(),
        })
      }
    } else if (type === 'organization.created' || type === 'organization.updated') {
      const clerkOrg = data
      const existing = await db.getOrganizationByClerkId(clerkOrg.id)
      
      if (existing) {
        await db.update('organizations', existing.id, {
          name: clerkOrg.name,
          stripe_customer_id: clerkOrg.stripe_customer_id || null,
          raw_json: D1Client.json(clerkOrg),
          updated_at: D1Client.now(),
        })
      } else {
        await db.insert('organizations', {
          id: D1Client.uuid(),
          name: clerkOrg.name,
          clerk_org_id: clerkOrg.id,
          stripe_customer_id: clerkOrg.stripe_customer_id || null,
          settings: '{}',
          created_at: D1Client.now(),
          updated_at: D1Client.now(),
        })
      }
    } else if (type === 'organizationMembership.created' || type === 'organizationMembership.updated') {
      const membership = data
      const user = await db.getUserByClerkId(membership.public_user_data.user_id)
      if (user) {
        await db.update('users', user.id, {
          organization_id: membership.organization.id,
          role: membership.role === 'admin' ? 'admin' : 'member',
          updated_at: D1Client.now(),
        })
      }
    }

    await db.run(
      `UPDATE webhook_logs SET status = 'processed' WHERE source = 'clerk' AND json_extract(payload, '$.data.id') = ?`,
      [data.id]
    )
  } catch (err) {
    console.error('Clerk webhook error:', err)
    await db.run(
      `UPDATE webhook_logs SET status = 'failed', error_message = ? WHERE source = 'clerk' AND json_extract(payload, '$.data.id') = ?`,
      [(err as Error).message, data.id]
    )
  }

  return c.json({ received: true })
})

// Stripe webhook (for subscription updates)
app.post('/api/webhook/stripe', async (c) => {
  const body = await c.req.text()
  const signature = c.req.header('Stripe-Signature') || ''
  const db = getDB(c)

  await db.insert('webhook_logs', {
    id: D1Client.uuid(),
    organization_id: null,
    source: 'stripe',
    event_type: 'event',
    payload: body,
    status: 'received',
    created_at: D1Client.now(),
  })

  // TODO: Verify Stripe signature and handle events
  // For now just acknowledge
  return c.json({ received: true })
})

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