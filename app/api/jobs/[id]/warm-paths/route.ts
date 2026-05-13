import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { rankContacts } from '@/lib/claude'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params

    const job = await prisma.job.findFirst({ where: { id, userId: user.id } })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const warmPaths = await prisma.warmPath.findMany({
      where: { jobId: id },
      include: { contact: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: [{ relevanceScore: 'desc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json(warmPaths)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// POST /api/jobs/[id]/warm-paths — accepts { rankAll: true } or { contactIds: string[] }
// Creates WarmPath records and scores them all in one Claude call
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const body = await request.json()
    const { rankAll, contactIds } = body

    const [job, fullUser] = await Promise.all([
      prisma.job.findFirst({ where: { id, userId: user.id } }),
      prisma.user.findUnique({ where: { id: user.id } }),
    ])
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let contacts
    if (rankAll) {
      contacts = await prisma.contact.findMany({ where: { userId: user.id } })
      if (contacts.length === 0) {
        return NextResponse.json({ error: 'No contacts to rank' }, { status: 400 })
      }
    } else {
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return NextResponse.json({ error: 'contactIds array is required' }, { status: 400 })
      }
      contacts = await prisma.contact.findMany({
        where: { id: { in: contactIds }, userId: user.id },
      })
    }

    // Upsert warm path records (may already exist)
    for (const contact of contacts) {
      await prisma.warmPath.upsert({
        where: { jobId_contactId: { jobId: id, contactId: contact.id } },
        create: { jobId: id, contactId: contact.id },
        update: {},
      })
    }

    const jobCompany = job.company.trim().toLowerCase()
    const userSchools = ((fullUser?.schools as any[]) ?? []).map((s: any) => (s.name ?? '').toLowerCase())
    const userOrgs = ((fullUser?.organizations as any[]) ?? []).map((o: string) => o.toLowerCase())

    function buildSharedAffiliations(c: any): string | null {
      const parts: string[] = []
      const contactSchools = ((c.educationHistory as any[]) ?? []).map((e: any) => (e.school ?? '').toLowerCase())
      const matched = userSchools.filter(us => contactSchools.some(cs => cs.includes(us) || us.includes(cs)))
      if (matched.length) parts.push(`${matched[0]} alum`)
      // Organizations stored in notes or future fields — for now we pass user orgs as context
      if (userOrgs.length && c.notes) {
        const notesLower = (c.notes as string).toLowerCase()
        const orgMatch = userOrgs.find(o => notesLower.includes(o))
        if (orgMatch) parts.push(orgMatch)
      }
      return parts.length ? parts.join('; ') : null
    }

    // Score all contacts in one call
    const scores = await rankContacts(
      { title: job.title, company: job.company, rawDescription: job.rawDescription },
      (contacts as any[]).map((c: any) => {
        const pastCompanies = ((c.employmentHistory as any[]) ?? []).map((e: any) => (e.company ?? '').toLowerCase())
        const companyOverlap = c.companyOverlap
          || (c.company ?? '').trim().toLowerCase() === jobCompany
          || pastCompanies.some((p: string) => p.includes(jobCompany) || jobCompany.includes(p))
        return {
          id: c.id,
          name: c.name,
          title: c.title,
          company: c.company,
          relationshipStrength: c.relationshipStrength,
          schoolOverlap: c.schoolOverlap,
          companyOverlap,
          lastInteractionDate: c.lastInteractionDate,
          notes: c.notes,
          sharedAffiliations: buildSharedAffiliations(c),
        }
      })
    )

    // Persist scores
    for (const score of scores) {
      await prisma.warmPath.update({
        where: { jobId_contactId: { jobId: id, contactId: score.contactId } },
        data: {
          relevanceScore: score.relevanceScore,
          scoreReasoning: score.scoreReasoning,
          pathType: score.pathType,
          recommendedAsk: score.recommendedAsk,
          referralReadiness: score.referralReadiness,
          nextAction: score.nextAction,
        },
      })
    }

    const updated = await prisma.warmPath.findMany({
      where: { jobId: id },
      include: { contact: true },
      orderBy: { relevanceScore: 'desc' },
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
