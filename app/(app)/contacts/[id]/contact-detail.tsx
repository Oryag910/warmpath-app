'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Added manually',
  linkedin_csv: 'LinkedIn import',
  apollo: 'Apollo',
  demo: 'Synthetic contact',
}

const TIE_LABELS: Record<string, string> = { strong: 'Strong tie', medium: 'Medium tie', weak: 'Weak tie' }

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  drafted: 'Drafted',
  sent: 'Sent',
  replied: 'Replied',
  meeting_set: 'Meeting set',
  referred: 'Referred',
  closed: 'Closed',
}

interface Props {
  contact: any
  warmPaths: any[]
}

export default function ContactDetail({ contact: initial, warmPaths }: Props) {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const c = initial

  const employment: any[] = Array.isArray(c.employmentHistory) ? c.employmentHistory : []
  const education: any[] = Array.isArray(c.educationHistory) ? c.educationHistory : []
  const skills: string[] = Array.isArray(c.skills) ? c.skills : []
  const orgs: any[] = Array.isArray(c.organizations) ? c.organizations : []
  const isEnriched = !!c.enrichedAt && !(c.linkedinProfile as any)?.unavailable

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/contacts/${c.id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Failed to delete contact')
        return
      }
      router.push('/contacts')
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/contacts" className="hover:text-foreground">Contacts</Link>
        <span>/</span>
        <span>{c.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
          {(c.title || c.company) && (
            <p className="text-muted-foreground">
              {c.title ?? ''}{c.company ? ` · ${c.company}` : ''}
            </p>
          )}
          {c.headline && c.headline !== `${c.title ?? ''} at ${c.company ?? ''}` && (
            <p className="text-sm text-muted-foreground">{c.headline}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {c.location && <Badge variant="outline" className="text-xs">{c.location}</Badge>}
            <Badge variant="outline" className="text-xs">{TIE_LABELS[c.relationshipStrength] ?? c.relationshipStrength}</Badge>
            <Badge variant="secondary" className="text-xs">{SOURCE_LABELS[c.source] ?? c.source}</Badge>
            {isEnriched && c.source !== 'demo' && <Badge variant="outline" className="text-xs">Profile enriched</Badge>}
            {c.schoolOverlap && <Badge className="text-xs">Shared school</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {c.linkedinUrl && (
            <a
              href={c.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              LinkedIn ↗
            </a>
          )}
        </div>
      </div>

      {/* Employment History */}
      {employment.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Experience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {employment.map((e, i) => (
              <div key={i} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{e.company}</p>
                  {e.title && <p className="text-xs text-muted-foreground">{e.title}</p>}
                </div>
                {e.dateRange && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">{e.dateRange}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Education History */}
      {education.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Education</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {education.map((e, i) => (
              <div key={i} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{e.school}</p>
                  {e.degree && <p className="text-xs text-muted-foreground">{e.degree}</p>}
                </div>
                {e.dateRange && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">{e.dateRange}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Skills & Organizations */}
      {(skills.length > 0 || orgs.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Skills &amp; Organizations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {skills.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            {orgs.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Organizations</p>
                <div className="flex flex-wrap gap-1.5">
                  {orgs.map((o, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {typeof o === 'string' ? o : o.name}
                      {o.role ? ` · ${o.role}` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Connected Jobs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Connected jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {warmPaths.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs connected yet. Add this contact to a job to start a warm path.</p>
          ) : (
            <div className="space-y-2">
              {warmPaths.map(wp => (
                <Link
                  key={wp.id}
                  href={`/jobs/${wp.jobId}/messages/${c.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{wp.job.title}</p>
                    <p className="text-xs text-muted-foreground">{wp.job.company}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{STATUS_LABELS[wp.status] ?? wp.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {c.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Delete */}
      <div className="flex justify-end pt-2">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Confirm delete'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
            Delete contact
          </Button>
        )}
      </div>
    </div>
  )
}
