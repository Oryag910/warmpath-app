'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button, buttonVariants } from '@/components/ui/button'

const LINKS = [
  { href: '/', label: 'Jobs' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/queue', label: 'Queue' },
  { href: '/profile', label: 'Profile' },
]

export default function Nav({ demo = false }: { demo?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-center gap-5 sm:gap-6">
          <Link href="/" className="shrink-0 text-sm font-semibold tracking-tight">WarmPath</Link>
          <nav aria-label="Primary" className="flex min-w-0 items-center gap-4 overflow-x-auto whitespace-nowrap pr-6 [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] sm:pr-0 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden">
            {LINKS.map(link => {
              const active = link.href === '/' ? pathname === '/' || pathname.startsWith('/jobs') : pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`text-sm ${active ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>
        {demo ? (
          <a href="/demo/exit" className={buttonVariants({ variant: 'outline', size: 'sm', className: 'shrink-0' })}>Exit demo</a>
        ) : (
          <Button variant="ghost" size="sm" onClick={signOut} className="shrink-0">Sign out</Button>
        )}
      </div>
    </header>
  )
}
