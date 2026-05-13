import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { generateMessage, generateFollowup } from '@/lib/claude'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const { warmPathId, channel, messageType } = body

    if (!warmPathId || !channel || !messageType) {
      return NextResponse.json({ error: 'warmPathId, channel, messageType required' }, { status: 400 })
    }

    const warmPath = await prisma.warmPath.findFirst({
      where: { id: warmPathId },
      include: {
        job: true,
        contact: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!warmPath || warmPath.job.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let body_text: string

    if (messageType === 'followup') {
      const priorMessages = (warmPath.messages as any[]).map((m: any) => m.body as string)
      const lastSent = (warmPath.messages as any[]).find((m: any) => m.status === 'sent')
      const daysSince = lastSent
        ? Math.floor((Date.now() - lastSent.createdAt.getTime()) / 86400000)
        : 7

      body_text = await generateFollowup(
        { title: warmPath.job.title, company: warmPath.job.company, rawDescription: warmPath.job.rawDescription },
        {
          id: warmPath.contact.id,
          name: warmPath.contact.name,
          title: warmPath.contact.title,
          company: warmPath.contact.company,
          relationshipStrength: warmPath.contact.relationshipStrength,
          schoolOverlap: warmPath.contact.schoolOverlap,
          companyOverlap: warmPath.contact.companyOverlap,
          lastInteractionDate: warmPath.contact.lastInteractionDate,
          notes: warmPath.contact.notes,
        },
        priorMessages,
        daysSince
      )
    } else {
      body_text = await generateMessage(
        { title: warmPath.job.title, company: warmPath.job.company, rawDescription: warmPath.job.rawDescription },
        {
          id: warmPath.contact.id,
          name: warmPath.contact.name,
          title: warmPath.contact.title,
          company: warmPath.contact.company,
          relationshipStrength: warmPath.contact.relationshipStrength,
          schoolOverlap: warmPath.contact.schoolOverlap,
          companyOverlap: warmPath.contact.companyOverlap,
          lastInteractionDate: warmPath.contact.lastInteractionDate,
          notes: warmPath.contact.notes,
        },
        {
          recommendedAsk: warmPath.recommendedAsk ?? 'context_ask',
          pathType: warmPath.pathType ?? 'weak',
          scoreReasoning: warmPath.scoreReasoning ?? '',
        },
        channel as 'linkedin' | 'email',
        messageType as 'outreach' | 'referral_ask'
      )
    }

    const message = await prisma.message.create({
      data: { warmPathId, channel, messageType, body: body_text },
    })

    return NextResponse.json(message, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
