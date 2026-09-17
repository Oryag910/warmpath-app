import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { prisma } from './prisma'
import { DEMO_DOMAIN, DEMO_TEMPLATE_EMAIL, DEMO_USER } from './demo/data'
import type { Prisma } from './generated/prisma/client'

// Recruiter demo mode.
//
// A seeded "template" user (see scripts/seed-demo.ts) holds the synthetic network, the target
// job, and the WarmPaths/messages produced by running the real pipeline against it. Every
// "Try demo" click clones that template into a fresh sandbox user so visitors never share
// state, then a signed cookie identifies the sandbox. requireUser() falls back to that cookie
// when there is no Supabase session, but only ever resolves to users on the demo domain.

export const DEMO_COOKIE = 'wp_demo'
export const DEMO_PERSONA_NAME = DEMO_USER.name
const SANDBOX_TTL_MS = 24 * 60 * 60 * 1000

// Abuse guards for anonymous sandboxes. Counts come from rows the sandbox already owns, so
// there is no extra state to store; limits are per sandbox, not per IP.
export const DEMO_LIMITS = {
  generate: 8,          // live message drafts (outreach / follow-up / referral ask) per sandbox
  reply: 5,             // reply interpretations per sandbox
  sandboxesPer10Min: 40 // global cap on new sandboxes, protects the clone path from bots
}
const DEMO_BLOCKED_MESSAGE = 'Not available in the demo sandbox. Sign up to use this with your own network.'

export type DemoAction = 'generate' | 'reply' | 'rank' | 'brief' | 'scrape' | 'job_create'
export type DemoCheck = { ok: true } | { ok: false; status: number; message: string }

/** Real users always pass. Demo sandboxes get per-sandbox counters or a plain block per action. */
export async function checkDemoLimit(
  user: { id: string; email?: string | null; createdAt?: Date | null },
  action: DemoAction
): Promise<DemoCheck> {
  if (!isDemoUser(user)) return { ok: true }
  switch (action) {
    case 'generate': {
      // Seeded drafts keep the template's timestamps, so counting from the sandbox's own
      // creation time counts only the visitor's live generations
      const used = await prisma.message.count({
        where: { warmPath: { job: { userId: user.id } }, createdAt: { gte: user.createdAt ?? new Date(0) } },
      })
      if (used >= DEMO_LIMITS.generate) {
        return { ok: false, status: 429, message: `This demo sandbox has used its ${DEMO_LIMITS.generate} live drafts. Start a new demo from the landing page to keep exploring.` }
      }
      return { ok: true }
    }
    case 'reply': {
      const used = await prisma.replyAnalysis.count({ where: { message: { warmPath: { job: { userId: user.id } } } } })
      if (used >= DEMO_LIMITS.reply) {
        return { ok: false, status: 429, message: `This demo sandbox has used its ${DEMO_LIMITS.reply} reply interpretations.` }
      }
      return { ok: true }
    }
    default:
      return { ok: false, status: 403, message: DEMO_BLOCKED_MESSAGE }
  }
}

export class DemoBusyError extends Error {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

// Dedicated signing secret for the sandbox cookie. Deliberately not derived from any other
// credential: rotating it only invalidates demo cookies, and a leaked cookie key exposes nothing else.
function secret(): string {
  const s = process.env.DEMO_COOKIE_SECRET
  if (!s) throw new Error('DEMO_COOKIE_SECRET must be set to enable the demo sandbox')
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

  // Global throttle on sandbox creation (each clone writes ~1,100 rows)
  const recent = await prisma.user.count({
    where: { email: { endsWith: `@${DEMO_DOMAIN}`, not: DEMO_TEMPLATE_EMAIL }, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
  })
  if (recent >= DEMO_LIMITS.sandboxesPer10Min) throw new DemoBusyError('Too many demo sandboxes created recently')

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
