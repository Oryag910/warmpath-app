'use client'

import { useState, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface School {
  name: string
  graduationYear?: number
}

interface Props {
  initialSchools: School[]
  initialPastCompanies: string[]
  initialOrganizations: string[]
}

function ChipList({ items, onRemove }: { items: string[]; onRemove: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <Badge key={i} variant="secondary" className="gap-1 pr-1">
          {item}
          <button onClick={() => onRemove(i)} className="ml-1 rounded-full hover:bg-muted-foreground/20 px-0.5">×</button>
        </Badge>
      ))}
    </div>
  )
}

function AddChip({ placeholder, onAdd }: { placeholder: string; onAdd: (val: string) => void }) {
  const [val, setVal] = useState('')
  function commit() {
    const trimmed = val.trim()
    if (trimmed) { onAdd(trimmed); setVal('') }
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
  }
  return (
    <div className="flex gap-2">
      <Input value={val} onChange={e => setVal(e.target.value)} onKeyDown={onKey} placeholder={placeholder} className="max-w-xs" />
      <Button type="button" variant="outline" size="sm" onClick={commit}>Add</Button>
    </div>
  )
}

export default function ProfileForm({ initialSchools, initialPastCompanies, initialOrganizations }: Props) {
  const [schools, setSchools] = useState<School[]>(initialSchools)
  const [schoolInput, setSchoolInput] = useState('')
  const [yearInput, setYearInput] = useState('')
  const [pastCompanies, setPastCompanies] = useState<string[]>(initialPastCompanies)
  const [organizations, setOrganizations] = useState<string[]>(initialOrganizations)
  const [saving, setSaving] = useState(false)

  function addSchool() {
    const name = schoolInput.trim()
    if (!name) return
    const year = yearInput.trim() ? parseInt(yearInput.trim()) : undefined
    setSchools(prev => [...prev, { name, ...(year && { graduationYear: year }) }])
    setSchoolInput('')
    setYearInput('')
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schools, pastCompanies, organizations }),
      })
      if (!res.ok) { toast.error('Failed to save profile'); return }
      toast.success('Profile saved')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Schools attended</CardTitle>
          <p className="text-sm text-muted-foreground">Used to auto-flag contacts who went to the same school.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <ChipList
            items={schools.map(s => s.graduationYear ? `${s.name} '${String(s.graduationYear).slice(-2)}` : s.name)}
            onRemove={i => setSchools(prev => prev.filter((_, idx) => idx !== i))}
          />
          <div className="flex gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">School name</Label>
              <Input value={schoolInput} onChange={e => setSchoolInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSchool() } }} placeholder="NYU, Cornell…" className="w-48" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Grad year (optional)</Label>
              <Input value={yearInput} onChange={e => setYearInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSchool() } }} placeholder="2026" className="w-24" />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addSchool}>Add</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Past companies</CardTitle>
          <p className="text-sm text-muted-foreground">Contacts who worked at the same companies can provide inside context.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <ChipList items={pastCompanies} onRemove={i => setPastCompanies(prev => prev.filter((_, idx) => idx !== i))} />
          <AddChip placeholder="Google, Stripe…" onAdd={v => setPastCompanies(prev => [...prev, v])} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Organizations & affiliations</CardTitle>
          <p className="text-sm text-muted-foreground">Volunteer orgs, sports teams, clubs, fraternities/sororities, interest groups — shared membership warms a cold contact.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <ChipList items={organizations} onRemove={i => setOrganizations(prev => prev.filter((_, idx) => idx !== i))} />
          <AddChip placeholder="Hillel, Soccer Club, HackNY…" onAdd={v => setOrganizations(prev => [...prev, v])} />
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button>
    </div>
  )
}
