'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { LinkedInRow } from '@/lib/linkedin-csv'

interface Props {
  contacts: any[]
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  linkedin_csv: 'LinkedIn',
  apollo: 'Apollo',
}

function isTrulyEnriched(c: any) {
  return !!c.enrichedAt && !(c.linkedinProfile as any)?.unavailable
}

function parseLinkedInCsv(text: string): LinkedInRow[] {
  const lines = text.split(/\r?\n/)
  const headerIdx = lines.findIndex(l => /(^|,)\s*"?First Name"?\s*(,|$)/i.test(l))
  const body = headerIdx >= 0 ? lines.slice(headerIdx).join('\n') : text
  const parsed = Papa.parse<Record<string, string>>(body, { header: true, skipEmptyLines: true })
  return (parsed.data ?? []).map(r => ({
    firstName: r['First Name'],
    lastName: r['Last Name'],
    url: r['URL'],
    email: r['Email Address'],
    company: r['Company'],
    position: r['Position'],
    connectedOn: r['Connected On'],
  }))
}

const EMPTY_FORM = { name: '', title: '', company: '' }

export default function ContactsDashboard({ contacts }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  async function deleteContact(contactId: string) {
    const res = await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Failed to delete contact')
      return
    }
    setConfirmingDelete(null)
    router.refresh()
  }

  function setField(field: string, value: string) {
    setManualForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...manualForm, source: 'manual', relationshipStrength: 'weak' }),
      })
      if (!res.ok) {
        toast.error('Failed to add contact')
        return
      }
      toast.success(`${manualForm.name} added`)
      setManualForm(EMPTY_FORM)
      setShowManual(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const rows = parseLinkedInCsv(text)
      if (rows.length === 0) {
        toast.error('No connections found in that file. Make sure it is the LinkedIn Connections export.')
        return
      }
      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      if (!res.ok) {
        toast.error('Import failed')
        return
      }
      const { imported, updated, skipped } = await res.json()
      toast.success(`Imported ${imported}, updated ${updated}${skipped ? `, skipped ${skipped}` : ''}`)
      router.refresh()
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const withUrl = contacts.filter(c => c.linkedinUrl)
  const enrichedCount = contacts.filter(c => isTrulyEnriched(c)).length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Import LinkedIn connections</CardTitle>
          <p className="text-sm text-muted-foreground">
            On LinkedIn: Settings &amp; Privacy → Data Privacy → Get a copy of your data → Connections → download, then upload the CSV here.
          </p>
        </CardHeader>
        <CardContent>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            disabled={importing}
            className="block text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
          />
          {importing && <p className="text-xs text-muted-foreground mt-2">Importing…</p>}
        </CardContent>
      </Card>

      {withUrl.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Profile enrichment</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ranking finds alumni and shared-affiliation paths from each connection&apos;s schools, past companies,
              and organizations. {enrichedCount} of {withUrl.length} connections with a LinkedIn URL have that history on file.
            </p>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Add contact manually</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowManual(v => !v)}>
              {showManual ? 'Cancel' : '+ Add'}
            </Button>
          </div>
        </CardHeader>
        {showManual && (
          <CardContent>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="m-name" className="text-xs">Name *</Label>
                  <Input id="m-name" value={manualForm.name} onChange={e => setField('name', e.target.value)} placeholder="Jane Smith" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="m-title" className="text-xs">Title</Label>
                  <Input id="m-title" value={manualForm.title} onChange={e => setField('title', e.target.value)} placeholder="Engineer" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="m-company" className="text-xs">Company</Label>
                  <Input id="m-company" value={manualForm.company} onChange={e => setField('company', e.target.value)} placeholder="Acme Inc." />
                </div>
              </div>
              <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Add contact'}</Button>
            </form>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">All contacts ({contacts.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {contacts.length === 0 && (
            <p className="text-sm text-muted-foreground">No contacts yet. Import a LinkedIn CSV above to get started.</p>
          )}
          {contacts.map(c => {
            const eduSchool = Array.isArray(c.educationHistory) && c.educationHistory[0]?.school
            const orgCount = Array.isArray(c.organizations) ? c.organizations.length : 0
            const enrichLine = [eduSchool, orgCount ? `${orgCount} org${orgCount !== 1 ? 's' : ''}` : null].filter(Boolean).join(' · ')
            const enriched = isTrulyEnriched(c)
            return (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
              <Link href={`/contacts/${c.id}`} className="flex-1 min-w-0 cursor-pointer">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.title ?? ''}{c.company ? ` · ${c.company}` : ''}</p>
                {enriched && enrichLine && <p className="text-xs text-muted-foreground/70 mt-0.5">{enrichLine}</p>}
              </Link>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {enriched && <Badge variant="outline" className="text-xs">Enriched</Badge>}
                <Badge variant="outline" className="text-xs capitalize">{c.relationshipStrength}</Badge>
                <Badge variant="secondary" className="text-xs">{SOURCE_LABELS[c.source] ?? c.source}</Badge>
                {confirmingDelete === c.id ? (
                  <>
                    <Button size="sm" variant="destructive" onClick={e => { e.stopPropagation(); deleteContact(c.id) }}>Confirm?</Button>
                    <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setConfirmingDelete(null) }}>Cancel</Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); setConfirmingDelete(c.id) }}>Delete</Button>
                )}
              </div>
            </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
