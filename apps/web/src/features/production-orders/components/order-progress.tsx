import { cn } from '@/lib/cn'
import { formatPercent } from '@/lib/format'
import type { OrderProgress as Progress } from '../types'

interface OrderProgressBarProps {
  progress: Progress
  className?: string
}

/**
 * Solid = good output on approved reports (official progress).
 * Light = good output on reports still awaiting review.
 */
export function OrderProgressBar({ progress, className }: OrderProgressBarProps) {
  const { plannedQuantity, approvedGood, pendingGood, percent } = progress
  const approvedWidth = plannedQuantity > 0 ? Math.min(100, (approvedGood / plannedQuantity) * 100) : 0
  const pendingWidth =
    plannedQuantity > 0 ? Math.min(100 - approvedWidth, (Math.max(0, pendingGood) / plannedQuantity) * 100) : 0

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(approvedWidth)}
      aria-label={`Progress ${formatPercent(percent, 0)} of planned quantity, approved reports only`}
      className={cn('flex h-2 overflow-hidden rounded-sm bg-neutral-bg', className)}
    >
      <div className="h-full bg-primary" style={{ width: `${approvedWidth}%` }} />
      <div className="h-full bg-blue-200" style={{ width: `${pendingWidth}%` }} />
    </div>
  )
}

/** Compact progress for table rows. */
export function OrderProgressCell({ progress }: { progress: Progress }) {
  return (
    <div className="flex items-center gap-2">
      <OrderProgressBar progress={progress} className="w-24" />
      <span className="w-10 text-right text-xs tabular-nums text-muted">{formatPercent(progress.percent, 0)}</span>
    </div>
  )
}
