'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Share2, Download, Upload } from 'lucide-react'
import {
  listFiles,
  presignUpload,
  uploadToPresignedUrl,
  presignDownload,
  deleteFile,
  createShare,
  formatBytes,
  formatDate,
  type FileItem,
} from '@/lib/api'
import { Button } from '@saas/ui'

export function FileTable() {
  const { getToken } = useAuth()
  const qc = useQueryClient()
  const [shareFor, setShareFor] = useState<FileItem | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['files'],
    queryFn: async () => listFiles(undefined, await getToken() ?? undefined),
  })

  const del = useMutation({
    mutationFn: async (id: string) => deleteFile(id, await getToken() ?? ''),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  })

  const handleUpload = useCallback(
    async (file: File) => {
      const token = await getToken() ?? ''
      const presign = await presignUpload(file.name, file.type, file.size, token)
      await uploadToPresignedUrl(presign.uploadUrl, file)
      qc.invalidateQueries({ queryKey: ['files'] })
    },
    [getToken, qc],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const files = Array.from(e.dataTransfer.files)
      files.forEach(handleUpload)
    },
    [handleUpload],
  )

  const handleDownload = async (id: string) => {
    const token = await getToken() ?? ''
    const { downloadUrl } = await presignDownload(id, token)
    window.open(downloadUrl, '_blank')
  }

  if (isLoading) return <div>Loading…</div>

  return (
    <div className="space-y-6">
      <UploadZone onDrop={onDrop} onPick={handleUpload} />

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3 w-24">Size</th>
              <th className="text-left p-3 w-40">Type</th>
              <th className="text-left p-3 w-48">Uploaded</th>
              <th className="text-right p-3 w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No files yet. Drop a file above to get started.
                </td>
              </tr>
            )}
            {data?.items.map((f) => (
              <tr key={f.id} className="border-t">
                <td className="p-3 font-medium truncate">{f.name}</td>
                <td className="p-3 text-muted-foreground">{formatBytes(f.size)}</td>
                <td className="p-3 text-muted-foreground truncate">{f.content_type}</td>
                <td className="p-3 text-muted-foreground">{formatDate(f.created_at)}</td>
                <td className="p-3 text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(f.id)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShareFor(f)}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => del.mutate(f.id)}
                    disabled={del.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shareFor && (
        <ShareModal file={shareFor} onClose={() => setShareFor(null)} />
      )}
    </div>
  )
}

function UploadZone({
  onDrop,
  onPick,
}: {
  onDrop: (e: React.DragEvent) => void
  onPick: (file: File) => void
}) {
  return (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-10 cursor-pointer hover:bg-muted/30"
    >
      <Upload className="h-8 w-8 text-muted-foreground" />
      <div className="text-sm text-muted-foreground">
        Drop files here or <span className="text-primary">browse</span>
      </div>
      <input
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          files.forEach(onPick)
          e.target.value = ''
        }}
      />
    </label>
  )
}

function ShareModal({ file, onClose }: { file: FileItem; onClose: () => void }) {
  const { getToken } = useAuth()
  const [expiresIn, setExpiresIn] = useState('24')
  const [maxDownloads, setMaxDownloads] = useState('')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    try {
      const opts: { expiresAt?: number; maxDownloads?: number } = {}
      const hours = parseInt(expiresIn, 10)
      if (!Number.isNaN(hours) && hours > 0) opts.expiresAt = Date.now() + hours * 3600 * 1000
      const md = parseInt(maxDownloads, 10)
      if (!Number.isNaN(md) && md > 0) opts.maxDownloads = md
      const token = await getToken() ?? ''
      const { shareUrl } = await createShare(file.id, token, opts)
      setShareUrl(shareUrl)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-background rounded-lg p-6 w-full max-w-md space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Share “{file.name}”</h2>
        {!shareUrl ? (
          <>
            <label className="block text-sm">
              Expires in (hours)
              <input
                className="mt-1 w-full border rounded px-2 py-1"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                placeholder="24 (blank = never)"
              />
            </label>
            <label className="block text-sm">
              Max downloads
              <input
                className="mt-1 w-full border rounded px-2 py-1"
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(e.target.value)}
                placeholder="Unlimited"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={create} disabled={busy}>
                Create link
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="border rounded px-3 py-2 text-sm break-all bg-muted">{shareUrl}</div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => navigator.clipboard.writeText(shareUrl)}>
                Copy
              </Button>
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
