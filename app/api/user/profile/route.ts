import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireUser()
    return NextResponse.json({
      schools: user.schools,
      pastCompanies: user.pastCompanies,
      organizations: user.organizations,
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser()
    const { schools, pastCompanies, organizations } = await request.json()
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(schools !== undefined && { schools }),
        ...(pastCompanies !== undefined && { pastCompanies }),
        ...(organizations !== undefined && { organizations }),
      },
    })
    return NextResponse.json({
      schools: updated.schools,
      pastCompanies: updated.pastCompanies,
      organizations: updated.organizations,
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
