'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import Link from 'next/link'
import { PathSignals, tierLabel } from '@/components/warm-path-card'
import type { PathSignal } from '@/lib/path-signals'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

const ASK_LABELS: Record<string, string> = {
  context_ask: 'Context ask',
  advice_ask: 'Advice ask',
  referral_ask: 'Referral ask',
  intro_ask: 'Intro ask',
  recruiter_pitch: 'Recruiter pitch',
}

const ASK_HINTS: Record<string, string> = {
  context_ask: 'Ask for a short chat to learn about the team. Perspective-seeking, not job-seeking.',
  advice_ask: 'Lead with the shared background and ask how they thought about a similar move.',
  referral_ask: 'Direct but not transactional: mention you applied, ask if they would be comfortable referring you.',
  intro_ask: 'Ask whether they know someone closer to the team who might be open to a brief chat.',
  recruiter_pitch: 'Mention you applied, give one line on why your background fits, ask for consideration.',
}

const CHANNEL_LABELS: Record<string, string> = { linkedin: 'LinkedIn DM', email: 'Email' }
const TYPE_LABELS: Record<string, string> = { outreach: 'First outreach', followup: 'Follow-up', referral_ask: 'Referral ask' }

const STATUS_OPTIONS = [
  'not_started', 'drafted', 'sent', 'replied', 'meeting_set', 'referred', 'closed',
]

interface Props {
  job: AnyRecord
  contact: AnyRecord
  warmPath: AnyRecord
  messages: AnyRecord[]
  signals?: PathSignal[]
  demo?: boolean
}

export default function MessageWorkspace({ job, contact, warmPath, messages, signals = [], demo = false }: Props) {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [interpreting, setInterpreting] = useState(false)
  const [replyAnalysis, setReplyAnalysis] = useState<{ sentiment: string; suggestedNextStep: string } | null>(null)
  const [status, setStatus] = useState(warmPath.status)
  const [channel, setChannel] = useState<'linkedin' | 'email'>('linkedin')
  const [msgType, setMsgType] = useState<'outreach' | 'followup' | 'referral_ask'>('outreach')

  async function generateMessage() {
    setGenerating(true)
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warmPathId: warmPath.id, channel, messageType: msgType }),
    })
    if (!res.ok) {
      toast.error('Failed to generate message')
      setGenerating(false)
      return
    }
    toast.success('Message generated')
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
      toast.error('Failed to interpret reply')
      setInterpreting(false)
      return
    }
    const data = await res.json()
    setReplyAnalysis({ sentiment: data.sentiment, suggestedNextStep: data.suggestedNextStep })
    setInterpreting(false)
    router.refresh()
  }

  async function updateStatus(newStatus: string) {
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
    positive: 'bg-green-100 text-green-800',
    neutral: 'bg-yellow-100 text-yellow-800',
    negative: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{contact.name}</h1>
          <p className="text-muted-foreground text-sm">
            {contact.title ?? ''}{contact.company ? ` · ${contact.company}` : ''}
            {' · '}<span className="capitalize">{contact.relationshipStrength} tie</span>
            {' · '}<Link href={`/contacts/${contact.id}`} className="underline hover:text-foreground">View profile</Link>
          </p>
          <PathSignals signals={signals} className="mt-2" />
        </div>
        <div className="flex items-center gap-2">
          {warmPath.recommendedAsk && (
            <Badge variant="secondary">{ASK_LABELS[warmPath.recommendedAsk] ?? warmPath.recommendedAsk}</Badge>
          )}
          <Select value={status} onValueChange={updateStatus}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue className="capitalize">{String(status).replace(/_/g, ' ')}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s} className="capitalize text-xs">
                  {s.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Why this person */}
      {(warmPath.scoreReasoning || warmPath.nextAction) && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Why this person · {tierLabel(warmPath.relevanceScore)} for {job.title} at {job.company}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {warmPath.scoreReasoning && (
              <p className="text-sm">{warmPath.scoreReasoning}</p>
            )}
            {warmPath.nextAction && (
              <p className="text-sm font-medium">→ {warmPath.nextAction}</p>
            )}
            {warmPath.recommendedAsk && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{ASK_LABELS[warmPath.recommendedAsk] ?? warmPath.recommendedAsk}:</span>{' '}
                {ASK_HINTS[warmPath.recommendedAsk] ?? ''}
              </p>
            )}
            {warmPath.referralReadiness && (
              <p className="text-xs text-muted-foreground">
                Referral readiness: <span className="capitalize">{warmPath.referralReadiness.replace(/_/g, ' ')}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Generate message */}
      <div className="space-y-3">
        <h2 className="font-medium">Generate message</h2>
        <div className="flex items-center gap-3">
          <Select value={channel} onValueChange={v => setChannel(v as 'linkedin' | 'email')}>
            <SelectTrigger className="w-36">
              <SelectValue>{CHANNEL_LABELS[channel]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linkedin">LinkedIn DM</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
          <Select value={msgType} onValueChange={v => setMsgType(v as 'outreach' | 'followup' | 'referral_ask')}>
            <SelectTrigger className="w-44">
              <SelectValue>{TYPE_LABELS[msgType]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="outreach">First outreach</SelectItem>
              <SelectItem value="followup">Follow-up</SelectItem>
              <SelectItem value="referral_ask">Referral ask</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={generateMessage} disabled={generating}>
            {generating ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </div>

      {/* Message history */}
      {messages.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium">Messages</h2>
          {demo && (
            <p className="text-xs text-muted-foreground">
              Drafts below were written by WarmPath&apos;s message generator when this demo network was seeded.
              Generate above drafts a new one live.
            </p>
          )}
          <Tabs defaultValue={messages[messages.length - 1].id}>
            <TabsList className="flex-wrap h-auto gap-1">
              {messages.map((msg, i) => (
                <TabsTrigger key={msg.id} value={msg.id} className="text-xs">
                  {i + 1}. {msg.channel === 'linkedin' ? 'LI' : 'Email'} {msg.messageType.replace(/_/g, ' ')}
                  {msg.status === 'sent' && ' ✓'}
                </TabsTrigger>
              ))}
            </TabsList>

            {messages.map(msg => (
              <TabsContent key={msg.id} value={msg.id} className="mt-3 space-y-3">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
                        {msg.channel === 'linkedin' ? 'LinkedIn DM' : 'Email'} · {msg.messageType.replace(/_/g, ' ')}
                      </CardTitle>
                      <Badge variant={msg.status === 'sent' ? 'default' : 'secondary'} className="text-xs capitalize">
                        {msg.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{msg.body}</pre>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(msg.body)}>
                        Copy
                      </Button>
                      {msg.status !== 'sent' && (
                        <Button size="sm" onClick={() => markSent(msg.id)}>Mark sent</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Reply interpreter */}
                {msg.status === 'sent' && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Got a reply?</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Paste their reply here and WarmPath will tell you what it means and what to do next…"
                        className="min-h-24 resize-none text-sm"
                      />
                      <Button size="sm" onClick={() => interpretReply(msg.id)} disabled={interpreting || !replyText.trim()}>
                        {interpreting ? 'Interpreting…' : 'Interpret reply'}
                      </Button>
                      {replyAnalysis && (
                        <div className="space-y-2 pt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${sentimentColors[replyAnalysis.sentiment] ?? ''}`}>
                            {replyAnalysis.sentiment}
                          </span>
                          <p className="text-sm font-medium">{replyAnalysis.suggestedNextStep}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </div>
  )
}
