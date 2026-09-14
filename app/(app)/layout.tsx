import { cookies } from 'next/headers'
import Nav from '@/components/nav'
import { DEMO_COOKIE } from '@/lib/demo'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies()
  const demo = store.has(DEMO_COOKIE)

  return (
    <div className="min-h-screen flex flex-col">
      <Nav demo={demo} />
      {demo && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900">
          <div className="max-w-5xl mx-auto px-4 py-2 text-xs sm:text-sm flex items-center justify-between gap-4">
            <span>
              <span className="font-medium">Demo sandbox.</span>{' '}
              You are Jordan Rivera, a fictional Michigan CS student with a synthetic network of 1,100 connections. No real people.
            </span>
            <a href="/demo/exit" className="underline whitespace-nowrap">Exit demo</a>
          </div>
        </div>
      )}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {children}
      </main>
    </div>
  )
}
