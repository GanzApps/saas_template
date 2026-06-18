'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Badge, Textarea } from '@saas/ui'
import { Plus, Edit, Trash2, Copy, Check, Loader2 } from 'lucide-react'

interface Template {
  id: string
  name: string
  content: string
  category: string | null
  is_default: boolean
  usage_count: number
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)

  const [form, setForm] = useState({
    name: '',
    content: '',
    category: 'custom' as 'positive' | 'negative' | 'neutral' | 'custom',
  })

  async function fetchTemplates() {
    setLoading(true)
    try {
      const res = await fetch('/api/templates')
      if (res.ok) setTemplates(await res.json())
    } catch (err) {
      console.error('Failed to fetch templates:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.content.trim()) return

    try {
      const url = editingTemplate ? `/api/templates/${editingTemplate.id}` : '/api/templates'
      const method = editingTemplate ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowCreate(false)
        setEditingTemplate(null)
        setForm({ name: '', content: '', category: 'custom' })
        fetchTemplates()
      }
    } catch (err) {
      console.error('Failed to save template:', err)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return
    try {
      await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      fetchTemplates()
    } catch (err) {
      console.error('Failed to delete template:', err)
    }
  }

  async function copyToClipboard(content: string) {
    await navigator.clipboard.writeText(content)
    // TODO: Show toast
  }

  useEffect(() => { fetchTemplates() }, [])

  const categoryColors: Record<string, string> = {
    positive: 'bg-green-100 text-green-800',
    negative: 'bg-red-100 text-red-800',
    neutral: 'bg-yellow-100 text-yellow-800',
    custom: 'bg-gray-100 text-gray-800',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Response Templates</h1>
          <p className="text-muted-foreground">Save and reuse common review responses</p>
        </div>
        <Button onClick={() => { setEditingTemplate(null); setForm({ name: '', content: '', category: 'custom' }); setShowCreate(true) }}>
          <Plus className="h-4 w-4 mr-2" />Create Template
        </Button>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-8">
            <p className="text-muted-foreground mb-4">No templates yet. Create your first saved response!</p>
            <Button onClick={() => setShowCreate(true)}>Create Template</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <Card key={template.id} className="relative">
              {template.is_default && (
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" />Default
                  </Badge>
                </div>
              )}
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium">{template.name}</h4>
                    <Badge className={categoryColors[template.category || 'custom']} className="mt-1">
                      {template.category?.charAt(0).toUpperCase() + template.category?.slice(1) || 'Custom'}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">Used {template.usage_count}x</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{template.content}</p>
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(template.content)}>
                    <Copy className="h-4 w-4 mr-1" />Copy
                  </Button>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => {
                      setEditingTemplate(template)
                      setForm({ name: template.name, content: template.content, category: template.category as any })
                      setShowCreate(true)
                    }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreate || editingTemplate) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setShowCreate(false); setEditingTemplate(null); setForm({ name: '', content: '', category: 'custom' }) }}>
          <div className="w-full max-w-xl bg-background rounded-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <Card>
              <CardHeader>
                <CardTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Thank you for 5 stars!" />
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))}
                  className="flex h-10 w-full items-center px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="positive">Positive (5-4 stars)</option>
                  <option value="neutral">Neutral (3 stars)</option>
                  <option value="negative">Negative (1-2 stars)</option>
                  <option value="custom">Custom</option>
                </select>
                <label className="block text-sm font-medium">Response Text</label>
                <Textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Thank you for the kind words! We're thrilled you had a great experience..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">Variables: {{name}}, {{business}}, {{rating}}, {{review_text}}</p>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => { setShowCreate(false); setEditingTemplate(null); setForm({ name: '', content: '', category: 'custom' }) }}>Cancel</Button>
                  <Button onClick={handleSubmit} disabled={!form.name.trim() || !form.content.trim() || loading}>
                    {editingTemplate ? 'Save Changes' : 'Create Template'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}