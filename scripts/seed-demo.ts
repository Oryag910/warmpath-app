/**
 * Seed the recruiter demo template.
 *
 * Creates (or fully rebuilds) the template demo user with the synthetic network from
 * lib/demo/data.ts, then runs the REAL pipeline against it — opportunity brief, the
 * two-stage ranking funnel, and outreach drafts for the top paths — and stores the results.
 * Every "Try the demo" click clones this template into a fresh sandbox (lib/demo.ts).
 *
 * Usage:  npx tsx scripts/seed-demo.ts
 * Env:    DATABASE_URL, ANTHROPIC_API_KEY (from .env / .env.local)
 *         DRAFTS=3   how many top paths get a pre-generated LinkedIn draft (default 3)
 */
import './load-env'

import { prisma } from '../lib/prisma'
import { DEMO_JOB, DEMO_TEMPLATE_EMAIL, DEMO_USER, buildDemoContacts } from '../lib/demo/data'
import { generateOpportunityBrief, generateMessage } from '../lib/claude'
import { rankJob, RECOMMEND_THRESHOLD } from '../lib/ranking'

const DRAFTS = parseInt(process.env.DRAFTS ?? '3')

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')

  console.log('Rebuilding demo template user…')
  await prisma.user.deleteMany({ where: { email: DEMO_TEMPLATE_EMAIL } })
  const user = await prisma.user.create({
    data: {
      email: DEMO_TEMPLATE_EMAIL,
      schools: DEMO_USER.schools,
      pastCompanies: DEMO_USER.pastCompanies,
      organizations: DEMO_USER.organizations,
    },
  })

  const contacts = buildDemoContacts()
  const enrichedAt = new Date('2026-09-01T12:00:00Z')
  await prisma.contact.createMany({
    data: contacts.map(c => ({
      userId: user.id,
      name: c.name,
      title: c.title,
      company: c.company,
      headline: c.enriched ? c.headline : null,
      location: c.enriched ? c.location : null,
      relationshipStrength: c.relationshipStrength,
      schoolOverlap: c.schoolOverlap,
      companyOverlap: false,
      notes: c.notes,
      source: 'demo',
      educationHistory: c.educationHistory,
      employmentHistory: c.employmentHistory,
      organizations: c.organizations,
      skills: c.skills,
      enrichedAt: c.enriched ? enrichedAt : null,
      lastInteractionDate: c.lastInteractionDate ? new Date(c.lastInteractionDate) : null,
    })),
  })
  console.log(`Created ${contacts.length} synthetic contacts`)

  const job = await prisma.job.create({
    data: {
      userId: user.id,
      title: DEMO_JOB.title,
      company: DEMO_JOB.company,
      url: DEMO_JOB.url,
      rawDescription: DEMO_JOB.rawDescription,
    },
  })

  console.log('Generating opportunity brief…')
  const brief = await generateOpportunityBrief({
    title: job.title, company: job.company, rawDescription: job.rawDescription,
  })
  await prisma.job.update({
    where: { id: job.id },
    data: {
      opportunityBrief: brief.opportunityBrief,
      networkingStrategy: brief.networkingStrategy,
      extractedRequirements: brief.extractedRequirements,
    },
  })

  console.log('Ranking network (real pipeline)…')
  const result = await rankJob(user, job, { rankAll: true })
  console.log(`Screened ${result.totalContacts} → scored ${result.rankedCount} → recommended ${result.recommendedCount}`)

  const warmPaths = (await prisma.warmPath.findMany({
    where: { jobId: job.id },
    include: { contact: true },
    orderBy: { relevanceScore: 'desc' },
  })) as any[]

  console.log('\nRanked results:')
  for (const wp of warmPaths) {
    const tier = (wp.relevanceScore ?? 0) >= RECOMMEND_THRESHOLD ? 'REC ' : 'weak'
    console.log(
      `  ${tier} ${(wp.relevanceScore ?? 0).toFixed(2)}  ${wp.contact.name.padEnd(20)} ${String(wp.contact.company ?? '').padEnd(12)} ${wp.pathType ?? ''}/${wp.recommendedAsk ?? ''}`
    )
  }

  const top = warmPaths.filter(wp => (wp.relevanceScore ?? 0) >= RECOMMEND_THRESHOLD).slice(0, DRAFTS)
  console.log(`\nDrafting LinkedIn outreach for top ${top.length}…`)
  for (const wp of top) {
    const c = wp.contact
    const body = await generateMessage(
      { title: job.title, company: job.company, rawDescription: job.rawDescription },
      {
        id: c.id, name: c.name, title: c.title, company: c.company,
        relationshipStrength: c.relationshipStrength, schoolOverlap: c.schoolOverlap,
        companyOverlap: true, lastInteractionDate: c.lastInteractionDate, notes: c.notes,
      },
      { recommendedAsk: wp.recommendedAsk ?? 'context_ask', pathType: wp.pathType ?? 'direct', scoreReasoning: wp.scoreReasoning ?? '' },
      'linkedin',
      'outreach'
    )
    await prisma.message.create({
      data: { warmPathId: wp.id, channel: 'linkedin', messageType: 'outreach', body },
    })
    await prisma.warmPath.update({ where: { id: wp.id }, data: { status: 'drafted' } })
    console.log(`  drafted for ${c.name} (${body.split(/\s+/).length} words)`)
  }

  console.log('\nDemo template seeded. Job id:', job.id)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
