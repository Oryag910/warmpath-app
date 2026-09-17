'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ASK_LABELS, PathSignals, TierPill } from '@/components/warm-path-card'
import type { PathSignal } from '@/lib/path-signals'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

const ASK_HINTS: Record<string, string> = {
  context_ask: 'Ask for a short chat to learn about the team. Perspective-seeking, not job-seeking.',
  advice_ask: 'Lead with the shared background and ask how they thought about a similar move.',
  referral_ask: 'Direct but not transactional: mention you applied, ask if they would be comfortable referring you.',
  intro_ask: 'Ask whether they know someone closer to the team who might be open to a brief chat.',
  recruiter_pitch: 'Mention you applied, give one line on why your background fits, ask for consideration.',
}

const CHANNEL_LABELS: Record<string, string> = { linkedin: 'LinkedIn DM', email: 'Email' }
const TYPE_LABELS: Record<string, string> = { outreach: 'First outreach', followup: 'Follow-up', referral_ask: 'Referral ask' }
const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  drafted: 'Drafted',
  sent: 'Sent',
  replied: 'Replied',
  meeting_set: 'Meeting set',
  referred: 'Referred',
  closed: 'Closed',
}
const STATUS_OPTIONS = Object.keys(STATUS_LABELS)
const TIE_LABELS: Record<string, string> = { strong: 'Strong tie', medium: 'Medium tie', weak: 'Weak tie' }

interface Props {
  job: AnyRecord
  contact: AnyRecord
  warmPath: AnyRecord
  messages: AnyRecord[]
  signals?: PathSignal[]
  demo?: boolean
  /** ISO timestamp; messages created at/after it were generated live in this session (demo only) */
  liveSince?: string | null
}

