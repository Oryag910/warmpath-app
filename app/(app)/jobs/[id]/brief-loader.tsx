'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function OpportunityBriefLoader({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function generate() {
    setLoading(true)
    await fetch(`/api/jobs/${jobId}/brief`, { method: 'POST' })
    router.refresh()
  }

  return (
    <Card className="border-dashed">
      <CardContent className="py-8 text-center space-y-3">
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Generating opportunity brief…</p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Opportunity brief not generated yet.</p>
            <Button size="sm" onClick={generate}>Generate brief</Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
