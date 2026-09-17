# Roadmap

Prioritised order of what to build next. Not a commitment.

## Shipped

- Auth (Supabase email login, session refreshed in `proxy.ts`)
- Job ingestion: manual entry and URL extraction
- Opportunity brief and networking strategy per job
- Contacts: manual add, LinkedIn connections CSV import, optional Apollo discovery
- Three-stage warm-path ranking with explanation chips, funnel and a "considered, not recommended" tier
- Ask-type recommendation and referral readiness
- Message generation: outreach, follow-up, referral ask (LinkedIn DM and email)
- Reply interpretation (sentiment and next step)
- Pipeline board per job and a cross-job action queue
- Public recruiter demo: synthetic network, per-visitor sandboxes, usage limits

## Near-term

- Sign-off name on the user profile so real users' drafts can close with a signature
- Follow-up scheduling on the queue (`Message.followUpDate`)
- Reply loop: interpret a reply, then draft the response in one step
- Status transitions directly on the pipeline board
- Pagination on the contacts page for very large networks

## Later

- Email client integration for sending and thread tracking
- Browser extension for one-click job capture
- Recruiter-side view for hiring contacts

## Out of scope

Auto-send messaging, scraping as a product feature, mobile app, billing, team workspaces.
