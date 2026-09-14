import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import MessageWorkspace from './message-workspace'
import { isDemoUser } from '@/lib/demo'
import { pathSignals } from '@/lib/ranking'

export default async function MessagePage({ params }: { params: Promise<{ id: string; contactId: string }> }) {
  const { id, contactId } = await params
  const user = await requireUser()

  const job = await prisma.job.findFirst({ where: { id, userId: user.id } })
  if (!job) notFound()

  const contact = await prisma.contact.findFirst({ where: { id: contactId, userId: user.id } })
  if (!contact) notFound()

  const warmPath = await prisma.warmPath.findFirst({
    where: { jobId: id, contactId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!warmPath) notFound()

  const signals = pathSignals(contact, { company: job.company }, user)
  const demo = isDemoUser(user)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Jobs</Link>
        <span>/</span>
        <Link href={`/jobs/${id}`} className="hover:text-foreground">{job.title}</Link>
        <span>/</span>
        <Link href={`/jobs/${id}/pipeline`} className="hover:text-foreground">Pipeline</Link>
        <span>/</span>
        <span>{contact.name}</span>
      </div>

      <MessageWorkspace job={job} contact={contact} warmPath={warmPath} messages={warmPath.messages} signals={signals} demo={demo} />
    </div>
  )
}
