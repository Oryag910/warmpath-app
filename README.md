# WarmPath

WarmPath is a job-to-intro copilot. Paste a job posting and it ranks your own network for that specific role, explains who to reach out to and why, recommends the right kind of ask, and drafts the message.

## Live demo

**https://warmpath-gamma.vercel.app**

A 60–90 second walkthrough, no sign-up:

1. **Try the demo.** A private sandbox is created for you (a few seconds). You are Jordan Rivera, a fictional University of Michigan CS student, looking at a Stripe Software Engineering Intern posting.
2. **Job page.** The opportunity brief and networking strategy, then the funnel: **1,100 connections screened → 13 candidates scored → 8 recommended.**
3. **Warm paths.** Each card shows the deterministic facts (Currently at Stripe, Formerly at Stripe 2019–2023, University of Michigan alum, Michigan Hackers, tie strength), the model's tier and reasoning, the next move, and the recommended ask.
4. **Considered, not recommended.** Expand the collapsed tier to see the five contacts that cleared the pre-filter on affiliation alone and why they were ruled out.
5. **Outreach workspace.** Open a person for the "why this person" panel and a pre-generated LinkedIn draft, then press **Generate** to watch a new draft get written live.

The demo network is entirely synthetic: no real people, no scraped data. Every visitor gets a disposable copy of the same seeded scenario, so nothing you do affects anyone else.

## Problem

Job seekers have warm connections buried in networks of hundreds or thousands of people and no way to tell which ones matter for a specific role, or how to ask without sounding like a mass DM. WarmPath turns "who do I know at this company" into a short, explained, ready-to-send action list, and tracks each conversation from first message to referral.

## How it works

```
job posting
   → deterministic retrieval        company / career / affiliation matching, capped pool
   → one batched LLM scoring call   relative scores, path type, ask, reasoning, next move
   → deterministic guardrails       id mapping, score floors, keep-all, safe replace
   → ranked warm paths              explained with fact chips and a next move
   → outreach                       drafted per channel and ask type, tracked to reply
```

## Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router, TypeScript |
| Auth + database | Supabase (Auth + PostgreSQL) |
| ORM | Prisma 7 with the `pg` driver adapter |
| AI | Claude API (`claude-sonnet-4-6`) with prompt caching |
| UI | Tailwind v4, shadcn/ui on `@base-ui/react` |
| Hosting | Vercel |

**Data model:** `User → Job → WarmPath ← Contact`, with `Message` and `ReplyAnalysis` hanging off a warm path. A `WarmPath` joins one job and one contact and holds every scored field: relevance score, path type, recommended ask, referral readiness, next action, and outreach status (`not_started → drafted → sent → replied → meeting_set → referred / closed`). Nothing is scored until the user asks.

