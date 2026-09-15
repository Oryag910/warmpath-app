/**
 * Dependency-free regression tests for the deterministic parts of the ranking pipeline:
 * the pure signal helpers in lib/path-signals.ts and the pre-filter funnel in rankJob
 * (lib/ranking.ts, ~lines 35-55), replicated here rather than imported because that file
 * pulls in prisma. No network, no database, no Claude calls.
 *
 * Run: npx tsx scripts/test-ranking.ts
 */

import assert from 'node:assert/strict'
import {
  companyDistinctiveWords,
  isCurrentlyAtCompany,
  hasCompanyMatch,
  buildSharedAffiliations,
  heuristicScore,
  employmentSummary,
  pathSignals,
  MAX_COMPANY_CONTACTS,
  MAX_OTHER_CONTACTS,
  RECOMMEND_THRESHOLD,
  CURRENT_EMPLOYEE_FLOOR,
  FORMER_EMPLOYEE_FLOOR,
} from '../lib/path-signals'
import { buildDemoContacts, DEMO_USER, DEMO_JOB, type DemoContact } from '../lib/demo/data'
import { stripSignaturePlaceholders } from '../lib/message-text'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

let failures = 0

function test(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (err) {
    failures++
    console.log(`FAIL - ${name}`)
    console.error(err instanceof Error ? err.message : err)
  }
}

// --- fixtures ---------------------------------------------------------------

// The helpers take plain records; the demo dataset's `enriched` boolean stands in for the
// `enrichedAt` timestamp, and `companyOverlap` (the stored flag) is forced false so the
// pre-filter below exercises only the computed `hasCompanyMatch`.
function toRecord(c: DemoContact): AnyRecord {
  return { ...c, enrichedAt: c.enriched ? new Date() : null, companyOverlap: false }
}

const demoContacts = buildDemoContacts()
const records = demoContacts.map(toRecord)
const byName = new Map(records.map(r => [r.name as string, r]))
function get(name: string): AnyRecord {
  const c = byName.get(name)
  if (!c) throw new Error(`fixture missing contact: ${name}`)
  return c
}

const user: AnyRecord = { schools: DEMO_USER.schools, organizations: DEMO_USER.organizations }
const userSchools = DEMO_USER.schools.map(s => s.name.toLowerCase())
const userOrgs = DEMO_USER.organizations.map(o => o.toLowerCase())
const words = companyDistinctiveWords(DEMO_JOB.company)

// Replicates the pre-filter in rankJob (lib/ranking.ts lines ~35-55): a company-matched
// pool (capped) plus a "rest" pool of affiliated-or-high-scoring contacts (capped), sorted
// by heuristicScore desc. Demo contacts have no `id`, so `name` stands in as the unique key.
function preFilter(all: AnyRecord[]) {
  const companyMatched = all.filter(c => hasCompanyMatch(c, words)).slice(0, MAX_COMPANY_CONTACTS)
  const companyMatchedNames = new Set(companyMatched.map(c => c.name))
  const rest = all
    .filter(c => {
      if (companyMatchedNames.has(c.name)) return false
      return buildSharedAffiliations(c, userSchools, userOrgs) || heuristicScore(c, words) >= 13
    })
    .sort((a, b) => heuristicScore(b, words) - heuristicScore(a, words))
    .slice(0, MAX_OTHER_CONTACTS)
  return { companyMatched, rest }
}

const { companyMatched, rest } = preFilter(records)

// --- tests --------------------------------------------------------------------

test('companyDistinctiveWords strips generic suffixes', () => {
  assert.deepEqual(companyDistinctiveWords('Palantir Technologies'), ['palantir'])
  assert.deepEqual(companyDistinctiveWords('Stripe'), ['stripe'])
  assert.deepEqual(companyDistinctiveWords('Procter & Gamble'), ['procter', 'gamble'])
})

test('company-matched pool is exactly the 8 Stripe-affiliated curated contacts', () => {
  const expectedCurrent = ['Priya Natarajan', 'Marcus Chen', 'Elena Rossi', 'Daniel Okafor', 'Aisha Rahman', 'Tom Becker']
  const expectedFormer = ['Sofia Alvarez', 'James Whitfield']
  const names = companyMatched.map(c => c.name as string).sort()
  assert.deepEqual(names, [...expectedCurrent, ...expectedFormer].sort())
  for (const name of expectedCurrent) assert.equal(isCurrentlyAtCompany(get(name), words), true, name)
  for (const name of expectedFormer) assert.equal(isCurrentlyAtCompany(get(name), words), false, name)
})

test('fintech near-misses are not company matches and are not scored', () => {
  for (const name of ['Nina Petrova', 'Carlos Mendes']) {
    assert.equal(hasCompanyMatch(get(name), words), false, name)
    assert.ok(!companyMatched.some(c => c.name === name), `${name} unexpectedly in companyMatched`)
    assert.ok(!rest.some(c => c.name === name), `${name} unexpectedly in rest`)
  }
})

