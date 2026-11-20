import { Ban, Boxes, CircleCheck, ClipboardCheck, Target, Timer } from 'lucide-react'
import { formatMinutes, formatNumber, formatPercent } from '@/lib/format'
import type { DashboardKpis } from '../lib/aggregate'
import { KpiCard } from './kpi-card'

export function KpiGrid({ kpis }: { kpis: DashboardKpis }) {
  return (
    <section aria-label="Key performance indicators" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        label="Total Produced"
        value={formatNumber(kpis.producedQuantity)}
        hint="All units, including rejected"
        icon={Boxes}
      />
      <KpiCard
        label="Good Output"
        value={formatNumber(kpis.goodQuantity)}
        hint="Produced minus rejected"
        icon={CircleCheck}
      />
      <KpiCard
        label="Target Achievement"
        value={formatPercent(kpis.targetAchievement)}
        hint={
          kpis.plannedQuantity > 0
            ? `${formatNumber(kpis.goodQuantity)} good of ${formatNumber(kpis.plannedQuantity)} planned`
            : 'No planned quantity in range'
        }
        icon={Target}
      />
      <KpiCard
        label="Rejection Rate"
        value={formatPercent(kpis.rejectionRate)}
        hint={
          kpis.producedQuantity > 0
            ? `${formatNumber(kpis.rejectedQuantity)} of ${formatNumber(kpis.producedQuantity)} produced`
            : 'No units produced in range'
        }
        icon={Ban}
      />
      <KpiCard
        label="Total Downtime"
        value={formatMinutes(kpis.downtimeMinutes)}
        hint={`${formatNumber(kpis.downtimeEvents)} ${kpis.downtimeEvents === 1 ? 'event' : 'events'}`}
        icon={Timer}
      />
      <KpiCard
        label="Pending Approvals"
        value={formatNumber(kpis.pendingApprovals)}
        hint="Reports awaiting review, all dates"
        icon={ClipboardCheck}
      />
    </section>
  )
}
