'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@saas/ui'
import { Star, MessageSquare, TrendingUp, AlertTriangle, Send, Loader2 } from 'lucide-react'
import { formatRelativeTime } from '@saas/ui'

interface Review {
  id: string
  star_rating: number
  comment: string | null
  reviewer_name: string | null
  reviewer_profile_photo: string | null
  review_time: string
  has_reply: boolean
  is_replied_by_us: boolean
  locations: { name: string }
}

interface AnalyticsOverview {
  totalReviews: number
  averageRating: number
  replyRate: number
  ratingDistribution: { star: number; count: number }[]
}

export default function DashboardPage() {
  const { user } = useUser()
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [recentReviews, setRecentReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    setLoading(true)
    try {
      const [analyticsRes, reviewsRes] = await Promise.all([
        fetch('/api/analytics/overview?days=30'),
        fetch('/api/reviews?limit=5&status=new'),
      ])
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json())
      if (reviewsRes.ok) {
        const data = await reviewsRes.json()
        setRecentReviews(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse w-1/4" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {user?.firstName || 'there'}
        </h1>
        <p className="text-muted-foreground">Here's what's happening with your reviews.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews (30d)</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalReviews || 0}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.averageRating?.toFixed(2) || '—'}</div>
            <p className="text-xs text-muted-foreground">Out of 5.0</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <Send className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.replyRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Reviews responded to</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Reply</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentReviews.length}</div>
            <p className="text-xs text-muted-foreground">Need your attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution + Recent Reviews */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics?.ratingDistribution?.map(({ star, count }) => (
                <div key={star} className="flex items-center gap-4">
                  <div className="w-12 text-right text-sm font-medium text-muted-foreground">
                    {'★'.repeat(star)}
                  </div>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: analytics.totalReviews > 0 ? `${(count / analytics.totalReviews) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="w-12 text-right text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Reviews Needing Reply</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/reviews'}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {recentReviews.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">All caught up! No reviews awaiting reply.</p>
            ) : (
              <div className="space-y-3">
                {recentReviews.map(review => (
                  <div key={review.id} className="p-3 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={review.reviewer_profile_photo || ''}
                          alt=""
                          className="h-10 w-10 rounded-full bg-muted object-cover"
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{review.reviewer_name || 'Anonymous'}</p>
                          <p className="text-sm text-muted-foreground truncate">{review.locations.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-yellow-400">{'★'.repeat(review.star_rating)}</span>
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(review.review_time)}</span>
                      </div>
                    </div>
                    {review.comment && (
                      <p className="mt-2 text-sm line-clamp-2 text-muted-foreground">{review.comment}</p>
                    )}
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" onClick={() => window.location.href = `/reviews/${review.id}`}>
                        Reply
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start gap-2" variant="outline" onClick={() => window.location.href = '/campaigns'}>
              <Send className="h-4 w-4" />
              <span>Create Review Campaign</span>
            </Button>
            <Button className="w-full justify-start gap-2" variant="outline" onClick={() => window.location.href = '/locations'}>
              <Loader2 className="h-4 w-4" />
              <span>Sync Locations & Reviews</span>
            </Button>
            <Button className="w-full justify-start gap-2" variant="outline" onClick={() => window.location.href = '/templates'}>
              <MessageSquare className="h-4 w-4" />
              <span>Manage Templates</span>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connected Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Manage your Google Business connections</p>
            <Button className="w-full mt-3" variant="outline" onClick={() => window.location.href = '/settings'}>
              Manage Connections
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Manage your plan and billing</p>
            <Button className="w-full mt-3" variant="outline" onClick={() => window.location.href = '/settings'}>
              Billing Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}