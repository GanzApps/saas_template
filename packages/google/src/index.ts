export { encrypt, decrypt, encryptObject, decryptObject } from './encryption'
export * from './api'

export interface GoogleOAuthState {
  organizationId: string
  returnTo?: string
  nonce: string
}

export interface GoogleWebhookPayload {
  message: {
    data: string // base64 encoded
    messageId: string
    publishTime: string
    attributes?: Record<string, string>
  }
  subscription: string
}

/**
 * Decode Google Pub/Sub message data
 */
export function decodePubSubMessage(data: string): any {
  const json = Buffer.from(data, 'base64').toString('utf8')
  return JSON.parse(json)
}

/**
 * Google Business Profile notification types
 */
export type GoogleNotificationType = 'NEW_REVIEW' | 'UPDATED_REVIEW' | 'REVIEW_DELETED'

export interface GoogleReviewNotification {
  review: {
    name: string // accounts/{account}/locations/{location}/reviews/{review}
    reviewer: {
      profilePhotoUrl: string
      displayName: string
    }
    starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE'
    comment: string
    createTime: string
    updateTime: string
    reviewReply?: {
      comment: string
      updateTime: string
    }
  }
  notificationType: GoogleNotificationType
}

/**
 * Parse Google review notification from Pub/Sub message
 */
export function parseReviewNotification(message: any): GoogleReviewNotification | null {
  try {
    const data = typeof message === 'string' ? decodePubSubMessage(message) : message
    return data
  } catch (error) {
    console.error('Failed to parse Google review notification:', error)
    return null
  }
}

/**
 * Convert Google star rating string to number
 */
export function googleStarRatingToNumber(rating: GoogleReviewNotification['review']['starRating']): number {
  const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }
  return map[rating]
}

/**
 * Extract location ID from review name
 * Format: accounts/{account}/locations/{location}/reviews/{review}
 */
export function getLocationIdFromReviewName(reviewName: string): string | null {
  const match = reviewName.match(/locations\/([^\/]+)/)
  return match ? match[1] : null
}

/**
 * Extract review ID from review name
 */
export function getReviewIdFromReviewName(reviewName: string): string | null {
  const match = reviewName.match(/reviews\/([^\/]+)$/)
  return match ? match[1] : null
}

/**
 * Extract account ID from review name
 */
export function getAccountIdFromReviewName(reviewName: string): string | null {
  const match = reviewName.match(/accounts\/([^\/]+)/)
  return match ? match[1] : null
}