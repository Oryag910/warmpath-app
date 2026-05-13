import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import DeleteJobButton from './delete-job-button'

export default async function DashboardPage() {
  const user = await requireUser()
  const jobs = await prisma.job.findMany({
    where: { userId: user.id, status: 'active' },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { warmPaths: true } } },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">Each job is its own warm path campaign.</p>
        </div>
        <Link href="/jobs/new" className={buttonVariants()}>Add job</Link>
      </div>

      {jobs.length === 0 ? (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <p className="font-medium">No jobs yet</p>
          <p className="text-sm text-muted-foreground">Paste a job posting to get started.</p>
          <Link href="/jobs/new" className={buttonVariants()}>Add your first job</Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {(jobs as any[]).map((job) => (
            <div key={job.id} className="flex items-stretch gap-2">
              <Link href={`/jobs/${job.id}`} className="flex-1 min-w-0">
                <Card className="hover:bg-muted/30 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{job.title}</CardTitle>
                        <CardDescription>{job.company}</CardDescription>
                      </div>
                      <Badge variant="secondary">{job._count.warmPaths} contacts</Badge>
                    </div>
                  </CardHeader>
                  {job.opportunityBrief && (
                    <CardContent className="pb-4">
                      <p className="text-sm text-muted-foreground line-clamp-2">{job.opportunityBrief}</p>
                    </CardContent>
                  )}
                </Card>
              </Link>
              <DeleteJobButton jobId={job.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
