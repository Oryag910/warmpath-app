import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { interpretReply } from '@/lib/claude'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const { messageId, replyText } = await request.json()

    if (!messageId || !replyText) {
      return NextResponse.json({ error: 'messageId and replyText required' }, { status: 400 })
    }

    const message = await prisma.message.findFirst({
      where: { id: messageId },
      include: {
        warmPath: {
          include: { job: true, contact: true },
        },
      },
    })

    if (!message || message.warmPath.job.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const interpretation = await interpretReply(
      {
        title: message.warmPath.job.title,
        company: message.warmPath.job.company,
        rawDescription: message.warmPath.job.rawDescription,
      },
      {
        id: message.warmPath.contact.id,
        name: message.warmPath.contact.name,
        title: message.warmPath.contact.title,
        company: message.warmPath.contact.company,
        relationshipStrength: message.warmPath.contact.relationshipStrength,
        schoolOverlap: message.warmPath.contact.schoolOverlap,
        companyOverlap: message.warmPath.contact.companyOverlap,
        lastInteractionDate: message.warmPath.contact.lastInteractionDate,
        notes: message.warmPath.contact.notes,
      },
      replyText
    )

    const analysis = await prisma.replyAnalysis.upsert({
      where: { messageId },
      create: {
        messageId,
        replyText,
        sentiment: interpretation.sentiment,
        suggestedNextStep: interpretation.suggestedNextStep,
      },
      update: {
        replyText,
        sentiment: interpretation.sentiment,
        suggestedNextStep: interpretation.suggestedNextStep,
      },
    })

    // Advance warm path status to replied
    await prisma.warmPath.update({
      where: { id: message.warmPathId },
      data: { status: 'replied' },
    })
    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'replied' },
    })

    return NextResponse.json(analysis, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
