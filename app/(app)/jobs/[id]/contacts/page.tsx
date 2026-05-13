import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ContactsClient from './contacts-client'

export default async function ContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()

  const job = await prisma.job.findFirst({ where: { id, userId: user.id } })
  if (!job) notFound()

  const allContacts = await prisma.contact.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Jobs</Link>
        <span>/</span>
        <Link href={`/jobs/${id}`} className="hover:text-foreground">{job.title} at {job.company}</Link>
        <span>/</span>
        <span>Manage contacts</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Manage contacts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add or discover people connected to this role. Ranking happens from the job page.
        </p>
      </div>

      <ContactsClient jobId={id} company={job.company} allContacts={allContacts} />
    </div>
  )
}
