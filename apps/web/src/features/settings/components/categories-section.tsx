import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { DOWNTIME_CATEGORY_LABELS } from '@/lib/labels'
import type { DowntimeCategory } from '@/types/domain'
import { SectionShell } from './section-shell'

const DESCRIPTIONS: Record<DowntimeCategory, string> = {
  machine_maintenance: 'Planned servicing, lubrication, calibration.',
  equipment_failure: 'Unplanned breakdowns and repairs.',
  material_shortage: 'Waiting for raw material or components.',
  changeover: 'Switching tooling or product setup.',
  operator_delay: 'Waiting for an operator, handover, breaks beyond plan.',
  other: 'Anything that fits none of the above. Explain it in the notes.',
}

export function CategoriesSection() {
  return (
    <SectionShell
      title="Downtime categories"
      description="A fixed list. Downtime events, the dashboard and exports all depend on it, so it is shown here but not editable. Defect types are managed under Defect types."
    >
      <Table>
        <THead>
          <Tr>
            <Th>Category</Th>
            <Th>Used for</Th>
          </Tr>
        </THead>
        <TBody>
          {(Object.keys(DOWNTIME_CATEGORY_LABELS) as DowntimeCategory[]).map((c) => (
            <Tr key={c}>
              <Td className="font-medium text-ink">{DOWNTIME_CATEGORY_LABELS[c]}</Td>
              <Td>{DESCRIPTIONS[c]}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </SectionShell>
  )
}
