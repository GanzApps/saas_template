/**
 * Server-side API Client for ReviewFlow Web App
 * Used in Server Components and API Routes
 */

import { validateEnv } from '@saas/config'
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'

const env = validateEnv(process.env)

const API_BASE_URL = env.NEXT_PUBLIC_API_URL

// Types (same as client)
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface Review {
  id: string
  location_id: string
  organization_id: string
  google_review_id: string
  google_reviewer_id: string | null
  reviewer_name: string | null
  reviewer_profile_photo: string | null
  star_rating: number
  comment: string | null
  review_time: string
  reply_text: string | null
  reply_time: string | null
  reply_author: string | null
  has_reply: boolean
  is_replied_by_us: boolean
  internal_notes: string | null
  assigned_to: string | null
  status: 'new' | 'replied' | 'resolved' | 'flagged'
  raw_json: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Location {
  id: string
  google_account_id: string
  organization_id: string
  google_location_id: string
  name: string
  address: string | null
  phone: string | null
  website: string | null
  primary_category: string | null
  place_id: string | null
  maps_uri: string | null
  is_active: boolean
  review_count: number
  average_rating: number
  last_review_sync_at: string | null
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface GoogleAccount {
  id: string
  organization_id: string
  google_account_email: string
  access_token_encrypted: string
  refresh_token_encrypted: string
  token_expires_at: string
  account_name: string | null
  account_type: string | null
  is_active: boolean
  last_sync_at: string | null
  sync_error: string | null
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  organization_id: string
  location_id: string | null
  name: string
  type: 'sms' | 'email' | 'qr' | 'link'
  template_sms: string | null
  template_email_subject: string | null
  template_email_body: string | null
  trigger_type: 'manual' | 'automatic' | 'scheduled'
  is_active: boolean
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CampaignRecipient {
  id: string
  campaign_id: string
  organization_id: string
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  status: 'pending' | 'sent' | 'delivered' | 'clicked' | 'submitted' | 'failed'
  sent_at: string | null
  delivered_at: string | null
  clicked_at: string | null
  submitted_at: string | null
  error_message: string | null
  external_id: string | null
  created_at: string
  updated_at: string
}

export interface ResponseTemplate {
  id: string
  organization_id: string
  name: string
  content: string
  category: string | null
  is_default: boolean
  usage_count: number
  created_at: string
  updated_at: string
}

export interface AnalyticsOverview {
  totalReviews: number
  averageRating: number
  replyRate: number
  ratingDistribution: Array<{ star: number; count: number }>
  periodDays: number
}

// Internal fetch with auth (server-side)
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`
  
  // Get auth token from Clerk
  const { getToken } = await auth()
  const token = await getToken()
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

// ============================================
// ACCOUNTS
// ============================================

export async function getAccounts(): Promise<GoogleAccount[]> {
  return apiFetch<GoogleAccount[]>('/api/accounts')
}

export async function getLocations(accountId: string): Promise<Location[]> {
  return apiFetch<Location[]>(`/api/accounts/${accountId}/locations`)
}

export async function syncAccount(accountId: string): Promise<{ synced: { locations: number; reviews: number } }> {
  return apiFetch(`/api/accounts/${accountId}/sync`, { method: 'POST' })
}

export async function disconnectAccount(accountId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/auth/google/disconnect`, {
    method: 'POST',
    body: JSON.stringify({ accountId }),
  })
}

// ============================================
// REVIEWS
// ============================================

export async function getReviews(params?: {
  locationId?: string
  status?: string
  rating?: number
  page?: number
  limit?: number
}): Promise<PaginatedResponse<Review>> {
  const searchParams = new URLSearchParams()
  if (params?.locationId) searchParams.set('locationId', params.locationId)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.rating) searchParams.set('rating', String(params.rating))
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))
  
  const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
  return apiFetch<PaginatedResponse<Review>>(`/api/reviews${query}`)
}

export async function getReview(id: string): Promise<Review> {
  return apiFetch<Review>(`/api/reviews/${id}`)
}

export async function replyToReview(id: string, text: string): Promise<Review> {
  return apiFetch<Review>(`/api/reviews/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export async function updateReview(id: string, data: {
  status?: Review['status']
  assignedTo?: string | null
  internalNotes?: string
}): Promise<Review> {
  return apiFetch<Review>(`/api/reviews/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function bulkUpdateReviews(action: 'assign' | 'status' | 'archive', ids: string[], data?: {
  assignedTo?: string | null
  status?: Review['status']
}): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/api/reviews/bulk', {
    method: 'POST',
    body: JSON.stringify({ action, ids, data }),
  })
}

// ============================================
// CAMPAIGNS
// ============================================

export async function getCampaigns(): Promise<Campaign[]> {
  return apiFetch<Campaign[]>('/api/campaigns')
}

export async function createCampaign(data: {
  name: string
  locationId?: string
  type: 'sms' | 'email' | 'qr' | 'link'
  templateSms?: string
  templateEmailSubject?: string
  templateEmailBody?: string
  triggerType?: 'manual' | 'automatic' | 'scheduled'
}): Promise<Campaign> {
  return apiFetch<Campaign>('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getCampaign(id: string): Promise<{ campaign: Campaign; recipients: CampaignRecipient[] }> {
  return apiFetch(`/api/campaigns/${id}`)
}

export async function sendCampaign(campaignId: string, recipients: Array<{
  customerName?: string
  customerPhone?: string
  customerEmail?: string
}>): Promise<{ queued: number }> {
  return apiFetch<{ queued: number }>(`/api/campaigns/${campaignId}/send`, {
    method: 'POST',
    body: JSON.stringify({ recipients }),
  })
}

// ============================================
// TEMPLATES
// ============================================

export async function getTemplates(category?: string): Promise<ResponseTemplate[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : ''
  return apiFetch<ResponseTemplate[]>(`/api/templates${query}`)
}

export async function createTemplate(data: {
  name: string
  content: string
  category?: 'positive' | 'negative' | 'neutral' | 'custom'
}): Promise<ResponseTemplate> {
  return apiFetch<ResponseTemplate>('/api/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ============================================
// ANALYTICS
// ============================================

export async function getAnalyticsOverview(params?: {
  locationId?: string
  days?: number
}): Promise<AnalyticsOverview> {
  const searchParams = new URLSearchParams()
  if (params?.locationId) searchParams.set('locationId', params.locationId)
  if (params?.days) searchParams.set('days', String(params.days))
  
  const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
  return apiFetch<AnalyticsOverview>(`/api/analytics/overview${query}`)
}

// ============================================
// GOOGLE OAUTH
// ============================================

export function getGoogleAuthUrl(): string {
  return `${API_BASE_URL}/api/auth/google`
}