import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { checkDemoLimit, isDemoUser, DEMO_PERSONA_NAME } from '@/lib/demo'
import { generateMessage, generateFollowup } from '@/lib/claude'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const { warmPathId, channel, messageType } = body
    const demo = await checkDemoLimit(user, 'generate')
    if (!demo.ok) return NextResponse.json({ error: demo.message }, { status: demo.status })

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

    // Real users have no name on file yet, so their drafts end on the ask with no signature
    const messageOpts = { senderName: isDemoUser(user) ? DEMO_PERSONA_NAME : null }
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
        daysSince,
        messageOpts
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
        messageType as 'outreach' | 'referral_ask',
        messageOpts
      )
    }

    const message = await prisma.message.create({
      data: { warmPathId, channel, messageType, body: body_text },
    })

    return NextResponse.json(message, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Could not generate the message right now. Please try again.' }, { status: 500 })
  }
}
