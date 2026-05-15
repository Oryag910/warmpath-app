import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import OpportunityBriefLoader from './brief-loader'
import RankButton from './rank-button'
import DiscoveredConnections from './discovered-connections'

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()

  const job = await prisma.job.findFirst({
    where: { id, userId: user.id },
    include: { _count: { select: { warmPaths: true } } },
  })

  if (!job) notFound()

  const [discoveredContacts, userContacts] = await Promise.all([
    prisma.discoveredContact.findMany({
      where: { jobId: id },
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
    }),
    prisma.contact.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, company: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const requirements = Array.isArray(job.extractedRequirements)
    ? (job.extractedRequirements as string[])
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
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
          <Link href={`/jobs/${id}/pipeline`} className={buttonVariants()}>
            View pipeline
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

      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{job._count.warmPaths} contacts in pipeline</p>
          <p className="text-sm text-muted-foreground">
            {job._count.warmPaths === 0 ? 'Rank your connections to find warm paths.' : 'Re-rank anytime after adding new contacts.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/jobs/${id}/contacts`} className={buttonVariants({ variant: 'outline' })}>
            Manage contacts
          </Link>
          <RankButton jobId={id} hasExistingPaths={job._count.warmPaths > 0} />
        </div>
      </div>

      <DiscoveredConnections
        jobId={id}
        companySlug={job.company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}
        discovered={discoveredContacts as any[]}
        contacts={userContacts as any[]}
        user={{ schools: (user as any).schools ?? [], pastCompanies: (user as any).pastCompanies ?? [], organizations: (user as any).organizations ?? [] }}
      />
    </div>
  )
}
