import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; dcId: string }> }
) {
  const { id: jobId, dcId } = await params
  const user = await requireUser()

  const existing = await prisma.discoveredContact.findFirst({
    where: { id: dcId, jobId, userId: user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { status, mutualContactId } = body

  const updated = await prisma.discoveredContact.update({
    where: { id: dcId },
    data: {
      ...(status ? { status } : {}),
      ...(mutualContactId !== undefined ? { mutualContactId } : {}),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; dcId: string }> }
) {
  const { id: jobId, dcId } = await params
  const user = await requireUser()

  const existing = await prisma.discoveredContact.findFirst({
    where: { id: dcId, jobId, userId: user.id },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.discoveredContact.delete({ where: { id: dcId } })
  return new NextResponse(null, { status: 204 })
}
