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
  // Seeded demo drafts keep the template's timestamps; anything newer than the sandbox itself
  // was generated live by this visitor. Lets the workspace label the two honestly.
  const liveSince = demo ? (user as { createdAt?: Date }).createdAt?.toISOString() ?? null : null

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="shrink-0 hover:text-foreground">Jobs</Link>
        <span aria-hidden>/</span>
        <Link href={`/jobs/${id}`} className="truncate hover:text-foreground">{job.title} at {job.company}</Link>
        <span aria-hidden>/</span>
        <span className="shrink-0 truncate text-foreground">{contact.name}</span>
      </nav>

      <MessageWorkspace
        job={job}
        contact={contact}
        warmPath={warmPath}
        messages={warmPath.messages}
        signals={signals}
        demo={demo}
        liveSince={liveSince}
      />
    </div>
  )
}
