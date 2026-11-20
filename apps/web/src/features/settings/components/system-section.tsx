import { isApiMode } from '@/lib/config'
import { FACTORY_TIME_ZONE } from '@/lib/dates'
import { getFactoryToday } from '@/services/factory-clock'
import { SectionShell } from './section-shell'

const DEFINITIONS: [string, string][] = [
  ['Good quantity', 'Produced minus rejected.'],
  ['Rejection rate', 'Rejected divided by produced, from summed quantities. Shown as — when nothing was produced.'],
  ['Target achievement', 'Good quantity divided by planned quantity (the sum of shift targets). Shown as — when nothing was planned.'],
  ['Official figures', 'Only approved reports count. Reopening an approved report removes it until it is approved again.'],
  ['Downtime', 'Calculated from start and end times of recorded events, never typed in.'],
]

export function SystemSection() {
  const info: [string, string][] = [
    ['Company', 'Northstar Metalworks (demo)'],
    ['Time zone', `${FACTORY_TIME_ZONE} (factory local time)`],
    ['Factory date in the demo', getFactoryToday()],
    ['Data', isApiMode ? 'Users, Settings and production orders are stored in the database. Reports, approvals, downtime and quality are still demo data in the browser until the next backend phases.' : 'Mock data in the browser. Changes reset when the page reloads.'],
    ['Deployment', isApiMode ? 'LAN-first web application with a Node API and PostgreSQL.' : 'LAN-first web application (run with VITE_DATA_SOURCE=api to use the backend).'],
  ]
  return (
    <SectionShell title="System" description="Read-only information about this installation. Nothing here is a setting yet because nothing else in the app reads a configurable value.">
      <div className="grid gap-6 p-4 lg:grid-cols-2">
        <dl className="space-y-3 text-sm">
          {info.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">How figures are calculated</h3>
          <dl className="space-y-3 text-sm">
            {DEFINITIONS.map(([k, v]) => (
              <div key={k}>
                <dt className="font-medium text-ink">{k}</dt>
                <dd className="text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </SectionShell>
  )
}
