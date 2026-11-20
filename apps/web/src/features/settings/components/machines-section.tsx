import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { formatNumber } from '@/lib/format'
import type { Machine, ProductionLine } from '@/types/domain'
import { isDuplicateName, validateName, validateShiftTarget } from '../lib/settings-rules'
import { useSettingsAction } from '../hooks/use-settings'
import { createMachine, setMachineActive, updateMachine } from '../services/settings-service'
import { ActiveToggle } from './active-toggle'
import { FieldsDialog, type FieldSpec } from './fields-dialog'
import { SectionShell } from './section-shell'
import { useSectionFeedback } from './use-section-feedback'

export function MachinesSection({ machines, lines }: { machines: Machine[]; lines: ProductionLine[] }) {
  const [dialog, setDialog] = useState<{ mode: 'add' } | { mode: 'edit'; machine: Machine } | null>(null)
  const feedback = useSectionFeedback()
  const lineName = (id: string) => lines.find((l) => l.id === id)?.name ?? id
  const create = useSettingsAction((v: { name: string; lineId: string; shiftTarget: number }, actor) => createMachine(v, actor))
  const update = useSettingsAction((v: { id: string; name: string; shiftTarget: number }, actor) => updateMachine(v.id, { name: v.name, shiftTarget: v.shiftTarget }, actor))
  const toggle = useSettingsAction((v: { id: string; isActive: boolean }, actor) => setMachineActive(v.id, v.isActive, actor))

  const validate = (exceptId?: string) => (v: Record<string, string>) => ({
    name: validateName(v.name ?? '') ?? (isDuplicateName(machines, v.name ?? '', exceptId) ? 'A machine with this name already exists.' : undefined),
    lineId: exceptId || v.lineId ? undefined : 'Select a production line.',
    shiftTarget: validateShiftTarget(Number(v.shiftTarget)) ?? undefined,
  })

  const targetField: FieldSpec = {
    name: 'shiftTarget',
    label: 'Target per shift (units)',
    kind: 'number',
    hint: 'Applies to reports filed from now on. Existing reports keep their target.',
  }
  const lineField = (readOnly: boolean): FieldSpec => ({
    name: 'lineId',
    label: 'Production line',
    kind: 'select',
    readOnly,
    options: lines.filter((l) => l.isActive || readOnly).map((l) => ({ value: l.id, label: l.name })),
    ...(readOnly ? { hint: 'A machine stays on its line.' } : {}),
  })

  return (
    <SectionShell
      title="Machines"
      description="Machines operators report against. Each has a standard output target per shift, which becomes the planned quantity on its reports."
      addLabel="Add machine"
      onAdd={() => setDialog({ mode: 'add' })}
      notice={feedback.notice}
      error={feedback.error}
    >
      <Table>
        <THead>
          <Tr>
            <Th>Machine</Th>
            <Th>Line</Th>
            <Th className="text-right">Target per shift</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {machines.map((m) => (
            <Tr key={m.id}>
              <Td className="font-medium text-ink">{m.name}</Td>
              <Td>{lineName(m.lineId)}</Td>
              <Td className="text-right tabular-nums">{formatNumber(m.shiftTarget)}</Td>
              <Td>
                <StatusBadge status={m.isActive ? 'active' : 'inactive'} />
              </Td>
              <Td>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setDialog({ mode: 'edit', machine: m })} aria-label={`Edit ${m.name}`}>
                    Edit
                  </Button>
                  <ActiveToggle
                    name={m.name}
                    isActive={m.isActive}
                    consequence="Operators can no longer report or record downtime against it. Existing records keep it."
                    onChange={(isActive) =>
                      toggle.mutateAsync({ id: m.id, isActive }).then(
                        () => feedback.success(`${m.name} was ${isActive ? 'reactivated' : 'deactivated'}.`),
                        feedback.fail,
                      )
                    }
                  />
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>

      {dialog?.mode === 'add' ? (
        <FieldsDialog
          title="Add machine"
          fields={[{ name: 'name', label: 'Machine name', kind: 'text' }, lineField(false), targetField]}
          initial={{ name: '', lineId: '', shiftTarget: '' }}
          submitLabel="Add machine"
          validate={validate()}
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            await create.mutateAsync({ name: v.name ?? '', lineId: v.lineId ?? '', shiftTarget: Number(v.shiftTarget) })
            feedback.success(`${(v.name ?? '').trim()} was added.`)
          }}
        />
      ) : null}
      {dialog?.mode === 'edit' ? (
        <FieldsDialog
          title={`Edit ${dialog.machine.name}`}
          fields={[{ name: 'name', label: 'Machine name', kind: 'text' }, lineField(true), targetField]}
          initial={{ name: dialog.machine.name, lineId: dialog.machine.lineId, shiftTarget: String(dialog.machine.shiftTarget) }}
          submitLabel="Save changes"
          validate={validate(dialog.machine.id)}
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            await update.mutateAsync({ id: dialog.machine.id, name: v.name ?? '', shiftTarget: Number(v.shiftTarget) })
            feedback.success('Machine updated.')
          }}
        />
      ) : null}
    </SectionShell>
  )
}