test('rest pool includes an affiliated strong tie and excludes an unaffiliated strong tie', () => {
  assert.ok(rest.length <= MAX_OTHER_CONTACTS)
  assert.ok(rest.some(c => c.name === 'Lena Fischer'), 'Lena Fischer missing from rest pool')
  assert.ok(!rest.some(c => c.name === 'Omar Haddad'), 'Omar Haddad should be excluded (strong tie, no affiliation)')
  for (const c of rest) assert.equal(hasCompanyMatch(c, words), false, `${c.name} has a company match`)
})

test('scored pool size is bounded; demo dataset is large, unique, and Stripe-clean', () => {
  const total = companyMatched.length + rest.length
  assert.ok(total >= 9 && total <= MAX_COMPANY_CONTACTS + MAX_OTHER_CONTACTS, `total=${total}`)
  assert.ok(demoContacts.length >= 1000, `only ${demoContacts.length} demo contacts`)
  assert.equal(new Set(demoContacts.map(c => c.name)).size, demoContacts.length, 'duplicate contact names found')
  const currentStripeNames = new Set(['Priya Natarajan', 'Marcus Chen', 'Elena Rossi', 'Daniel Okafor', 'Aisha Rahman', 'Tom Becker'])
  const strayStripe = demoContacts
    .filter(c => (c.company ?? '').toLowerCase().includes('stripe') && !currentStripeNames.has(c.name))
    .map(c => c.name)
  assert.deepEqual(strayStripe, [])
})

test('pathSignals labels for current, former, and unaffiliated contacts', () => {
  const priyaLabels = pathSignals(get('Priya Natarajan'), DEMO_JOB, user).map(s => s.label)
  assert.ok(priyaLabels.includes('Currently at Stripe'), priyaLabels.join(', '))
  assert.ok(priyaLabels.includes('University of Michigan alum'), priyaLabels.join(', '))
  assert.ok(priyaLabels.includes('Michigan Hackers'), priyaLabels.join(', '))
  assert.ok(priyaLabels.includes('Strong tie'), priyaLabels.join(', '))

  const sofiaLabels = pathSignals(get('Sofia Alvarez'), DEMO_JOB, user).map(s => s.label)
  assert.ok(sofiaLabels.some(l => l.startsWith('Formerly at Stripe')), sofiaLabels.join(', '))

  const lenaLabels = pathSignals(get('Lena Fischer'), DEMO_JOB, user).map(s => s.label)
  assert.ok(!lenaLabels.some(l => l.includes('at Stripe')), lenaLabels.join(', '))
})

test('score floors: current >= recommend threshold, former in [floor, threshold), unaffiliated unchanged', () => {
  const fakeScore = 0.2
  const current = get('Priya Natarajan')
  const former = get('Sofia Alvarez')
  const schoolOnly = get('Lena Fischer')

  // Mirrors the floor logic in rankJob (lib/ranking.ts:90-94).
  function applyFloor(c: AnyRecord): number {
    if (isCurrentlyAtCompany(c, words)) return Math.max(fakeScore, CURRENT_EMPLOYEE_FLOOR)
    if (hasCompanyMatch(c, words)) return Math.max(fakeScore, FORMER_EMPLOYEE_FLOOR)
    return fakeScore
  }

  const currentScore = applyFloor(current)
  const formerScore = applyFloor(former)
  const schoolOnlyScore = applyFloor(schoolOnly)

  assert.ok(currentScore >= RECOMMEND_THRESHOLD, `current=${currentScore}`)
  assert.ok(formerScore >= FORMER_EMPLOYEE_FLOOR && formerScore < RECOMMEND_THRESHOLD, `former=${formerScore}`)
  assert.equal(schoolOnlyScore, 0.2)
})

test('employmentSummary includes both employers for a past-Stripe contact', () => {
  const summary = employmentSummary(get('Sofia Alvarez'))
  assert.ok(summary?.includes('Stripe'), summary ?? 'null')
  assert.ok(summary?.includes('Ramp'), summary ?? 'null')
})

// ---- generated-message signature handling ----

test('stripSignaturePlaceholders removes placeholder sign-offs and dangling closings', () => {
  assert.equal(stripSignaturePlaceholders('Hi Priya,\n\nWould you refer me?\n\n— [Your name]'), 'Hi Priya,\n\nWould you refer me?')
  assert.equal(stripSignaturePlaceholders('Hey,\n\nQuick ask.\n\nBest,\n[Name]'), 'Hey,\n\nQuick ask.')
  assert.equal(stripSignaturePlaceholders('Thanks so much!\n\nBest,\nJordan'), 'Thanks so much!\n\nBest,\nJordan')
  assert.equal(stripSignaturePlaceholders('No placeholder here.'), 'No placeholder here.')
})

// --- report -------------------------------------------------------------------

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`)
  process.exit(1)
} else {
  console.log('\nall tests passed')
}
