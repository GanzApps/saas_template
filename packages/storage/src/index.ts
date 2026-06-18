/**
 * @saas/storage - FileVault R2 Storage Layer
 *
 * R2 client wrapper, presigned URL generation (HMAC-signed Worker URLs),
 * file metadata helpers.
 *
 * R2 has no native S3-style presigned URLs from Workers, so we use a
 * one-shot upload token (DB-stored) plus a Worker route that accepts a
 * single PUT and writes to R2. Same ergonomics from the client side.
 */

import type { R2Bucket, R2Object, R2PutOptions } from '@cloudflare/workers-types'
import { z } from 'zod'

// ============================================================================
// Types
// ============================================================================

export interface UploadResult {
  key: string
  size: number
  contentType: string
  etag: string
}

export interface PresignedUpload {
  uploadUrl: string   // PUT URL pointing back at the API
  key: string
  token: string
  expiresAt: number    // epoch ms
  fileId: string
}

export interface PresignedDownload {
  downloadUrl: string
  expiresAt: number
}

export interface FileMetadata {
  key: string
  size: number
  contentType: string
  etag: string
  uploadedAt: string
}

// ============================================================================
// Schemas
// ============================================================================

export const presignRequestSchema = z.object({
  name: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  size: z.number().int().nonnegative().optional(),
})
export type PresignRequest = z.infer<typeof presignRequestSchema>

export const shareRequestSchema = z.object({
  fileId: z.string().uuid(),
  expiresAt: z.number().int().optional(),
  maxDownloads: z.number().int().positive().optional(),
})
export type ShareRequest = z.infer<typeof shareRequestSchema>

// ============================================================================
// Limits
// ============================================================================

export const UPLOAD_LIMITS = {
  FREE_MAX_BYTES: 100 * 1024 * 1024,        // 100 MB
  PRO_MAX_BYTES: 1 * 1024 * 1024 * 1024,    // 1 GB
  DEFAULT_MAX_BYTES: 100 * 1024 * 1024,
  PRESIGN_TTL_SECONDS: 15 * 60,             // 15 min
  DOWNLOAD_TTL_SECONDS: 5 * 60,             // 5 min
}

// ============================================================================
// R2 client
// ============================================================================

export class R2Client {
  constructor(
    private bucket: R2Bucket,
    private publicUrl?: string,
  ) {}

  /** Generate a deterministic-ish object key scoped to org. */
  static generateKey(orgId: string, fileId: string, filename: string): string {
    const ext = filename.includes('.') ? filename.split('.').pop() : ''
    const safeBase = filename
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80)
    const suffix = ext ? `.${ext}` : ''
    return `${orgId}/${fileId}/${safeBase}${suffix}`
  }

  async put(
    key: string,
    // @ts-ignore - ReadableStream type mismatch between DOM lib and workers-types
    body: any,
    options: { contentType?: string; cacheControl?: string } = {},
  ): Promise<UploadResult> {
    const putOptions: R2PutOptions = {}
    if (options.contentType) {
      putOptions.httpMetadata = {
        contentType: options.contentType,
        cacheControl: options.cacheControl,
      }
    }
    const object = await this.bucket.put(key, body, putOptions)
    if (!object) throw new Error('R2 put returned no object')
    return {
      key: object.key,
      size: object.size,
      contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
      etag: object.etag,
    }
  }

  async get(key: string): Promise<R2Object | null> {
    return this.bucket.get(key)
  }

  async head(key: string): Promise<FileMetadata | null> {
    const obj = await this.bucket.head(key)
    if (!obj) return null
    return {
      key: obj.key,
      size: obj.size,
      contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream',
      etag: obj.etag,
      uploadedAt: obj.uploaded.toISOString(),
    }
  }

  async delete(key: string): Promise<boolean> {
    await this.bucket.delete(key)
    return true
  }

  getPublicUrl(key: string): string | null {
    return this.publicUrl ? `${this.publicUrl.replace(/\/$/, '')}/${key}` : null
  }
}

export function createR2Client(bucket: R2Bucket, publicUrl?: string): R2Client {
  return new R2Client(bucket, publicUrl)
}

// ============================================================================
// Content-type helpers
// ============================================================================

const EXT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  csv: 'text/csv',
  txt: 'text/plain',
  json: 'application/json',
  zip: 'application/zip',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
}

export function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  return EXT_TYPES[ext ?? ''] ?? 'application/octet-stream'
}

export function isImage(contentType: string): boolean {
  return contentType.startsWith('image/')
}

// ============================================================================
// Token generation
// ============================================================================

export function generateUploadToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function generateShareToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
