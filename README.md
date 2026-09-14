# WarmPath

WarmPath is a job-to-intro copilot. Paste a job posting, and it ranks your LinkedIn network for that specific role, explains who to reach out to and why, recommends the right ask, and drafts the outreach message. It's not a CRM and not a job tracker — it's a relationship execution layer that tells you the single highest-leverage move and writes it for you.

## Live demo

**[https://warmpath-gamma.vercel.app](https://warmpath-gamma.vercel.app)**

A 60-90 second walkthrough:

1. Click **Try the demo**. You land as Jordan Rivera, a University of Michigan CS student and former Shopify intern, looking at a Stripe Software Engineering Intern (Summer 2027) posting.
2. See the ranked warm paths for that job, each with signal chips (Currently at Stripe, Formerly at Stripe, University of Michigan alum, Michigan Hackers, tie strength), a path type, a recommended ask, and a plain-English "why."
3. Expand **weaker signals considered but not recommended** to see contacts the system looked at and correctly ruled out, and why.
4. Open a person to see their full "Why this person" panel and a pre-generated LinkedIn message draft.
5. Click **Generate** to watch a fresh draft get written live.

The demo network is 1,100 entirely synthetic contacts — no real people, no real companies scraped. Every visitor gets their own disposable sandbox copy of the same seeded scenario, so nothing you do affects anyone else's session.

## The problem

Job seekers have warm connections buried in a LinkedIn network of hundreds or thousands of people, but no way to know which ones actually matter for a specific role, or how to ask without sounding like a mass-DM. WarmPath turns "who do I know at this company" into a ranked, explained, ready-to-send action list:

1. Paste or import a job posting.
2. Add or import your contacts (CSV export or enriched LinkedIn profiles).
3. WarmPath ranks your network against that specific job and explains each recommendation.
4. It suggests the right kind of ask for each person — advice, referral, intro, or a direct recruiter pitch — and drafts the message.
5. A follow-up queue tracks where each conversation stands, across every job you're working.

Each warm path moves through a simple, explicit status lifecycle: not started → drafted → sent → replied → meeting set → referred, or closed.

## What's inside

- **Dashboard** — every active job at a glance.
- **Job intake** — paste a posting or scrape one from a URL; get back a structured opportunity brief and networking strategy.
- **Contact ranking** — run the pipeline below against a job to generate warm paths.
- **Pipeline board** — a kanban view of every warm path, from not started through referred or closed.
- **Message workspace** — per-contact drafting, regeneration, and follow-up generation.
- **Contacts** — manage your network directly or import a LinkedIn connections export.
- **Cross-job queue** — every actionable warm path across all your jobs, sorted by relevance.

## Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 16, App Router, TypeScript |
| Auth + database | Supabase (Auth + Postgres) |
| ORM | Prisma 7, driver adapter |
| AI | Claude API |
| UI | Tailwind + shadcn/ui (on base-ui) |
| Hosting | Vercel |

**Data model:** `User` → `Job` → `WarmPath` → `Message`. A `WarmPath` joins one job and one contact and holds every AI-scored field: relevance score, path type, recommended ask, referral readiness, and next action. Nothing is scored until the user triggers ranking for that job.

**Auth:** Next 16's request middleware (`proxy.ts`) refreshes the Supabase session and redirects unauthenticated visitors to login. Every API route resolves the current user through a single `requireUser()` helper.

**Demo mode:** a seeded template user holds the synthetic network and a pre-run scoring pass.

- Every "Try the demo" click clones that template into a fresh sandbox user.
- The sandbox is identified by a signed, HttpOnly cookie.
- `requireUser()` will only ever resolve that cookie to accounts on the reserved demo domain, so sandbox sessions can never touch real user data.
- Stale sandboxes are cleaned up automatically after 24 hours.

## Ranking pipeline

This is the core of the product: turning a network of hundreds or thousands of contacts into a short, defensible, explained shortlist. It runs in three stages.

**Stage 1 — deterministic pre-filter.** Before any model call, the pipeline narrows the network using plain matching logic:

- Company names are reduced to their distinctive words, so "Stripe" doesn't match on a generic word like "Technologies."
- Employment history is checked for past overlap with the target company, not just current employer.
- School and organization affiliations are compared against the user's own profile.

This produces a heuristically ordered, capped candidate pool — at most 30 company-matched contacts plus 5 others with some other real signal — so the model only ever sees a small, explainable set rather than an entire network.

**Stage 2 — one batched scoring call.** A single Claude call scores the whole candidate pool together, so contacts are ranked relative to each other rather than in isolation. It returns, per contact: a path type (direct / alumni / intro / weak), a recommended ask (context, advice, referral, intro, or recruiter pitch), referral readiness, a next action, and a short plain-English explanation.

Scoring is calibrated with strict rules. Someone currently employed at the target company must score in the "recommended" band regardless of relationship strength, and the model is explicitly barred from inferring indirect connections it can't see in the data — no leaping from "worked in defense" to "probably knows someone at this defense contractor."

**Stage 3 — deterministic guarantees on top of the model.** A few invariants are enforced in code after the model responds, not left to the model's judgment:

- Contacts are referenced by short index IDs during scoring, then mapped back to real records afterward — long database IDs get mis-copied by the model often enough to silently drop people otherwise.
- A current employee is always at least a recommended path; a former employee is always at least a visible weak signal.
- Every scored candidate is kept, not just the recommended ones, so the UI can show *why* someone was considered and not recommended.
- Nothing is deleted from a prior ranking until a new one completes successfully.

In the demo scenario, this funnel takes **1,100 connections screened down to 13 candidates scored, with 8 recommended.**

## LinkedIn enrichment pipeline

This is a real part of the product for actual users — the hosted demo above does not use it or scrape any real LinkedIn data.

Contacts can be added in two ways:

- **CSV import** — upload a LinkedIn connections export directly.
- **Local enrichment scripts** — `linkedin:login`, `linkedin:enrich`, and `linkedin:discover` drive the user's own already-logged-in browser, at a human pace, to pull employment history, education, and organizations from a profile's detail sub-pages, and to surface second-degree connections at a target company.

These scripts are intentionally local-only, and deliberately not a hosted feature:

- Playwright can't run in a serverless environment.
- Running enrichment through the user's own browser session means LinkedIn sees the user's own IP, not a shared server making bulk requests.
- If a run hits an auth wall, it stops immediately rather than retrying.
- Runs are resumable — a later run picks up any contacts left unenriched from a prior one.

## Engineering tradeoffs

A handful of deliberate choices shaped how this was built:

- **One batched scoring call instead of one call per contact** — contacts get ranked relative to each other, and it's dramatically cheaper and faster than scoring a network member by member.
- **A deterministic pre-filter runs before the LLM ever sees the data** — the model is handed a small, defensible candidate pool instead of an entire network, which keeps cost bounded and results explainable.
- **Score floors and invariants sit on top of the model's output** — the model handles ordering and explanation; well-defined facts (currently employed there, previously employed there) are never left purely to model judgment.
- **Each demo visitor gets a fresh sandboxed clone of a shared seed** — rather than one shared demo account, so concurrent visitors never see each other's edits or generated drafts.
- **LinkedIn enrichment runs locally only, never on a server** — by design, to keep it a personal dev tool rather than a scraping service, and to keep the requests coming from the user's own IP and account.

## Local setup

Environment variables (see `.env` / `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
DATABASE_URL
DIRECT_URL
ANTHROPIC_API_KEY
APOLLO_API_KEY        # optional — enables company-based contact discovery
DEMO_COOKIE_SECRET    # optional — falls back to DATABASE_URL if unset
```

```bash
npm install
npx prisma db push          # run against DIRECT_URL, not the pooler
npm run dev
```

Build the seeded demo template (requires `ANTHROPIC_API_KEY`; this is what the live demo clones per visitor):

```bash
npm run seed:demo
```

Tests:

```bash
npx tsx scripts/test-ranking.ts     # deterministic ranking-pipeline tests, no network calls
npx tsx scripts/verify-demo.ts      # end-to-end browser check of the demo flow
```

## Demo-mode and synthetic data

Everything in the hosted demo — the network, the job posting, the candidate, and every generated message — is fictional. No real person's data is used or represented anywhere in the demo. Company and university names are real, well-known institutions used only as realistic backdrop; no individual's actual employment or education is depicted. Each visitor's session runs against an isolated, disposable copy of this synthetic data and never touches another visitor's session.
