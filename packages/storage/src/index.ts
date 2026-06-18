/**
 * R2 Storage Wrapper for ReviewFlow
 * Handles file uploads: review images, QR codes, exported reports, template assets
 */

import type { R2Bucket, R2Object, R2PutOptions } from '@cloudflare/workers-types'
import { z } from 'zod'

// ============================================================================
// Types
// ============================================================================

export interface UploadResult {
  key: string
  url: string
  size: number
  contentType: string
  etag: string
}

export interface PresignedUrlResult {
  uploadUrl: string
  key: string
  expiresAt: string
}

export interface FileMetadata {
  key: string
  size: number
  contentType: string
  etag: string
  uploadedAt: string
  customMetadata?: Record<string, string>
}

// ============================================================================
// Validation Schemas
// ============================================================================

const uploadOptionsSchema = z.object({
  contentType: z.string().optional(),
  customMetadata: z.record(z.string()).optional(),
  cacheControl: z.string().optional(),
})

export type UploadOptions = z.infer<typeof uploadOptionsSchema>

// ============================================================================
// R2 Client
// ============================================================================

export class R2Client {
  constructor(
    private bucket: R2Bucket,
    private publicUrl?: string
  ) {}

  /**
   * Generate a unique key for a file
   */
  static generateKey(folder: string, filename: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 10)
    const ext = filename.split('.').pop() || ''
    const base = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
    return `${folder}/${timestamp}_${random}_${base}.${ext}`
  }

  /**
   * Upload a file directly
   */
  async upload(
    key: string,
    body: ReadableStream | ArrayBuffer | string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const putOptions: R2PutOptions = {
      httpMetadata: options.contentType ? { contentType: options.contentType } : undefined,
      customMetadata: options.customMetadata,
    }

    const object = await this.bucket.put(key, body, putOptions)

    if (!object) {
      throw new Error('Upload failed: no object returned')
    }

    return {
      key: object.key,
      url: this.getPublicUrl(object.key),
      size: object.size,
      contentType: object.httpMetadata?.contentType || 'application/octet-stream',
      etag: object.etag,
    }
  }

  /**
   * Upload from FormData (multipart/form-data)
   */
  async uploadFromFormData(
    formData: FormData,
    fieldName: string,
    folder: string
  ): Promise<UploadResult> {
    const entry = formData.get(fieldName)
    if (!entry || typeof entry === 'string') {
      throw new Error(`No file found in field: ${fieldName}`)
    }
    const file = entry as unknown as File

    const key = R2Client.generateKey(folder, file.name)
    const arrayBuffer = await file.arrayBuffer()

    return this.upload(key, arrayBuffer, {
      contentType: file.type,
    })
  }

  /**
   * Generate a presigned upload URL for direct client uploads
   * Note: R2 supports S3-compatible presigned URLs via Workers
   */
  async createPresignedUploadUrl(
    key: string,
    options: { contentType?: string; expiresIn?: number } = {}
  ): Promise<PresignedUrlResult> {
    const expiresIn = options.expiresIn || 3600 // 1 hour default
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // For R2, we need to implement presigned URL generation
    // This is a simplified version - in production, use @aws-sdk/s3-request-presigner
    const uploadUrl = `${this.publicUrl || ''}/api/upload/presigned?key=${encodeURIComponent(key)}&expires=${expiresIn}`

    return {
      uploadUrl,
      key,
      expiresAt,
    }
  }

  /**
   * Get a file
   */
  async get(key: string): Promise<R2Object | null> {
    return this.bucket.get(key)
  }

  /**
   * Get file metadata without downloading
   */
  async head(key: string): Promise<FileMetadata | null> {
    const object = await this.bucket.head(key)
    if (!object) return null

    return {
      key: object.key,
      size: object.size,
      contentType: object.httpMetadata?.contentType || 'application/octet-stream',
      etag: object.etag,
      uploadedAt: object.uploaded?.toISOString() || new Date().toISOString(),
      customMetadata: object.customMetadata as Record<string, string> | undefined,
    }
  }

  /**
   * Delete a file
   */
  async delete(key: string): Promise<boolean> {
    await this.bucket.delete(key)
    return true
  }

  /**
   * Delete multiple files
   */
  async deleteMany(keys: string[]): Promise<number> {
    const results = await Promise.allSettled(keys.map(key => this.delete(key)))
    return results.filter(r => r.status === 'fulfilled').length
  }

  /**
   * List files with prefix
   */
  async list(options: {
    prefix?: string
    limit?: number
    cursor?: string
  } = {}): Promise<{ objects: R2Object[]; cursor?: string; truncated: boolean }> {
    return this.bucket.list({
      prefix: options.prefix,
      limit: options.limit,
      cursor: options.cursor,
    })
  }

  /**
   * Copy a file
   */
  async copy(sourceKey: string, destKey: string): Promise<UploadResult> {
    const object = await this.bucket.get(sourceKey)
    if (!object) throw new Error(`Source object not found: ${sourceKey}`)

    const arrayBuffer = await object.arrayBuffer()
    return this.upload(destKey, arrayBuffer, {
      contentType: object.httpMetadata?.contentType,
      customMetadata: object.customMetadata as Record<string, string> | undefined,
    })
  }

  /**
   * Get public URL for a key
   */
  getPublicUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`
    }
    // Fallback: return key (will need custom domain setup)
    return key
  }

  /**
   * Check if file exists
   */
  async exists(key: string): Promise<boolean> {
    const object = await this.bucket.head(key)
    return object !== null
  }
}

// ============================================================================
// High-level Helpers for ReviewFlow
// ============================================================================

export class ReviewFlowStorage {
  constructor(private client: R2Client) {}

  /**
   * Upload review image (photo from Google review or user upload)
   */
  async uploadReviewImage(
    organizationId: string,
    locationId: string,
    reviewId: string,
    file: File | ArrayBuffer,
    filename: string
  ): Promise<UploadResult> {
    const folder = `reviews/${organizationId}/${locationId}/${reviewId}`
    const key = R2Client.generateKey(folder, filename)

    const body = file instanceof File ? await file.arrayBuffer() : file
    const contentType = file instanceof File ? file.type : 'image/jpeg'

    return this.client.upload(key, body, { contentType })
  }

  /**
   * Upload QR code image
   */
  async uploadQRCode(
    organizationId: string,
    campaignId: string,
    qrCodeId: string,
    imageDataUrl: string // base64 data URL
  ): Promise<UploadResult> {
    const folder = `qr-codes/${organizationId}/${campaignId}`
    const key = `${folder}/${qrCodeId}.png`

    // Convert data URL to ArrayBuffer
    const base64 = imageDataUrl.split(',')[1] || imageDataUrl
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }

    return this.client.upload(key, bytes.buffer, { contentType: 'image/png' })
  }

  /**
   * Upload exported report (CSV/PDF)
   */
  async uploadReport(
    organizationId: string,
    reportType: string,
    file: ArrayBuffer,
    filename: string
  ): Promise<UploadResult> {
    const folder = `reports/${organizationId}/${reportType}`
    const key = R2Client.generateKey(folder, filename)

    const contentType = filename.endsWith('.csv') ? 'text/csv' :
                       filename.endsWith('.pdf') ? 'application/pdf' :
                       'application/octet-stream'

    return this.client.upload(key, file, { contentType })
  }

  /**
   * Upload template asset (logo, etc.)
   */
  async uploadTemplateAsset(
    organizationId: string,
    templateId: string,
    file: File | ArrayBuffer,
    filename: string
  ): Promise<UploadResult> {
    const folder = `templates/${organizationId}/${templateId}`
    const key = R2Client.generateKey(folder, filename)

    const body = file instanceof File ? await file.arrayBuffer() : file
    const contentType = file instanceof File ? file.type : 'application/octet-stream'

    return this.client.upload(key, body, { contentType })
  }

  /**
   * Delete all files for a review
   */
  async deleteReviewFiles(organizationId: string, locationId: string, reviewId: string): Promise<number> {
    const prefix = `reviews/${organizationId}/${locationId}/${reviewId}/`
    const { objects } = await this.client.list({ prefix })
    const keys = objects.map(o => o.key)
    return this.client.deleteMany(keys)
  }

  /**
   * Delete all files for a campaign
   */
  async deleteCampaignFiles(organizationId: string, campaignId: string): Promise<number> {
    const prefixes = [
      `qr-codes/${organizationId}/${campaignId}/`,
      `reports/${organizationId}/${campaignId}/`,
    ]
    let deleted = 0
    for (const prefix of prefixes) {
      const { objects } = await this.client.list({ prefix })
      deleted += await this.client.deleteMany(objects.map(o => o.key))
    }
    return deleted
  }

  /**
   * Get signed URL for temporary access (if using custom domain with signed URLs)
   */
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    // For R2 with custom domain, you can use Cloudflare's signed URLs
    // This requires Workers KV for signature generation
    // Simplified version:
    return `${this.client['publicUrl'] || ''}/api/storage/signed?key=${encodeURIComponent(key)}&expires=${expiresIn}`
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createR2Client(bucket: R2Bucket, publicUrl?: string): R2Client {
  return new R2Client(bucket, publicUrl)
}

export function createReviewFlowStorage(bucket: R2Bucket, publicUrl?: string): ReviewFlowStorage {
  return new ReviewFlowStorage(createR2Client(bucket, publicUrl))
}

// ============================================================================
// Content-Type Helpers
// ============================================================================

export function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const types: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    // Documents
    pdf: 'application/pdf',
    csv: 'text/csv',
    txt: 'text/plain',
    json: 'application/json',
    // Archives
    zip: 'application/zip',
    // Fonts
    woff: 'font/woff',
    woff2: 'font/woff2',
    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
  }
  return types[ext || ''] || 'application/octet-stream'
}

export function isImage(contentType: string): boolean {
  return contentType.startsWith('image/')
}

export function isAllowedUpload(contentType: string, maxSize: number, fileSize: number): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/csv',
    'application/json',
  ]
  return allowedTypes.includes(contentType) && fileSize <= maxSize
}

// Default limits
export const UPLOAD_LIMITS = {
  REVIEW_IMAGE: 5 * 1024 * 1024,      // 5 MB
  QR_CODE: 1 * 1024 * 1024,           // 1 MB
  REPORT: 10 * 1024 * 1024,           // 10 MB
  TEMPLATE_ASSET: 2 * 1024 * 1024,    // 2 MB
  DEFAULT: 5 * 1024 * 1024,           // 5 MB
}