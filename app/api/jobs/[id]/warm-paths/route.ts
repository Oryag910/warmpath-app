import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { rankContacts } from '@/lib/claude'

export const maxDuration = 60

const MAX_RANK_CONTACTS = 75

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
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Failed to load warm paths' }, { status: 500 })
  }
}

// POST /api/jobs/[id]/warm-paths — accepts { rankAll: true } or { contactIds: string[] }
// Pre-filters to top MAX_RANK_CONTACTS by heuristic before sending to Claude
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

    let allContacts: any[]
    if (rankAll) {
      allContacts = await prisma.contact.findMany({ where: { userId: user.id } })
      if (allContacts.length === 0) {
        return NextResponse.json({ error: 'No contacts to rank' }, { status: 400 })
      }
    } else {
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return NextResponse.json({ error: 'contactIds array is required' }, { status: 400 })
      }
      allContacts = await prisma.contact.findMany({
        where: { id: { in: contactIds }, userId: user.id },
      })
    }

    const jobCompany = job.company.trim().toLowerCase()

    function hasCompanyMatch(c: any): boolean {
      const cc = (c.company ?? '').trim().toLowerCase()
      const pastCompanies = ((c.employmentHistory as any[]) ?? []).map((e: any) => (e.company ?? '').toLowerCase())
      return c.companyOverlap
        || (cc.length > 0 && (cc.includes(jobCompany) || jobCompany.includes(cc)))
        || pastCompanies.some((p: string) => p.length > 0 && (p.includes(jobCompany) || jobCompany.includes(p)))
    }

    function heuristicScore(c: any): number {
      let score = 0
      if (hasCompanyMatch(c)) score += 10
      if (c.schoolOverlap) score += 5
      if (c.relationshipStrength === 'strong') score += 8
      if (c.relationshipStrength === 'medium') score += 4
      if (c.enrichedAt) score += 2
      return score
    }

    const totalContacts = allContacts.length
    let contacts: any[]
    if (rankAll) {
      // Company-matched contacts always included; fill remaining slots by heuristic score
      const companyMatched = allContacts.filter(c => hasCompanyMatch(c))
      const rest = allContacts
        .filter(c => !companyMatched.includes(c))
        .sort((a, b) => heuristicScore(b) - heuristicScore(a))
        .slice(0, Math.max(0, MAX_RANK_CONTACTS - companyMatched.length))
      contacts = [...companyMatched, ...rest]
    } else {
      contacts = allContacts
    }

    // Bulk-create WarmPath stubs for contacts being ranked (skip existing)
    await prisma.warmPath.createMany({
      data: contacts.map((c: any) => ({ jobId: id, contactId: c.id })),
      skipDuplicates: true,
    })

    const userSchools = ((fullUser?.schools as any[]) ?? []).map((s: any) => (s.name ?? '').toLowerCase())
    const userOrgs = ((fullUser?.organizations as any[]) ?? []).map((o: string) => o.toLowerCase())

    function buildSharedAffiliations(c: any): string | null {
      const parts: string[] = []
      const contactSchools = ((c.educationHistory as any[]) ?? []).map((e: any) => (e.school ?? '').toLowerCase())
      const matchedSchools = userSchools.filter(us => contactSchools.some(cs => cs.includes(us) || us.includes(cs)))
      if (matchedSchools.length) parts.push(`${matchedSchools[0]} alum`)
      const contactOrgs = ((c.organizations as any[]) ?? []).map((o: any) => (o.name ?? '').toLowerCase()).filter(Boolean)
      const matchedOrgs = userOrgs.filter(uo => contactOrgs.some(co => co.includes(uo) || uo.includes(co)))
      for (const o of matchedOrgs) parts.push(`shared org: ${o}`)
      if (!matchedOrgs.length && userOrgs.length && c.notes) {
        const notesLower = (c.notes as string).toLowerCase()
        const orgMatch = userOrgs.find(o => notesLower.includes(o))
        if (orgMatch) parts.push(`shared org: ${orgMatch}`)
      }
      return parts.length ? parts.join('; ') : null
    }

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

    return NextResponse.json({ rankedCount: contacts.length, totalContacts })
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Ranking failed' }, { status: 500 })
  }
}
