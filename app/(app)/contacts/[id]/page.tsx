import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import ContactDetail from './contact-detail'

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()

  const contact = await prisma.contact.findFirst({ where: { id, userId: user.id } })
  if (!contact) notFound()

  const warmPaths = (await prisma.warmPath.findMany({
    where: { contactId: id },
    include: { job: true },
    orderBy: { createdAt: 'desc' },
  })) as any[]

  return <ContactDetail contact={contact as any} warmPaths={warmPaths} />
}
