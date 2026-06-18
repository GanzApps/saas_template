'use client'

import { useState, useEffect } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Input } from '@saas/ui'
import { RefreshCw, MapPin, Wifi, AlertTriangle, Loader2 } from 'lucide-react'
import { formatRelativeTime } from '@saas/ui'

interface Location {
  id: string
  name: string
  address: string | null
  phone: string | null
  website: string | null
  primary_category: string | null
  google_location_id: string
  is_active: boolean
  review_count: number
  average_rating: number | null
  last_review_sync_at: string | null
  google_accounts: { google_account_email: string }
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)

  async function fetchLocations() {
    setLoading(true)
    try {
      const res = await fetch('/api/accounts')
      if (res.ok) {
        const accounts = await res.json()
        // Fetch locations for each account
        const allLocations: Location[] = []
        for (const account of accounts) {
          const locRes = await fetch(`/api/accounts/${account.id}/locations`)
          if (locRes.ok) {
            const locs = await locRes.json()
            allLocations.push(
              ...locs.map((l: Location) => ({ ...l, google_accounts: { google_account_email: account.google_account_email } }))
            )
          }
        }
        setLocations(allLocations)
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err)
    } finally {
      setLoading(false)
    }
  }

  async function syncLocation(accountId: string, locationId: string) {
    setSyncing(locationId)
    try {
      await fetch(`/api/accounts/${accountId}/sync`, { method: 'POST' })
      fetchLocations()
    } catch (err) {
      console.error('Failed to sync:', err)
    } finally {
      setSyncing(null)
    }
  }

  useEffect(() => { fetchLocations() }, [])

  const getSyncStatus = (loc: Location) => {
    if (!loc.last_review_sync_at) return { label: 'Never synced', variant: 'destructive' as const }
    const hoursSince = (Date.now() - new Date(loc.last_review_sync_at).getTime()) / (1000 * 60 * 60)
    if (hoursSince < 1) return { label: 'Just now', variant: 'default' as const }
    if (hoursSince < 24) return { label: `${Math.floor(hoursSince)}h ago`, variant: 'default' as const }
    return { label: `${Math.floor(hoursSince / 24)}d ago`, variant: 'secondary' as const }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
          <p className="text-muted-foreground">Manage your Google Business locations</p>
        </div>
        <Button onClick={fetchLocations} disabled={loading}><RefreshCw className="h-4 w-4 mr-2" />Refresh All</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : locations.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-8">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No locations connected</h3>
            <p className="text-muted-foreground mb-4">Connect a Google Business account to sync your locations</p>
            <Button onClick={() => window.location.href = '/onboarding'}>Connect Google Business</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {locations.map(loc => {
            const syncStatus = getSyncStatus(loc)
            return (
              <Card key={loc.id} className={!loc.is_active ? 'opacity-50' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{loc.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{loc.google_accounts.google_account_email}</p>
                    </div>
                    <Badge variant={loc.is_active ? 'default' : 'secondary'}>{loc.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loc.address && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />{loc.address}
                    </div>
                  )}
                  {loc.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">📞 {loc.phone}</div>
                  )}
                  {loc.primary_category && (
                    <Badge variant="outline" className="text-xs">{loc.primary_category}</Badge>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <StarRating rating={loc.average_rating} />
                        <span className="font-medium">{loc.average_rating?.toFixed(1) || '—'}</span>
                      </div>
                      <span className="text-muted-foreground">({loc.review_count} reviews)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={syncStatus.variant} className="gap-1">
                        <Wifi className="h-3 w-3" />{syncStatus.label}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncLocation(loc.google_accounts.google_account_email, loc.id)}
                        disabled={syncing === loc.id}
                      >
                        {syncing === loc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < Math.round(rating) ? 'text-yellow-400' : 'text-gray-300'}>★</span>
      ))}
    </div>
  )
}