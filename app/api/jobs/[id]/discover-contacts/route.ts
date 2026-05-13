import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { searchPeopleAtCompany, ApolloNotConfiguredError } from '@/lib/apollo'

function normalizeSchool(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, '') }

function computeSchoolOverlap(
  contactSchools: string[],
  userSchools: { name: string }[]
): boolean {
  const normalized = userSchools.map(s => normalizeSchool(s.name))
  return contactSchools.some(cs => {
    const ncs = normalizeSchool(cs)
    return normalized.some(us => ncs.includes(us) || us.includes(ncs))
  })
}

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  let user
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params
  const [job, fullUser] = await Promise.all([
    prisma.job.findFirst({ where: { id, userId: user.id } }),
    prisma.user.findUnique({ where: { id: user.id } }),
  ])
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userSchools = (fullUser?.schools as any[]) ?? []

  const titles = [job.title, 'Recruiter', 'Talent Acquisition', 'Hiring Manager']

  let people
  try {
    people = await searchPeopleAtCompany(job.company, titles)
  } catch (err) {
    if (err instanceof ApolloNotConfiguredError) {
      return NextResponse.json({ error: 'Apollo not configured' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Apollo search failed' }, { status: 502 })
  }

  const existing = (await prisma.contact.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, company: true, linkedinUrl: true },
  })) as any[]
  const byUrl = new Map<string, any>()
  const byNameCompany = new Map<string, any>()
  for (const c of existing) {
    if (c.linkedinUrl) byUrl.set(c.linkedinUrl, c)
    byNameCompany.set(`${(c.name ?? '').toLowerCase()}|${(c.company ?? '').toLowerCase()}`, c)
  }

  const created: any[] = []
  const matched: any[] = []

  for (const person of people) {
    const company = person.organizationName ?? job.company
    const existingMatch = person.linkedinUrl
      ? byUrl.get(person.linkedinUrl)
      : byNameCompany.get(`${person.name.toLowerCase()}|${company.toLowerCase()}`)

    const schoolOverlap = computeSchoolOverlap(
      person.educationHistory.map(e => e.school),
      userSchools
    )

    if (existingMatch) {
      const updated = await prisma.contact.update({
        where: { id: existingMatch.id },
        data: {
          companyOverlap: true,
          ...(schoolOverlap && { schoolOverlap: true }),
          educationHistory: person.educationHistory as any,
          employmentHistory: person.employmentHistory as any,
        } as any,
      })
      matched.push(updated)
      continue
    }

    const newContact = (await prisma.contact.create({
      data: {
        userId: user.id,
        name: person.name,
        title: person.title,
        company,
        linkedinUrl: person.linkedinUrl,
        email: person.email,
        relationshipStrength: 'weak',
        companyOverlap: true,
        schoolOverlap,
        source: 'apollo',
        educationHistory: person.educationHistory as any,
        employmentHistory: person.employmentHistory as any,
      } as any,
    })) as any
    if (newContact.linkedinUrl) byUrl.set(newContact.linkedinUrl, newContact)
    byNameCompany.set(`${newContact.name.toLowerCase()}|${(newContact.company ?? '').toLowerCase()}`, newContact)
    created.push(newContact)
  }

  return NextResponse.json({ created, matched })
}
