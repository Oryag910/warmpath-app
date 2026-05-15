import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

const TOP_N = 10

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function scoreDiscoveredContact(dc: any): number {
  let score = 0
  const bridge = dc.mutualContact

  if (dc.mutualContactName) score += 3          // LinkedIn named the mutual
  if (dc.mutualContactId) score += 1            // any bridge resolved in DB

  if (bridge) {
    // Bridge was found via exact name match (LinkedIn name === contact name)
    if (dc.mutualContactName && norm(bridge.name) === norm(dc.mutualContactName)) score += 2
    if (bridge.schoolOverlap) score += 2
    if (bridge.enrichedAt) score += 1
  }

  return score
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params
  const user = await requireUser()

  const job = await prisma.job.findFirst({ where: { id: jobId, userId: user.id } })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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

  // Score and sort all discovered contacts
  const scored = all
    .map(dc => ({ dc, score: scoreDiscoveredContact(dc) }))
    .sort((a, b) => b.score - a.score)

  // Keep: top N + any that are already in-progress (not identified)
  const topIds = new Set(scored.slice(0, TOP_N).map(({ dc }) => dc.id))
  const keepIds = all
    .filter(dc => topIds.has(dc.id) || dc.status !== 'identified')
    .map(dc => dc.id)

  // Delete identified contacts that didn't make the cut
  await prisma.discoveredContact.deleteMany({
    where: {
      jobId,
      userId: user.id,
      status: 'identified',
      id: { notIn: keepIds },
    },
  })

  // Return survivors in score order (for the UI to replace its list)
  const survivors = scored
    .filter(({ dc }) => keepIds.includes(dc.id))
    .map(({ dc }) => dc)

  return NextResponse.json(survivors)
}
