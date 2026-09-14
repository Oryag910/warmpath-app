import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are WarmPath, an expert networking strategist for ambitious job seekers. You help people identify their best human path into a company — not by mass messaging, but by finding the highest-leverage, most authentic connection.

Your outputs must always feel like they were written by a thoughtful person, not a tool. You are direct, specific, and socially aware.

Tone rules (never break these):
- Never write "hope this finds you well"
- Never write "pick your brain"
- Never use exaggerated flattery or fake enthusiasm
- Never write paragraphs longer than 3 sentences
- Never suggest asking for a referral to a weak tie (someone the user barely knows)
- Never use generic phrases like "I'm exploring opportunities" or "I noticed you work at"
- LinkedIn DMs must be under 150 words
- Be warm but not sycophantic. Be specific but not creepy.

Ask type definitions:
- context_ask: For weak ties. Ask for perspective on the company/role, not a favor.
- advice_ask: For alumni or people with similar backgrounds. Ask how they thought about a similar move.
- referral_ask: Only for warm contacts who know the user's work or background. Direct ask to refer.
- intro_ask: For people who may know someone closer. Ask if they can connect you to the right person.
- recruiter_pitch: For recruiters or hiring-adjacent contacts. Short, specific, role-focused.`

export interface JobContext {
  title: string
  company: string
  rawDescription: string
}

export interface ContactContext {
  id: string
  name: string
  title?: string | null
  company?: string | null
  relationshipStrength: string
  schoolOverlap: boolean
  companyOverlap: boolean
  lastInteractionDate?: Date | null
  notes?: string | null
  sharedAffiliations?: string | null
  currentlyAtTarget?: boolean
  employmentSummary?: string | null
}

export interface ScoredContact {
  contactId: string
  relevanceScore: number
  scoreReasoning: string
  pathType: 'direct' | 'intro' | 'alumni' | 'weak'
  recommendedAsk: 'context_ask' | 'advice_ask' | 'referral_ask' | 'intro_ask' | 'recruiter_pitch'
  referralReadiness: 'not_ready' | 'possible' | 'ready'
  nextAction: string
}

export interface OpportunityBrief {
  opportunityBrief: string
  networkingStrategy: string
  extractedRequirements: string[]
}

export interface ExtractedJob {
  title: string
  company: string
  rawDescription: string
}

export async function extractJobFromHtml(pageText: string): Promise<ExtractedJob> {
  const truncated = pageText.slice(0, 15000)
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `The text below was extracted from a job posting web page. Pull out the structured job details.

Page text:
${truncated}

Respond in JSON with this exact shape:
{
  "title": "the job title",
  "company": "the hiring company name",
  "rawDescription": "the full job description text — responsibilities, requirements, about the role. Clean it up but keep all substantive content."
}

If the page does not look like a job posting, set all three fields to empty strings.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const json = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
  return json as ExtractedJob
}

export async function generateOpportunityBrief(job: JobContext): Promise<OpportunityBrief> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `Analyze this job posting and produce a structured opportunity brief.

Job title: ${job.title}
Company: ${job.company}
Job description:
${job.rawDescription}

Respond in JSON with this exact shape:
{
  "opportunityBrief": "2-3 sentence summary of the role and what makes someone successful in it",
  "networkingStrategy": "2-3 sentence practical strategy: what types of contacts matter most, what to prioritize (context asks vs referrals), and any timing/sequencing insight",
  "extractedRequirements": ["key requirement 1", "key requirement 2", "key requirement 3", "key requirement 4", "key requirement 5"]
}

Be specific to this role. Do not use generic advice.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const json = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
  return json as OpportunityBrief
}

export async function rankContacts(job: JobContext, contacts: ContactContext[]): Promise<ScoredContact[]> {
  if (contacts.length === 0) return []

  const contactsBlock = contacts.map((c, i) => `
