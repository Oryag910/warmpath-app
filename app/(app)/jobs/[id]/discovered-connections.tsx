'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const STATUS_LABELS: Record<string, string> = {
  identified: 'Identified',
  intro_requested: 'Asked',
  connected: 'Connected',
  dead_end: 'Dead end',
}

const STATUS_NEXT: Record<string, string> = {
  identified: 'intro_requested',
  intro_requested: 'connected',
}

const STATUS_NEXT_LABEL: Record<string, string> = {
  identified: 'Mark asked',
  intro_requested: 'Mark connected',
}

interface UserProfile {
  schools: any[]
  pastCompanies: any[]
  organizations: any[]
}

interface Props {
  jobId: string
  companySlug: string
  discovered: any[]
  contacts: any[]
  user: UserProfile
  warmPathCount: number
}

function normStr(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

function worksAtCompany(contact: any, companySlug: string): boolean {
  if (!contact.company) return false
  const slug = companySlug.toLowerCase().replace(/-/g, ' ')
  const co = contact.company.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  return co.includes(slug) || slug.includes(co)
}

function BridgeSelect({ contacts, companySlug, loading, onChange, placeholder }: {
  contacts: any[]
  companySlug: string
  loading: boolean
  onChange: (id: string) => void
  placeholder: string
}) {
  const atCompany = contacts.filter(c => worksAtCompany(c, companySlug))
  const others = contacts.filter(c => !worksAtCompany(c, companySlug))
  return (
    <select
      className="text-xs border rounded px-1.5 py-0.5 bg-background text-muted-foreground"
      defaultValue=""
      onChange={e => { if (e.target.value) onChange(e.target.value) }}
      disabled={loading}
    >
      <option value="" disabled>{placeholder}</option>
      {atCompany.length > 0 && (
        <optgroup label={`Works at ${companySlug}`}>
          {atCompany.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>
          ))}
        </optgroup>
      )}
      <optgroup label={atCompany.length > 0 ? 'Other contacts' : 'All contacts'}>
        {others.map((c: any) => (
          <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>
        ))}
      </optgroup>
    </select>
  )
}

function toStringArray(val: any): string[] {
  if (!Array.isArray(val)) return []
  return val.map((v: any) => (typeof v === 'string' ? v : v?.name ?? '')).filter(Boolean)
}

function computeCommonalities(user: UserProfile, bridge: any): string[] {
  const result: string[] = []

  const userSchools = toStringArray(user.schools)
  const bridgeSchools: string[] = Array.isArray(bridge.educationHistory)
    ? bridge.educationHistory.map((e: any) => e.school ?? '').filter(Boolean)
    : []
  for (const us of userSchools) {
    if (bridgeSchools.some(bs => normStr(bs).includes(normStr(us)) || normStr(us).includes(normStr(bs)))) {
      result.push(us)
    }
  }

  const userCompanies = toStringArray(user.pastCompanies)
  const bridgeCompanies: string[] = Array.isArray(bridge.employmentHistory)
    ? bridge.employmentHistory.map((e: any) => e.company ?? '').filter(Boolean)
    : []
  for (const uc of userCompanies) {
    if (bridgeCompanies.some(bc => normStr(bc).includes(normStr(uc)) || normStr(uc).includes(normStr(bc)))) {
      result.push(`ex-${uc}`)
    }
  }

  const userOrgs = toStringArray(user.organizations)
  const bridgeOrgs: string[] = Array.isArray(bridge.organizations)
    ? bridge.organizations.map((o: any) => (typeof o === 'string' ? o : o?.name ?? '')).filter(Boolean)
    : []
  for (const uo of userOrgs) {
    if (bridgeOrgs.some(bo => normStr(bo).includes(normStr(uo)) || normStr(uo).includes(normStr(bo)))) {
      result.push(uo)
    }
  }

  return result
}

