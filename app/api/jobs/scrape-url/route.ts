import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { extractJobFromHtml } from '@/lib/claude'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    await requireUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { url } = await request.json()
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ ok: false, reason: 'Invalid URL' }, { status: 400 })
  }

  let html: string
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow' })
    if (!res.ok) return NextResponse.json({ ok: false, reason: `Page returned ${res.status}` })
    html = await res.text()
  } catch {
    return NextResponse.json({ ok: false, reason: 'Could not fetch the page' })
  }

  const text = htmlToText(html)
  if (text.length < 200) {
    return NextResponse.json({ ok: false, reason: 'Page had no readable text (likely needs JavaScript)' })
  }

  try {
    const extracted = await extractJobFromHtml(text)
    if (!extracted.title && !extracted.company && !extracted.rawDescription) {
      return NextResponse.json({ ok: false, reason: 'That page does not look like a job posting' })
    }
    return NextResponse.json({ ok: true, ...extracted })
  } catch {
    return NextResponse.json({ ok: false, reason: 'Could not extract job details' })
  }
}
