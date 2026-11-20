import { EmptyState } from '@/components/ui/empty-state'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { formatFactoryDateTime } from '@/lib/dates'
import type { SettingsAuditEntry, SettingsEntity } from '@/types/domain'
import { SectionShell } from './section-shell'

const ENTITY_LABELS: Record<SettingsEntity, string> = {
  user: 'User',
  product: 'Product',
  line: 'Line',
  machine: 'Machine',
  shift: 'Shift',
  defect_type: 'Defect type',
}

export function AuditSection({ entries }: { entries: SettingsAuditEntry[] }) {
  return (
    <SectionShell title="Change log" description="Every configuration change: who, what and when. With the real server this history is stored in the database; in demo mode it lasts until the page reloads.">
      {entries.length === 0 ? (
        <EmptyState title="No changes yet" description="Changes you make in Settings will be listed here." />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>Item</Th>
              <Th>Change</Th>
            </Tr>
          </THead>
          <TBody>
            {entries.map((e) => (
              <Tr key={e.id}>
                <Td className="whitespace-nowrap">{formatFactoryDateTime(e.timestamp)}</Td>
                <Td>{e.actor}</Td>
                <Td>{ENTITY_LABELS[e.entity]}</Td>
                <Td>{e.detail}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </SectionShell>
  )
}
