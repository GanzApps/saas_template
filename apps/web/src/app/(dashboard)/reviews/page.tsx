'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Badge, Dropdown, Separator, Avatar } from '@saas/ui'
import {
  Search, Filter, Star, MessageSquare, MoreHorizontal,
  ChevronDown, ChevronUp, Mail, Phone, AlertTriangle
} from 'lucide-react'
import { formatRelativeTime } from '@saas/ui'

interface Review {
  id: string
  google_review_id: string
  star_rating: number
  comment: string | null
  reviewer_name: string | null
  reviewer_profile_photo: string | null
  review_time: string
  reply_text: string | null
  reply_time: string | null
  has_reply: boolean
  is_replied_by_us: boolean
  internal_notes: string | null
  assigned_to: string | null
  status: string
  locations: { name: string }
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  replied: 'bg-green-100 text-green-800',
  flagged: 'bg-yellow-100 text-yellow-800',
  archived: 'bg-gray-100 text-gray-800',
}

export default function ReviewsPage() {
  const searchParams = useSearchParams()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    rating: searchParams.get('rating') || '',
    search: '',
  })
  const [replyModal, setReplyModal] = useState<{ review: Review | null; text: string }>({ review: null, text: '' })
  const [notesModal, setNotesModal] = useState<{ review: Review | null; text: string }>({ review: null, text: '' })

  async function fetchReviews() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })
      if (filters.status) params.set('status', filters.status)
      if (filters.rating) params.set('rating', filters.rating)

      const res = await fetch(`/api/reviews?${params}`)
      if (res.ok) {
        const data: PaginatedResponse<Review> = await res.json()
        setReviews(data.data)
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews()
  }, [pagination.page, filters.status, filters.rating])

  async function handleReply(review: Review) {
    if (!replyModal.text.trim()) return

    try {
      const res = await fetch(`/api/reviews/${review.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyModal.text }),
      })
      if (res.ok) {
        setReplyModal({ review: null, text: '' })
        fetchReviews()
      }
    } catch (err) {
      console.error('Failed to reply:', err)
    }
  }

  async function handleStatusChange(review: Review, status: string) {
    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) fetchReviews()
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  function getRatingStars(rating: number) {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`h-4 w-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
    ))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reviews</h1>
          <p className="text-muted-foreground">Manage and respond to customer reviews</p>
        </div>
        <Button onClick={() => fetchReviews()} variant="outline" disabled={loading}>
          <ChevronDown className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[250px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reviews..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>

            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="flex h-10 w-[180px] items-center px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="replied">Replied</option>
              <option value="flagged">Flagged</option>
              <option value="archived">Archived</option>
            </select>

            <select
              value={filters.rating}
              onChange={(e) => setFilters(prev => ({ ...prev, rating: e.target.value }))}
              className="flex h-10 w-[140px] items-center px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Reviews Table */}
      <Card>
        <CardContent className="pt-0">
          {loading && reviews.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
              <p>No reviews found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">Reviewer</th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">Rating</th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">Review</th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">Location</th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">Date</th>
                    <th className="p-4 text-right text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map(review => (
                    <tr key={review.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={review.reviewer_profile_photo || undefined}
                            fallback={review.reviewer_name?.[0] || 'U'}
                            size="sm"
                          />
                          <div>
                            <p className="font-medium">{review.reviewer_name || 'Anonymous'}</p>
                            {review.is_replied_by_us && (
                              <Badge variant="secondary" className="text-xs">Replied by us</Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">{getRatingStars(review.star_rating)}</div>
                      </td>
                      <td className="p-4 max-w-md">
                        <p className="line-clamp-2">{review.comment || '<em class="text-muted-foreground">No text</em>'}</p>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{review.locations.name}</td>
                      <td className="p-4">
                        <Badge className={statusColors[review.status] || statusColors.new}>
                          {review.status.charAt(0).toUpperCase() + review.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{formatRelativeTime(review.review_time)}</td>
                      <td className="p-4 text-right">
                        <Dropdown
                          trigger={<Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>}
                          items={[
                            {
                              label: review.has_reply ? 'View Reply' : 'Reply',
                              onClick: () => setReplyModal({ review, text: replyModal.review?.id === review.id ? replyModal.text : '' }),
                              icon: <MessageSquare className="h-4 w-4" />,
                            },
                            {
                              label: 'Internal Notes',
                              onClick: () => setNotesModal({ review, text: review.internal_notes || '' }),
                              icon: <Mail className="h-4 w-4" />,
                            },
                            { type: 'separator' },
                            {
                              label: 'Mark as Replied',
                              onClick: () => handleStatusChange(review, 'replied'),
                              disabled: review.status === 'replied',
                            },
                            {
                              label: 'Flag',
                              onClick: () => handleStatusChange(review, 'flagged'),
                              disabled: review.status === 'flagged',
                            },
                            {
                              label: 'Archive',
                              onClick: () => handleStatusChange(review, 'archived'),
                              disabled: review.status === 'archived',
                              destructive: true,
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages || loading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reply Modal */}
      {replyModal.review && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setReplyModal({ review: null, text: '' })}>
          <div className="w-full max-w-lg bg-background rounded-lg shadow-xl p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Reply to Review</h2>
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <p className="font-medium">{replyModal.review.reviewer_name || 'Anonymous'}</p>
              <p className="text-sm text-muted-foreground">{replyModal.review.comment || '<em>No text</em>'}</p>
            </div>
            <textarea
              value={replyModal.text}
              onChange={(e) => setReplyModal(prev => ({ ...prev, text: e.target.value }))}
              placeholder="Write your reply..."
              className="w-full min-h-[120px] p-3 border rounded-lg resize-y mb-4"
              maxLength={4000}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReplyModal({ review: null, text: '' })}>Cancel</Button>
              <Button onClick={() => handleReply(replyModal.review!)} disabled={!replyModal.text.trim()}>
                Send Reply
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesModal.review && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setNotesModal({ review: null, text: '' })}>
          <div className="w-full max-w-lg bg-background rounded-lg shadow-xl p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Internal Notes</h2>
            <textarea
              value={notesModal.text}
              onChange={(e) => setNotesModal(prev => ({ ...prev, text: e.target.value }))}
              placeholder="Add internal notes for your team..."
              className="w-full min-h-[120px] p-3 border rounded-lg resize-y mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNotesModal({ review: null, text: '' })}>Cancel</Button>
              <Button onClick={async () => {
                try {
                  await fetch(`/api/reviews/${notesModal.review!.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ internalNotes: notesModal.text }),
                  })
                  setNotesModal({ review: null, text: '' })
                  fetchReviews()
                } catch (err) {
                  console.error('Failed to save notes:', err)
                }
              }}>
                Save Notes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}