import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { checkDemoLimit } from '@/lib/demo'
import { generateOpportunityBrief } from '@/lib/claude'

export async function GET() {
  try {
    const user = await requireUser()
    const jobs = await prisma.job.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { warmPaths: true } } },
    })
    return NextResponse.json(jobs)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const { title, company, url, rawDescription } = body
    const demo = await checkDemoLimit(user, 'job_create')
    if (!demo.ok) return NextResponse.json({ error: demo.message }, { status: demo.status })

    if (!title || !company || !rawDescription) {
      return NextResponse.json({ error: 'title, company, and rawDescription are required' }, { status: 400 })
    }

    const job = await prisma.job.create({
      data: { userId: user.id, title, company, url, rawDescription },
    })

    // Generate brief async (fire and forget for fast response)
    generateOpportunityBrief({ title, company, rawDescription }).then(async (brief) => {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          opportunityBrief: brief.opportunityBrief,
          networkingStrategy: brief.networkingStrategy,
          extractedRequirements: brief.extractedRequirements,
        },
      })
    }).catch(console.error)

    return NextResponse.json(job, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
