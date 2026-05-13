'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function DeleteJobButton({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirming) { setConfirming(true); return }
    setDeleting(true)
    const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Failed to delete job')
      setDeleting(false)
      setConfirming(false)
      return
    }
    router.refresh()
  }

  return (
    <Button
      variant={confirming ? 'destructive' : 'ghost'}
      size="sm"
      disabled={deleting}
      onClick={handleDelete}
      onBlur={() => setConfirming(false)}
      className="shrink-0 self-center"
    >
      {deleting ? 'Deleting…' : confirming ? 'Confirm?' : 'Delete'}
    </Button>
  )
}