**Auth:** `proxy.ts` (Next 16's middleware) refreshes the Supabase session and redirects anonymous visitors. Every server path resolves the current user through one `requireUser()` helper.

Deeper narrative in [`docs/architecture.md`](docs/architecture.md); recorded tradeoffs in [`docs/decisions.md`](docs/decisions.md); prompts in [`docs/prompts.md`](docs/prompts.md).

## Ranking pipeline

`rankJob()` in `lib/ranking.ts` turns a whole network into a short, defensible shortlist in three stages. The pure matching helpers live in `lib/path-signals.ts` so the UI can explain results with the exact logic that produced them.

### Stage 1 — deterministic retrieval

Before any model call:

- The target company is reduced to its distinctive words, so "Stripe" never matches on a generic word like "Technologies".
- A contact matches if that word appears in their current company **or anywhere in their employment history**, so former employees are found, not just current ones.
- School and organization affiliations are compared against the user's own profile.

The result is a heuristically ordered pool of at most 30 company matches plus 5 affiliation matches. The model never sees anyone else.

### Stage 2 — batched semantic scoring

One Claude call scores the whole pool together, so every score is relative to the rest of the pool. Each contact goes in with a short index id, relationship strength, shared affiliations, a condensed employment summary and an explicit "currently at target" flag. The call returns, per contact, a score, a path type (direct / alumni / intro / weak), a recommended ask (context, advice, referral, intro, or recruiter pitch), referral readiness, a next action and a plain-English explanation. It runs at temperature 0, and the model is barred from inferring connections it cannot see in the data.

### Stage 3 — deterministic invariants

Enforced in code after the model responds, not left to its judgment:

- Short ids are mapped back to real records. Long database ids were mis-copied often enough to silently drop people.
- A current employee is always at least a recommended path; a former employee is always at least a visible weak signal.
- Every scored candidate is persisted, so the UI can show who was considered and why they were not recommended.
- Rows from the previous ranking are only replaced inside a transaction that runs after scoring succeeds, and paths already in progress are preserved.

In the demo scenario the funnel is **1,100 → 13 → 8**.

## Why hybrid ranking

Fully deterministic ranking cannot judge role proximity or write an explanation, and it cannot tell a recruiter from a sales rep at the same company. Fully model-driven ranking over a thousand contacts is slow, expensive and unexplainable; in practice it also scored former employees as strangers and lost contacts whose ids it mis-copied. Splitting the work keeps the model where it adds value (relative judgment and explanation) and keeps the facts (who works there, who used to) in code.

## Demo architecture

```
synthetic dataset (lib/demo/data.ts, deterministic)
   → seeded template user           npm run seed:demo runs the real pipeline once
   → per-visitor sandbox            GET /demo clones the template in one transaction
   → signed HttpOnly cookie         HMAC with a dedicated DEMO_COOKIE_SECRET
   → 24h cleanup                    stale sandboxes deleted on the next demo start
   → generation limits              8 live drafts, 5 reply reads, no re-rank or job creation
```

`requireUser()` only resolves the demo cookie to accounts on the reserved demo domain, so a sandbox can never reach real user data. A cookie that fails verification is cleared and the visitor lands back on the landing page. Global sandbox creation is throttled to protect the clone path from bots.

## Engineering highlights

- **Short id mapping** — contacts are scored as `c1 … cN` and mapped back afterwards.
- **Score floors** — current and former employees have guaranteed minimum scores; the model orders within those bands.
- **Prompt caching** — the system prompt is cached on every call, and the job description is a second cache anchor during scoring.
- **Employment-history matching** — retrieval and explanation chips read the whole history, not just the current employer.
- **Safe re-ranking** — the old ranking is replaced only after the new one succeeds, and in-progress outreach survives.
- **Sandbox isolation** — every demo visitor gets their own rows; limits are counted from those rows, so there is no extra state to protect.
- **Explainability by construction** — the same pure functions that filter candidates render the "why" chips in the UI.

## Tech stack

Next.js 16 · React 19 · TypeScript · Supabase · PostgreSQL · Prisma 7 · Claude API · Tailwind v4 · shadcn/ui · Vercel · Playwright (verification only)

## Local setup

```bash
npm install
cp .env.example .env.local      # fill in the values below
npx prisma db push              # use DIRECT_URL, not the pooler
npm run dev
```

Environment variables:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
DATABASE_URL          # transaction pooler
DIRECT_URL            # direct connection, used by prisma db push
ANTHROPIC_API_KEY
DEMO_COOKIE_SECRET    # any long random string; signs the demo sandbox cookie
APOLLO_API_KEY        # optional, enables company-based contact discovery
```

Prisma loads `.env`; Next.js loads `.env.local`. Both need `DATABASE_URL`.

To build the seeded demo template that the live demo clones per visitor (needs `ANTHROPIC_API_KEY`):

```bash
npm run seed:demo
```

## Tests

```bash
npm run test:ranking            # deterministic ranking tests, no network
npm run verify:demo             # headless browser run of the full demo flow (BASE_URL=… for a deployment)
npx tsx scripts/test-prompts.ts # prompt quality check against the demo scenario (live model calls)
```
