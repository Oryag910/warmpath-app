# Architecture

System narrative for WarmPath: request lifecycle, data model, the ranking pipeline, the AI layer, and the recruiter demo. The README has the short version.

## Stack

Next.js 16 (App Router) + TypeScript · Supabase (Auth + PostgreSQL) · Prisma 7 with `@prisma/adapter-pg` · Claude API (`@anthropic-ai/sdk`, `claude-sonnet-4-6`) · Tailwind v4 + shadcn/ui on `@base-ui/react` · Vercel.

## Request lifecycle

1. **`proxy.ts`** (Next.js 16's name for `middleware.ts`) runs on every request: it refreshes the Supabase session cookie, rewrites an anonymous `/` to the landing page, lets `/demo`, `/landing`, `/login` and `/signup` through, and redirects every other unauthenticated request to `/login`. A request carrying the demo cookie is let through; the cookie is verified later, in `lib/auth.ts`.
2. Pages under **`app/(app)/`** (a route group, no URL segment) are the authenticated shell.
3. Server code that needs the current user calls **`requireUser()`** (`lib/auth.ts`). It resolves the Supabase user and upserts the matching Prisma `User` row keyed by email. With no Supabase session it falls back to the signed demo cookie, which can only ever resolve to a user on the reserved demo domain. A cookie that fails verification is cleared and the visitor is sent back to the landing page.
4. **`lib/prisma.ts`** exports a singleton `PrismaClient` built on the `PrismaPg` adapter (Prisma 7 requires a driver adapter). It is cached on `globalThis` in development to survive HMR.

## Data model

`prisma/schema.prisma`:

```
User ──< Job ──< WarmPath >── Contact
                    │
                    └──< Message ──1 ReplyAnalysis
```

- **User** — auth identity plus profile arrays (`schools`, `pastCompanies`, `organizations`) used for affiliation matching.
- **Job** — the posting (`title`, `company`, `url?`, `rawDescription`) plus the generated `opportunityBrief`, `networkingStrategy` and `extractedRequirements`. Null until the brief is generated.
- **Contact** — a person in the user's network. Core fields (`name`, `title`, `company`, `linkedinUrl`, `relationshipStrength`, `schoolOverlap`, `companyOverlap`, `notes`, `source`) plus optional profile history (`headline`, `location`, `educationHistory`, `employmentHistory`, `organizations`, `skills`, `enrichedAt`). Unique on `(userId, linkedinUrl)`.
- **WarmPath** — one Job × one Contact, and the heart of the product. Holds every scored field: `relevanceScore` (0–1), `scoreReasoning`, `pathType` (`direct | alumni | intro | weak`), `recommendedAsk` (`context_ask | advice_ask | referral_ask | intro_ask | recruiter_pitch`), `referralReadiness`, `nextAction`, and the outreach `status` (`not_started → drafted → sent → replied → meeting_set → referred / closed`). Unique on `(jobId, contactId)`.
- **Message** — a drafted or sent message on a WarmPath (`channel` linkedin | email, `messageType` outreach | followup | referral_ask, `body`, `status`).
- **ReplyAnalysis** — 1:1 with a Message: the pasted reply plus `sentiment` and `suggestedNextStep`.
- **DiscoveredContact** — a second-degree person at a target company with the bridge contact who can introduce the user. The tracking UI is in the app; the tooling that populated it is experimental and not part of this repository.

AI-derived fields are nullable and written on demand (rank, generate brief, draft message) rather than eagerly, which keeps model calls explicit and cheap.

## Ranking pipeline

`rankJob(user, job, { rankAll | contactIds })` in `lib/ranking.ts` is the single entry point, used by the warm-paths API route and by the demo seed. It runs three stages; the pure matching helpers live in `lib/path-signals.ts`, which is dependency-free so client components can reuse the same logic for explanation chips.

**Stage 1 — deterministic retrieval.** The target company is reduced to its distinctive words (`"Palantir Technologies"` → `palantir`) so generic words never match. A contact is a company match if that word appears in their current `company` or any `employmentHistory` entry. Up to 30 company matches, ordered by a small heuristic, plus up to 5 contacts with a school or organization shared with the user, form the candidate pool. Everyone else is never sent to the model.

**Stage 2 — one batched scoring call.** `rankContacts` scores the whole pool in a single call so scores are relative to each other. Each contact is sent with a short index id (`c1 … cN`), their relationship strength, shared affiliations, a condensed employment summary and an explicit "currently at target company" flag. The prompt fixes the calibration: employment at the target company is what makes a path warm; relationship strength shapes the ask, not the score; the model may not infer connections it cannot see. The call runs at `temperature: 0`, and explanations must not mention scores or rules.

**Stage 3 — deterministic invariants.** After the model responds: short ids are mapped back to real contact ids (long ids were being mis-copied and silently dropped); current employees are floored to the recommend threshold (0.55) and former employees to 0.30; every scored candidate is persisted so the UI can show who was considered and not recommended; and stale rows from a previous ranking are only replaced inside a transaction that runs after scoring succeeds. Paths that were already in progress are preserved.

The job page renders the result as a funnel (connections screened → candidates scored → recommended), then the ranked cards with `pathSignals()` chips (currently at / formerly at / school alum / shared org / tie strength), and a collapsed tier of the non-recommended candidates.

## Other flows

- **Create job** — `/jobs/new`. An optional URL goes to `POST /api/jobs/scrape-url`, which fetches the page, strips it to text and calls `extractJobFromHtml`; blocked or JS-only pages fall back to manual entry. The brief is generated separately by `/api/jobs/[id]/brief` and surfaced by `brief-loader.tsx`.
- **Contacts** — manual entry, LinkedIn connections CSV import (`lib/linkedin-csv.ts`, parsed client-side, deduplicated on LinkedIn URL then name + company), and optional Apollo.io company search (`lib/apollo.ts`, dormant without `APOLLO_API_KEY`).
- **Draft message** — `/jobs/[id]/messages/[contactId]` → `generateMessage` with the channel and the recommended ask baked into the prompt (LinkedIn DM < 150 words; email gets a subject line and < 200 words). Follow-ups use `generateFollowup`.
- **Reply handling** — paste a reply → `interpretReply` → `{ sentiment, suggestedNextStep }` stored as `ReplyAnalysis`.
- **Queue** — `/queue` lists actionable warm paths across all jobs, sorted by score.

## AI layer (`lib/claude.ts`)

One module, one shared `SYSTEM_PROMPT` (persona, hard tone rules, ask-type definitions). Functions:

| Function | Purpose | Output |
|---|---|---|
| `extractJobFromHtml(pageText)` | Parse a scraped job page | `{ title, company, rawDescription }` |
| `generateOpportunityBrief(job)` | Summarise the role and how to network into it | `{ opportunityBrief, networkingStrategy, extractedRequirements[] }` |
| `rankContacts(job, contacts[])` | Score the candidate pool in one call | `ScoredContact[]` |
| `generateMessage(...)` | Write the outreach body | string |
| `generateFollowup(...)` | Write a short nudge | string |
| `interpretReply(...)` | Classify a reply and suggest the next step | `{ sentiment, suggestedNextStep }` |

The system prompt is sent with `cache_control: ephemeral` on every call; `rankContacts` also caches the job description as a second anchor so repeated scoring for the same job reuses the prefix. JSON responses are parsed after stripping code fences. See `docs/prompts.md` for the prompt text.

## Demo mode

A seeded template user (`npm run seed:demo`, data in `lib/demo/data.ts`) holds 1,100 synthetic contacts, one target job, and the warm paths and drafts produced by running the real pipeline against it. `GET /demo` (`app/demo/route.ts`) clones that template into a fresh per-visitor user, sets an HMAC-signed HttpOnly cookie (`DEMO_COOKIE_SECRET`), and redirects to the job page. `requireUser()` accepts that cookie only for users on the demo domain, so a forged cookie can at most reach another sandbox. Sandboxes older than 24 hours are deleted on the next demo start.

Abuse guards (`checkDemoLimit` in `lib/demo.ts`): per sandbox, 8 live drafts and 5 reply interpretations; job creation, URL extraction, brief generation and re-ranking return 403 inside a sandbox; at most 40 new sandboxes per 10 minutes globally. Real users are never limited. Drafts sign off as the demo persona in sandboxes and end on the ask with no signature for real users.

## Supabase: server vs. client

`lib/supabase.ts` exports `createClient()` (browser) and `createServerSupabase()` (server only; it imports `next/headers` inside the function so it is never bundled into a client component). `proxy.ts` uses `@supabase/ssr` for the cookie refresh.

## Environment

`.env` is loaded by Prisma (`dotenv/config` in `prisma.config.ts`), `.env.local` by Next.js; both need `DATABASE_URL`. Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (transaction pooler), `DIRECT_URL` (direct connection, used for `prisma db push`), `ANTHROPIC_API_KEY`, `DEMO_COOKIE_SECRET`. Optional: `APOLLO_API_KEY`.
