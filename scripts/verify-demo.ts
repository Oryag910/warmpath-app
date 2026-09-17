/**
 * Browser verification of the recruiter demo flow (Playwright, headless).
 *
 *   Landing → Try the demo → job page (ranked warm paths) → contact workspace → contact profile
 *   → refresh / back → contacts / queue / dashboard → exit demo
 *
 * Usage:  BASE_URL=http://localhost:3000 npx tsx scripts/verify-demo.ts
 *         GENERATE=1   also click "Generate" in the workspace (live Claude call, ~10s)
 *         SHOTS=dir    write screenshots to this directory (default: none)
 * Exits non-zero on the first failed check. Prints console errors seen along the way.
 */
import { chromium } from 'playwright'
import * as fs from 'node:fs'
import * as path from 'node:path'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const SHOTS = process.env.SHOTS
const GENERATE = process.env.GENERATE === '1'
// Dev servers compile routes on first hit (slow machines: a minute); production is fast
const NAV_TIMEOUT = 150_000

const failures: string[] = []
function check(cond: unknown, label: string) {
  if (cond) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}`); failures.push(label) }
}

async function main() {
  // Prefer the installed Chrome so no `playwright install` is needed
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }))
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(NAV_TIMEOUT)
  page.setDefaultTimeout(NAV_TIMEOUT)
  const consoleErrors: string[] = []
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`))

  let shot = 0
  async function snap(name: string) {
    if (!SHOTS) return
    fs.mkdirSync(SHOTS, { recursive: true })
    // Screenshots are diagnostics only — never fail the run on them
    await page
      .screenshot({ path: path.join(SHOTS, `${String(++shot).padStart(2, '0')}-${name}.png`), fullPage: true, timeout: 20_000 })
      .catch(err => console.log(`  (screenshot ${name} skipped: ${String(err.message).split('\n')[0]})`))
  }
  const text = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ')

  console.log(`Landing (${BASE}/)`)
  await page.goto(`${BASE}/`, { waitUntil: 'load' })
  let t = await text()
  check(/Try the demo/i.test(t), 'landing shows "Try the demo"')
  check(/synthetic/i.test(t), 'landing discloses synthetic data')
  check(!/Sign in to your account|password/i.test(t), 'anonymous root is not the login page')
  await snap('landing')

  console.log('Try the demo')
  // Give hydration a moment (a visitor reads the page before clicking); the CTA works either way
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  const t0 = Date.now()
  // Dispatch the click from page context: Playwright's own click() waits for the navigation it
  // starts, which would hide the intermediate loading state we want to observe.
  // The click handler runs synchronously inside a.click(), so the very same evaluate can read the
  // state the visitor sees while the /demo request is in flight.
  const loadingSeen = await page.evaluate(() => {
    const cta = document.querySelector('#try-demo a[href="/demo"]') as HTMLAnchorElement | null
    const label = document.querySelector('#try-demo a span:nth-child(2)') as HTMLElement | null
    if (!cta || !label) return false
    cta.click()
    return getComputedStyle(label).display !== 'none' && getComputedStyle(cta).pointerEvents === 'none'
  }).catch(() => false)
  check(loadingSeen, 'loading state appears immediately after clicking Try the demo (and CTA is locked)')
  await page.waitForURL(/\/jobs\/[^/]+$/, { timeout: NAV_TIMEOUT })
  await page.waitForLoadState('load')
  console.log(`  sandbox created + job page loaded in ${Date.now() - t0} ms`)
  const jobUrl = page.url()
  t = await text()
  check(/Demo sandbox/i.test(t), 'demo banner visible')
  check(/Software Engineering Intern/i.test(t) && /Stripe/.test(t), 'target job is the Stripe internship')
  check(/Opportunity Brief/i.test(t), 'opportunity brief rendered')
  check(/connections screened/i.test(t), 'funnel line rendered')
  check(/Priya Natarajan/.test(t), 'top recommended contact present')
  check(/Currently at Stripe/.test(t), 'signal chip "Currently at Stripe"')
  check(/Formerly at Stripe/.test(t), 'signal chip "Formerly at Stripe"')
  check(/University Of Michigan alum|Michigan alum/i.test(t), 'signal chip for shared school')
  check(/considered, not recommended|weaker signal/i.test(t), 'weaker-signals tier present')
  check(!/npm run|linkedin:(login|enrich|discover)|APOLLO_API_KEY/i.test(t), 'no CLI text on job page')
  const names = ['Priya Natarajan', 'Daniel Okafor', 'Elena Rossi', 'Sofia Alvarez']
  const idx = names.map(n => t.indexOf(n))
  check(idx.every(i => i >= 0) && idx[0] < idx[1] && idx[1] < idx[2] && idx[2] < idx[3], 'insiders ranked above alumni path')
  check(!/Rachel Goldberg|Omar Haddad|Nina Petrova/.test(t), 'irrelevant contacts not shown as paths')
  check(!/\bc\d{1,2}\b/.test(t), 'no short contact ids leaked into explanations')
  check(!/Re-rank|Rank my connections/i.test(t), 'live Re-rank is not offered in the demo')
  check(/same pipeline real users run|production ranking pipeline/i.test(t), 'demo ranking provenance copy shown')
  await snap('job')

  console.log('Weaker signals')
  await page.locator('summary', { hasText: /not recommended|weaker signal/i }).first().click()
  t = await text()
  check(/Lena Fischer/.test(t), 'school-only contact shown as weak signal after expanding')
  await snap('job-weaker')

  console.log('Outreach workspace')
  await page.getByRole('link', { name: /outreach draft|draft outreach/i }).first().click()
  await page.waitForURL(/\/messages\//, { timeout: NAV_TIMEOUT })
  await page.waitForLoadState('load')
  t = await text()
  check(/Why this person/i.test(t), '"Why this person" panel')
  check(/Referral ask|Context ask|Advice ask|Recruiter pitch|Intro ask/.test(t), 'recommended ask shown')
  check(/LinkedIn DM/i.test(t) && /Copy/.test(t), 'pre-generated LinkedIn draft visible')
  check(/pre-generated|when this demo network was seeded/i.test(t), 'draft provenance disclosed')
  const PLACEHOLDER = /\[(your |first |full )?name\]|\[signature\]|\[your first name\]/i
  check(!PLACEHOLDER.test(t), 'seeded draft has no name placeholder')
  await snap('workspace')

  if (GENERATE) {
    console.log('Generate (live)')
    const before = await page.getByRole('tab').count()
    const g0 = Date.now()
    await page.getByRole('button', { name: /^Generate$/ }).click()
    await page.waitForFunction((n) => document.querySelectorAll('[role="tab"]').length > n, before, { timeout: 90_000 })
    console.log(`  new draft generated in ${Date.now() - g0} ms`)
    check((await page.getByRole('tab').count()) > before, 'live generation added a draft')
    check(!PLACEHOLDER.test(await text()), 'live draft has no name placeholder')
    await snap('workspace-generated')

    if (process.env.LIMITS === '1') {
      // Exhaust the per-sandbox draft limit through the API (same sandbox cookie) — costs a few Claude calls
      console.log('Demo limits (API)')
      const [, jobId, contactId] = page.url().match(/\/jobs\/([^/]+)\/messages\/([^/?#]+)/) ?? []
      const rank = await page.request.post(`${BASE}/api/jobs/${jobId}/warm-paths`, { data: { rankAll: true } })
      const rankBody = await rank.json().catch(() => ({}))
      check(rank.status() === 403 && typeof rankBody.error === 'string', `re-rank blocked in demo (${rank.status()}: ${rankBody.error ?? ''})`)
      const paths = await (await page.request.get(`${BASE}/api/jobs/${jobId}/warm-paths`)).json() as { id: string; contactId: string }[]
      const warmPathId = paths.find(p => p.contactId === contactId)?.id
      check(!!warmPathId, 'resolved warm path id for the limit test')
      let last = 0, lastMsg = ''
      for (let i = 0; i < 12 && warmPathId; i++) {
        const r = await page.request.post(`${BASE}/api/messages`, { data: { warmPathId, channel: 'linkedin', messageType: 'outreach' }, timeout: 90_000 })
        last = r.status()
        if (last !== 201) { lastMsg = ((await r.json().catch(() => ({}))) as { error?: string }).error ?? ''; break }
      }
      check(last === 429 && /live drafts/i.test(lastMsg), `draft limit returns a clear 429 (${last}: ${lastMsg.slice(0, 80)})`)
      // The UI surfaces the same message as a toast
      await page.getByRole('button', { name: /^Generate$/ }).click()
      const toastSeen = await page.getByText(/used its \d+ live drafts/i).first().waitFor({ timeout: 15_000 }).then(() => true).catch(() => false)
      check(toastSeen, 'limit message surfaced to the user as a toast')
    }
  }

  console.log('Contact profile')
  await page.getByRole('link', { name: /view profile/i }).click()
  await page.waitForURL(/\/contacts\/[^/]+$/, { timeout: NAV_TIMEOUT })
  await page.waitForLoadState('load')
  t = await text()
  check(/Experience|Education/i.test(t), 'profile shows enrichment sections')
  await snap('contact')

  console.log('Refresh / back / direct load')
  // Dev-only: Turbopack occasionally aborts a navigation while it recompiles; retry once
  await page.reload({ waitUntil: 'load' }).catch(() => page.reload({ waitUntil: 'load' }))
  check(/Experience|Education/i.test(await text()), 'profile survives refresh')
  await page.goBack()
  // Back is a client-side transition in production; wait for the route and its content
  await page.waitForURL(/\/messages\//, { timeout: 30_000 }).catch(() => {})
  await page.getByText(/Why this person/i).first().waitFor({ timeout: 30_000 }).catch(() => {})
  check(/\/messages\//.test(page.url()) && /Why this person/i.test(await text()), `back returns to workspace (${page.url()})`)
  await page.goto(jobUrl, { waitUntil: 'load' })
  check(/connections screened/i.test(await text()), 'direct load of job URL works')

  console.log('Secondary pages')
  for (const p of ['/', '/contacts', '/queue', '/profile']) {
    await page.goto(`${BASE}${p}`, { waitUntil: 'load' }).catch(() => page.goto(`${BASE}${p}`, { waitUntil: 'load' }))
    t = await text()
    check(!/npm run|linkedin:(login|enrich|discover)|APOLLO_API_KEY/i.test(t) && !/Application error|Unhandled/i.test(t), `${p} renders without CLI text or errors`)
    await snap(p === '/' ? 'dashboard' : p.slice(1))
  }

  console.log('Exit demo')
  await page.goto(`${BASE}/demo/exit`, { waitUntil: 'load' })
  check(/Try the demo/i.test(await text()), 'exit returns to landing')
  await page.goto(`${BASE}/queue`, { waitUntil: 'load' })
  check(/\/login/.test(page.url()), 'app routes require auth again after exit')

  // The LIMITS run deliberately provokes a 429, which Chrome logs as a resource error
  const realErrors = consoleErrors.filter(e => !/favicon|Download the React DevTools/i.test(e) && !(process.env.LIMITS === '1' && /status of (429|403)/.test(e)))
  check(realErrors.length === 0, `no console errors (${realErrors.length})`)
  for (const e of realErrors) console.log('   console:', e.slice(0, 200))

  await browser.close()
  if (failures.length) { console.log(`\n${failures.length} check(s) failed`); process.exit(1) }
  console.log('\nAll checks passed')
}

main().catch(err => { console.error(err); process.exit(1) })
