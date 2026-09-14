import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { rankJob, RECOMMEND_THRESHOLD } from '@/lib/ranking'

export const maxDuration = 60

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params

    const job = await prisma.job.findFirst({ where: { id, userId: user.id } })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const warmPaths = await prisma.warmPath.findMany({
      where: { jobId: id, relevanceScore: { gte: RECOMMEND_THRESHOLD } },
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

    if (!rankAll && (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0)) {
      return NextResponse.json({ error: 'contactIds array is required' }, { status: 400 })
    }

    const [job, fullUser] = await Promise.all([
      prisma.job.findFirst({ where: { id, userId: user.id } }),
      prisma.user.findUnique({ where: { id: user.id } }),
    ])
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const result = await rankJob(fullUser ?? user, job, { rankAll: !!rankAll, contactIds })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'No contacts to rank') {
      return NextResponse.json({ error: 'No contacts to rank' }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Ranking failed' }, { status: 500 })
  }
}
