import { cookies } from 'next/headers'
import Nav from '@/components/nav'
import { DEMO_COOKIE, DEMO_PERSONA_NAME } from '@/lib/demo'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies()
  const demo = store.has(DEMO_COOKIE)

  return (
    <div className="flex min-h-screen flex-col">
      <Nav demo={demo} />
      {demo && (
        <div className="border-b border-amber-200/70 bg-amber-50/70 text-amber-950">
          <p className="mx-auto max-w-5xl px-4 py-1.5 text-xs leading-relaxed sm:text-[13px]">
            <span className="font-medium">Demo sandbox.</span>{' '}
            You are {DEMO_PERSONA_NAME}, a fictional CS student with a synthetic network of 1,100 connections. No real people; nothing here is saved beyond this session.
          </p>
        </div>
      )}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  )
}