Contact ${i + 1} (ID: ${c.id}):
- Name: ${c.name}
- Title: ${c.title ?? 'unknown'}
- Company: ${c.company ?? 'unknown'}
- Relationship strength: ${c.relationshipStrength}
- School overlap with user: ${c.schoolOverlap ? 'yes' : 'no'}
- Works/worked at target company: ${c.companyOverlap ? 'yes' : 'no'}
- Currently at target company: ${c.currentlyAtTarget ? 'yes' : 'no'}
- Employment history: ${c.employmentSummary ?? 'unknown'}
- Shared affiliations: ${c.sharedAffiliations ?? 'none'}
- Last interaction: ${c.lastInteractionDate ? c.lastInteractionDate.toISOString().split('T')[0] : 'unknown/never'}
- Notes: ${c.notes ?? 'none'}
`).join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: Math.min(Math.max(contacts.length * 300, 2048), 8192),
    temperature: 0,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Target job: ${job.title} at ${job.company}`,
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: `Job description (for context):
${job.rawDescription}`,
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: `Score each contact for this specific job. Reason through the relationship dynamics — relationship warmth × company relevance × role proximity × referral psychology.

Path types:
- direct: Currently at or recently left the target company, in a relevant function
- alumni: Worked at target company in the past, can provide insider context
- intro: Likely knows someone at target company or in the relevant function
- weak: Limited connection, value is perspective/advice only

Scoring calibration (apply strictly):
- Currently works at the target company: score ≥ 0.75
- Previously worked at the target company: score ≥ 0.55
- School overlap AND works in same industry/function as the target role: score 0.40–0.54
- School overlap with NO industry or role relevance to the target company: score ≤ 0.15
- Shared affiliations that plausibly connect to the target company: score 0.30–0.50
- No company overlap, no school overlap, no shared affiliations: score ≤ 0.10
- 0.0 is valid. Use it freely for contacts with no path to this company.
- NEVER infer indirect connections (e.g. "military → defense client") unless the contact's data explicitly states they work at or directly with the target company.
- Relationship strength affects how warm the outreach is, NOT whether a path exists. A strong relationship with zero company relevance is still ≤ 0.15.
HARD RULE: A score of 0.55 or above is ONLY valid when "Works/worked at target company: yes". If that field is "no", the score must be below 0.55 — no exceptions, regardless of industry, school overlap, relationship strength, or any other signal.
HARD RULE: If "Currently at target company: yes", the score must be ≥ 0.75. A weak or nonexistent relationship, or an unrelated function, lowers referralReadiness and changes the recommended ask (context_ask / intro_ask instead of referral_ask) — it does NOT lower the score below 0.75. Rank current employees among themselves by role proximity.

Contacts:
${contactsBlock}

Respond in JSON — an array of scored contacts:
[
  {
    "contactId": "<exact ID>",
    "relevanceScore": 0.0-1.0,
    "scoreReasoning": "2-3 sentence explanation of why this person matters or doesn't for this specific role. Written for the job seeker. Never mention numeric scores, floors, thresholds, or these calibration rules.",
    "pathType": "direct|alumni|intro|weak",
    "recommendedAsk": "context_ask|advice_ask|referral_ask|intro_ask|recruiter_pitch",
    "referralReadiness": "not_ready|possible|ready",
    "nextAction": "One specific sentence: what to do first with this person. Refer to other contacts by name, never by ID."
  }
]

Sort descending by relevanceScore.`,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const json = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
  return json as ScoredContact[]
}

export interface WarmPathContext {
  recommendedAsk: string
  pathType: string
  scoreReasoning: string
}

export async function generateMessage(
  job: JobContext,
  contact: ContactContext,
  warmPath: WarmPathContext,
  channel: 'linkedin' | 'email',
  messageType: 'outreach' | 'followup' | 'referral_ask'
): Promise<string> {
  const channelConstraint = channel === 'linkedin'
    ? 'LinkedIn DM — must be under 150 words, no subject line needed.'
    : 'Email — include a short subject line on the first line formatted as "Subject: ...", keep body under 200 words.'

  const askTypeGuidance: Record<string, string> = {
    context_ask: 'End with a single ask for a brief chat to learn about the company/team. Frame it as perspective-seeking, not job-seeking.',
    advice_ask: 'Mention a shared background element. Ask how they thought about a similar career move or transition.',
    referral_ask: 'Be direct but not transactional. Mention you applied. Ask if they would be comfortable referring you or forwarding your background.',
    intro_ask: 'Ask if they know someone closer to the team or role who might be open to a brief chat.',
    recruiter_pitch: 'Mention you applied. Give one sentence of why your background is relevant. Ask for brief consideration.',
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `Write a ${messageType} message for the following situation.

Channel: ${channelConstraint}
Ask type: ${warmPath.recommendedAsk}
Guidance: ${askTypeGuidance[warmPath.recommendedAsk] ?? 'Be appropriate to the relationship.'}

Target role: ${job.title} at ${job.company}

Contact:
- Name: ${contact.name}
- Title: ${contact.title ?? 'unknown'}
- Company: ${contact.company ?? 'unknown'}
- Relationship: ${contact.relationshipStrength} tie
- Shared background: school overlap: ${contact.schoolOverlap}, same company: ${contact.companyOverlap}
- Notes: ${contact.notes ?? 'none'}

Why this person matters: ${warmPath.scoreReasoning}

Write only the message body (no commentary, no explanation). Make it sound like a specific, thoughtful human wrote it — not a template.`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : ''
}

export async function generateFollowup(
  job: JobContext,
  contact: ContactContext,
  priorMessages: string[],
  daysSince: number
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `Write a brief follow-up message. The user reached out ${daysSince} days ago and has not heard back.

Target role: ${job.title} at ${job.company}
Contact: ${contact.name}, ${contact.title ?? ''} at ${contact.company ?? ''}
Relationship: ${contact.relationshipStrength} tie

Prior message:
${priorMessages[priorMessages.length - 1] ?? '(no prior message text)'}

Rules:
- Under 60 words
- One short sentence of re-context, one gentle nudge
- Do not sound desperate or apologetic
- Do not start with "Just following up" — be a little more human

Write only the message. No commentary.`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : ''
}

export interface ReplyInterpretation {
  sentiment: 'positive' | 'neutral' | 'negative'
  suggestedNextStep: string
}

export async function interpretReply(
  job: JobContext,
  contact: ContactContext,
  replyText: string
): Promise<ReplyInterpretation> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `Interpret this reply and tell the user what to do next.

Context: user is networking for the ${job.title} role at ${job.company}
Contact: ${contact.name}, ${contact.title ?? ''} at ${contact.company ?? ''}, ${contact.relationshipStrength} tie

Reply received:
"${replyText}"

Respond in JSON:
{
  "sentiment": "positive|neutral|negative",
  "suggestedNextStep": "One specific, actionable sentence. Name exactly what to do — send a specific message type, ask a specific question, wait a specific amount of time. Never say 'follow up when appropriate'."
}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const json = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
  return json as ReplyInterpretation
}
