import { ChevronRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '@/lib/navigation'

interface Crumb {
  label: string
  to?: string
}

function humanize(segment: string): string {
  // Identifiers such as order numbers (PO-2026-001) are shown exactly as they appear in the URL.
  const decoded = decodeURIComponent(segment)
  if (/\d/.test(decoded)) return decoded
  return decoded.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return []
  const root = NAV_ITEMS.find((n) => n.path === `/${segments[0]}`)
  const crumbs: Crumb[] = [{ label: root?.label ?? humanize(segments[0] ?? ''), to: `/${segments[0]}` }]
  segments.slice(1).forEach((seg, i) => {
    const to = `/${segments.slice(0, i + 2).join('/')}`
    crumbs.push({ label: humanize(seg), to })
  })
  const last = crumbs[crumbs.length - 1]
  if (last) delete last.to
  return crumbs
}

export function Breadcrumbs() {
  const { pathname } = useLocation()
  const crumbs = buildCrumbs(pathname)
  if (crumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 text-sm text-muted">
        <li className="hidden sm:block">ShopFloor</li>
        {crumbs.map((c) => (
          <li key={c.label} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="hidden h-3.5 w-3.5 sm:block" aria-hidden="true" />
            {c.to ? (
              <Link to={c.to} className="truncate hover:text-ink">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-medium text-ink">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
