// @ts-ignore - Hono moduleResolution issue with bundler
const Hono: any = (() => { try { return require('hono').Hono } catch { return require('hono').default } })()
import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { Webhook } from 'svix'
import type { Env } from '@saas/config'
import { D1Client, createD1Client } from '@saas/db-d1'
import {
  R2Client,
  createR2Client,
  generateShareToken,
  generateUploadToken,
  getContentType,
  presignRequestSchema,
  shareRequestSchema,
  UPLOAD_LIMITS,
} from '@saas/storage'
import type { D1Database, R2Bucket, R2ObjectBody } from '@cloudflare/workers-types'

type Bindings = Env & {
  DB: D1Database
  FILEVAULT_BUCKET: R2Bucket
}

type Variables = {
  orgId: string
  userId: string
}

const app = new Hono()

// ----------------------------------------------------------------------------
// Auth middleware
// ----------------------------------------------------------------------------

// @ts-ignore - clerkMiddleware types mismatch with @clerk/backend version
app.use('*', clerkMiddleware())

// Routes that don't need an orgId
app.get('/api/health', (c: any) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() }),
)

// Resolve org from Clerk userId for all other /api routes
app.use('/api/*', async (c: any, next: any) => {
  if (
    c.req.path === '/api/health' ||
    c.req.path.startsWith('/api/webhook/') ||
    c.req.path === '/api/public/download' ||
    c.req.path.startsWith('/s/')
  ) {
    return next()
  }
  const auth = getAuth(c)
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401)

  const db = createD1Client(c.env.DB)

  // Pick first membership; in a multi-org app the client would pass active org.
  const membership = await db.getFirstMembershipForUser(auth.userId)
  if (!membership) {
    return c.json({ error: 'No organization found for user' }, 403)
  }

  c.set('orgId', membership.org_id)
  c.set('userId', auth.userId)
  await next()
})

function getDB(c: any): D1Client {
  return createD1Client(c.env.DB)
}

function getR2(c: any): R2Client {
  return createR2Client(c.env.FILEVAULT_BUCKET, c.env.CF_R2_PUBLIC_URL)
}

// ----------------------------------------------------------------------------
// Clerk webhook — sync orgs + memberships into D1
// ----------------------------------------------------------------------------

app.post('/api/webhook/clerk', async (c: any) => {
  const secret = c.env.CLERK_WEBHOOK_SECRET
  if (!secret) return c.json({ error: 'webhook not configured' }, 500)

  const svixId = c.req.header('svix-id')
  const svixTimestamp = c.req.header('svix-timestamp')
  const svixSignature = c.req.header('svix-signature')
  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: 'Missing svix headers' }, 400)
  }

  const rawBody = await c.req.text()
  let body: { type?: string; data?: any }
  try {
    const wh = new Webhook(secret)
    wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    })
    body = JSON.parse(rawBody)
  } catch (err) {
    console.error('Clerk webhook signature failed', err)
    return c.json({ error: 'Invalid signature' }, 401)
  }

  const db = getDB(c)

  try {
    const { type, data } = body

    if (type === 'organization.created' || type === 'organization.updated') {
      const org = data
      const slug = (org.slug ?? org.id)
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .slice(0, 64)
      const existing = await db.getOrganizationByClerkId(org.id)
      if (existing) {
        await db.update('organizations', 'id = ?', { name: org.name }, [existing.id])
      } else {
        await db.insert('organizations', {
          id: D1Client.uuid(),
          name: org.name,
          slug,
          clerk_org_id: org.id,
          plan: 'free',
        })
      }
    } else if (
      type === 'organizationMembership.created' ||
      type === 'organizationMembership.updated'
    ) {
      const m = data
      const clerkOrgId = m.organization?.id
      const clerkUserId = m.public_user_data?.user_id
      if (!clerkOrgId || !clerkUserId) return c.json({ received: true })

      const org = await db.getOrganizationByClerkId(clerkOrgId)
      if (!org) return c.json({ received: true })

      const role = m.role === 'admin' || m.role === 'org:admin' ? 'admin' : 'member'
      await db.upsertMembership(org.id, clerkUserId, role)
    } else if (type === 'user.created') {
      // No-op: membership is created by orgMembership event
    }

    return c.json({ received: true })
  } catch (err) {
    console.error('Clerk webhook error', err)
    return c.json({ error: 'webhook failed' }, 500)
  }
})

// ----------------------------------------------------------------------------
// Files
// ----------------------------------------------------------------------------

// GET /api/files?cursor=&limit=
app.get('/api/files', async (c: any) => {
  const orgId = c.get('orgId')
  const db = getDB(c)
  const cursorStr = c.req.query('cursor')
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 200)
  const cursor = cursorStr ? parseInt(cursorStr, 10) : undefined
  const page = await db.listFilesByOrg(orgId, { limit, cursor })
  return c.json(page)
})

