import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import ContactsDashboard from './contacts-dashboard'

export default async function ContactsPage() {
  const user = await requireUser()
  // Only the fields the dashboard renders — a large network serialized with every JSON column
  // (skills, full scraped profile, …) is multiple MB of HTML
  const contacts = await prisma.contact.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, title: true, company: true, linkedinUrl: true, source: true,
      relationshipStrength: true, schoolOverlap: true, companyOverlap: true, enrichedAt: true,
      educationHistory: true, organizations: true, linkedinProfile: true,
    },
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