function whySuggested(dc: any, bridge: any | null, commonalities: string[]): string {
  const name = bridge?.name ?? dc.mutualContactName
  if (!name) return `2nd-degree connection at ${dc.companySlug}`
  if (commonalities.length >= 2) {
    return `2nd degree via ${name} — strong bridge (${commonalities.length} shared affiliations)`
  }
  if (commonalities.length === 1) {
    return `2nd degree via ${name} — you share ${commonalities[0]} with your bridge contact`
  }
  if (bridge?.schoolOverlap) {
    return `2nd degree via ${name} — bridge contact shares your school background`
  }
  return `2nd degree via ${name} — your bridge contact knows this person at the company`
}

function actionableStep(dc: any, bridge: any | null): string {
  const bridgeName = bridge?.name ?? dc.mutualContactName ?? 'your mutual connection'
  switch (dc.status) {
    case 'identified': return `Ask ${bridgeName} to introduce you to ${dc.name}`
    case 'intro_requested': return `Follow up with ${bridgeName} in 5–7 days if no response`
    case 'connected': return `Send ${dc.name} a personalized outreach message on LinkedIn`
    default: return ''
  }
}

export default function DiscoveredConnections({ jobId, companySlug, discovered, contacts, user, warmPathCount }: Props) {
  const [items, setItems] = useState<any[]>(discovered)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [reranking, setReranking] = useState(false)

  async function rerank() {
    setReranking(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/discovered-contacts`, { method: 'POST' })
      if (!res.ok) { toast.error('Re-rank failed'); return }
      const survivors = await res.json()
      setItems(survivors)
      toast.success(`Re-ranked — showing top ${survivors.filter((i: any) => i.status === 'identified').length} connections`)
    } finally {
      setReranking(false)
    }
  }

  async function updateStatus(dc: any, newStatus: string) {
    setLoadingId(dc.id)
    try {
      const res = await fetch(`/api/jobs/${jobId}/discovered-contacts/${dc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) { toast.error('Update failed'); return }
      setItems(prev => prev.map(i => i.id === dc.id ? { ...i, status: newStatus } : i))
    } finally {
      setLoadingId(null)
    }
  }

  async function updateBridge(dc: any, mutualContactId: string) {
    setLoadingId(dc.id)
    try {
      const res = await fetch(`/api/jobs/${jobId}/discovered-contacts/${dc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mutualContactId }),
      })
      if (!res.ok) { toast.error('Update failed'); return }
      const contact = contacts.find(c => c.id === mutualContactId)
      setItems(prev => prev.map(i => i.id === dc.id
        ? { ...i, mutualContactId, mutualContact: contact }
        : i))
    } finally {
      setLoadingId(null)
    }
  }

  async function dismiss(dc: any) {
    setLoadingId(dc.id)
    try {
      await fetch(`/api/jobs/${jobId}/discovered-contacts/${dc.id}`, { method: 'DELETE' })
      setItems(prev => prev.filter(i => i.id !== dc.id))
    } finally {
      setLoadingId(null)
    }
  }

  const active = items.filter(i => i.status !== 'dead_end')
  const deadEnds = items.filter(i => i.status === 'dead_end')

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">
              2nd-degree connections at this company
              {active.length > 0 && (
                <span className="ml-2 text-muted-foreground font-normal">({active.length})</span>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              People your contacts know who work here — discovered via LinkedIn.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {items.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 shrink-0"
                disabled={reranking}
                onClick={rerank}
              >
                {reranking ? 'Re-ranking…' : 'Re-rank'}
              </Button>
            )}
            {warmPathCount === 0 && items.length > 0 && (
              <p className="text-xs text-muted-foreground text-right">
                Rank contacts first to improve re-ranking.
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">No 2nd-degree connections discovered yet.</p>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Run this command to discover them:</p>
              <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto">
                {`COMPANY=${companySlug} JOB_ID=${jobId} npm run linkedin:discover`}
              </pre>
              <p className="text-xs text-muted-foreground mt-1">
                Replace <code>{companySlug}</code> with the company&apos;s LinkedIn URL slug
                (e.g. &ldquo;stripe&rdquo;, &ldquo;palantir-technologies&rdquo;).
              </p>
            </div>
          </div>
        )}

        {active.length > 0 && (
          <div className="space-y-3">
            {active.map(dc => {
              const bridge = dc.mutualContact ?? contacts.find((c: any) => c.id === dc.mutualContactId)
              const commonalities = bridge ? computeCommonalities(user, bridge) : []
              const why = whySuggested(dc, bridge, commonalities)
              const step = actionableStep(dc, bridge)
              const loading = loadingId === dc.id

              return (
                <div key={dc.id} className="p-4 rounded-lg border space-y-2.5">
                  {/* Name + status */}
                  <div className="flex items-start justify-between gap-3">
                    <a
                      href={dc.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline"
                    >
                      {dc.name} ↗
                    </a>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {STATUS_LABELS[dc.status] ?? dc.status}
                    </Badge>
                  </div>

                  {/* Current role */}
                  {dc.title && (
                    <p className="text-xs text-muted-foreground">{dc.title}</p>
                  )}

                  {/* Bridge */}
                  <div className="space-y-1">
                    {bridge ? (
                      <>
                        <p className="text-xs">
                          <span className="text-muted-foreground">Bridge: </span>
                          <Link href={`/contacts/${bridge.id}`} className="font-medium hover:underline">
                            {bridge.name}
                          </Link>
                          {bridge.headline && (
                            <span className="text-muted-foreground"> · {bridge.headline}</span>
                          )}
                          {' · '}
                          <Link
                            href={`/jobs/${jobId}/messages/${bridge.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            draft intro request →
                          </Link>
                        </p>
                        {commonalities.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            You have in common: {commonalities.join(' · ')}
                          </p>
                        )}
                      </>
                    ) : dc.mutualContactName ? (
                      <div className="space-y-1.5">
                        <p className="text-xs">
                          <span className="text-muted-foreground">Bridge: </span>
                          <span className="font-medium">{dc.mutualContactName}</span>
                          <span className="text-muted-foreground"> — not in your contacts</span>
                        </p>
                        <BridgeSelect
                          contacts={contacts}
                          companySlug={companySlug}
                          loading={loading}
                          onChange={id => updateBridge(dc, id)}
                          placeholder="Assign a contact as bridge…"
                        />
                      </div>
                    ) : (
                      <BridgeSelect
                        contacts={contacts}
                        companySlug={companySlug}
                        loading={loading}
                        onChange={id => updateBridge(dc, id)}
                        placeholder="Assign bridge contact…"
                      />
                    )}
                  </div>

                  {/* Why suggested */}
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Why: </span>{why}
                  </p>

                  {/* Next step */}
                  {step && (
                    <p className="text-xs">
                      <span className="text-muted-foreground font-medium">Next: </span>{step}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {STATUS_NEXT[dc.status] && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        disabled={loading}
                        onClick={() => updateStatus(dc, STATUS_NEXT[dc.status])}
                      >
                        {STATUS_NEXT_LABEL[dc.status]}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 text-muted-foreground hover:text-destructive"
                      disabled={loading}
                      onClick={() => updateStatus(dc, 'dead_end')}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {active.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Re-run to discover more:</p>
            <pre className="text-xs bg-muted rounded-md p-2 overflow-x-auto">
              {`COMPANY=${companySlug} JOB_ID=${jobId} npm run linkedin:discover`}
            </pre>
          </div>
        )}

        {deadEnds.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              {deadEnds.length} dismissed
            </summary>
            <div className="mt-2 space-y-1 pl-2">
              {deadEnds.map(dc => (
                <div key={dc.id} className="flex items-center gap-2">
                  <span>{dc.name}{dc.title ? ` · ${dc.title}` : ''}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 text-xs px-1"
                    onClick={() => updateStatus(dc, 'identified')}
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
