import type { Metadata } from 'next'
import Link from 'next/link'
import TryDemoButton from './try-demo-button'

export const metadata: Metadata = {
  title: 'WarmPath — the warmest path into any company',
  description:
    'Paste a job posting. WarmPath ranks your network for that role, explains who to reach out to and why, and drafts the message.',
}

const steps = [
  {
    title: 'Paste a job',
    description: 'WarmPath pulls the role, company, and requirements out of the posting and writes a short brief on what the team actually values.',
  },
  {
    title: 'Rank your network',
    description:
      'A deterministic pre-filter narrows ~1,000 connections to the few with company, career, or affiliation overlap. One model call then scores those candidates against each other and explains every score.',
  },
  {
    title: 'Make the move',
    description:
      'Each recommended person comes with the right kind of ask — context, advice, referral, intro, or recruiter pitch — and a drafted LinkedIn DM or email.',
  },
]

const signals = [
  'Current or past employment at the target company',
  'Career history and role proximity',
  'Shared school',
  'Shared organizations',
  'Relationship strength, which shapes the ask rather than the ranking',
]

const funnel = [
  { value: '1,100', label: 'connections screened' },
  { value: '13', label: 'candidates scored' },
  { value: '8', label: 'recommended' },
]

const ERROR_NOTICES: Record<string, string> = {
  busy: 'The demo is getting a lot of traffic right now. Please try again in a few minutes.',
  demo: 'The demo could not be started. Please try again in a moment.',
}

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const notice = error ? ERROR_NOTICES[error] : null
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-sm font-semibold tracking-tight">WarmPath</span>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="py-16 text-center sm:py-24">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Job-to-intro copilot</p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Find the warmest path into any company.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            Paste a job posting. WarmPath ranks your network for that specific role, explains who to
            reach out to and why, and drafts the message.
          </p>
          <div className="mt-8">
            {notice && (
              <p role="alert" className="mx-auto mb-4 max-w-md rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {notice}
              </p>
            )}
            <TryDemoButton />
          </div>

          <dl className="mx-auto mt-12 flex max-w-lg items-stretch justify-center divide-x divide-border rounded-xl border border-border text-center">
            {funnel.map(stat => (
              <div key={stat.label} className="flex flex-1 flex-col items-center px-3 py-4">
                <dd className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">{stat.value}</dd>
                <dt className="mt-1 text-[11px] leading-tight text-muted-foreground sm:text-xs">{stat.label}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            The demo scenario: one Stripe internship, ranked against a synthetic 1,100-person network.
          </p>
        </section>

        <section className="border-t border-border py-14">
          <h2 className="text-lg font-semibold tracking-tight">How it works</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title}>
                <div className="text-xs font-medium tabular-nums text-muted-foreground">{`0${i + 1}`}</div>
                <h3 className="mt-2 font-medium">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-border py-14">
          <h2 className="text-lg font-semibold tracking-tight">What the ranking looks at</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every recommendation is explained with the signals below, so you can see why someone ranked where they did.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {signals.map(signal => (
              <li key={signal} className="flex gap-2 text-sm text-muted-foreground">
                <span aria-hidden className="text-foreground">·</span>
                {signal}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-border py-10">
          <div className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-2 sm:gap-8">
            <p>
              Built with Next.js 16, TypeScript, PostgreSQL (Supabase), Prisma 7, the Claude API, and Tailwind.
            </p>
            <p>
              The demo network is entirely synthetic: no real people or LinkedIn data. In the real product,
              connections come from your own LinkedIn connections export.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 text-sm text-muted-foreground">
          <span>WarmPath &copy; {new Date().getFullYear()}</span>
          <Link href="/login" className="hover:text-foreground">Sign in</Link>
        </div>
      </footer>
    </div>
  )
}
