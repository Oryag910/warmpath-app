import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { checkDemoLimit } from '@/lib/demo'
import { generateOpportunityBrief } from '@/lib/claude'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const demo = await checkDemoLimit(user, 'brief')
    if (!demo.ok) return NextResponse.json({ error: demo.message }, { status: demo.status })

    const job = await prisma.job.findFirst({ where: { id, userId: user.id } })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const brief = await generateOpportunityBrief({
      title: job.title,
      company: job.company,
      rawDescription: job.rawDescription,
    })

    const updated = await prisma.job.update({
      where: { id },
      data: {
        opportunityBrief: brief.opportunityBrief,
        networkingStrategy: brief.networkingStrategy,
        extractedRequirements: brief.extractedRequirements,
      },
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
