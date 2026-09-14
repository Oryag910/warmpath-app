# Prompts

Catalog of the Claude API calls in `lib/claude.ts`. All use model `claude-sonnet-4-6`.

---

## Shared system prompt (`SYSTEM_PROMPT`)

Cached with `cache_control: ephemeral` on every call.

```
You are WarmPath, an expert networking strategist for ambitious job seekers. You help people identify their best human path into a company — not by mass messaging, but by finding the highest-leverage, most authentic connection.

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
- recruiter_pitch: For recruiters or hiring-adjacent contacts. Short, specific, role-focused.
```

---

## `extractJobFromHtml(pageText)`

**Purpose:** Parse scraped job-page text into structured fields.
**Input:** `pageText` (raw text from the fetched page), truncated to 15,000 chars.
**Output:** `{ title: string, company: string, rawDescription: string }` — all empty strings if the page isn't a job posting.
**Caching:** system prompt only.
**Max tokens:** 2048.

User prompt template:
```
The text below was extracted from a job posting web page. Pull out the structured job details.

Page text:
{truncated text}

Respond in JSON with this exact shape:
{
  "title": "...",
  "company": "...",
  "rawDescription": "..."
}

If the page does not look like a job posting, set all three fields to empty strings.
```

---

## `generateOpportunityBrief(job)`

**Purpose:** Produce a role summary + networking strategy for a job.
**Input:** `{ title, company, rawDescription }`.
**Output:** `{ opportunityBrief: string, networkingStrategy: string, extractedRequirements: string[] }`.
**Caching:** system prompt only.
**Max tokens:** 1024.

User prompt template:
```
Analyze this job posting and produce a structured opportunity brief.

Job title: {title}
Company: {company}
Job description:
{rawDescription}

Respond in JSON:
{
  "opportunityBrief": "2-3 sentence summary of the role and what makes someone successful in it",
  "networkingStrategy": "2-3 sentence practical strategy: what types of contacts matter most, what to prioritize, any timing/sequencing insight",
  "extractedRequirements": ["key requirement 1", ..., "key requirement 5"]
}

Be specific to this role. Do not use generic advice.
```

---

## `rankContacts(job, contacts[])`

**Purpose:** Score the full contact list for a specific job in one call.
**Input:** `job` + array of `ContactContext` objects (id, name, title, company, relationshipStrength, schoolOverlap, companyOverlap, sharedAffiliations, lastInteractionDate, notes).
**Output:** `ScoredContact[]` sorted descending by `relevanceScore`.
**Caching:** system prompt cached; additionally, the job title line and job description are each cached as `ephemeral` anchors (two extra cache blocks so subsequent calls for the same job reuse the prefix).
**Max tokens:** 2048.

```typescript
ScoredContact {
  contactId: string
  relevanceScore: number          // 0.0–1.0
  scoreReasoning: string          // 2-3 sentences
  pathType: 'direct' | 'alumni' | 'intro' | 'weak'
  recommendedAsk: 'context_ask' | 'advice_ask' | 'referral_ask' | 'intro_ask' | 'recruiter_pitch'
  referralReadiness: 'not_ready' | 'possible' | 'ready'
  nextAction: string              // one specific sentence
}
```

User message is three content blocks (the third is the actual task):
1. `"Target job: {title} at {company}"` — cached ephemeral
2. `"Job description (for context): {rawDescription}"` — cached ephemeral
3. Scoring task + per-contact block + JSON output instructions (not cached)

Path type definitions embedded in the scoring task:
- **direct** — currently at or recently left target company, relevant function
- **alumni** — worked there in the past, insider context
- **intro** — likely knows someone at the company or in the function
- **weak** — limited connection, perspective/advice only

---

## `generateMessage(job, contact, warmPath, channel, messageType)`

**Purpose:** Draft an outreach message.
**Inputs:** job, contact, warmPath (recommendedAsk, pathType, scoreReasoning), `channel` (`linkedin|email`), `messageType` (`outreach|followup|referral_ask`).
**Output:** message string (no commentary).
**Caching:** system prompt only.
**Max tokens:** 512.

Channel constraints baked into the prompt:
- `linkedin` — LinkedIn DM, under 150 words, no subject line
- `email` — include `Subject: …` on first line, body under 200 words

Ask-type guidance map (embedded in prompt):
- `context_ask` — frame as perspective-seeking; end with a brief-chat ask
- `advice_ask` — mention shared background; ask how they thought about a similar move
- `referral_ask` — be direct, mention you applied, ask if comfortable referring
- `intro_ask` — ask if they know someone closer to the team
- `recruiter_pitch` — one sentence on why your background fits; ask for consideration

---

## `generateFollowup(job, contact, priorMessages[], daysSince)`

**Purpose:** Write a brief non-cringe follow-up when the user hasn't heard back.
**Inputs:** job, contact, last prior message body, days since last send.
**Output:** message string under 60 words.
**Caching:** system prompt only.
**Max tokens:** 256.

Rules embedded: under 60 words; one short re-context sentence + one gentle nudge; not desperate; never start with "Just following up."

---

## `interpretReply(job, contact, replyText)`

**Purpose:** Read a received reply and tell the user what to do next.
**Inputs:** job, contact, raw reply text.
**Output:** `{ sentiment: 'positive' | 'neutral' | 'negative', suggestedNextStep: string }` — `suggestedNextStep` must be one specific, actionable sentence (never "follow up when appropriate").
**Caching:** system prompt only.
**Max tokens:** 256.

---

## Testing prompts

`npx tsx scripts/test-prompts.ts` — runs prompt quality assertions against the real Claude API. Run this when modifying any prompt in `lib/claude.ts`.


## rankContacts — inputs added for the demo release

The per-contact block now also carries `Currently at target company: yes/no` and `Employment history: Company — Title (dates); …` (from `employmentSummary()` in `lib/path-signals.ts`), and the prompt has a second HARD RULE: a current employee scores ≥ 0.75 (relationship weakness changes the ask and referral readiness, not the score). `scoreReasoning` must not mention numeric scores, floors or calibration rules. The call runs at `temperature: 0`. Contact ids in the prompt are short indices (`c1…cN`) mapped back in `rankJob`.
