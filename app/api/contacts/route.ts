import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireUser()
    const contacts = await prisma.contact.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(contacts)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const { name, title, company, relationshipStrength, schoolOverlap, companyOverlap, lastInteractionDate, notes } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const contact = await prisma.contact.create({
      data: {
        userId: user.id,
        name,
        title,
        company,
        relationshipStrength: relationshipStrength ?? 'weak',
        schoolOverlap: schoolOverlap ?? false,
        companyOverlap: companyOverlap ?? false,
        lastInteractionDate: lastInteractionDate ? new Date(lastInteractionDate) : null,
        notes,
      },
    })

    return NextResponse.json(contact, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
