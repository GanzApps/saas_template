import twilio from 'twilio'
import type { Env } from '@saas/config'

let _twilioClient: twilio.Twilio | null = null

export function getTwilioClient(env: Pick<Env, 'TWILIO_ACCOUNT_SID' | 'TWILIO_AUTH_TOKEN'>): twilio.Twilio {
  if (!_twilioClient) {
    _twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
  }
  return _twilioClient
}

export interface SendSMSParams {
  to: string // E.164 format: +15551234567
  body: string
  messagingServiceSid?: string
  statusCallback?: string
}

export interface SMSResult {
  sid: string
  status: string
  dateCreated: Date
  to: string
  from: string
  body: string
}

/**
 * Send SMS via Twilio
 */
export async function sendSMS(
  env: Pick<Env, 'TWILIO_ACCOUNT_SID' | 'TWILIO_AUTH_TOKEN' | 'TWILIO_MESSAGING_SERVICE_SID'>,
  params: SendSMSParams
): Promise<SMSResult> {
  const client = getTwilioClient(env)

  const message = await client.messages.create({
    to: params.to,
    body: params.body,
    messagingServiceSid: params.messagingServiceSid || env.TWILIO_MESSAGING_SERVICE_SID,
    statusCallback: params.statusCallback,
  })

  return {
    sid: message.sid,
    status: message.status,
    dateCreated: message.dateCreated || new Date(),
    to: message.to,
    from: message.from || '',
    body: message.body || '',
  }
}

/**
 * Send bulk SMS with rate limiting
 */
export async function sendBulkSMS(
  env: Pick<Env, 'TWILIO_ACCOUNT_SID' | 'TWILIO_AUTH_TOKEN' | 'TWILIO_MESSAGING_SERVICE_SID'>,
  messages: SendSMSParams[],
  options?: {
    concurrency?: number
    delayMs?: number
    onProgress?: (sent: number, total: number) => void
  }
): Promise<{ success: SMSResult[]; failed: { params: SendSMSParams; error: Error }[] }> {
  const { concurrency = 10, delayMs = 100, onProgress } = options || {}
  const success: SMSResult[] = []
  const failed: { params: SendSMSParams; error: Error }[] = []

  // Process in chunks
  for (let i = 0; i < messages.length; i += concurrency) {
    const chunk = messages.slice(i, i + concurrency)
    const promises = chunk.map(async (params) => {
      try {
        const result = await sendSMS(env, params)
        success.push(result)
      } catch (error) {
        failed.push({ params, error: error as Error })
      }
    })

    await Promise.all(promises)
    if (onProgress) onProgress(success.length + failed.length, messages.length)

    // Small delay between chunks to respect rate limits
    if (i + concurrency < messages.length && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return { success, failed }
}

/**
 * Validate phone number format (E.164)
 */
export function validatePhoneNumber(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone)
}

/**
 * Format phone number to E.164 (US/Canada default)
 */
export function formatPhoneNumber(phone: string, defaultCountryCode = '1'): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith(defaultCountryCode)) {
    return '+' + cleaned
  }
  if (cleaned.length === 10) {
    return '+' + defaultCountryCode + cleaned
  }
  return '+' + cleaned
}

/**
 * Twilio webhook signature verification
 */
export function verifyTwilioSignature(
  env: Pick<Env, 'TWILIO_WEBHOOK_SECRET'>,
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  if (!env.TWILIO_WEBHOOK_SECRET) return false
  return twilio.validateRequest(env.TWILIO_WEBHOOK_SECRET, signature, url, params)
}

export type MessageStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'delivered'
  | 'undelivered'
  | 'receiving'
  | 'received'
  | 'accepted'

export interface TwilioStatusCallback {
  MessageSid: string
  MessageStatus: MessageStatus
  To: string
  From: string
  Body?: string
  ErrorCode?: string
  ErrorMessage?: string
  SmsSid: string
  SmsStatus: MessageStatus
  ApiVersion: string
  AccountSid: string
}