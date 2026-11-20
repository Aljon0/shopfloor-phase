import { Skeleton } from '@/components/ui/skeleton'

/** Shown while the router prepares the first screen (lazy route chunks). */
export function RouteLoading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}
