import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function QueuePage() {
  const user = await requireUser()

  const actionablePaths = await prisma.warmPath.findMany({
    where: {
      job: { userId: user.id, status: 'active' },
      status: { in: ['not_started', 'drafted', 'sent', 'replied'] },
    },
    include: {
      job: { select: { id: true, title: true, company: true } },
      contact: { select: { id: true, name: true, title: true, company: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: [{ relevanceScore: 'desc' }, { updatedAt: 'asc' }],
    take: 20,
  })

  const grouped = (actionablePaths as any[]).reduce<Record<string, any[]>>((acc, wp) => {
    const key = actionLabel(wp.status)
    if (!acc[key]) acc[key] = []
    acc[key].push(wp)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Action queue</h1>
        <p className="text-sm text-muted-foreground mt-1">Your highest-leverage moves right now.</p>
      </div>

      {actionablePaths.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <p className="text-muted-foreground text-sm">No active paths. Add a job and contacts to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([label, paths]) => (
            <div key={label} className="space-y-3">
              <h2 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">{label}</h2>
              {paths.map(wp => (
                <Link key={wp.id} href={`/jobs/${wp.job.id}/messages/${wp.contact.id}`}>
                  <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-sm">{wp.contact.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {wp.contact.title ?? ''}{wp.contact.company ? ` · ${wp.contact.company}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            For: {wp.job.title} at {wp.job.company}
                          </p>
                          {wp.nextAction && (
                            <p className="text-sm mt-2 font-medium">→ {wp.nextAction}</p>
                          )}
                        </div>
                        {wp.recommendedAsk && (
                          <Badge variant="secondary" className="flex-shrink-0 capitalize text-xs">
                            {wp.recommendedAsk.replace(/_/g, ' ')}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function actionLabel(status: string): string {
  switch (status) {
    case 'not_started': return 'Send first message'
    case 'drafted': return 'Message drafted — send it'
    case 'sent': return 'Awaiting reply'
    case 'replied': return 'Reply received — take action'
    default: return 'In progress'
  }
}
