// Pure, dependency-free matching + explanation helpers shared by the ranking pipeline (server)
// and UI components (client-safe). Keep this file free of prisma/claude imports.


// Two-stage ranking funnel:
//   1. deterministic pre-filter — company-matched contacts (capped) + a few contacts with a
//      real affiliation signal, so Claude only ever sees a small, defensible candidate pool
//   2. one batched Claude call scores the pool relationally and explains each contact
// Scores >= RECOMMEND_THRESHOLD are recommended paths. Lower-scoring candidates are kept as
// "weaker signals" so the user can see why they were considered and not recommended.

export const MAX_COMPANY_CONTACTS = 30
export const MAX_OTHER_CONTACTS = 5
export const RECOMMEND_THRESHOLD = 0.55
// Every candidate the deterministic pre-filter surfaced is kept, so the UI can show why the
// non-recommended ones were considered and rejected (stable across runs; the model only orders them).
export const KEEP_THRESHOLD = 0
// Score floors applied after the model scores (see rankJob): current employees are always at least
// a recommended path; former employees are always at least a visible weak signal.
export const CURRENT_EMPLOYEE_FLOOR = RECOMMEND_THRESHOLD
export const FORMER_EMPLOYEE_FLOOR = 0.3

// Generic words stripped when extracting distinctive words from a company name.
// Prevents "technologies" in "Palantir Technologies" from matching every tech company.
const GENERIC_WORDS = new Set([
  'technologies', 'technology', 'solutions', 'services', 'group', 'inc',
  'corp', 'llc', 'ltd', 'co', 'company', 'international', 'global',
  'systems', 'software', 'digital', 'partners', 'consulting', 'enterprises',
  'ventures', 'capital', 'labs', 'studio', 'studios', 'platforms', 'industries',
  'management', 'health', 'healthcare', 'finance', 'financial', 'media',
])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

export function companyDistinctiveWords(company: string): string[] {
  return company
    .trim()
    .toLowerCase()
    .split(/[\s&,./]+/)
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length > 2 && !GENERIC_WORDS.has(w))
}

function nameMatches(name: string, words: string[]): boolean {
  const n = name.trim().toLowerCase()
  return n.length > 0 && words.some(w => n.includes(w))
}

/** Currently at the target company (by current `company`). */
export function isCurrentlyAtCompany(c: AnyRecord, words: string[]): boolean {
  if (words.length === 0) return false
  return nameMatches(c.company ?? '', words)
}

/** Worked at the target company at some point (employmentHistory or stored flag). */
export function hasCompanyMatch(c: AnyRecord, words: string[]): boolean {
  if (c.companyOverlap) return true
  if (words.length === 0) return false
  if (isCurrentlyAtCompany(c, words)) return true
  const past = ((c.employmentHistory as AnyRecord[]) ?? []).map(e => String(e.company ?? ''))
  return past.some(p => nameMatches(p, words))
}

export function userSchoolNames(user: AnyRecord): string[] {
  return ((user?.schools as AnyRecord[]) ?? []).map(s => String(s.name ?? '').toLowerCase()).filter(Boolean)
}

export function userOrgNames(user: AnyRecord): string[] {
  return ((user?.organizations as unknown[]) ?? []).map(o => String(o).toLowerCase()).filter(Boolean)
}

export function matchedSchools(c: AnyRecord, userSchools: string[]): string[] {
  const contactSchools = ((c.educationHistory as AnyRecord[]) ?? []).map(e => String(e.school ?? '').toLowerCase())
  return userSchools.filter(us => contactSchools.some(cs => cs.includes(us) || us.includes(cs)))
}

export function matchedOrgs(c: AnyRecord, userOrgs: string[]): string[] {
  const contactOrgs = ((c.organizations as AnyRecord[]) ?? [])
    .map(o => (typeof o === 'string' ? o : String(o.name ?? '')).toLowerCase())
    .filter(Boolean)
  const matched = userOrgs.filter(uo => contactOrgs.some(co => co.includes(uo) || uo.includes(co)))
  if (!matched.length && userOrgs.length && c.notes) {
    const notesLower = String(c.notes).toLowerCase()
    const orgMatch = userOrgs.find(o => notesLower.includes(o))
    if (orgMatch) return [orgMatch]
  }
  return matched
}

export function buildSharedAffiliations(c: AnyRecord, userSchools: string[], userOrgs: string[]): string | null {
  const parts: string[] = []
  const schools = matchedSchools(c, userSchools)
  if (schools.length) parts.push(`${schools[0]} alum`)
  for (const o of matchedOrgs(c, userOrgs)) parts.push(`shared org: ${o}`)
  return parts.length ? parts.join('; ') : null
}

/** Condensed employment history for prompts: "Ramp — Senior SWE (2023–present); Stripe — SWE, Billing (2019–2023)". */
export function employmentSummary(c: AnyRecord, max = 4): string | null {
  const entries = ((c.employmentHistory as AnyRecord[]) ?? [])
    .filter(e => e && e.company)
    .slice(0, max)
    .map(e => {
      const title = e.title ? ` — ${e.title}` : ''
      const dates = e.dateRange ? ` (${e.dateRange})` : ''
      return `${e.company}${title}${dates}`
    })
  return entries.length ? entries.join('; ') : null
}

export function heuristicScore(c: AnyRecord, words: string[]): number {
  let score = 0
  if (hasCompanyMatch(c, words)) score += 10
  if (c.schoolOverlap) score += 5
  if (c.relationshipStrength === 'strong') score += 8
  if (c.relationshipStrength === 'medium') score += 4
  if (c.enrichedAt) score += 2
  return score
}

export interface PathSignal {
  label: string
  kind: 'company' | 'past_company' | 'school' | 'org' | 'tie'
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, ch => ch.toUpperCase())
}

/** Human-readable, deterministic signals explaining why a contact is a candidate for this job. */
export function pathSignals(c: AnyRecord, job: { company: string }, user: AnyRecord): PathSignal[] {
  const words = companyDistinctiveWords(job.company)
  const signals: PathSignal[] = []
  if (isCurrentlyAtCompany(c, words)) {
    signals.push({ label: `Currently at ${job.company}`, kind: 'company' })
  } else if (hasCompanyMatch(c, words)) {
    const entry = ((c.employmentHistory as AnyRecord[]) ?? []).find(e => nameMatches(String(e.company ?? ''), words))
    const when = entry?.dateRange ? ` (${entry.dateRange})` : ''
    signals.push({ label: `Formerly at ${job.company}${when}`, kind: 'past_company' })
  }
  const schools = matchedSchools(c, userSchoolNames(user))
  if (schools.length) {
    const entry = ((c.educationHistory as AnyRecord[]) ?? []).find(e => {
      const name = String(e.school ?? '').toLowerCase()
      return name.includes(schools[0]) || schools[0].includes(name)
    })
    signals.push({ label: `${entry?.school ?? titleCase(schools[0])} alum`, kind: 'school' })
  }
  else if (c.schoolOverlap) signals.push({ label: 'Shared school', kind: 'school' })
  for (const o of matchedOrgs(c, userOrgNames(user))) signals.push({ label: titleCase(o), kind: 'org' })
  if (c.relationshipStrength === 'strong') signals.push({ label: 'Strong tie', kind: 'tie' })
  else if (c.relationshipStrength === 'medium') signals.push({ label: 'Medium tie', kind: 'tie' })
  return signals
}

