# Architecture

Deeper companion to the Architecture section in `CLAUDE.md`. Read `CLAUDE.md` first for the quick map and the Prisma 7 / shadcn gotchas.

## Stack

Next.js 16 (App Router) + TypeScript · Supabase (Auth + PostgreSQL) · Prisma 7 (with `@prisma/adapter-pg`) · Claude API `claude-sonnet-4-6` (`@anthropic-ai/sdk`) · Tailwind v4 + shadcn/ui on `@base-ui/react` · Vercel deployment. Standalone Playwright scripts for LinkedIn enrichment (local dev tool, not deployed).

## Request lifecycle

1. **`proxy.ts`** (Next.js 16's rename of `middleware.ts`) runs on every request: refreshes the Supabase session cookie and redirects unauthenticated users to `/login`.
2. Pages under **`app/(app)/`** (a route group — no URL segment) are the authenticated shell. `app/login`, `app/signup` are public.
3. Server code that needs the user calls **`requireUser()`** (`lib/auth.ts`): reads the Supabase user, then `findUnique`/`create`s the matching Prisma `User` row keyed by email (the Prisma `User.id` is set to the Supabase auth id on first login). Throws `'Unauthorized'` otherwise.
4. **`lib/prisma.ts`** exports a singleton `PrismaClient` built with a `PrismaPg` adapter over `DATABASE_URL` (the bare `new PrismaClient()` throws in Prisma 7 — the adapter is mandatory). Cached on `globalThis` in dev to survive HMR.

## Data model

`prisma/schema.prisma`:

```
User ──< Job ──< WarmPath >── Contact
                    │
                    └──< Message ──1 ReplyAnalysis
```

- **User** — auth identity + profile JSON arrays (`schools`, `pastCompanies`, `organizations`) used for overlap detection.
- **Job** — the posting (`title`, `company`, `url?`, `rawDescription`) plus AI-generated `opportunityBrief`, `networkingStrategy`, `extractedRequirements` (null until the brief is generated). `status` defaults `"active"`.
- **Contact** — a person in the user's network. Core fields (`name`, `title?`, `company?`, `linkedinUrl?`, `email?`, `relationshipStrength` default `"weak"`, `schoolOverlap`, `companyOverlap`, `notes?`, `source` `manual|apollo`) plus LinkedIn-enrichment fields (`headline`, `location`, `about`, `educationHistory`, `employmentHistory`, `organizations`, `skills`, `linkedinProfile`, `enrichedAt`). Unique on `(userId, linkedinUrl)`.
- **WarmPath** — the join of one Job + one Contact, and the heart of the product. Holds all AI-scored fields: `relevanceScore` (0–1), `scoreReasoning`, `pathType` (`direct|alumni|intro|weak`), `recommendedAsk` (`context_ask|advice_ask|referral_ask|intro_ask|recruiter_pitch`), `referralReadiness` (`not_ready|possible|ready`), `nextAction`. All null until ranking runs. `status` lifecycle: `not_started → drafted → sent → replied → meeting_set → referred / closed`. Unique on `(jobId, contactId)`.
- **Message** — a drafted/sent outreach message on a WarmPath (`channel` linkedin|email, `messageType` outreach|followup|referral_ask, `body`, `status` draft|…, `sentAt?`, `followUpDate?`).
- **ReplyAnalysis** — 1:1 with a Message; stores the pasted `replyText` plus AI `sentiment` and `suggestedNextStep`.

AI fields are deliberately nullable and populated on demand (user clicks "rank" / "generate brief" / "draft message") rather than eagerly — keeps Claude calls explicit and cheap.

## Key flows

- **Create job** — `/jobs/new`. Optional URL → `POST /api/jobs/scrape-url` fetches the page, strips HTML to text, calls `extractJobFromHtml` (Claude) → `{ title, company, rawDescription }`. JS-heavy / bot-blocked pages return `{ ok: false, reason }` and the form falls back to manual entry. Then `POST /api/jobs` creates the Job; the opportunity brief is generated separately (`/api/jobs/[id]/brief`, surfaced by `brief-loader.tsx`).
- **Rank contacts → create WarmPaths** — `/jobs/[id]/contacts` → `POST /api/jobs/[id]/warm-paths`. This route: (a) recomputes `companyOverlap` dynamically — a contact whose `company` *or any `employmentHistory` entry* matches the job's company (case-insensitive) counts as an insider even if the stored flag is false; (b) builds a `sharedAffiliations` string per contact (school + organization overlap vs the user's profile); (c) calls `rankContacts` once for the whole list; (d) upserts a WarmPath per contact with the returned scores.
- **Draft message** — `/jobs/[id]/messages/[contactId]` → `generateMessage` with channel + ask-type guidance baked into the prompt. Channel constraints: LinkedIn DM < 150 words; email gets a `Subject:` first line, body < 200 words.
- **Follow-up** — `generateFollowup` (< 60 words, no "just following up"). The `/queue` page lists WarmPaths in actionable statuses across all jobs, sorted by score.
- **Reply handling** — paste a reply → `interpretReply` returns `{ sentiment, suggestedNextStep }`, stored as `ReplyAnalysis` via `/api/replies`.

