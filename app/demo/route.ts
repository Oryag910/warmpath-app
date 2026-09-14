import { NextRequest, NextResponse } from 'next/server'
import { createDemoSandbox, encodeDemoCookie, DEMO_COOKIE } from '@/lib/demo'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /demo — "Try the demo": clone the seeded template into a fresh sandbox, set the
// signed sandbox cookie, and land the visitor directly on the target job.
export async function GET(request: NextRequest) {
  try {
    const { userId, jobId } = await createDemoSandbox()
    const res = NextResponse.redirect(new URL(`/jobs/${jobId}`, request.url), 303)
    res.cookies.set(DEMO_COOKIE, encodeDemoCookie(userId), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
    return res
  } catch (err) {
    console.error('demo start failed', err)
    const url = new URL('/landing', request.url)
    url.searchParams.set('error', 'demo')
    return NextResponse.redirect(url, 303)
  }
}