// POST /api/files/presign — create file row + upload token, return PUT URL
app.post('/api/files/presign', zValidator('json', presignRequestSchema), async (c: any) => {
  const orgId = c.get('orgId')
  const userId = c.get('userId')
  const { name, contentType, size } = c.req.valid('json')
  const db = getDB(c)

  const fileId = D1Client.uuid()
  const key = R2Client.generateKey(orgId, fileId, name)
  const token = generateUploadToken()
  const expiresAt = Date.now() + UPLOAD_LIMITS.PRESIGN_TTL_SECONDS * 1000

  await db.insert('files', {
    id: fileId,
    org_id: orgId,
    key,
    name,
    size: size ?? 0,
    content_type: contentType,
    uploaded_by: userId,
  })

  await db.insert('upload_tokens', {
    token,
    org_id: orgId,
    user_id: userId,
    file_id: fileId,
    key,
    content_type: contentType,
    max_size: UPLOAD_LIMITS.DEFAULT_MAX_BYTES,
    expires_at: expiresAt,
  })

  const uploadUrl = `${c.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api/upload/${token}`
  return c.json({ uploadUrl, key, fileId, token, expiresAt })
})

// GET /api/files/:id/presign — short-lived download URL
app.get('/api/files/:id/presign', async (c: any) => {
  const orgId = c.get('orgId')
  const fileId = c.req.param('id')
  const db = getDB(c)
  const r2 = getR2(c)

  const file = await db.getFileForOrg(orgId, fileId)
  if (!file) return c.json({ error: 'Not found' }, 404)

  // Use Worker as the gateway so the bucket doesn't need a public domain.
  const downloadUrl = `${c.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api/download/${file.id}`
  const expiresAt = Date.now() + UPLOAD_LIMITS.DOWNLOAD_TTL_SECONDS * 1000

  return c.json({ downloadUrl, expiresAt })
})

// DELETE /api/files/:id — remove from R2 + D1
app.delete('/api/files/:id', async (c: any) => {
  const orgId = c.get('orgId')
  const fileId = c.req.param('id')
  const db = getDB(c)
  const r2 = getR2(c)

  const file = await db.getFileForOrg(orgId, fileId)
  if (!file) return c.json({ error: 'Not found' }, 404)

  await r2.delete(file.key)
  await db.deleteFileForOrg(orgId, fileId)
  return c.json({ ok: true })
})

// ----------------------------------------------------------------------------
// Upload + download (one-shot, token-based)
// ----------------------------------------------------------------------------

// PUT /api/upload/:token  body = file bytes
app.put('/api/upload/:token', async (c: any) => {
  const token = c.req.param('token')
  const db = getDB(c)
  const r2 = getR2(c)

  const rec = await db.getUploadToken(token)
  if (!rec) return c.json({ error: 'Invalid token' }, 404)
  if (rec.consumed) return c.json({ error: 'Token already used' }, 410)
  if (rec.expires_at < Date.now()) return c.json({ error: 'Token expired' }, 410)

  const contentLength = parseInt(c.req.header('content-length') ?? '0', 10)
  if (contentLength > rec.max_size) {
    return c.json({ error: `File too large (max ${rec.max_size} bytes)` }, 413)
  }

  const body = await c.req.arrayBuffer()
  if (body.byteLength > rec.max_size) {
    return c.json({ error: 'File too large' }, 413)
  }

  await r2.put(rec.key, body, { contentType: rec.content_type })

  // Update file row with final size + mark token consumed atomically
  await db.update('files', 'id = ?', { size: body.byteLength }, [rec.file_id])
  await db.consumeUploadToken(token)

  return c.json({ ok: true, key: rec.key, size: body.byteLength })
})

