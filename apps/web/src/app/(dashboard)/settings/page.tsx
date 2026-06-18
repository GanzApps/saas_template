'use client'

import { useState, useEffect } from 'react'
import { useUser, useOrganization } from '@clerk/nextjs'
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Separator, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@saas/ui'
import { User, Mail, Lock, Bell, Shield, Wifi, Phone, Send, CreditCard, Trash2, ExternalLink, MapPin } from 'lucide-react'

interface GoogleAccount {
  id: string
  google_account_email: string
  account_name: string | null
  is_active: boolean
  last_sync_at: string | null
  sync_error: string | null
  locations: { id: string; name: string }[]
}

interface Organization {
  id: string
  name: string
  subscription_status: string | null
  subscription_tier: string | null
}

export default function SettingsPage() {
  const { user, isLoaded } = useUser()
  const { organization } = useOrganization()
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'integrations' | 'billing' | 'team' | 'danger'>('profile')

  const formatTier = (tier?: string | null) => {
    if (!tier) return 'Free'
    return tier.charAt(0).toUpperCase() + tier.slice(1)
  }

  const formatStatus = (status?: string | null) => {
    if (!status) return 'Inactive'
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      trialing: 'bg-blue-100 text-blue-800',
      past_due: 'bg-yellow-100 text-yellow-800',
      canceled: 'bg-red-100 text-red-800',
    }
    return <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>{status.replace('_', ' ')}</Badge>
  }

  async function fetchGoogleAccounts() {
    setLoadingAccounts(true)
    try {
      const res = await fetch('/api/accounts')
      if (res.ok) setGoogleAccounts(await res.json())
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
    } finally {
      setLoadingAccounts(false)
    }
  }

  async function syncAccount(accountId: string) {
    setSyncing(accountId)
    try {
      await fetch(`/api/accounts/${accountId}/sync`, { method: 'POST' })
      fetchGoogleAccounts()
    } catch (err) {
      console.error('Failed to sync:', err)
    } finally {
      setSyncing(null)
    }
  }

  async function disconnectAccount(accountId: string) {
    if (!confirm('Disconnect this Google account? Reviews will be preserved but no new syncs will occur.')) return
    try {
      await fetch('/api/auth/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      fetchGoogleAccounts()
    } catch (err) {
      console.error('Failed to disconnect:', err)
    }
  }

  useEffect(() => { fetchGoogleAccounts() }, [])

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account, integrations, and team.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="profile"><User className="h-4 w-4 mr-2" />Profile</TabsTrigger>
          <TabsTrigger value="security"><Lock className="h-4 w-4 mr-2" />Security</TabsTrigger>
          <TabsTrigger value="integrations"><Wifi className="h-4 w-4 mr-2" />Integrations</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="h-4 w-4 mr-2" />Billing</TabsTrigger>
          <TabsTrigger value="team"><Shield className="h-4 w-4 mr-2" />Team</TabsTrigger>
          <TabsTrigger value="danger"><Trash2 className="h-4 w-4 mr-2" />Danger Zone</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 rounded-full bg-muted overflow-hidden">
                  {user?.imageUrl ? (
                    <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-medium text-muted-foreground">
                      {user?.firstName?.[0] || user?.username?.[0] || 'U'}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">{user?.fullName || 'User'}</h3>
                  <p className="text-sm text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="First Name" defaultValue={user?.firstName || ''} icon={<User className="h-4 w-4" />} />
                <Input label="Last Name" defaultValue={user?.lastName || ''} icon={<User className="h-4 w-4" />} />
                <Input label="Username" defaultValue={user?.username || ''} icon={<User className="h-4 w-4" />} />
                <Input label="Email" type="email" defaultValue={user?.primaryEmailAddress?.emailAddress || ''} icon={<Mail className="h-4 w-4" />} disabled />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Security settings are managed by Clerk. Click below to open your Clerk account settings.
              </p>
              <Button variant="outline" onClick={() => window.open('https://clerk.com/account', '_blank')} className="gap-2">
                <Lock className="h-4 w-4" />Open Clerk Security Settings
              </Button>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Active Sessions</h4>
                <p className="text-sm text-muted-foreground">Manage your active sessions from Clerk dashboard.</p>
                <Button variant="outline" onClick={() => window.open('https://clerk.com/account/sessions', '_blank')}>
                  Manage Sessions
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wifi className="h-5 w-5" />Google Business Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Google Business Profile to sync reviews and locations.
              </p>
              <Button onClick={() => window.location.href = '/api/auth/google'} disabled={loadingAccounts}>
                <ExternalLink className="h-4 w-4 mr-2" />{googleAccounts.length === 0 ? 'Connect Google Account' : 'Add Another Account'}
              </Button>

              {loadingAccounts ? (
                <div className="h-32 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
              ) : googleAccounts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No Google accounts connected.</p>
              ) : (
                <div className="space-y-4">
                  {googleAccounts.map(account => (
                    <div key={account.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{account.account_name || account.google_account_email}</h4>
                          <p className="text-sm text-muted-foreground">{account.google_account_email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {account.locations.length} location(s) • Last sync: {account.last_sync_at ? new Date(account.last_sync_at).toLocaleString() : 'Never'}
                          </p>
                          {account.sync_error && (
                            <p className="text-xs text-destructive mt-1">Error: {account.sync_error}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={account.is_active ? 'default' : 'secondary'}>{account.is_active ? 'Active' : 'Inactive'}</Badge>
                          <Button variant="outline" size="sm" onClick={() => syncAccount(account.id)} disabled={syncing === account.id}>
                            <Wifi className="h-4 w-4 mr-1" />{syncing === account.id ? 'Syncing...' : 'Sync Now'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => disconnectAccount(account.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {account.locations.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {account.locations.map(loc => (
                            <Badge key={loc.id} variant="outline" className="gap-1">
                              <MapPin className="h-3 w-3" />{loc.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" />Twilio (SMS)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Configure Twilio for sending review request SMS messages.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Account SID" placeholder="ACxxxxxxxx" icon={<Shield className="h-4 w-4" />} />
                <Input label="Auth Token" type="password" placeholder="••••••••" icon={<Lock className="h-4 w-4" />} />
                <Input label="Messaging Service SID" placeholder="MGxxxxxxxx" icon={<Send className="h-4 w-4" />} />
              </div>
              <Button variant="outline">Test SMS Configuration</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Resend (Email)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Configure Resend for sending review request emails.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="API Key" type="password" placeholder="re_••••••••" icon={<Lock className="h-4 w-4" />} />
                <Input label="From Email" placeholder="reviews@yourdomain.com" icon={<Mail className="h-4 w-4" />} />
              </div>
              <Button variant="outline">Test Email Configuration</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Subscription</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {organization ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">{organization.name}</h3>
                      <p className="text-sm text-muted-foreground">Current plan: {formatTier(organization.subscription_tier || 'free')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {formatStatus(organization.subscription_status)}
                    </div>
                  </div>
                  <Button onClick={() => window.open('https://billing.stripe.com', '_blank')}>
                    <CreditCard className="h-4 w-4 mr-2" />Manage Billing
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">No organization found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Manage team members and their roles. Invite new members from the Clerk dashboard.
              </p>
              <Button onClick={() => window.open('https://clerk.com/account/members', '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />Manage in Clerk
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">Roles & Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { role: 'Owner', desc: 'Full access including billing, team management, and account deletion' },
                  { role: 'Admin', desc: 'Can manage locations, campaigns, templates, and team members' },
                  { role: 'Member', desc: 'Can view and reply to reviews, create campaigns, use templates' },
                  { role: 'Viewer', desc: 'Read-only access to reviews and analytics' },
                ].map(({ role, desc }) => (
                  <div key={role} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{role}</p>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Danger Zone */}
        <TabsContent value="danger">
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" />Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Disconnect All Google Accounts</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  This will disconnect all Google Business accounts but preserve your review history.
                  You won't be able to sync new reviews until you reconnect.
                </p>
                <Button variant="destructive" onClick={() => { /* TODO: bulk disconnect */ }}>
                  Disconnect All Accounts
                </Button>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Delete All Data</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Permanently delete all reviews, campaigns, templates, and settings. This cannot be undone.
                </p>
                <Button variant="destructive" onClick={() => { /* TODO: confirm modal */ }}>
                  Delete All Data
                </Button>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Delete Account</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Permanently delete your account and all associated data. This action is irreversible.
                </p>
                <Button variant="destructive" onClick={() => window.open('https://clerk.com/account', '_blank')}>
                  Delete Account via Clerk
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}