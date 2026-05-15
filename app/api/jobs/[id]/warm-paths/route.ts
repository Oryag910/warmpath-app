import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { rankContacts } from '@/lib/claude'

export const maxDuration = 60

const MAX_COMPANY_CONTACTS = 30
const MAX_OTHER_CONTACTS = 5

// Generic words stripped when extracting distinctive words from a company name.
// Prevents "technologies" in "Palantir Technologies" from matching every tech company.
const GENERIC_WORDS = new Set([
  'technologies', 'technology', 'solutions', 'services', 'group', 'inc',
  'corp', 'llc', 'ltd', 'co', 'company', 'international', 'global',
  'systems', 'software', 'digital', 'partners', 'consulting', 'enterprises',
  'ventures', 'capital', 'labs', 'studio', 'studios', 'platforms', 'industries',
  'management', 'health', 'healthcare', 'finance', 'financial', 'media',
])

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params

    const job = await prisma.job.findFirst({ where: { id, userId: user.id } })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const warmPaths = await prisma.warmPath.findMany({
      where: { jobId: id, relevanceScore: { gte: 0.55 } },
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

    // Extract distinctive words from the job company name so "Palantir Technologies"
    // → ["palantir"], not ["palantir", "technologies"]. Computed once, used in hasCompanyMatch.
    const jobDistinctiveWords = jobCompany
      .split(/[\s&,./]+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length > 2 && !GENERIC_WORDS.has(w))

    function hasCompanyMatch(c: any): boolean {
      if (c.companyOverlap) return true
      if (jobDistinctiveWords.length === 0) return false
      const cc = (c.company ?? '').trim().toLowerCase()
      const pastCompanies = ((c.employmentHistory as any[]) ?? []).map(
        (e: any) => (e.company ?? '').toLowerCase()
      )
      const nameMatches = (name: string) => name.length > 0 && jobDistinctiveWords.some(w => name.includes(w))
      return nameMatches(cc) || pastCompanies.some(nameMatches)
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

    let contacts: any[]
    if (rankAll) {
      // Company-matched contacts fill the first pool (capped); rest fills the second pool by score
      const companyMatched = allContacts.filter(c => hasCompanyMatch(c)).slice(0, MAX_COMPANY_CONTACTS)
      const companyMatchedIds = new Set(companyMatched.map((c: any) => c.id))
      const rest = allContacts
        .filter(c => {
          if (companyMatchedIds.has(c.id)) return false
          // Require at least one enrichment-based signal — school overlap alone isn't enough
          return buildSharedAffiliations(c) || heuristicScore(c) >= 13
        })
        .sort((a, b) => heuristicScore(b) - heuristicScore(a))
        .slice(0, MAX_OTHER_CONTACTS)
      contacts = [...companyMatched, ...rest]
    } else {
      contacts = allContacts
    }

    // On a full re-rank, wipe stale not_started rows so old scores don't bleed through
    if (rankAll) {
      await prisma.warmPath.deleteMany({
        where: { jobId: id, status: 'not_started' },
      })
    }

    // Bulk-create WarmPath stubs (skip existing)
    await prisma.warmPath.createMany({
      data: contacts.map((c: any) => ({ jobId: id, contactId: c.id })),
      skipDuplicates: true,
    })

    const scores = await rankContacts(
      { title: job.title, company: job.company, rawDescription: job.rawDescription },
      (contacts as any[]).map((c: any) => {
        const companyOverlap = hasCompanyMatch(c)
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

    // Persist scores; delete WarmPath rows that fall below the relevance threshold
    const toKeep = scores.filter(s => s.relevanceScore >= 0.55)
    const toDrop = scores.filter(s => s.relevanceScore < 0.55).map(s => s.contactId)

    await Promise.all([
      ...toKeep.map(score =>
        prisma.warmPath.update({
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
      ),
      toDrop.length > 0
        ? prisma.warmPath.deleteMany({
            where: { jobId: id, contactId: { in: toDrop } },
          })
        : Promise.resolve(),
    ])

    return NextResponse.json({ rankedCount: contacts.length, totalContacts })
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error(err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Ranking failed', detail: msg }, { status: 500 })
  }
}
