import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { prisma } from './prisma'
import { DEMO_DOMAIN, DEMO_TEMPLATE_EMAIL } from './demo/data'
import type { Prisma } from './generated/prisma/client'

// Recruiter demo mode.
//
// A seeded "template" user (see scripts/seed-demo.ts) holds the synthetic network, the target
// job, and the WarmPaths/messages produced by running the real pipeline against it. Every
// "Try demo" click clones that template into a fresh sandbox user so visitors never share
// state, then a signed cookie identifies the sandbox. requireUser() falls back to that cookie
// when there is no Supabase session, but only ever resolves to users on the demo domain.

export const DEMO_COOKIE = 'wp_demo'
const SANDBOX_TTL_MS = 24 * 60 * 60 * 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

function secret(): string {
  const s = process.env.DEMO_COOKIE_SECRET ?? process.env.DATABASE_URL
  if (!s) throw new Error('DEMO_COOKIE_SECRET or DATABASE_URL must be set')
  return s
}

function sign(userId: string): string {
  return createHmac('sha256', secret()).update(userId).digest('base64url')
}

export function encodeDemoCookie(userId: string): string {
  return `${userId}.${sign(userId)}`
}

export function decodeDemoCookie(value: string | undefined): string | null {
  if (!value) return null
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return null
  const userId = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  const expected = sign(userId)
  if (sig.length !== expected.length) return null
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? userId : null
}

export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(`@${DEMO_DOMAIN}`)
}

export function isDemoUser(user: { email?: string | null } | null | undefined): boolean {
  return isDemoEmail(user?.email)
}

/** Clone the seeded template into a fresh sandbox user. Returns the sandbox user id and the demo job id. */
export async function createDemoSandbox(): Promise<{ userId: string; jobId: string }> {
  const template = (await prisma.user.findUnique({
    where: { email: DEMO_TEMPLATE_EMAIL },
    include: {
      contacts: true,
      jobs: { include: { warmPaths: { include: { messages: true } } } },
    },
  })) as AnyRecord | null
  if (!template || template.jobs.length === 0) {
    throw new Error('Demo template is not seeded')
  }

  // Opportunistic cleanup of stale sandboxes (cascade removes their data)
  await prisma.user.deleteMany({
    where: {
      email: { endsWith: `@${DEMO_DOMAIN}`, not: DEMO_TEMPLATE_EMAIL },
      createdAt: { lt: new Date(Date.now() - SANDBOX_TTL_MS) },
    },
  })

  const userId = randomUUID()
  const contactIdMap = new Map<string, string>()
  for (const c of template.contacts as AnyRecord[]) contactIdMap.set(c.id, randomUUID())

  const jobs = template.jobs as AnyRecord[]
  const jobIdMap = new Map<string, string>()
  for (const j of jobs) jobIdMap.set(j.id, randomUUID())

  const warmPathRows: Prisma.WarmPathCreateManyInput[] = []
  const messageRows: Prisma.MessageCreateManyInput[] = []
  for (const j of jobs) {
    for (const wp of j.warmPaths as AnyRecord[]) {
      const newWpId = randomUUID()
      warmPathRows.push({
        id: newWpId,
        jobId: jobIdMap.get(j.id)!,
        contactId: contactIdMap.get(wp.contactId)!,
        relevanceScore: wp.relevanceScore,
        scoreReasoning: wp.scoreReasoning,
        pathType: wp.pathType,
        recommendedAsk: wp.recommendedAsk,
        referralReadiness: wp.referralReadiness,
        nextAction: wp.nextAction,
        status: wp.status,
      })
      for (const m of wp.messages as AnyRecord[]) {
        messageRows.push({
          warmPathId: newWpId,
          channel: m.channel,
          messageType: m.messageType,
          body: m.body,
          status: m.status,
          createdAt: m.createdAt,
        })
      }
    }
  }

  await prisma.$transaction([
    prisma.user.create({
      data: {
        id: userId,
        email: `sandbox-${userId}@${DEMO_DOMAIN}`,
        schools: template.schools,
        pastCompanies: template.pastCompanies,
        organizations: template.organizations,
      },
    }),
    prisma.contact.createMany({
      data: (template.contacts as AnyRecord[]).map(c => ({
        id: contactIdMap.get(c.id)!,
        userId,
        name: c.name,
        title: c.title,
        company: c.company,
        linkedinUrl: null,
        email: null,
        relationshipStrength: c.relationshipStrength,
        schoolOverlap: c.schoolOverlap,
        companyOverlap: c.companyOverlap,
        lastInteractionDate: c.lastInteractionDate,
        notes: c.notes,
        source: c.source,
        educationHistory: c.educationHistory ?? undefined,
        employmentHistory: c.employmentHistory ?? undefined,
        headline: c.headline,
        location: c.location,
        organizations: c.organizations ?? undefined,
        skills: c.skills ?? undefined,
        enrichedAt: c.enrichedAt,
      })),
    }),
    prisma.job.createMany({
      data: jobs.map(j => ({
        id: jobIdMap.get(j.id)!,
        userId,
        title: j.title,
        company: j.company,
        url: j.url,
        rawDescription: j.rawDescription,
        opportunityBrief: j.opportunityBrief,
        networkingStrategy: j.networkingStrategy,
        extractedRequirements: j.extractedRequirements ?? undefined,
        status: j.status,
      })),
    }),
    prisma.warmPath.createMany({ data: warmPathRows }),
    ...(messageRows.length ? [prisma.message.createMany({ data: messageRows })] : []),
  ])

  return { userId, jobId: jobIdMap.get(jobs[0].id)! }
}