// GET /api/public/download?token=...  -> public, resolves share, streams R2
app.get('/api/public/download', async (c: any) => {
  const shareToken = c.req.query('token')
  if (!shareToken) return c.json({ error: 'Missing token' }, 400)

  const db = getDB(c)
  const r2 = getR2(c)
  const share = await db.getShareByToken(shareToken)
  if (!share) return c.json({ error: 'Invalid share link' }, 404)
  if (share.expires_at && share.expires_at < Date.now()) {
    return c.json({ error: 'Share link expired' }, 410)
  }
  if (share.max_downloads && share.download_count >= share.max_downloads) {
    return c.json({ error: 'Download limit reached' }, 410)
  }

  const file = await db.getFileForOrg(share.org_id, share.file_id)
  if (!file) return c.json({ error: 'File not found' }, 404)

  const object = await r2.get(file.key)
  if (!object) return c.json({ error: 'Object missing' }, 404)

  await db.incrementShareDownloadCount(share.id)

  const headers = new Headers()
  headers.set('Content-Type', object.httpMetadata?.contentType ?? file.content_type)
  headers.set('Content-Length', String(object.size))
  headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`)
  headers.set('Cache-Control', 'no-store')

  // @ts-ignore - ReadableStream compatibility between workers-types and DOM lib
  return new Response((object as R2ObjectBody).body, { headers })
})

// GET /api/download/:id  -> stream R2 object with Content-Disposition
app.get('/api/download/:id', async (c: any) => {
  const fileId = c.req.param('id')
  const db = getDB(c)
  const r2 = getR2(c)

  // Allow either org-scoped (requires auth) or public share (token in query)
  const shareToken = c.req.query('token')
  let file = null as Awaited<ReturnType<typeof db.getFileForOrg>> | null
  let share: Awaited<ReturnType<typeof db.getShareByToken>> | null = null

  if (shareToken) {
    share = await db.getShareByToken(shareToken)
    if (!share) return c.json({ error: 'Invalid share link' }, 404)
    if (share.file_id !== fileId) {
      return c.json({ error: 'Share does not match file' }, 400)
    }
    if (share.expires_at && share.expires_at < Date.now()) {
      return c.json({ error: 'Share link expired' }, 410)
    }
    if (share.max_downloads && share.download_count >= share.max_downloads) {
      return c.json({ error: 'Download limit reached' }, 410)
    }
    file = await db.getFileForOrg(share.org_id, share.file_id)
  } else {
    const orgId = c.get('orgId')
    file = await db.getFileForOrg(orgId, fileId)
  }

  if (!file) return c.json({ error: 'Not found' }, 404)

  const object = await r2.get(file.key)
  if (!object) return c.json({ error: 'Object missing' }, 404)

  if (share) await db.incrementShareDownloadCount(share.id)

  const headers = new Headers()
  headers.set('Content-Type', object.httpMetadata?.contentType ?? file.content_type)
  headers.set(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(file.name)}"`,
  )
  headers.set('Content-Length', String(object.size))

  // @ts-ignore - ReadableStream compatibility between workers-types and DOM lib
  return new Response((object as R2ObjectBody).body, { headers })
})

// ----------------------------------------------------------------------------
// Shares
// ----------------------------------------------------------------------------

// POST /api/shares  body: { fileId, expiresAt?, maxDownloads? }
app.post('/api/shares', zValidator('json', shareRequestSchema), async (c: any) => {
  const orgId = c.get('orgId')
  const userId = c.get('userId')
  const { fileId, expiresAt, maxDownloads } = c.req.valid('json')
  const db = getDB(c)

  const file = await db.getFileForOrg(orgId, fileId)
  if (!file) return c.json({ error: 'File not found' }, 404)

  const token = generateShareToken()
  const share = await db.insert('shares', {
    id: D1Client.uuid(),
    file_id: fileId,
    org_id: orgId,
    token,
    expires_at: expiresAt ?? null,
    max_downloads: maxDownloads ?? null,
    created_by: userId,
  })

  const shareUrl = `${c.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/s/${token}`
  return c.json({ shareUrl, token, share })
})

// GET /api/shares?fileId=...  (list shares for a file)
app.get('/api/shares', async (c: any) => {
  const orgId = c.get('orgId')
  const fileId = c.req.query('fileId')
  const db = getDB(c)
  const shares = fileId
    ? await db.listSharesForFile(orgId, fileId)
    : await db.listSharesForOrg(orgId)
  return c.json(shares)
})

// DELETE /api/shares/:id
app.delete('/api/shares/:id', async (c: any) => {
  const orgId = c.get('orgId')
  const shareId = c.req.param('id')
  const db = getDB(c)
  await db.delete('shares', 'id = ? AND org_id = ?', [shareId, orgId])
  return c.json({ ok: true })
})

// ----------------------------------------------------------------------------
// Public share resolver (serves the Next.js public download page)
// ----------------------------------------------------------------------------

app.get('/s/:token', async (c: any) => {
  const token = c.req.param('token')
  const db = getDB(c)
  const share = await db.getShareByToken(token)
  if (!share) return c.json({ error: 'Invalid share link' }, 404)
  if (share.expires_at && share.expires_at < Date.now()) {
    return c.json({ error: 'Share link expired' }, 410)
  }
  if (share.max_downloads && share.download_count >= share.max_downloads) {
    return c.json({ error: 'Download limit reached' }, 410)
  }
  // Hand off to the Next.js frontend share page
  return c.redirect(`${c.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/s/${token}`)
})

// 404
app.notFound((c: any) => c.json({ error: 'Not found' }, 404))

export default app