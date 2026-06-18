const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

export type FileItem = {
  id: string
  name: string
  size: number
  content_type: string
  created_at: number
}

export type FilesPage = {
  items: FileItem[]
  nextCursor: string | null
}

async function authedFetch<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${API_URL}${path}`, { ...init, headers })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string }
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function listFiles(cursor?: string, token?: string): Promise<FilesPage> {
  const qs = cursor ? `?cursor=${cursor}` : ''
  return authedFetch(`/api/files${qs}`, {}, token)
}

export async function presignUpload(
  name: string,
  contentType: string,
  size: number,
  token: string,
): Promise<{ uploadUrl: string; fileId: string; key: string }> {
  return authedFetch(
    '/api/files/presign',
    { method: 'POST', body: JSON.stringify({ name, contentType, size }) },
    token,
  )
}

export async function presignDownload(
  fileId: string,
  token: string,
): Promise<{ downloadUrl: string; expiresAt: number }> {
  return authedFetch(`/api/files/${fileId}/presign`, {}, token)
}

export async function deleteFile(fileId: string, token: string): Promise<{ ok: true }> {
  return authedFetch(`/api/files/${fileId}`, { method: 'DELETE' }, token)
}

export async function createShare(
  fileId: string,
  token: string,
  opts: { expiresAt?: number; maxDownloads?: number } = {},
): Promise<{ shareUrl: string; token: string }> {
  return authedFetch(
    '/api/shares',
    { method: 'POST', body: JSON.stringify({ fileId, ...opts }) },
    token,
  )
}

export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
): Promise<{ ok: true; key: string; size: number }> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  return res.json()
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleString()
}
