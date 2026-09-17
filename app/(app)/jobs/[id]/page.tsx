import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { isDemoUser } from '@/lib/demo'
import { RECOMMEND_THRESHOLD } from '@/lib/ranking'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
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
  const ranked = warmPaths.length > 0

  return (
    <div className="space-y-10">
      {/* Target job */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Jobs</Link>
            <span aria-hidden>/</span>
            <span className="truncate">{job.company}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{job.title}</h1>
          <p className="mt-1 text-base text-muted-foreground">{job.company}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/jobs/${id}/contacts`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Manage contacts
          </Link>
          <Link href={`/jobs/${id}/pipeline`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Pipeline
          </Link>
        </div>
      </header>

      {/* Brief + strategy: context for the ranking below, visually one block */}
      {!job.opportunityBrief ? (
        <OpportunityBriefLoader jobId={id} />
      ) : (
        <section aria-labelledby="brief-heading" className="rounded-xl border border-border bg-muted/30">
          <div className="grid gap-6 p-5 md:grid-cols-2 md:gap-8 md:p-6">
            <div>
              <h2 id="brief-heading" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Opportunity brief
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{job.opportunityBrief}</p>
            </div>
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Networking strategy
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{job.networkingStrategy}</p>
            </div>
          </div>
          {requirements.length > 0 && (
            <details className="group border-t border-border px-5 py-3 md:px-6">
              <summary className="cursor-pointer select-none text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground">
                Key requirements ({requirements.length})
              </summary>
              <ul className="mt-3 grid gap-1.5 text-sm text-foreground/80 md:grid-cols-2 md:gap-x-8">
                {requirements.map((req, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="text-muted-foreground">·</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {/* Warm paths */}
      <section aria-labelledby="paths-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="paths-heading" className="text-xl font-semibold tracking-tight">Warm paths</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {ranked
                ? 'Who in your network can actually help with this role, and how to ask.'
                : 'Rank your connections to find the best people to reach out to for this role.'}
            </p>
          </div>
          {!demo && <RankButton jobId={id} hasExistingPaths={ranked} />}
        </div>

        {ranked && (
          <div className="rounded-xl border border-border bg-card">
            <dl className="grid grid-cols-3 divide-x divide-border">
              <FunnelStat value={totalContacts} label="connections screened" />
              <FunnelStat value={warmPaths.length} label="candidates scored" />
              <FunnelStat value={recommended.length} label="recommended" emphasis />
            </dl>
            <p className="border-t border-border px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
              A deterministic pre-filter keeps only connections with company overlap or a real shared affiliation.
              Those candidates are scored together in one pass, so each explanation is relative to the rest of the pool.
              Relationship strength shapes the ask, not the ranking.
              {demo && ' Demo rankings come from the same pipeline real users run.'}
            </p>
          </div>
        )}

        {recommended.length > 0 && (
          <ol className="space-y-3">
            {recommended.map((wp, i) => (
              <li key={wp.id}>
                <WarmPathCard rank={i + 1} warmPath={wp} job={job} user={user} />
              </li>
            ))}
          </ol>
        )}

        {ranked && recommended.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No connection has a direct path into {job.company} yet. The weaker signals below explain why.
          </div>
        )}

        {weaker.length > 0 && (
          <details className="group rounded-xl border border-dashed border-border px-4 py-3 sm:px-5">
            <summary className="flex cursor-pointer select-none flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground hover:text-foreground">
              <span className="font-medium">
                {weaker.length} more considered, not recommended
              </span>
              <span className="text-xs">— shared school or organization, but no employment overlap with {job.company}</span>
            </summary>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              These connections cleared the pre-filter on affiliation alone. Without a link to {job.company},
              a referral ask would be a cold ask, so they are worth knowing about but not messaging first.
            </p>
            <ol className="mt-3 space-y-2">
              {weaker.map((wp, i) => (
                <li key={wp.id}>
                  <WarmPathCard rank={recommended.length + i + 1} warmPath={wp} job={job} user={user} compact />
                </li>
              ))}
            </ol>
          </details>
        )}
      </section>

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

function FunnelStat({ value, label, emphasis = false }: { value: number; label: string; emphasis?: boolean }) {
  return (
    <div className="flex flex-col items-center px-3 py-4 text-center sm:px-4">
      <dt className="order-2 mt-1 block text-[11px] leading-tight text-muted-foreground sm:text-xs">{label}</dt>
      <dd className={`text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl ${emphasis ? '' : 'text-foreground/80'}`}>
        {value.toLocaleString()}
      </dd>
    </div>
  )
}
