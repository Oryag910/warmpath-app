/**
 * AI quality validation script.
 * Run BEFORE building UI to confirm prompts produce impressive output.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/test-prompts.ts
 *
 * Replace the sample data below with a real job you're applying to and real
 * contacts you have. The output should match your gut intuition.
 */

import {
  generateOpportunityBrief,
  rankContacts,
  generateMessage,
  generateFollowup,
  interpretReply,
} from '../lib/claude'

// ─── Replace with real data ──────────────────────────────────────────────────

const SAMPLE_JOB = {
  title: 'Product Specialist',
  company: 'Bilt Rewards',
  rawDescription: `
About the role:
Bilt Rewards is looking for a Product Specialist to join our fast-growing team. You will work
closely with our product and customer success teams to support our growing portfolio of
landlord and resident customers. You will serve as a key liaison between our product
organization and external stakeholders, helping to gather feedback, communicate product
updates, and drive adoption.

Responsibilities:
- Serve as primary point of contact for key landlord partners on product-related questions
- Translate customer feedback into actionable product insights for the engineering team
- Create training materials and documentation for new product features
- Analyze product usage data to identify trends and improvement opportunities
- Support launch of new product features with landlord and resident audiences
- Coordinate with cross-functional teams (engineering, design, marketing, sales)

Requirements:
- 2-4 years of experience in product, customer success, or operations roles
- Strong communication skills, both written and verbal
- Ability to work cross-functionally in a fast-paced environment
- Experience with data analysis tools (SQL a plus)
- Passion for fintech and real estate tech
- Bachelor's degree preferred
`,
}

const SAMPLE_CONTACTS = [
  {
    id: 'contact-1',
    name: 'Sarah Chen',
    title: 'Product Operations Manager',
    company: 'Bilt Rewards',
    relationshipStrength: 'medium' as const,
    schoolOverlap: true,
    companyOverlap: true,
    lastInteractionDate: new Date('2024-09-15'),
    notes: 'Met at a Columbia alumni event. We had a 20-min conversation about fintech. She seemed friendly.',
  },
  {
    id: 'contact-2',
    name: 'David Park',
    title: 'Senior Product Manager',
    company: 'Stripe',
    relationshipStrength: 'weak' as const,
    schoolOverlap: true,
    companyOverlap: false,
    lastInteractionDate: null,
    notes: 'Columbia alum, connected on LinkedIn. Never actually spoken.',
  },
  {
    id: 'contact-3',
    name: 'Maya Rodriguez',
    title: 'Head of Customer Success',
    company: 'Bilt Rewards',
    relationshipStrength: 'strong' as const,
    schoolOverlap: false,
    companyOverlap: true,
    lastInteractionDate: new Date('2024-11-01'),
    notes: 'Former coworker at previous company. She knows my work well and we stayed in touch.',
  },
  {
    id: 'contact-4',
    name: 'Allison Torres',
    title: 'Technical Recruiter',
    company: 'Bilt Rewards',
    relationshipStrength: 'weak' as const,
    schoolOverlap: false,
    companyOverlap: true,
    lastInteractionDate: null,
    notes: 'Found on LinkedIn. No connection.',
  },
  {
    id: 'contact-5',
    name: 'James Kim',
    title: 'VP of Product',
    company: 'Navan',
    relationshipStrength: 'medium' as const,
    schoolOverlap: false,
    companyOverlap: false,
    lastInteractionDate: new Date('2024-07-20'),
    notes: 'Former colleague. We worked together briefly 2 years ago. He moved to a different company.',
  },
]

// ────────────────────────────────────────────────────────────────────────────

function section(title: string) {
  console.log('\n' + '═'.repeat(60))
  console.log(`  ${title}`)
  console.log('═'.repeat(60))
}

async function main() {
  console.log('WarmPath Prompt Quality Test')
  console.log('Testing 5 prompts. This will take ~20 seconds...\n')

  // 1. Opportunity Brief
  section('1. Opportunity Brief')
  const brief = await generateOpportunityBrief(SAMPLE_JOB)
  console.log('\nBrief:')
  console.log(brief.opportunityBrief)
  console.log('\nNetworking Strategy:')
  console.log(brief.networkingStrategy)
  console.log('\nExtracted Requirements:')
  brief.extractedRequirements.forEach((r, i) => console.log(`  ${i + 1}. ${r}`))

  // 2. Contact Ranking
  section('2. Contact Ranking (most important)')
  const scores = await rankContacts(SAMPLE_JOB, SAMPLE_CONTACTS)
  console.log('\nRanked contacts (check: does #1 match your intuition?)\n')
  scores.forEach((s, i) => {
    const contact = SAMPLE_CONTACTS.find(c => c.id === s.contactId)
    console.log(`${i + 1}. ${contact?.name} (${s.relevanceScore.toFixed(2)})`)
    console.log(`   Path: ${s.pathType} | Ask: ${s.recommendedAsk} | Referral: ${s.referralReadiness}`)
    console.log(`   Reasoning: ${s.scoreReasoning}`)
    console.log(`   Next: ${s.nextAction}\n`)
  })

  // 3. Message Generation — use top contact
  const topScore = scores[0]
  const topContact = SAMPLE_CONTACTS.find(c => c.id === topScore.contactId)!
  section(`3. Message Generation — ${topContact.name}`)

  const linkedInMsg = await generateMessage(
    SAMPLE_JOB,
    topContact,
    {
      recommendedAsk: topScore.recommendedAsk,
      pathType: topScore.pathType,
      scoreReasoning: topScore.scoreReasoning,
    },
    'linkedin',
    'outreach'
  )
  console.log('\nLinkedIn DM:')
  console.log(linkedInMsg)
  console.log(`\n(${linkedInMsg.split(' ').length} words)`)

  // 4. Follow-up
  section(`4. Follow-up — ${topContact.name} (7 days no reply)`)
  const followup = await generateFollowup(SAMPLE_JOB, topContact, [linkedInMsg], 7)
  console.log('\nFollow-up:')
  console.log(followup)

  // 5. Reply Interpretation
  section('5. Reply Interpretation')
  const sampleReply = "Happy to chat next week. I'm not directly on the product team but I know the company pretty well and I'm happy to share some context."
  console.log('\nReply:')
  console.log(`"${sampleReply}"`)

  const interpretation = await interpretReply(SAMPLE_JOB, topContact, sampleReply)
  console.log('\nSentiment:', interpretation.sentiment)
  console.log('What to do next:', interpretation.suggestedNextStep)

  section('Done')
  console.log('\nIf all 5 outputs above would genuinely impress you, the prompts are ready.')
  console.log('If any output feels generic or wrong, iterate on lib/claude.ts before building the UI.\n')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
