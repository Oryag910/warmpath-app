import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import ContactsDashboard from './contacts-dashboard'

export default async function ContactsPage() {
  const user = await requireUser()
  const contacts = await prisma.contact.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import your LinkedIn connections so WarmPath can match them to jobs automatically.
        </p>
      </div>
      <ContactsDashboard contacts={contacts as any[]} />
    </div>
  )
}
