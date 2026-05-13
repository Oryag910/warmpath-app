'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Props {
  jobId: string
  company: string
  allContacts: any[]
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  linkedin_csv: 'LinkedIn',
  apollo: 'Apollo',
}

const emptyForm = {
  name: '',
  title: '',
  company: '',
  relationshipStrength: 'weak',
  schoolOverlap: false,
  companyOverlap: false,
  notes: '',
}

export default function ContactsClient({ jobId, company, allContacts }: Props) {
  const router = useRouter()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [discovering, setDiscovering] = useState(false)

  async function discoverContacts() {
    setDiscovering(true)
    toast.info(`Searching Apollo for people at ${company}…`)
    try {
      const res = await fetch(`/api/jobs/${jobId}/discover-contacts`, { method: 'POST' })
      if (res.status === 400) {
        toast.error("Apollo isn't configured yet — add APOLLO_API_KEY to enable this.")
        return
      }
      if (!res.ok) {
        toast.error('Contact discovery failed')
        return
      }
      const { created, matched } = await res.json()
      const total = (created?.length ?? 0) + (matched?.length ?? 0)
      toast.success(total > 0 ? `Found ${total} contact${total !== 1 ? 's' : ''} at ${company}` : `No new contacts found at ${company}`)
      router.refresh()
    } finally {
      setDiscovering(false)
    }
  }

  function set(field: string, value: string | boolean | null) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function addNewContact(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      toast.error('Failed to add contact')
      setSaving(false)
      return
    }
    const contact = await res.json()
    toast.success(`${contact.name} added`)
    setForm(emptyForm)
    setAddingNew(false)
    router.refresh()
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={discoverContacts} disabled={discovering}>
          {discovering ? 'Searching…' : `Find contacts at ${company}`}
        </Button>
        <Button variant="outline" onClick={() => router.push('/contacts')}>
          Import LinkedIn CSV
        </Button>
      </div>

      {allContacts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Your contacts ({allContacts.length})</CardTitle>
            <p className="text-sm text-muted-foreground">All contacts will be ranked when you click "Rank my connections" on the job page.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {allContacts.map(contact => (
              <div key={contact.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">{contact.name}</p>
                  <p className="text-xs text-muted-foreground">{contact.title ?? ''}{contact.company ? ` · ${contact.company}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{SOURCE_LABELS[contact.source] ?? contact.source}</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{contact.relationshipStrength}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {addingNew ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">New contact</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addNewContact} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={form.name} onChange={e => set('name', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ct-title">Title</Label>
                  <Input id="ct-title" value={form.title} onChange={e => set('title', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ct-company">Company</Label>
                  <Input id="ct-company" value={form.company} onChange={e => set('company', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Relationship strength</Label>
                  <Select value={form.relationshipStrength} onValueChange={v => set('relationshipStrength', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weak">Weak — barely know them</SelectItem>
                      <SelectItem value="medium">Medium — friendly but not close</SelectItem>
                      <SelectItem value="strong">Strong — know my work well</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.schoolOverlap} onChange={e => set('schoolOverlap', e.target.checked)} className="rounded" />
                  Same school
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.companyOverlap} onChange={e => set('companyOverlap', e.target.checked)} className="rounded" />
                  Works/worked at target company
                </label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ct-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea id="ct-notes" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="How you know them, any relevant context…" className="min-h-20 resize-none" />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add contact'}</Button>
                <Button type="button" variant="ghost" onClick={() => setAddingNew(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setAddingNew(true)}>+ Add new contact</Button>
      )}
    </div>
  )
}
