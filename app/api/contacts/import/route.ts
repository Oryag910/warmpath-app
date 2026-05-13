import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { rowToContactInput, type LinkedInRow } from '@/lib/linkedin-csv'

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const rows: LinkedInRow[] = Array.isArray(body?.rows) ? body.rows : []
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  const existing = (await prisma.contact.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, company: true, linkedinUrl: true, source: true },
  })) as any[]

  const byUrl = new Map<string, any>()
  const byNameCompany = new Map<string, any>()
  for (const c of existing) {
    if (c.linkedinUrl) byUrl.set(c.linkedinUrl, c)
    byNameCompany.set(`${(c.name ?? '').toLowerCase()}|${(c.company ?? '').toLowerCase()}`, c)
  }

  let imported = 0
  let updated = 0
  let skipped = 0

  for (const row of rows) {
    const input = rowToContactInput(row)
    if (!input) {
      skipped++
      continue
    }

    const match = input.linkedinUrl
      ? byUrl.get(input.linkedinUrl)
      : byNameCompany.get(`${input.name.toLowerCase()}|${(input.company ?? '').toLowerCase()}`)

    if (match) {
      await prisma.contact.update({
        where: { id: match.id },
        data: {
          title: input.title ?? undefined,
          company: input.company ?? undefined,
          email: input.email ?? undefined,
          ...(match.source === 'manual' ? {} : { source: 'linkedin_csv' }),
        } as any,
      })
      updated++
      continue
    }

    const created = (await prisma.contact.create({
      data: {
        userId: user.id,
        name: input.name,
        title: input.title,
        company: input.company,
        linkedinUrl: input.linkedinUrl,
        email: input.email,
        relationshipStrength: input.relationshipStrength,
        source: input.source,
      } as any,
    })) as any
    if (created.linkedinUrl) byUrl.set(created.linkedinUrl, created)
    byNameCompany.set(`${created.name.toLowerCase()}|${(created.company ?? '').toLowerCase()}`, created)
    imported++
  }

  return NextResponse.json({ imported, updated, skipped })
}
