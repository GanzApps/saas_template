'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth, useUser } from '@clerk/nextjs'
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Badge } from '@saas/ui'
import { Mail, Phone, ArrowRight, CheckCircle, Loader2 } from 'lucide-react'

interface Location {
  id: string
  name: string
  address: string | null
}

interface GoogleAccount {
  id: string
  google_account_email: string
  account_name: string | null
  locations: Location[]
}

export default function OnboardingPage() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const { user } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState<'connect' | 'select' | 'complete'>('connect')
  const [accounts, setAccounts] = useState<GoogleAccount[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if coming from Google OAuth
  if (isLoaded && searchParams.get('connected') === 'true') {
    setStep('select')
    fetchAccounts()
  }

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/accounts')
      if (res.ok) {
        const data = await res.json()
        setAccounts(data)
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
    }
  }

  async function connectGoogle() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/google')
      if (res.ok) {
        window.location.href = res.url
      }
    } catch (err) {
      setError('Failed to start Google connection')
      setLoading(false)
    }
  }

  function toggleLocation(locationId: string) {
    setSelectedLocations(prev =>
      prev.includes(locationId) ? prev.filter(id => id !== locationId) : [...prev, locationId]
    )
  }

  async function completeOnboarding() {
    if (selectedLocations.length === 0) {
      setError('Please select at least one location')
      return
    }

    setLoading(true)
    try {
      // Sync selected locations
      for (const account of accounts) {
        for (const location of account.locations) {
          if (selectedLocations.includes(location.id)) {
            await fetch(`/api/accounts/${account.id}/sync`, { method: 'POST' })
          }
        }
      }
      setStep('complete')
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch (err) {
      setError('Failed to complete setup')
      setLoading(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isSignedIn) return null

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-8">
          {['Connect', 'Select', 'Complete'].map((label, i) => (
            <div key={label} className="flex flex-col items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                ${i < (step === 'connect' ? 0 : step === 'select' ? 1 : 2) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
              `}>
                {i + 1}
              </div>
              <span className="mt-2 text-xs text-muted-foreground">{label}</span>
              {i < 2 && <div className="absolute w-full h-0.5 bg-muted top-5 left-1/2 -translate-x-1/2" />}
            </div>
          ))}
        </div>

        {/* Step 1: Connect Google */}
        {step === 'connect' && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Connect Google Business Profile</CardTitle>
              <p className="text-muted-foreground mt-2">
                We'll securely connect to your Google account to access your business locations and reviews.
              </p>
            </CardHeader>
            <CardContent className="text-center">
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-2" />
                  <p className="text-sm">Read & manage your Google Business Profile</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-2" />
                  <p className="text-sm">Access reviews across all locations</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-2" />
                  <p className="text-sm">Reply to reviews directly from dashboard</p>
                </div>
              </div>
              <Button onClick={connectGoogle} disabled={loading} className="mt-8 w-full gap-2" size="lg">
                <Mail className="h-4 w-4" />
                Connect with Google
              </Button>
              {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Locations */}
        {step === 'select' && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Select Locations to Manage</CardTitle>
              <p className="text-muted-foreground mt-2">
                Choose which business locations you want to sync reviews for.
              </p>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No Google accounts connected yet.</p>
                  <Button variant="outline" onClick={() => setStep('connect')} className="mt-4">
                    Connect Account
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {accounts.map(account => (
                    <div key={account.id} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">
                        {account.account_name || account.google_account_email}
                      </h4>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {account.locations.map(loc => (
                          <label
                            key={loc.id}
                            className={`
                              flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                              ${selectedLocations.includes(loc.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted'}
                            `}
                          >
                            <input
                              type="checkbox"
                              checked={selectedLocations.includes(loc.id)}
                              onChange={() => toggleLocation(loc.id)}
                              className="h-4 w-4 text-primary"
                            />
                            <div>
                              <p className="font-medium">{loc.name}</p>
                              {loc.address && <p className="text-xs text-muted-foreground">{loc.address}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Button onClick={completeOnboarding} disabled={loading || selectedLocations.length === 0} className="w-full gap-2" size="lg">
                    Complete Setup <ArrowRight className="h-4 w-4" />
                  </Button>
                  {error && <p className="mt-4 text-sm text-destructive text-center">{error}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Complete */}
        {step === 'complete' && (
          <Card className="text-center">
            <CardContent className="py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">You're all set!</h2>
              <p className="text-muted-foreground mb-6">
                We're syncing your reviews in the background. This may take a few minutes.
              </p>
              <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}