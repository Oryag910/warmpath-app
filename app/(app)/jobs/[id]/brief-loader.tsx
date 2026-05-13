'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'

export default function OpportunityBriefLoader({ jobId }: { jobId: string }) {
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/jobs/${jobId}/brief`, { method: 'POST' })
      .then(() => router.refresh())
  }, [jobId])

  return (
    <Card className="border-dashed">
      <CardContent className="py-8 text-center space-y-3">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Generating opportunity brief…</p>
      </CardContent>
    </Card>
  )
}
