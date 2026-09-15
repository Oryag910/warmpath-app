import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { checkDemoLimit } from '@/lib/demo'
import { NextResponse } from 'next/server'

const TOP_N = 5

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function titleSeniority(title: string | null): number {
  if (!title) return 0
  const t = title.toLowerCase()
  if (/\b(vp|vice president|head of|chief|cto|ceo|coo|cfo|founder|partner|director)\b/.test(t)) return 3
  if (/\b(senior|sr\b|lead|principal|manager|staff)\b/.test(t)) return 1
  return 0
}

// Counts shared schools + past companies between the user and the bridge contact.
// Bridge enrichment data is used (not the discovered contact — they have no profile yet).
// More shared history = bridge is more comfortable making the intro.
function countBridgeCommonalities(userRecord: any, bridge: any): number {
  if (!bridge) return 0
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  let count = 0

  const userSchools = (Array.isArray(userRecord?.schools) ? userRecord.schools : [])
    .map((v: any) => (typeof v === 'string' ? v : v?.name ?? '')).filter(Boolean)
  const bridgeSchools = (Array.isArray(bridge.educationHistory) ? bridge.educationHistory : [])
    .map((e: any) => e.school ?? '').filter(Boolean)
  if (userSchools.some((us: string) => bridgeSchools.some((bs: string) =>
    n(bs).includes(n(us)) || n(us).includes(n(bs))))) count++

  const userCompanies = (Array.isArray(userRecord?.pastCompanies) ? userRecord.pastCompanies : [])
    .map((v: any) => (typeof v === 'string' ? v : v?.name ?? '')).filter(Boolean)
  const bridgeCompanies = (Array.isArray(bridge.employmentHistory) ? bridge.employmentHistory : [])
    .map((e: any) => e.company ?? '').filter(Boolean)
  if (userCompanies.some((uc: string) => bridgeCompanies.some((bc: string) =>
    n(bc).includes(n(uc)) || n(uc).includes(n(bc))))) count++

  return count
}

function scoreDiscoveredContact(dc: any, bridgeRelevance: number, userRecord: any): number {
  let score = 0
  const bridge = dc.mutualContact

  // Connectivity certainty
  if (dc.mutualContactName) score += 3
  if (dc.mutualContactId) score += 1
  if (bridge) {
    if (dc.mutualContactName && norm(bridge.name) === norm(dc.mutualContactName)) score += 1
    if (bridge.schoolOverlap) score += 1
    if (bridge.enrichedAt) score += 1
  }

  // Bridge warmth for this job — primary signal
  if (bridgeRelevance >= 0.75) score += 8
  else if (bridgeRelevance >= 0.55) score += 6
  else if (bridgeRelevance >= 0.35) score += 4
  else if (bridgeRelevance > 0) score += 2

  // User↔bridge personal fit (comfortable intro likelihood)
  const commonalities = countBridgeCommonalities(userRecord, bridge)
  score += commonalities >= 2 ? 4 : commonalities === 1 ? 2 : 0

  // Seniority of the discovered target
  score += titleSeniority(dc.title)

  return score
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params
  const user = await requireUser()
  const demo = await checkDemoLimit(user, 'rank')
  if (!demo.ok) return NextResponse.json({ error: demo.message }, { status: demo.status })

  const job = await prisma.job.findFirst({ where: { id: jobId, userId: user.id } })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Bridge WarmPath relevance scores for this job
  const warmPaths = await prisma.warmPath.findMany({
    where: { jobId },
    select: { contactId: true, relevanceScore: true },
  })
  const bridgeRelevanceMap = new Map(
    warmPaths.map(wp => [wp.contactId, wp.relevanceScore ?? 0])
  )

  // User profile for bridge commonality computation
  const userRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: { schools: true, pastCompanies: true, organizations: true },
  })

  // Fetch ALL discovered contacts, including the candidate pool
  const all = await prisma.discoveredContact.findMany({
    where: { jobId, userId: user.id },
    include: {
      mutualContact: {
        select: {
          id: true, name: true, company: true, headline: true,
          linkedinUrl: true, schoolOverlap: true,
          educationHistory: true, employmentHistory: true, organizations: true,
          enrichedAt: true,
        },
      },
    },
  }) as any[]

  const scored = all
    .map(dc => ({
      dc,
      score: scoreDiscoveredContact(
        dc,
        bridgeRelevanceMap.get(dc.mutualContactId ?? '') ?? 0,
        userRecord,
      ),
    }))
    .sort((a, b) => b.score - a.score)

  // Contacts in active outreach are always preserved — exclude from rank competition
  const preservedStatuses = new Set(['intro_requested', 'connected'])
  const rankable = scored.filter(({ dc }) => !preservedStatuses.has(dc.status))
  const newTopIds = new Set(rankable.slice(0, TOP_N).map(({ dc }) => dc.id))

  // Promote new top N to 'identified'
  await prisma.discoveredContact.updateMany({
    where: { jobId, userId: user.id, id: { in: [...newTopIds] } },
    data: { status: 'identified' },
  })

  // Demote everything outside the new top N back to 'candidate' pool
  await prisma.discoveredContact.updateMany({
    where: {
      jobId,
      userId: user.id,
      status: { in: ['identified', 'candidate'] },
      id: { notIn: [...newTopIds] },
    },
    data: { status: 'candidate' },
  })

  // Return non-candidate contacts so the UI can replace its list
  const survivors = await prisma.discoveredContact.findMany({
    where: { jobId, userId: user.id, status: { not: 'candidate' } },
    include: {
      mutualContact: {
        select: {
          id: true, name: true, company: true, headline: true,
          linkedinUrl: true, schoolOverlap: true,
          educationHistory: true, employmentHistory: true, organizations: true,
          enrichedAt: true,
        },
      },
    },
    orderBy: { discoveredAt: 'desc' },
  }) as any[]

  return NextResponse.json(survivors)
}
