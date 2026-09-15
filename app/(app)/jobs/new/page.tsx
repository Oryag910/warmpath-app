'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function AddJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [form, setForm] = useState({
    title: '',
    company: '',
    url: '',
    rawDescription: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function fetchFromUrl() {
    if (!form.url) {
      toast.error('Enter a job posting URL first')
      return
    }
    setFetching(true)
    toast.info('Reading the job posting…')
    try {
      const res = await fetch('/api/jobs/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.url }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        toast.error(`${data.reason ?? 'Couldn’t read that page'} — paste the details manually.`)
        return
      }
      setForm(prev => ({
        ...prev,
        title: data.title || prev.title,
        company: data.company || prev.company,
        rawDescription: data.rawDescription || prev.rawDescription,
      }))
      toast.success('Filled in from the posting — review and edit before analyzing.')
    } finally {
      setFetching(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to add job')
      setLoading(false)
      return
    }

    const job = await res.json()
    // Fire brief generation before navigating so it has a head start
    fetch(`/api/jobs/${job.id}/brief`, { method: 'POST' })
    router.push(`/jobs/${job.id}`)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Add a job</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste the job description and WarmPath will analyze it for you.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Job details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Job title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={e => set('title', e.target.value)}
                  placeholder="Product Specialist"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={form.company}
                  onChange={e => set('company', e.target.value)}
                  placeholder="Acme Inc."
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Job URL <span className="text-muted-foreground">(optional — auto-fills the fields below)</span></Label>
              <div className="flex gap-2">
                <Input
                  id="url"
                  type="url"
                  value={form.url}
                  onChange={e => set('url', e.target.value)}
                  placeholder="https://..."
                />
                <Button type="button" variant="outline" onClick={fetchFromUrl} disabled={fetching}>
                  {fetching ? 'Reading…' : 'Fetch from URL'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rawDescription">Job description</Label>
              <Textarea
                id="rawDescription"
                value={form.rawDescription}
                onChange={e => set('rawDescription', e.target.value)}
                placeholder="Paste the full job description here…"
                className="min-h-48 resize-none"
                required
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Analyzing…' : 'Analyze job'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
