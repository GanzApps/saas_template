'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Badge, Textarea } from '@saas/ui'
import { Plus, Send, Trash2, Edit, Eye, Download, Loader2 } from 'lucide-react'
import { formatRelativeTime } from '@saas/ui'

interface Campaign {
  id: string
  name: string
  type: string
  template_sms: string | null
  template_email_subject: string | null
  template_email_body: string | null
  trigger_type: string
  is_active: boolean
  locations: { name: string } | null
  created_at: string
}

interface Recipient {
  id: string
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  status: string
  sent_at: string | null
  delivered_at: string | null
  clicked_at: string | null
  submitted_at: string | null
  error_message: string | null
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [recipientLoading, setRecipientLoading] = useState(false)

  // Form state
  const [form, setForm] = useState({
    name: '',
    locationId: '',
    type: 'sms' as 'sms' | 'email' | 'both',
    templateSms: '',
    templateEmailSubject: '',
    templateEmailBody: '',
    triggerType: 'manual' as 'manual' | 'webhook' | 'api',
  })

  async function fetchCampaigns() {
    setLoading(true)
    try {
      const res = await fetch('/api/campaigns')
      if (res.ok) {
        const data = await res.json()
        setCampaigns(data)
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchRecipients(campaignId: string) {
    setRecipientLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`)
      if (res.ok) {
        const data = await res.json()
        setRecipients(data.recipients || [])
      }
    } catch (err) {
      console.error('Failed to fetch recipients:', err)
    } finally {
      setRecipientLoading(false)
    }
  }

  async function handleCreate() {
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowCreate(false)
        setForm({ name: '', locationId: '', type: 'sms', templateSms: '', templateEmailSubject: '', templateEmailBody: '', triggerType: 'manual' })
        fetchCampaigns()
      }
    } catch (err) {
      console.error('Failed to create campaign:', err)
    }
  }

  async function handleSend(campaignId: string) {
    // Simple CSV upload or manual entry - for MVP, let's use a prompt
    const names = prompt('Enter customer names (comma separated):')
    if (!names) return
    const phones = prompt('Enter phone numbers (comma separated, E.164 format):')
    const emails = prompt('Enter emails (comma separated):')

    const recipientList = names.split(',').map((name, i) => ({
      customerName: name.trim(),
      customerPhone: phones?.split(',')[i]?.trim() || undefined,
      customerEmail: emails?.split(',')[i]?.trim() || undefined,
    })).filter(r => r.customerName)

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: recipientList }),
      })
      if (res.ok) {
        const data = await res.json()
        alert(`Queued ${data.queued} messages`)
        fetchRecipients(campaignId)
      }
    } catch (err) {
      console.error('Failed to send campaign:', err)
    }
  }

  useEffect(() => { fetchCampaigns() }, [])

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    delivered: 'bg-green-100 text-green-800',
    clicked: 'bg-purple-100 text-purple-800',
    submitted: 'bg-emerald-100 text-emerald-800',
    failed: 'bg-red-100 text-red-800',
    opted_out: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Campaigns</h1>
          <p className="text-muted-foreground">Collect reviews via SMS and email</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Create Campaign</Button>
      </div>

      {/* Campaigns List */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="h-32 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No campaigns yet. Create your first review collection campaign!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map(campaign => (
                <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      {campaign.type === 'sms' ? <Phone className="h-5 w-5 text-primary" /> :
                       campaign.type === 'email' ? <Mail className="h-5 w-5 text-primary" /> :
                       <div className="flex gap-1"><Phone className="h-5 w-5 text-primary" /><Mail className="h-5 w-5 text-primary" /></div>}
                    </div>
                    <div>
                      <h4 className="font-medium">{campaign.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {campaign.locations?.name || 'All locations'} • {campaign.trigger_type} • {campaign.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={campaign.is_active ? 'default' : 'secondary'} className="gap-1">
                      {campaign.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedCampaign(campaign); fetchRecipients(campaign.id) }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleSend(campaign.id)} disabled={!campaign.is_active}>
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {}}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {}}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Campaign Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-2xl bg-background rounded-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <Card>
              <CardHeader>
                <CardTitle>Create Campaign</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input label="Campaign Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Summer Review Drive" />
                <Input label="Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} />

                {form.type === 'sms' || form.type === 'both' ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">SMS Template</label>
                    <Textarea
                      value={form.templateSms}
                      onChange={e => setForm(f => ({ ...f, templateSms: e.target.value }))}
                      placeholder="Hi {{name}}, thanks for visiting {{business}}! Leave a review: {{link}}"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">Variables: {{name}}, {{business}}, {{link}}</p>
                  </div>
                ) : null}

                {(form.type === 'email' || form.type === 'both') ? (
                  <div className="space-y-2">
                    <Input label="Email Subject" value={form.templateEmailSubject} onChange={e => setForm(f => ({ ...f, templateEmailSubject: e.target.value }))} placeholder="We'd love your feedback!" />
                    <label className="block text-sm font-medium">Email Body (HTML)</label>
                    <Textarea
                      value={form.templateEmailBody}
                      onChange={e => setForm(f => ({ ...f, templateEmailBody: e.target.value }))}
                      placeholder="<p>Hi {{name}},</p><p>Thanks for visiting {{business}}!</p><p><a href='{{link}}'>Leave a review</a></p>"
                      rows={5}
                    />
                  </div>
                ) : null}

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={!form.name || loading}>Create Campaign</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Recipients Detail Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedCampaign(null)}>
          <div className="w-full max-w-4xl bg-background rounded-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{selectedCampaign.name} - Recipients</CardTitle>
                  <Button onClick={() => handleSend(selectedCampaign.id)}><Send className="h-4 w-4 mr-2" />Send More</Button>
                </div>
              </CardHeader>
              <CardContent>
                {recipientLoading ? (
                  <div className="h-32 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : recipients.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No recipients yet. Click "Send More" to add customers.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="p-4 text-left text-sm font-medium text-muted-foreground">Customer</th>
                          <th className="p-4 text-left text-sm font-medium text-muted-foreground">Contact</th>
                          <th className="p-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                          <th className="p-4 text-left text-sm font-medium text-muted-foreground">Sent</th>
                          <th className="p-4 text-left text-sm font-medium text-muted-foreground">Delivered</th>
                          <th className="p-4 text-left text-sm font-medium text-muted-foreground">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipients.map(r => (
                          <tr key={r.id} className="border-b">
                            <td className="p-4 font-medium">{r.customer_name || 'Unknown'}</td>
                            <td className="p-4 text-sm text-muted-foreground">
                              {r.customer_phone && <div><Phone className="h-3 w-3 inline mr-1" />{r.customer_phone}</div>}
                              {r.customer_email && <div><Mail className="h-3 w-3 inline mr-1" />{r.customer_email}</div>}
                            </td>
                            <td className="p-4">
                              <Badge className={statusColors[r.status] || statusColors.pending}>{r.status}</Badge>
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">{r.sent_at ? formatRelativeTime(r.sent_at) : '-'}</td>
                            <td className="p-4 text-sm text-muted-foreground">{r.delivered_at ? formatRelativeTime(r.delivered_at) : '-'}</td>
                            <td className="p-4 text-sm text-destructive">{r.error_message || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}