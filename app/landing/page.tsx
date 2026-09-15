import type { Metadata } from 'next'
import Link from 'next/link'
import TryDemoButton from './try-demo-button'

export const metadata: Metadata = {
  title: 'WarmPath — warm paths into any company',
}

const steps = [
  {
    title: 'Paste a job',
    description: 'WarmPath extracts the role, company, and requirements from the posting.',
  },
  {
    title: 'Rank your network',
    description:
      'A deterministic pre-filter screens ~1,000 connections for company, career, and affiliation overlap; a single Claude call scores the candidates relationally and explains each one.',
  },
  {
    title: 'Make the move',
    description:
      'Get the recommended ask — context, advice, referral, intro, or recruiter pitch — and a drafted LinkedIn DM or email.',
  },
]

const signals = [
  'Current or past employment at the target company',
  'Career history and role proximity',
  'Shared school',
  'Shared organizations',
  'Relationship strength (shapes the ask, not the ranking)',
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
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-lg font-semibold">WarmPath</span>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="py-16 sm:py-24 text-center">
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-balance">
            Find the warmest path into any company.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground text-balance">
            Paste a job posting and WarmPath ranks your LinkedIn network for that specific role,
            explains who to reach out to and why, and drafts the message.
          </p>
          <div className="mt-8">
            {notice && (
              <p className="mx-auto mb-4 max-w-md rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {notice}
              </p>
            )}
            <TryDemoButton />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
              Sign in
            </Link>
          </p>
        </section>

        <section className="border-t border-border py-16">
          <h2 className="text-xl font-semibold">How it works</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title}>
                <div className="text-sm font-medium text-muted-foreground">{`0${i + 1}`}</div>
                <h3 className="mt-2 font-medium">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border py-16">
          <h2 className="text-xl font-semibold">What it looks at</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {signals.map(signal => (
              <li key={signal} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-foreground">·</span>
                {signal}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-border py-10">
          <p className="text-sm text-muted-foreground">
            Built with Next.js 16, TypeScript, PostgreSQL (Supabase), Prisma 7, Claude API, and
            Tailwind.
          </p>
        </section>

        <section className="border-t border-border py-10">
          <p className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            The demo network is entirely synthetic. No real people or LinkedIn data are used. In
            the real product, connections come from a LinkedIn CSV export plus a local enrichment
            tool.
          </p>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted-foreground">
          WarmPath &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  )
}