export default function MessageWorkspace({ job, contact, warmPath, messages, signals = [], demo = false, liveSince = null }: Props) {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [interpreting, setInterpreting] = useState(false)
  const [replyAnalysis, setReplyAnalysis] = useState<{ sentiment: string; suggestedNextStep: string } | null>(null)
  const [status, setStatus] = useState(warmPath.status)
  const [channel, setChannel] = useState<'linkedin' | 'email'>('linkedin')
  const [msgType, setMsgType] = useState<'outreach' | 'followup' | 'referral_ask'>('outreach')
  const latestId: string | null = messages.length ? messages[messages.length - 1].id : null
  const [activeTab, setActiveTab] = useState<string | null>(latestId)
  // A freshly generated draft arrives via router.refresh(); jump to it so the result is visible
  useEffect(() => { setActiveTab(latestId) }, [latestId])

  const liveSinceMs = liveSince ? new Date(liveSince).getTime() : null
  function isLive(msg: AnyRecord): boolean {
    return liveSinceMs !== null && new Date(msg.createdAt).getTime() >= liveSinceMs
  }

  async function generateMessage() {
    setGenerating(true)
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warmPathId: warmPath.id, channel, messageType: msgType }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to generate message')
      setGenerating(false)
      return
    }
    toast.success('Draft ready')
    setGenerating(false)
    router.refresh()
  }

  async function markSent(messageId: string) {
    await fetch(`/api/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent' }),
    })
    toast.success('Marked as sent')
    router.refresh()
  }

  async function interpretReply(messageId: string) {
    if (!replyText.trim()) return
    setInterpreting(true)
    const res = await fetch('/api/replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, replyText }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to interpret reply')
      setInterpreting(false)
      return
    }
    const data = await res.json()
    setReplyAnalysis({ sentiment: data.sentiment, suggestedNextStep: data.suggestedNextStep })
    setInterpreting(false)
    router.refresh()
  }

  async function updateStatus(newStatus: string | null) {
    if (!newStatus) return
    await fetch(`/api/warm-paths/${warmPath.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setStatus(newStatus)
    toast.success('Status updated')
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const sentimentColors: Record<string, string> = {
    positive: 'bg-emerald-50 text-emerald-800',
    neutral: 'bg-amber-50 text-amber-800',
    negative: 'bg-red-50 text-red-800',
  }

  const askLabel = warmPath.recommendedAsk ? ASK_LABELS[warmPath.recommendedAsk] ?? warmPath.recommendedAsk : null

  return (
    <div className="space-y-8">
      {/* Person */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{contact.name}</h1>
            <TierPill score={warmPath.relevanceScore} />
          </div>
          <p className="text-sm text-muted-foreground">
            {contact.title ?? ''}{contact.title && contact.company ? ' · ' : ''}{contact.company ?? ''}
            {contact.relationshipStrength && ` · ${TIE_LABELS[contact.relationshipStrength] ?? contact.relationshipStrength}`}
            {' · '}
            <Link href={`/contacts/${contact.id}`} className="underline underline-offset-4 hover:text-foreground">View profile</Link>
          </p>
          <PathSignals signals={signals} className="pt-1" />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Status</span>
          <Select value={status} onValueChange={updateStatus}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue>{STATUS_LABELS[String(status)] ?? String(status).replace(/_/g, ' ')}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </header>

      {/* Why this person → what to ask */}
      {(warmPath.scoreReasoning || warmPath.nextAction) && (
        <section aria-labelledby="why-heading" className="rounded-xl border border-border bg-muted/30 p-5 space-y-4">
          <div>
            <h2 id="why-heading" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Why this person
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">for {job.title} at {job.company}</p>
          </div>
          {warmPath.scoreReasoning && (
            <p className="text-sm leading-relaxed text-foreground/90">{warmPath.scoreReasoning}</p>
          )}
          {warmPath.nextAction && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Next move</p>
              <p className="mt-0.5 text-sm font-medium leading-relaxed">{warmPath.nextAction}</p>
            </div>
          )}
          {askLabel && (
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-border pt-3">
              <Badge variant="secondary" className="shrink-0">{askLabel}</Badge>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {ASK_HINTS[warmPath.recommendedAsk] ?? ''}
                {warmPath.referralReadiness && (
                  <> Referral readiness: <span className="capitalize text-foreground/80">{String(warmPath.referralReadiness).replace(/_/g, ' ')}</span>.</>
                )}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Compose */}
      <section aria-labelledby="compose-heading" className="space-y-3">
        <div>
          <h2 id="compose-heading" className="text-lg font-semibold tracking-tight">Draft outreach</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            WarmPath writes the draft from the reasoning above{askLabel ? ` as a ${askLabel.toLowerCase()}` : ''}. Pick a channel and message type.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Select value={channel} onValueChange={v => v && setChannel(v as 'linkedin' | 'email')}>
            <SelectTrigger className="w-36" aria-label="Channel">
              <SelectValue>{CHANNEL_LABELS[channel]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linkedin">LinkedIn DM</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
          <Select value={msgType} onValueChange={v => v && setMsgType(v as 'outreach' | 'followup' | 'referral_ask')}>
            <SelectTrigger className="w-40" aria-label="Message type">
              <SelectValue>{TYPE_LABELS[msgType]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="outreach">First outreach</SelectItem>
              <SelectItem value="followup">Follow-up</SelectItem>
              <SelectItem value="referral_ask">Referral ask</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={generateMessage} disabled={generating}>
            {generating ? (
              <>
                <span className="size-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
                Writing…
              </>
            ) : 'Generate'}
          </Button>
        </div>
        {generating && (
          <p className="text-xs text-muted-foreground" role="status">
            Drafting a {CHANNEL_LABELS[channel].toLowerCase()} to {contact.name.split(' ')[0]}. Usually under ten seconds.
          </p>
        )}
      </section>

      {/* Drafts */}
      {messages.length > 0 && (
        <section aria-labelledby="drafts-heading" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="drafts-heading" className="text-lg font-semibold tracking-tight">Drafts</h2>
            {demo && (
              <p className="text-xs text-muted-foreground">
                Pre-generated drafts were written when the demo network was seeded. Live drafts are written on the spot.
              </p>
            )}
          </div>
          <Tabs value={activeTab ?? undefined} onValueChange={v => setActiveTab(String(v))}>
            <TabsList className="h-auto flex-wrap gap-1">
              {messages.map((msg, i) => (
                <TabsTrigger key={msg.id} value={msg.id} className="text-xs">
                  {i + 1}. {CHANNEL_LABELS[msg.channel] ?? msg.channel} · {TYPE_LABELS[msg.messageType] ?? msg.messageType}
                  {msg.status === 'sent' && ' ✓'}
                </TabsTrigger>
              ))}
            </TabsList>

            {messages.map(msg => (
              <TabsContent key={msg.id} value={msg.id} className="mt-3 space-y-3">
                <article className="rounded-xl border border-border bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 sm:px-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {CHANNEL_LABELS[msg.channel] ?? msg.channel} · {TYPE_LABELS[msg.messageType] ?? msg.messageType}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {demo && (
                        <Badge variant="outline" className="text-xs">{isLive(msg) ? 'Generated live' : 'Pre-generated'}</Badge>
                      )}
                      <Badge variant={msg.status === 'sent' ? 'default' : 'secondary'} className="text-xs capitalize">
                        {msg.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-4 px-4 py-4 sm:px-5">
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{msg.body}</pre>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(msg.body)}>
                        Copy
                      </Button>
                      {msg.status !== 'sent' && (
                        <Button size="sm" onClick={() => markSent(msg.id)}>Mark sent</Button>
                      )}
                    </div>
                  </div>
                </article>

                {/* Reply interpreter */}
                {msg.status === 'sent' && (
                  <div className="rounded-xl border border-border bg-card px-4 py-4 sm:px-5 space-y-3">
                    <div>
                      <h3 className="text-sm font-medium">Got a reply?</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">Paste it and WarmPath reads the tone and suggests the next step.</p>
                    </div>
                    <Textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder={`Paste ${contact.name.split(' ')[0]}'s reply here…`}
                      className="min-h-24 resize-none text-sm"
                    />
                    <Button size="sm" onClick={() => interpretReply(msg.id)} disabled={interpreting || !replyText.trim()}>
                      {interpreting ? 'Reading…' : 'Interpret reply'}
                    </Button>
                    {replyAnalysis && (
                      <div className="space-y-2 pt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${sentimentColors[replyAnalysis.sentiment] ?? ''}`}>
                          {replyAnalysis.sentiment}
                        </span>
                        <p className="text-sm font-medium">{replyAnalysis.suggestedNextStep}</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </section>
      )}
    </div>
  )
}