## AI layer (`lib/claude.ts`)

One module, one shared `SYSTEM_PROMPT` (the WarmPath persona + hard tone rules + ask-type definitions). Functions:

| Function | Purpose | Output |
|---|---|---|
| `extractJobFromHtml(pageText)` | Parse a scraped job page | `{ title, company, rawDescription }` (empty strings if not a job posting) |
| `generateOpportunityBrief(job)` | Summarize role + networking strategy | `{ opportunityBrief, networkingStrategy, extractedRequirements[] }` |
| `rankContacts(job, contacts[])` | Score every contact for this job in one call | `ScoredContact[]`, sorted desc by `relevanceScore` |
| `generateMessage(job, contact, warmPath, channel, messageType)` | Write the outreach body | message string |
| `generateFollowup(job, contact, priorMessages, daysSince)` | Write a nudge | message string |
| `interpretReply(job, contact, replyText)` | Classify a reply, suggest next step | `{ sentiment, suggestedNextStep }` |

**Prompt caching:** `SYSTEM_PROMPT` is sent with `cache_control: ephemeral` on every call. `rankContacts` additionally caches the job title line and the job description as separate anchors, so scoring many contacts for the same job reuses that prefix. JSON responses are parsed after stripping ``` fences.

See `docs/prompts.md` for the full prompt text and shapes.

## Supabase: server vs. client

`lib/supabase.ts` exports `createClient()` (browser — safe in client components) and `createServerSupabase()` (server only — imports `next/headers` *dynamically inside the function* so it never gets bundled into a client component). `proxy.ts` uses `@supabase/ssr` to do the cookie refresh.

## LinkedIn enrichment (dev tool, not deployed)

`npm run linkedin:login` (saves a headed-browser session to `.linkedin-session.json`, gitignored) then `npm run linkedin:enrich` (`scripts/enrich-linkedin.ts` + `lib/linkedin-scrape.ts`): visits up to `LIMIT` (default 40) un-enriched contacts that have a `linkedinUrl`, scrapes profile sections into the `Contact` enrichment fields, sleeps `DELAY_MIN..DELAY_MAX` ms between profiles, and **stops immediately on a login/checkpoint wall** rather than burning contacts. Resumable. Scraper selectors anchor on LinkedIn section ids (`#about`, `#experience`, `#education`, `#skills`, `#volunteering_experience`) and are inherently fragile — the raw scrape is also stored in `linkedinProfile` as a catch-all. Can't run serverless (Playwright) and is intentionally local-only.

## Environment

`.env` (loaded by Prisma via `dotenv/config` in `prisma.config.ts`) and `.env.local` (loaded by Next.js) both need `DATABASE_URL`. Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (transaction pooler, port 6543, `?pgbouncer=true`), `DIRECT_URL` (direct, port 5432 — used for `prisma db push`), `ANTHROPIC_API_KEY`. Optional: `APOLLO_API_KEY` (without it `/api/jobs/[id]/discover-contacts` returns 400; everything else works).
