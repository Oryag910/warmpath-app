import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params
    const body = await request.json()

    const contact = await prisma.contact.findFirst({ where: { id, userId: user.id } })
    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.contact.update({ where: { id }, data: body })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await ctx.params

    const contact = await prisma.contact.findFirst({ where: { id, userId: user.id } })
    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.contact.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
