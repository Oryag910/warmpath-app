import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { isDemoUser } from '@/lib/demo'
import { RECOMMEND_THRESHOLD } from '@/lib/ranking'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import OpportunityBriefLoader from './brief-loader'
import RankButton from './rank-button'
import DiscoveredConnections from './discovered-connections'
import WarmPathCard from '@/components/warm-path-card'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const demo = isDemoUser(user)

  const job = await prisma.job.findFirst({ where: { id, userId: user.id } })
  if (!job) notFound()

  const [warmPaths, totalContacts, discoveredContacts, userContacts] = await Promise.all([
    prisma.warmPath.findMany({
      where: { jobId: id },
      include: { contact: true, messages: { select: { id: true }, take: 1 } },
      orderBy: [{ relevanceScore: 'desc' }, { createdAt: 'asc' }],
    }) as Promise<AnyRecord[]>,
    prisma.contact.count({ where: { userId: user.id } }),
    demo
      ? Promise.resolve([] as AnyRecord[])
      : (prisma.discoveredContact.findMany({
          where: { jobId: id, status: { not: 'candidate' } },
          include: {
            mutualContact: {
              select: {
                id: true, name: true, company: true, headline: true,
                linkedinUrl: true, schoolOverlap: true,
                educationHistory: true, employmentHistory: true, organizations: true,
              },
            },
          },
          orderBy: { discoveredAt: 'desc' },
        }) as Promise<AnyRecord[]>),
    demo
      ? Promise.resolve([] as AnyRecord[])
      : (prisma.contact.findMany({
          where: { userId: user.id },
          select: { id: true, name: true, company: true },
          orderBy: { name: 'asc' },
        }) as Promise<AnyRecord[]>),
  ])

  const recommended = warmPaths.filter(wp => (wp.relevanceScore ?? 0) >= RECOMMEND_THRESHOLD)
  const weaker = warmPaths.filter(wp => (wp.relevanceScore ?? 0) < RECOMMEND_THRESHOLD)
  const requirements = Array.isArray(job.extractedRequirements)
    ? (job.extractedRequirements as string[])
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground">Jobs</Link>
            <span>/</span>
            <span>{job.company}</span>
          </div>
          <h1 className="text-2xl font-semibold">{job.title}</h1>
          <p className="text-muted-foreground">{job.company}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/jobs/${id}/contacts`} className={buttonVariants({ variant: 'outline' })}>
            Manage contacts
          </Link>
          <Link href={`/jobs/${id}/pipeline`} className={buttonVariants({ variant: 'outline' })}>
            Pipeline
          </Link>
        </div>
      </div>

      {!job.opportunityBrief ? (
        <OpportunityBriefLoader jobId={id} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Opportunity Brief
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{job.opportunityBrief}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Networking Strategy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{job.networkingStrategy}</p>
            </CardContent>
          </Card>

          {requirements.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Key Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {requirements.map((req, i) => (
                    <Badge key={i} variant="secondary">{req}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Separator />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Warm paths</h2>
          {warmPaths.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-1">
              Rank your connections to find the best people to reach out to for this role.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-foreground">{totalContacts.toLocaleString()}</span> connections screened
              {' → '}
              <span className="font-medium text-foreground">{warmPaths.length}</span> candidates scored
              {' → '}
              <span className="font-medium text-foreground">{recommended.length}</span> recommended
            </p>
          )}
        </div>
        {demo ? (
          <p className="text-xs text-muted-foreground max-w-xs text-right">
            Demo rankings were generated with WarmPath&apos;s production ranking pipeline.
          </p>
        ) : (
          <RankButton jobId={id} hasExistingPaths={warmPaths.length > 0} />
        )}
      </div>

      {warmPaths.length > 0 && (
        <p className="text-xs text-muted-foreground -mt-3">
          A deterministic pre-filter keeps only connections with company overlap or a real shared
          affiliation. Those candidates are then scored together in one pass, so each explanation is
          relative to the rest of the pool. Relationship strength shapes the ask, not the ranking.
        </p>
      )}

      {recommended.length > 0 && (
        <div className="space-y-3">
          {recommended.map((wp, i) => (
            <WarmPathCard key={wp.id} rank={i + 1} warmPath={wp} job={job} user={user} />
          ))}
        </div>
      )}

      {warmPaths.length > 0 && recommended.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No connection has a direct path into {job.company} yet. The weaker signals below explain why.
        </div>
      )}

      {weaker.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            {weaker.length} weaker signal{weaker.length === 1 ? '' : 's'} considered but not recommended
          </summary>
          <p className="text-xs text-muted-foreground mt-2 mb-3">
            The pre-filter surfaced these connections for a shared school or organization, but none has employment
            overlap with {job.company}, so a referral ask would be a cold ask. Worth knowing about, not messaging first.
          </p>
          <div className="space-y-2">
            {weaker.map((wp, i) => (
              <WarmPathCard key={wp.id} rank={recommended.length + i + 1} warmPath={wp} job={job} user={user} compact />
            ))}
          </div>
        </details>
      )}

      {!demo && (
        <DiscoveredConnections
          jobId={id}
          companySlug={job.company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}
          discovered={discoveredContacts}
          contacts={userContacts}
          user={{ schools: (user as AnyRecord).schools ?? [], pastCompanies: (user as AnyRecord).pastCompanies ?? [], organizations: (user as AnyRecord).organizations ?? [] }}
          warmPathCount={warmPaths.length}
        />
      )}
    </div>
  )
}
