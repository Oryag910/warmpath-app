import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const body = await request.json()

    const warmPath = await prisma.warmPath.findFirst({
      where: { id },
      include: { job: true },
    })

    if (!warmPath || warmPath.job.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updated = await prisma.warmPath.update({
      where: { id },
      data: { status: body.status },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
