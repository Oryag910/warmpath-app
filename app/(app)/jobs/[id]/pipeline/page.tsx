import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { RECOMMEND_THRESHOLD } from '@/lib/path-signals'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
const ASK_LABELS: Record<string, string> = {
  context_ask: 'Context ask',
  advice_ask: 'Advice ask',
  referral_ask: 'Referral ask',
  intro_ask: 'Intro ask',
  recruiter_pitch: 'Recruiter pitch',
}

const PATH_COLORS: Record<string, string> = {
  direct: 'bg-green-100 text-green-800',
  alumni: 'bg-blue-100 text-blue-800',
  intro: 'bg-yellow-100 text-yellow-800',
  weak: 'bg-gray-100 text-gray-700',
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  drafted: 'Drafted',
  sent: 'Sent',
  replied: 'Replied',
  meeting_set: 'Meeting set',
  referred: 'Referred',
  closed: 'Closed',
}

export default async function PipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()

  const job = await prisma.job.findFirst({ where: { id, userId: user.id } })
  if (!job) notFound()

  const warmPaths = (await prisma.warmPath.findMany({
    where: { jobId: id, relevanceScore: { gte: RECOMMEND_THRESHOLD } },
    include: { contact: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: [{ relevanceScore: 'desc' }, { createdAt: 'asc' }],
  })) as any[]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Jobs</Link>
        <span>/</span>
        <Link href={`/jobs/${id}`} className="hover:text-foreground">{job.title} at {job.company}</Link>
        <span>/</span>
        <span>Pipeline</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Warm paths</h1>
          <p className="text-sm text-muted-foreground mt-1">Ranked by relevance to this role.</p>
        </div>
        <Link href={`/jobs/${id}/contacts`} className={buttonVariants({ variant: 'outline' })}>
          Add contacts
        </Link>
      </div>

      {warmPaths.length === 0 ? (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <p className="font-medium">No contacts ranked yet</p>
          <Link href={`/jobs/${id}/contacts`} className={buttonVariants()}>
            Add and rank contacts
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {warmPaths.map((wp, i) => (
            <Link key={wp.id} href={`/jobs/${id}/messages/${wp.contactId}`}>
              <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-6 flex-shrink-0">
                        {i + 1}
                      </span>
                      <div>
                        <CardTitle className="text-base">{wp.contact.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {wp.contact.title ?? ''}
                          {wp.contact.company ? ` · ${wp.contact.company}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {wp.pathType && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PATH_COLORS[wp.pathType] ?? 'bg-gray-100'}`}>
                          {wp.pathType}
                        </span>
                      )}
                      {wp.recommendedAsk && (
                        <Badge variant="secondary">{ASK_LABELS[wp.recommendedAsk] ?? wp.recommendedAsk}</Badge>
                      )}
                      <Badge variant="outline">{STATUS_LABELS[wp.status] ?? wp.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                {(wp.scoreReasoning || wp.nextAction) && (
                  <CardContent className="pb-4 pl-12">
                    {wp.scoreReasoning && (
                      <p className="text-sm text-muted-foreground mb-1">{wp.scoreReasoning}</p>
                    )}
                    {wp.nextAction && (
                      <p className="text-sm font-medium">→ {wp.nextAction}</p>
                    )}
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
