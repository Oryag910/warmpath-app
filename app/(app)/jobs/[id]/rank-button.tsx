'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Props {
  jobId: string
  hasExistingPaths: boolean
}

export default function RankButton({ jobId, hasExistingPaths }: Props) {
  const router = useRouter()
  const [ranking, setRanking] = useState(false)

  async function rank() {
    setRanking(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/warm-paths`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rankAll: true }),
      })
      if (res.status === 400) {
        const { error } = await res.json()
        if (error === 'No contacts to rank') {
          toast.error('Add some contacts first — import your LinkedIn CSV or add manually.')
        } else {
          toast.error(error ?? 'Ranking failed')
        }
        return
      }
      if (!res.ok) {
        toast.error('Ranking failed')
        return
      }
      const { rankedCount, totalContacts } = await res.json()
      if (totalContacts > rankedCount) {
        toast.success(`Ranked top ${rankedCount} of ${totalContacts} contacts`)
      }
      router.push(`/jobs/${jobId}/pipeline`)
    } finally {
      setRanking(false)
    }
  }

  return (
    <Button onClick={rank} disabled={ranking} variant={hasExistingPaths ? 'outline' : 'default'}>
      {ranking ? 'Ranking…' : hasExistingPaths ? 'Re-rank contacts' : 'Rank my connections'}
    </Button>
  )
}
