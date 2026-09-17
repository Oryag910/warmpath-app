# Decisions

Recorded tradeoffs. Template: **Decision → Why → Consequences.**

---

## Hybrid ranking: deterministic retrieval, one batched model call, deterministic invariants

**Decision:** Ranking is three stages. Plain matching logic picks a small candidate pool, one Claude call scores that pool relationally, and code enforces a few invariants on the result.

**Why:** Fully deterministic ranking cannot judge role proximity or write an explanation. Fully model-driven ranking over a thousand contacts is slow, expensive, and unexplainable, and in practice it scored former employees as strangers and dropped contacts whose ids it mis-copied. Facts that are knowable from the data (currently or formerly employed at the target) should never depend on model judgment.

**Consequences:** The model only ever sees at most ~35 contacts, so cost is bounded and every recommendation is explained relative to the same pool. Current employees are floored to the recommend threshold and former employees to a visible weak signal. Every scored candidate is kept so the UI can show who was considered and rejected. Contacts are sent as short index ids and mapped back afterwards.

---

## One batched `rankContacts` call, not one call per contact

**Decision:** The whole candidate pool is scored in a single call.

**Why:** Scoring in isolation ignores relative comparison ("among these people, who matters most?"). One call is faster and cheaper, and the scores are better calibrated because the model reasons across the pool.

**Consequences:** Prompt size grows with pool size, which is why Stage 1 caps the pool. `max_tokens` scales with the number of contacts so JSON is never truncated.

---

## Per-visitor demo sandboxes instead of a shared demo account

**Decision:** Every "Try the demo" click clones a seeded template user into a fresh sandbox identified by a signed HttpOnly cookie.

**Why:** A shared demo account was the main reliability risk: concurrent visitors would see each other's drafts and status changes. Cloning costs a few seconds and removes the problem entirely.

**Consequences:** Sandboxes are throttled (40 per 10 minutes), limited (8 live drafts, 5 reply interpretations, no job creation or re-ranking) and deleted after 24 hours. `requireUser()` resolves the cookie only to users on the reserved demo domain, so real accounts are unreachable from a demo session.

---

## Dedicated `DEMO_COOKIE_SECRET`

**Decision:** The demo cookie is signed with its own secret, with no fallback to another credential.

**Why:** Reusing a connection string as an HMAC key couples two unrelated secrets: rotating one breaks the other, and a cookie-key leak would expose the database. A dedicated secret can be rotated freely; the only effect is that in-flight demo cookies are cleared and visitors return to the landing page.

**Consequences:** The variable is required in every environment that serves the demo.

---

## Supabase over Firebase

**Decision:** Supabase (PostgreSQL + Auth + SSR SDK) as the backend.

**Why:** A real relational database suits the Job → WarmPath ← Contact model; Firestore does not. Supabase's cookie-based SSR auth fits the App Router.

**Consequences:** The SQL schema is the source of truth, Prisma sits on top, and `proxy.ts` refreshes the session on every request.

---

## Prisma 7 with the `pg` driver adapter

**Decision:** Prisma 7 with `@prisma/adapter-pg`.

**Why:** Prisma 7 runs in the Next.js 16 serverless environment without the legacy query engine binary.

**Consequences:** The connection URL lives in `prisma.config.ts`, not `schema.prisma`; the client is generated into `lib/generated/prisma` (ignored, regenerated on install and build); `new PrismaClient()` without the adapter throws, so everything goes through `lib/prisma.ts`; generated types are `@ts-nocheck`, so query results are cast explicitly.

---

## `@base-ui/react` shadcn variant

**Decision:** shadcn/ui on `@base-ui/react` rather than Radix.

**Why:** It is what `shadcn init` generated for this Next.js version; no reason to deviate.

**Consequences:** `Button` has no `asChild`, so links use `<Link className={buttonVariants()}>`; `Select` reports `string | null` on change.

---

## `proxy.ts` instead of `middleware.ts`

**Decision:** Request middleware lives in `proxy.ts`.

**Why:** Next.js 16 renamed the convention. A `middleware.ts` would be ignored.

---

## AI fields nullable and populated on demand

**Decision:** `Job.opportunityBrief`, `WarmPath.relevanceScore` and friends start null and are written when the user triggers generation.

**Why:** Eager generation on every create would spend model calls on jobs and contacts the user never acts on and add latency to the create flow.

**Consequences:** The UI handles the null state (loading card, rank button).

---

## Company overlap recomputed at ranking time

**Decision:** Ranking derives company overlap from the contact's current company and employment history rather than trusting the stored `companyOverlap` flag alone.

**Why:** A contact's history may show past employment at the target company even when the stored flag is stale.

**Consequences:** Ranking reflects the data on file at the time it runs; the stored flag is a hint, not a source of truth.

---

## Profile enrichment tooling kept out of the repository

**Decision:** Contacts enter the product through CSV import, manual entry, or Apollo search. The experimental local tooling that once populated employment and education history from LinkedIn profiles is not part of this repository, and the hosted demo does not depend on it.

**Why:** It cannot run serverless, it is brittle by nature, and it is not what the project is about. The product's value is in retrieval, ranking, explanation and outreach; those work on whatever history is on file.

**Consequences:** The `Contact` history fields and the second-degree `DiscoveredContact` model remain, and the UI shows them when present.
