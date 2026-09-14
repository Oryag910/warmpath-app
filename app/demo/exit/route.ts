import { NextRequest, NextResponse } from 'next/server'
import { DEMO_COOKIE } from '@/lib/demo'

export const dynamic = 'force-dynamic'

// GET /demo/exit — leave the sandbox and return to the landing page.
export async function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL('/', request.url), 303)
  res.cookies.set(DEMO_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
