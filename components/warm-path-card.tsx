import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { pathSignals, RECOMMEND_THRESHOLD, type PathSignal } from '@/lib/path-signals'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

export const ASK_LABELS: Record<string, string> = {
  context_ask: 'Context ask',
  advice_ask: 'Advice ask',
  referral_ask: 'Referral ask',
  intro_ask: 'Intro ask',
  recruiter_pitch: 'Recruiter pitch',
}

export const PATH_LABELS: Record<string, string> = {
  direct: 'Direct',
  alumni: 'Alumni',
  intro: 'Intro',
  weak: 'Weak',
}

const PATH_COLORS: Record<string, string> = {
  direct: 'bg-green-100 text-green-800',
  alumni: 'bg-blue-100 text-blue-800',
  intro: 'bg-yellow-100 text-yellow-800',
  weak: 'bg-gray-100 text-gray-700',
}

const SIGNAL_COLORS: Record<PathSignal['kind'], string> = {
  company: 'border-green-300 bg-green-50 text-green-800',
  past_company: 'border-blue-300 bg-blue-50 text-blue-800',
  school: 'border-violet-300 bg-violet-50 text-violet-800',
  org: 'border-violet-300 bg-violet-50 text-violet-800',
  tie: 'border-border bg-muted text-muted-foreground',
}

export function tierLabel(score: number | null | undefined): string {
  const s = score ?? 0
  if (s >= 0.75) return 'Strong path'
  if (s >= RECOMMEND_THRESHOLD) return 'Good path'
  return 'Weak signal'
}

export function PathSignals({ signals, className = '' }: { signals: PathSignal[]; className?: string }) {
  if (signals.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {signals.map(s => (
        <span key={s.label} className={`text-xs px-2 py-0.5 rounded-full border ${SIGNAL_COLORS[s.kind]}`}>
          {s.label}
        </span>
      ))}
    </div>
  )
}

interface Props {
  rank: number
  warmPath: AnyRecord   // WarmPath with `contact` included
  job: AnyRecord
  user: AnyRecord
  compact?: boolean
}

export default function WarmPathCard({ rank, warmPath: wp, job, user, compact = false }: Props) {
  const c = wp.contact
  const signals = pathSignals(c, { company: String(job.company) }, user)
  const href = `/jobs/${job.id}/messages/${c.id}`

  return (
    <Card className={compact ? 'bg-muted/20' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-lg font-bold text-muted-foreground w-6 flex-shrink-0">{rank}</span>
            <div className="min-w-0">
              <CardTitle className="text-base">
                <Link href={`/contacts/${c.id}`} className="hover:underline">{c.name}</Link>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {c.title ?? ''}{c.company ? ` · ${c.company}` : ''}
              </p>
              <PathSignals signals={signals} className="mt-2" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className="text-xs font-medium text-muted-foreground">{tierLabel(wp.relevanceScore)}</span>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {wp.pathType && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PATH_COLORS[wp.pathType] ?? 'bg-gray-100'}`}>
                  {PATH_LABELS[wp.pathType] ?? wp.pathType}
                </span>
              )}
              {wp.recommendedAsk && !compact && (
                <Badge variant="secondary">{ASK_LABELS[wp.recommendedAsk] ?? wp.recommendedAsk}</Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      {(wp.scoreReasoning || wp.nextAction) && (
        <CardContent className="pb-4 pl-12 space-y-2">
          {wp.scoreReasoning && (
            <p className="text-sm text-muted-foreground">{wp.scoreReasoning}</p>
          )}
          {!compact && wp.nextAction && (
            <p className="text-sm font-medium">→ {wp.nextAction}</p>
          )}
          {!compact && (
            <div className="pt-1">
              <Link href={href} className="text-sm font-medium text-primary hover:underline">
                {wp.messages?.length ? 'View outreach draft →' : 'Draft outreach →'}
              </Link>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
