import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const body = await request.json()

    const message = await prisma.message.findFirst({
      where: { id },
      include: { warmPath: { include: { job: true } } },
    })

    if (!message || message.warmPath.job.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.status) updateData.status = body.status
    if (body.status === 'sent') updateData.sentAt = new Date()
    if (body.followUpDate) updateData.followUpDate = new Date(body.followUpDate)
    if (body.body) updateData.body = body.body

    // When a message is marked sent, advance the warm path status
    if (body.status === 'sent' && message.warmPath.status === 'not_started') {
      await prisma.warmPath.update({
        where: { id: message.warmPathId },
        data: { status: 'drafted' },
      })
    }

    const updated = await prisma.message.update({ where: { id }, data: updateData })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
