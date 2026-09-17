import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
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

// Deterministic facts about the contact (chips). Colour = kind of evidence, so a reader can
// tell company overlap from affiliation overlap from relationship strength at a glance.
const SIGNAL_COLORS: Record<PathSignal['kind'], string> = {
  company: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  past_company: 'border-sky-200 bg-sky-50 text-sky-800',
  school: 'border-violet-200 bg-violet-50 text-violet-800',
  org: 'border-violet-200 bg-violet-50 text-violet-800',
  tie: 'border-border bg-muted text-muted-foreground',
}

export type Tier = 'strong' | 'good' | 'weak'

export function tierOf(score: number | null | undefined): Tier {
  const s = score ?? 0
  if (s >= 0.75) return 'strong'
  if (s >= RECOMMEND_THRESHOLD) return 'good'
  return 'weak'
}

export function tierLabel(score: number | null | undefined): string {
  return TIER_LABELS[tierOf(score)]
}

const TIER_LABELS: Record<Tier, string> = {
  strong: 'Strong path',
  good: 'Good path',
  weak: 'Not recommended',
}

const TIER_STYLES: Record<Tier, string> = {
  strong: 'bg-foreground text-background',
  good: 'bg-muted text-foreground',
  weak: 'border border-border text-muted-foreground',
}

/** Model-judged tier for this path, shown as a small pill. */
export function TierPill({ score, className = '' }: { score: number | null | undefined; className?: string }) {
  const tier = tierOf(score)
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TIER_STYLES[tier]} ${className}`}>
      {TIER_LABELS[tier]}
    </span>
  )
}

export function PathSignals({ signals, className = '' }: { signals: PathSignal[]; className?: string }) {
  if (signals.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {signals.map(s => (
        <span key={s.label} className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${SIGNAL_COLORS[s.kind]}`}>
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

/**
 * One ranked warm path. Reads top to bottom as: who (facts) → why (model reasoning) →
 * what to do (next move + draft). Single column so it holds up at 375px.
 */
export default function WarmPathCard({ rank, warmPath: wp, job, user, compact = false }: Props) {
  const c = wp.contact
  const signals = pathSignals(c, { company: String(job.company) }, user)
  const href = `/jobs/${job.id}/messages/${c.id}`
  const hasDraft = Boolean(wp.messages?.length)

  return (
    <article className={`rounded-xl border bg-card ${compact ? 'border-border/70 px-4 py-3 sm:px-5' : 'border-border px-4 py-4 sm:px-5 sm:py-5 shadow-xs'}`}>
      <div className="flex gap-3 sm:gap-4">
        <span
          aria-label={`Rank ${rank}`}
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground"
        >
          {rank}
        </span>

        <div className="min-w-0 flex-1 space-y-3">
          {/* Who */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className={`font-semibold leading-tight ${compact ? 'text-sm' : 'text-base'}`}>
                <Link href={`/contacts/${c.id}`} className="hover:underline underline-offset-4">{c.name}</Link>
              </h3>
              <TierPill score={wp.relevanceScore} />
            </div>
            <p className="text-sm text-muted-foreground">
              {c.title ?? ''}{c.title && c.company ? ' · ' : ''}{c.company ?? ''}
            </p>
            <PathSignals signals={signals} className="pt-1" />
          </div>

          {/* Why */}
          {wp.scoreReasoning && (
            <p className={`text-sm leading-relaxed ${compact ? 'text-muted-foreground' : 'text-foreground/80'}`}>
              {wp.scoreReasoning}
            </p>
          )}

          {/* What to do */}
          {!compact && wp.nextAction && (
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Next move</p>
              <p className="mt-0.5 text-sm font-medium leading-relaxed">{wp.nextAction}</p>
            </div>
          )}

          {!compact && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5">
              <Link href={href} className={buttonVariants({ size: 'sm', variant: hasDraft ? 'default' : 'outline' })}>
                {hasDraft ? 'Open outreach draft' : 'Draft outreach'}
              </Link>
              {wp.recommendedAsk && (
                <span className="text-xs text-muted-foreground">
                  Recommended ask:{' '}
                  <span className="font-medium text-foreground">{ASK_LABELS[wp.recommendedAsk] ?? wp.recommendedAsk}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
