import { google, Auth, mybusiness_v4, mybusinessbusinessinformation_v1 } from 'googleapis'
import { validateEnv, Env } from '@saas/config'
import { encrypt, decrypt } from './encryption'

// Types from Google APIs
type OAuth2Client = Auth.OAuth2Client
type MyBusinessV4 = mybusiness_v4.Mybusiness
type MyBusinessInfoV1 = mybusinessbusinessinformation_v1.Mybusinessbusinessinformation

// Google OAuth Scopes needed
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/plus.business.manage',
]

/**
 * Create OAuth2 client with credentials from env
 */
export function createOAuthClient(env: Pick<Env, 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET' | 'GOOGLE_OAUTH_REDIRECT_URI'>): OAuth2Client {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_OAUTH_REDIRECT_URI
  )
}

/**
 * Generate Google OAuth authorization URL
 */
export function getAuthUrl(oauthClient: OAuth2Client, state: string): string {
  return oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    state,
    prompt: 'consent', // Force refresh token on first auth
  })
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(
  oauthClient: OAuth2Client,
  code: string
): Promise<{ access_token: string; refresh_token: string; expiry_date: number }> {
  const { tokens } = await oauthClient.getToken(code)
  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error('Failed to obtain valid tokens from Google')
  }
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  oauthClient: OAuth2Client,
  refreshToken: string
): Promise<{ access_token: string; expiry_date: number }> {
  oauthClient.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await oauthClient.refreshAccessToken()
  if (!credentials.access_token || !credentials.expiry_date) {
    throw new Error('Failed to refresh access token')
  }
  return {
    access_token: credentials.access_token,
    expiry_date: credentials.expiry_date,
  }
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(
  oauthClient: OAuth2Client,
  encryptedRefreshToken: string,
  env: Pick<Env, 'ENCRYPTION_KEY'>
): Promise<string> {
  const refreshToken = decrypt(encryptedRefreshToken, env.ENCRYPTION_KEY)
  const { access_token } = await refreshAccessToken(oauthClient, refreshToken)
  return access_token
}

/**
 * Create My Business API client (v4 - Account Management)
 */
export function createMyBusinessClient(oauthClient: OAuth2Client): MyBusinessV4 {
  return google.mybusiness({ version: 'v4', auth: oauthClient })
}

/**
 * Create My Business Business Information API client (v1 - Locations & Reviews)
 */
export function createMyBusinessInfoClient(oauthClient: OAuth2Client): MyBusinessInfoV1 {
  return google.mybusinessbusinessinformation({ version: 'v1', auth: oauthClient })
}

/**
 * Google Account info from OAuth
 */
export interface GoogleAccountInfo {
  email: string
  name: string
  picture?: string
}

/**
 * Fetch Google account info using access token
 */
export async function fetchGoogleAccountInfo(accessToken: string): Promise<GoogleAccountInfo> {
  const oauth2 = google.oauth2({ version: 'v2', auth: accessToken })
  const { data } = await oauth2.userinfo.get()
  return {
    email: data.email!,
    name: data.name!,
    picture: data.picture || undefined,
  }
}

/**
 * List all accounts accessible by the user
 */
export async function listAccounts(myBusiness: MyBusinessV4): Promise<mybusiness_v4.Schema$Account[]> {
  const { data } = await myBusiness.accounts.list()
  return data.accounts || []
}

/**
 * List all locations for an account
 */
export async function listLocations(
  myBusinessInfo: MyBusinessInfoV1,
  accountName: string // e.g., "accounts/123456789"
): Promise<mybusinessbusinessinformation_v1.Schema$Location[]> {
  const { data } = await myBusinessInfo.accounts.locations.list({
    parent: accountName,
    readMask: 'name,title,storeCode,phoneNumbers,websiteUri,location,primaryCategory,metadata,profile',
  })
  return data.locations || []
}

/**
 * Get location details
 */
export async function getLocation(
  myBusinessInfo: MyBusinessInfoV1,
  locationName: string // e.g., "accounts/123456789/locations/987654321"
): Promise<mybusinessbusinessinformation_v1.Schema$Location> {
  const { data } = await myBusinessInfo.accounts.locations.get({ name: locationName })
  return data
}

/**
 * List reviews for a location
 */
export async function listReviews(
  myBusinessInfo: MyBusinessInfoV1,
  locationName: string,
  pageSize = 50,
  pageToken?: string
): Promise<{
  reviews: mybusinessbusinessinformation_v1.Schema$Review[]
  nextPageToken: string | undefined
}> {
  const { data } = await myBusinessInfo.accounts.locations.reviews.list({
    parent: locationName,
    pageSize,
    pageToken,
    orderBy: 'updateTime desc',
  })
  return {
    reviews: data.reviews || [],
    nextPageToken: data.nextPageToken,
  }
}

/**
 * Reply to a review
 */
export async function replyToReview(
  myBusinessInfo: MyBusinessInfoV1,
  reviewName: string, // e.g., "accounts/123/locations/456/reviews/789"
  replyText: string
): Promise<mybusinessbusinessinformation_v1.Schema$ReviewReply> {
  const { data } = await myBusinessInfo.accounts.locations.reviews.reply({
    name: reviewName,
    requestBody: { comment: replyText },
  })
  return data
}

/**
 * Delete a review reply
 */
export async function deleteReviewReply(
  myBusinessInfo: MyBusinessInfoV1,
  reviewName: string
): Promise<void> {
  await myBusinessInfo.accounts.locations.reviews.deleteReply({ name: reviewName })
}

/**
 * Register a Pub/Sub notification for review updates
 * Call this once per location to set up webhook
 */
export async function registerNotifications(
  myBusiness: MyBusinessV4,
  accountName: string,
  topicName: string // e.g., "projects/my-project/topics/gbp-reviews"
): Promise<mybusiness_v4.Schema$Notification> {
  const { data } = await myBusiness.accounts.notifications.create({
    parent: accountName,
    requestBody: {
      topicName,
      notificationTypes: ['NEW_REVIEW', 'UPDATED_REVIEW', 'REVIEW_DELETED'],
    },
  })
  return data
}

/**
 * List registered notifications
 */
export async function listNotifications(
  myBusiness: MyBusinessV4,
  accountName: string
): Promise<mybusiness_v4.Schema$Notification[]> {
  const { data } = await myBusiness.accounts.notifications.list({ parent: accountName })
  return data.notifications || []
}

/**
 * Delete a notification registration
 */
export async function deleteNotification(
  myBusiness: MyBusinessV4,
  notificationName: string
): Promise<void> {
  await myBusiness.accounts.notifications.delete({ name: notificationName })
}

/**
 * Batch get locations (more efficient for multiple)
 */
export async function batchGetLocations(
  myBusinessInfo: MyBusinessInfoV1,
  locationNames: string[]
): Promise<mybusinessbusinessinformation_v1.Schema$Location[]> {
  const { data } = await myBusinessInfo.accounts.locations.batchGet({
    requestBody: { names: locationNames },
  })
  return data.locations || []
}

/**
 * Check if access token is expired or near expiry (5 min buffer)
 */
export function isTokenExpired(expiryDate: number): boolean {
  return Date.now() >= expiryDate - 5 * 60 * 1000
}

/**
 * Encrypt tokens for storage
 */
export function encryptTokens(
  tokens: { access_token: string; refresh_token: string; expiry_date: number },
  env: Pick<Env, 'ENCRYPTION_KEY'>
): { access_token_encrypted: string; refresh_token_encrypted: string; token_expires_at: string } {
  return {
    access_token_encrypted: encrypt(tokens.access_token, env.ENCRYPTION_KEY),
    refresh_token_encrypted: encrypt(tokens.refresh_token, env.ENCRYPTION_KEY),
    token_expires_at: new Date(tokens.expiry_date).toISOString(),
  }
}

/**
 * Decrypt stored tokens
 */
export function decryptTokens(
  stored: { access_token_encrypted: string; refresh_token_encrypted: string; token_expires_at: string },
  env: Pick<Env, 'ENCRYPTION_KEY'>
): { access_token: string; refresh_token: string; expiry_date: number } {
  return {
    access_token: decrypt(stored.access_token_encrypted, env.ENCRYPTION_KEY),
    refresh_token: decrypt(stored.refresh_token_encrypted, env.ENCRYPTION_KEY),
    expiry_date: new Date(stored.token_expires_at).getTime(),
  }
}