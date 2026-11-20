import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import type { ShiftConfig } from '@/types/domain'
import { shiftLengthMinutes, validateShiftTimes } from '../lib/settings-rules'
import { useSettingsAction } from '../hooks/use-settings'
import { updateShift } from '../services/settings-service'
import { FieldsDialog, type FieldSpec } from './fields-dialog'
import { SectionShell } from './section-shell'
import { useSectionFeedback } from './use-section-feedback'

const FIELDS: FieldSpec[] = [
  { name: 'startTime', label: 'Starts', kind: 'time' },
  { name: 'endTime', label: 'Ends', kind: 'time', hint: 'A shift that ends before it starts runs overnight.' },
]

export function ShiftsSection({ shifts }: { shifts: ShiftConfig[] }) {
  const [editing, setEditing] = useState<ShiftConfig | null>(null)
  const feedback = useSectionFeedback()
  const update = useSettingsAction((v: { id: ShiftConfig['id']; startTime: string; endTime: string }, actor) => updateShift(v.id, { startTime: v.startTime, endTime: v.endTime }, actor))

  return (
    <SectionShell
      title="Shifts"
      description="Working hours of each shift, in factory local time. The two shifts are fixed. Hours are for reference for now: reports are filed per shift, not by clock time."
      notice={feedback.notice}
      error={feedback.error}
    >
      <Table>
        <THead>
          <Tr>
            <Th>Shift</Th>
            <Th>Starts</Th>
            <Th>Ends</Th>
            <Th className="text-right">Length</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {shifts.map((s) => {
            const minutes = shiftLengthMinutes(s.startTime, s.endTime)
            return (
              <Tr key={s.id}>
                <Td className="font-medium text-ink">{s.name}</Td>
                <Td>{s.startTime}</Td>
                <Td>
                  {s.endTime}
                  {s.endTime <= s.startTime ? <span className="ml-1 text-xs text-muted">(next day)</span> : null}
                </Td>
                <Td className="text-right tabular-nums">{minutes === null ? '—' : `${minutes / 60} h`}</Td>
                <Td>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(s)} aria-label={`Edit ${s.name} shift hours`}>
                      Edit hours
                    </Button>
                  </div>
                </Td>
              </Tr>
            )
          })}
        </TBody>
      </Table>

      {editing ? (
        <FieldsDialog
          title={`${editing.name} shift hours`}
          fields={FIELDS}
          initial={{ startTime: editing.startTime, endTime: editing.endTime }}
          submitLabel="Save hours"
          validate={(v) => ({ endTime: validateShiftTimes(v.startTime ?? '', v.endTime ?? '') ?? undefined })}
          onClose={() => setEditing(null)}
          onSubmit={async (v) => {
            await update.mutateAsync({ id: editing.id, startTime: v.startTime ?? '', endTime: v.endTime ?? '' })
            feedback.success(`${editing.name} shift hours were saved.`)
          }}
        />
      ) : null}
    </SectionShell>
  )
}
