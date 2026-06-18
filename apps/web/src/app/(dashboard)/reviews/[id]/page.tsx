'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Textarea } from '@saas/ui'
import { ArrowLeft, Star, MessageSquare, Edit, Copy, Check, Loader2, AlertTriangle } from 'lucide-react'
import { formatRelativeTime } from '@saas/ui'

interface Review {
  id: string
  google_review_id: string
  star_rating: number
  comment: string | null
  reviewer_name: string | null
  reviewer_profile_photo: string | null
  google_reviewer_id: string | null
  review_time: string
  reply_text: string | null
  reply_time: string | null
  reply_author: string | null
  has_reply: boolean
  is_replied_by_us: boolean
  internal_notes: string | null
  assigned_to: string | null
  status: string
  locations: { name: string; id: string }
}

interface Template {
  id: string
  name: string
  content: string
}

export default function ReviewDetailPage() {
  const params = useParams()
  const router = useRouter()
  const reviewId = params.id as string

  const [review, setReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [notesText, setNotesText] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [sending, setSending] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  async function fetchReview() {
    setLoading(true)
    try {
      const res = await fetch(`/api/reviews/${reviewId}`)
      if (res.ok) {
        const data = await res.json()
        setReview(data)
        setReplyText(data.reply_text || '')
        setNotesText(data.internal_notes || '')
      } else if (res.status === 404) {
        router.push('/reviews')
      }
    } catch (err) {
      console.error('Failed to fetch review:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/templates')
      if (res.ok) setTemplates(await res.json())
    } catch (err) {
      console.error('Failed to fetch templates:', err)
    }
  }

  async function handleReply() {
    if (!replyText.trim() || !review) return
    setSending(true)
    try {
      const res = await fetch(`/api/reviews/${review.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText }),
      })
      if (res.ok) {
        fetchReview()
        // Increment template usage if a template was used
      }
    } catch (err) {
      console.error('Failed to reply:', err)
    } finally {
      setSending(false)
    }
  }

  async function handleNotesSave() {
    if (!review) return
    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalNotes: notesText }),
      })
      if (res.ok) fetchReview()
    } catch (err) {
      console.error('Failed to save notes:', err)
    }
  }

  async function handleStatusChange(status: string) {
    if (!review) return
    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) fetchReview()
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  function useTemplate(template: Template) {
    setReplyText(template.content
      .replace('{{name}}', review?.reviewer_name || '')
      .replace('{{business}}', review?.locations.name || '')
      .replace('{{rating}}', review?.star_rating?.toString() || '')
      .replace('{{review_text}}', review?.comment || '')
    )
    setShowTemplates(false)
  }

  useEffect(() => { fetchReview(); fetchTemplates() }, [reviewId])

  const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800',
    replied: 'bg-green-100 text-green-800',
    flagged: 'bg-yellow-100 text-yellow-800',
    archived: 'bg-gray-100 text-gray-800',
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="h-8 bg-muted rounded animate-pulse w-1/4" />
        </div>
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (!review) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Details</h1>
          <p className="text-muted-foreground">{review.locations.name}</p>
        </div>
        <div className="flex-1" />
        <Badge className={statusColors[review.status] || statusColors.new}>
          {review.status.charAt(0).toUpperCase() + review.status.slice(1)}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Review Card */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={review.reviewer_profile_photo || ''}
                  alt=""
                  className="h-16 w-16 rounded-full bg-muted object-cover"
                />
                <div>
                  <h3 className="text-xl font-bold">{review.reviewer_name || 'Anonymous'}</h3>
                  <p className="text-muted-foreground">{review.locations.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-yellow-400 text-2xl">
                  {'★'.repeat(review.star_rating)}
                </div>
                <span className="text-sm text-muted-foreground">{formatRelativeTime(review.review_time)}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {review.comment && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="whitespace-pre-wrap">{review.comment}</p>
                </div>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Google Review ID: {review.google_review_id}</span>
                {review.google_reviewer_id && <span>Reviewer ID: {review.google_reviewer_id}</span>}
              </div>
            </CardContent>
          </Card>

          {/* Reply Section */}
          <Card>
            <CardHeader>
              <CardTitle>Reply to Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {review.has_reply && review.reply_text && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-800">
                      {review.is_replied_by_us ? 'Your reply' : 'Existing reply'}
                    </span>
                    {review.reply_time && (
                      <span className="text-sm text-green-600">{formatRelativeTime(review.reply_time)}</span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-green-900">{review.reply_text}</p>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-medium">Write your reply</label>
                  <Button variant="ghost" size="sm" onClick={() => setShowTemplates(!showTemplates)}>
                    {showTemplates ? (
                      <>Hide <Edit className="h-4 w-4 ml-1" /></>
                    ) : (
                      <>Templates <MessageSquare className="h-4 w-4 ml-1" /></>
                    )}
                  </Button>
                </div>

                {showTemplates && templates.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {templates.map(t => (
                      <Button
                        key={t.id}
                        variant="outline"
                        size="sm"
                        onClick={() => useTemplate(t)}
                        className="gap-1"
                      >
                        {t.name}
                      </Button>
                    ))}
                  </div>
                )}

                <Textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Write your response..."
                  rows={4}
                  maxLength={4000}
                />
                <p className="text-xs text-muted-foreground">
                  {replyText.length}/4000 characters
                </p>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleStatusChange('replied')}
                    disabled={!review.has_reply}
                  >
                    Mark as Replied (No Reply)
                  </Button>
                  <Button
                    onClick={handleReply}
                    disabled={sending || !replyText.trim() || review.has_reply}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Reply'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Internal Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Internal Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notesText}
                onChange={e => setNotesText(e.target.value)}
                placeholder="Add internal notes for your team..."
                rows={4}
              />
              <div className="flex justify-end mt-3">
                <Button onClick={handleNotesSave}>Save Notes</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer" onClick={() => handleStatusChange(review.status === 'new' ? 'replied' : 'new')}>
                <MessageSquare className="h-5 w-5" />
                <span>{review.status === 'new' ? 'Mark Replied' : 'Mark as New'}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer" onClick={() => handleStatusChange('flagged')}>
                <AlertTriangle className="h-5 w-5" />
                <span>Flag Review</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer" onClick={() => handleStatusChange('archived')}>
                <AlertTriangle className="h-5 w-5" />
                <span>Archive</span>
              </div>
              <Separator />
              {review.reply_text && (
                <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer" onClick={() => navigator.clipboard.writeText(review.reply_text!)}>
                  <Copy className="h-5 w-5" />
                  <span>Copy Reply</span>
                </div>
              )}
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer" onClick={() => navigator.clipboard.writeText(`https://maps.google.com/?cid=${review.locations.id}`)}>
                <ExternalLink className="h-5 w-5" />
                <span>Open on Google Maps</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Review Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rating</span>
                <span className="font-medium">{'★'.repeat(review.star_rating)} ({review.star_rating}/5)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge className={statusColors[review.status] || statusColors.new}>
                  {review.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Posted</span>
                <span>{formatRelativeTime(review.review_time)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium truncate max-w-[150px]">{review.locations.name}</span>
              </div>
              {review.assigned_to && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned to</span>
                  <span className="font-medium">{review.assigned_to}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}