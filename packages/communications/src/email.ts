import { Resend } from 'resend'
import type { Env } from '@saas/config'

let _resendClient: Resend | null = null

export function getResendClient(env: Pick<Env, 'RESEND_API_KEY'>): Resend {
  if (!_resendClient) {
    _resendClient = new Resend(env.RESEND_API_KEY)
  }
  return _resendClient
}

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  tags?: { name: string; value: string }[]
}

export interface EmailResult {
  id: string
  to: string
  subject: string
}

/**
 * Send email via Resend
 */
export async function sendEmail(
  env: Pick<Env, 'RESEND_API_KEY' | 'RESEND_FROM_EMAIL'>,
  params: SendEmailParams
): Promise<EmailResult> {
  const client = getResendClient(env)

  const { data, error } = await client.emails.send({
    from: params.from || env.RESEND_FROM_EMAIL || 'ReviewFlow <noreply@reviewflow.app>',
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
    text: params.text,
    reply_to: params.replyTo,
    tags: params.tags,
  })

  if (error) {
    throw new Error(`Resend error: ${error.message}`)
  }

  return {
    id: data!.id,
    to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
    subject: params.subject,
  }
}

/**
 * Send bulk emails with rate limiting
 */
export async function sendBulkEmail(
  env: Pick<Env, 'RESEND_API_KEY' | 'RESEND_FROM_EMAIL'>,
  emails: SendEmailParams[],
  options?: {
    concurrency?: number
    delayMs?: number
    onProgress?: (sent: number, total: number) => void
  }
): Promise<{ success: EmailResult[]; failed: { params: SendEmailParams; error: Error }[] }> {
  const { concurrency = 10, delayMs = 100, onProgress } = options || {}
  const success: EmailResult[] = []
  const failed: { params: SendEmailParams; error: Error }[] = []

  for (let i = 0; i < emails.length; i += concurrency) {
    const chunk = emails.slice(i, i + concurrency)
    const promises = chunk.map(async (params) => {
      try {
        const result = await sendEmail(env, params)
        success.push(result)
      } catch (error) {
        failed.push({ params, error: error as Error })
      }
    })

    await Promise.all(promises)
    if (onProgress) onProgress(success.length + failed.length, emails.length)

    if (i + concurrency < emails.length && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return { success, failed }
}

/**
 * Verify email format
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Resend webhook event types
 */
export type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.complained'
  | 'email.bounced'
  | 'email.opened'
  | 'email.clicked'
  | 'email.unsubscribed'

export interface ResendWebhookPayload {
  type: ResendEventType
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    // Event-specific fields
    bounce_type?: 'hard' | 'soft'
    bounce_reason?: string
    click_location?: string
    link_url?: string
  }
}

/**
 * Verify Resend webhook signature
 * Resend uses a simple secret comparison in the header
 */
export function verifyResendSignature(
  env: Pick<Env, 'RESEND_WEBHOOK_SECRET'>,
  signature: string
): boolean {
  if (!env.RESEND_WEBHOOK_SECRET) return false
  return signature === env.RESEND_WEBHOOK_SECRET
}

/**
 * HTML email template for review request
 */
export function createReviewRequestEmail(params: {
  businessName: string
  customerName: string
  reviewUrl: string
  greeting?: string
  footer?: string
}): { html: string; text: string } {
  const { businessName, customerName, reviewUrl, greeting, footer } = params

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8fafc; border-radius: 12px; padding: 32px;">
    <h1 style="color: #1e293b; margin: 0 0 16px; font-size: 24px;">${greeting || `Hi ${customerName},`}</h1>
    
    <p style="margin: 0 0 24px; font-size: 16px;">
      We hope you had a great experience with <strong>${businessName}</strong>!
      Your feedback helps us improve and helps others discover us.
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${reviewUrl}" 
         style="display: inline-block; background: #2563eb; color: white; padding: 16px 32px; 
                border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
        Leave a Review
      </a>
    </div>
    
    <p style="margin: 24px 0 0; font-size: 14px; color: #64748b;">
      It only takes a minute. Thank you for your support!
    </p>
    
    ${footer ? `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    <p style="margin: 0; font-size: 12px; color: #94a3b8;">${footer}</p>` : ''}
  </div>
</body>
</html>`

  const text = `${greeting || `Hi ${customerName},`}

We hope you had a great experience with ${businessName}!
Your feedback helps us improve and helps others discover us.

Leave a review: ${reviewUrl}

It only takes a minute. Thank you for your support!
${footer || ''}`

  return { html, text }
}

/**
 * SMS template for review request
 */
export function createReviewRequestSMS(params: {
  businessName: string
  reviewUrl: string
  greeting?: string
}): string {
  const { businessName, reviewUrl, greeting } = params
  return `${greeting || 'Hi!'} Thanks for visiting ${businessName}! We'd love your feedback: ${reviewUrl} - Takes 30 sec. Thanks!`
}