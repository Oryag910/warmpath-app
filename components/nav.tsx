'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button, buttonVariants } from '@/components/ui/button'

export default function Nav({ demo = false }: { demo?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const links = [
    { href: '/', label: 'Jobs' },
    { href: '/contacts', label: 'Contacts' },
    { href: '/queue', label: 'Action Queue' },
    { href: '/profile', label: 'Profile' },
  ]

  return (
    <header className="border-b">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-sm">WarmPath</Link>
          <nav className="flex items-center gap-4">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm ${pathname === link.href ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        {demo ? (
          <a href="/demo/exit" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Exit demo</a>
        ) : (
          <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
        )}
      </div>
    </header>
  )
}
