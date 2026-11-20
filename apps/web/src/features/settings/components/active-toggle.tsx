import { useState } from 'react'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'

interface ActiveToggleProps {
  name: string
  isActive: boolean
  /** Extra sentence for the deactivate confirmation. */
  consequence: string
  onChange: (isActive: boolean) => Promise<void>
}

/** Activate immediately; deactivate after a confirmation. Errors from the service are handled by the caller. */
export function ActiveToggle({ name, isActive, consequence, onChange }: ActiveToggleProps) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  const run = async (next: boolean) => {
    setPending(true)
    try {
      await onChange(next)
    } finally {
      setPending(false)
      setConfirming(false)
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => (isActive ? setConfirming(true) : void run(true))} aria-label={`${isActive ? 'Deactivate' : 'Reactivate'} ${name}`}>
        {isActive ? 'Deactivate' : 'Reactivate'}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Deactivate ${name}?`}
        description={consequence}
        confirmLabel="Deactivate"
        tone="danger"
        pending={pending}
        onConfirm={() => void run(false)}
      />
    </>
  )
}
