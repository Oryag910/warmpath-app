/**
 * Prompt quality check. Runs the five model calls in lib/claude.ts against the synthetic demo
 * scenario (Stripe internship, a handful of the seeded contacts) and prints the outputs so prompt
 * changes can be eyeballed before they ship. Makes live Claude calls (~20 s, five requests).
 *
 *   ANTHROPIC_API_KEY=... npx tsx scripts/test-prompts.ts
 */
import './load-env'
import {
  generateOpportunityBrief,
  rankContacts,
  generateMessage,
  generateFollowup,
  interpretReply,
  type ContactContext,
} from '../lib/claude'
import { DEMO_JOB, DEMO_USER, buildDemoContacts } from '../lib/demo/data'
import {
  buildSharedAffiliations,
  companyDistinctiveWords,
  employmentSummary,
  isCurrentlyAtCompany,
  userOrgNames,
  userSchoolNames,
} from '../lib/path-signals'

const SAMPLE_JOB = { title: DEMO_JOB.title, company: DEMO_JOB.company, rawDescription: DEMO_JOB.rawDescription }

// A small, mixed pool: insiders, former employees, and affiliation-only contacts
const words = companyDistinctiveWords(SAMPLE_JOB.company)
const schools = userSchoolNames(DEMO_USER)
const orgs = userOrgNames(DEMO_USER)
const SAMPLE_CONTACTS: ContactContext[] = buildDemoContacts()
  .filter(c => c.companyOverlap || c.schoolOverlap)
  .slice(0, 8)
  .map((c, i) => ({
    id: `c${i + 1}`,
    name: c.name,
    title: c.title,
    company: c.company,
    relationshipStrength: c.relationshipStrength,
    schoolOverlap: c.schoolOverlap,
    companyOverlap: c.companyOverlap,
    lastInteractionDate: c.lastInteractionDate ? new Date(c.lastInteractionDate) : null,
    notes: c.notes,
    sharedAffiliations: buildSharedAffiliations(c, schools, orgs),
    currentlyAtTarget: isCurrentlyAtCompany(c, words),
    employmentSummary: employmentSummary(c),
  }))

function section(title: string) {
  console.log('\n' + '═'.repeat(60))
  console.log(`  ${title}`)
  console.log('═'.repeat(60))
}

async function main() {
  console.log('WarmPath prompt quality check')
  console.log(`Job: ${SAMPLE_JOB.title} at ${SAMPLE_JOB.company} · ${SAMPLE_CONTACTS.length} contacts\n`)

  section('1. Opportunity brief')
  const brief = await generateOpportunityBrief(SAMPLE_JOB)
  console.log('\nBrief:\n' + brief.opportunityBrief)
  console.log('\nNetworking strategy:\n' + brief.networkingStrategy)
  console.log('\nRequirements:')
  brief.extractedRequirements.forEach((r, i) => console.log(`  ${i + 1}. ${r}`))

  section('2. Contact ranking')
  const scores = await rankContacts(SAMPLE_JOB, SAMPLE_CONTACTS)
  scores.forEach((s, i) => {
    const contact = SAMPLE_CONTACTS.find(c => c.id === s.contactId)
    console.log(`${i + 1}. ${contact?.name ?? s.contactId} (${s.relevanceScore.toFixed(2)})`)
    console.log(`   Path: ${s.pathType} | Ask: ${s.recommendedAsk} | Referral: ${s.referralReadiness}`)
    console.log(`   Why: ${s.scoreReasoning}`)
    console.log(`   Next: ${s.nextAction}\n`)
  })

  const topScore = scores[0]
  const topContact = SAMPLE_CONTACTS.find(c => c.id === topScore.contactId)!
  section(`3. Outreach draft — ${topContact.name}`)
  const linkedInMsg = await generateMessage(
    SAMPLE_JOB,
    topContact,
    { recommendedAsk: topScore.recommendedAsk, pathType: topScore.pathType, scoreReasoning: topScore.scoreReasoning },
    'linkedin',
    'outreach',
    { senderName: DEMO_USER.name }
  )
  console.log('\n' + linkedInMsg)
  console.log(`\n(${linkedInMsg.split(/\s+/).length} words)`)

  section(`4. Follow-up — ${topContact.name}, 7 days without a reply`)
  console.log('\n' + await generateFollowup(SAMPLE_JOB, topContact, [linkedInMsg], 7))

  section('5. Reply interpretation')
  const sampleReply = "Happy to chat next week. I'm not on that team but I know the company well and can share some context."
  console.log(`\nReply: "${sampleReply}"`)
  const interpretation = await interpretReply(SAMPLE_JOB, topContact, sampleReply)
  console.log('Sentiment:', interpretation.sentiment)
  console.log('Next step:', interpretation.suggestedNextStep)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
