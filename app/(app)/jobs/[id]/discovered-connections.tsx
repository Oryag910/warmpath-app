'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

interface Props {
  jobId: string
  companySlug: string
  discovered: any[]
  contacts: any[] // user's contacts for bridge selection
}

export default function DiscoveredConnections({ jobId, companySlug, discovered, contacts }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<any[]>(discovered)
  const [loadingId, setLoadingId] = useState<string | null>(null)

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
          <div className="space-y-2">
            {active.map(dc => {
              const bridge = dc.mutualContact ?? contacts.find((c: any) => c.id === dc.mutualContactId)
              const loading = loadingId === dc.id
              return (
                <div key={dc.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={dc.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:underline"
                      >
                        {dc.name} ↗
                      </a>
                      <Badge variant="outline" className="text-xs">{STATUS_LABELS[dc.status] ?? dc.status}</Badge>
                    </div>
                    {dc.title && (
                      <p className="text-xs text-muted-foreground mt-0.5">{dc.title}</p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      {bridge ? (
                        <span className="text-xs text-muted-foreground">
                          Bridge:{' '}
                          <Link href={`/contacts/${bridge.id}`} className="hover:underline font-medium">
                            {bridge.name}
                          </Link>
                          {' '}→{' '}
                          <Link
                            href={`/jobs/${jobId}/messages/${bridge.id}`}
                            className="text-xs hover:underline text-blue-600"
                          >
                            draft intro request →
                          </Link>
                        </span>
                      ) : (
                        <select
                          className="text-xs border rounded px-1.5 py-0.5 bg-background text-muted-foreground"
                          defaultValue=""
                          onChange={e => { if (e.target.value) updateBridge(dc, e.target.value) }}
                          disabled={loading}
                        >
                          <option value="" disabled>Assign bridge contact…</option>
                          {contacts.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
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

        {active.length > 0 && items.length === 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Re-run to find more:</p>
            <pre className="text-xs bg-muted rounded-md p-2 overflow-x-auto">
              {`COMPANY=${companySlug} JOB_ID=${jobId} npm run linkedin:discover`}
            </pre>
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
