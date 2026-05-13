# Roadmap

Feature sequencing. Not a commitment — a prioritized order of what to build next.

## Shipped (v0)

- Auth (Supabase, email login, session via proxy.ts)
- Job ingestion: manual entry + URL scrape → Claude extraction
- Opportunity brief generation (Claude)
- Contact management: manual add, LinkedIn CSV import, Apollo contact discovery
- LinkedIn profile enrichment (local Playwright scripts)
- Warm-path ranking: batch contact scoring (Claude), dynamic company/school overlap detection
- Ask-type recommendation + referral readiness scoring
- Message generation: outreach, followup, referral ask (LinkedIn DM + email)
- Reply interpretation (Claude → sentiment + next step)
- Pipeline view: kanban-style WarmPath status board per job
- Cross-job queue: actionable WarmPaths sorted by score
- User profile: schools, past companies, organizations (used for overlap detection)

## Near-term

- [ ] Message workspace polish — editing, channel switching, copy-to-clipboard UX
- [ ] Follow-up queue with scheduled nudge dates (`Message.followUpDate`)
- [ ] Reply loop UX — paste reply → see interpretation → one-click "draft response"
- [ ] Wire up Apollo when `APOLLO_API_KEY` is available; test contact discovery flow end-to-end
- [ ] `prisma db push` flow docs / onboarding script for new dev setup
- [ ] Status lifecycle transitions — UI controls on the pipeline board to move WarmPaths through statuses

## Later

- Gmail / email client integration for actual send + thread tracking
- Referral readiness score surfaced in the UI (currently computed, not prominently shown)
- Recruiter CRM mode — separate persona for recruiter contacts
- AI networking simulator — practice conversation turns
- Browser extension for one-click job capture
- Analytics dashboard (conversion through the status funnel)
- Team / shared workspace

## Do not build (MVP scope)

Auto-send messaging, public LinkedIn scraping as a product feature, mobile app, billing, multi-tenant team features.
