import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import type { Machine, ProductionLine } from '@/types/domain'
import { isDuplicateName, validateLineCode, validateName } from '../lib/settings-rules'
import { useSettingsAction } from '../hooks/use-settings'
import { createLine, setLineActive, updateLine } from '../services/settings-service'
import { ActiveToggle } from './active-toggle'
import { FieldsDialog, type FieldSpec } from './fields-dialog'
import { SectionShell } from './section-shell'
import { useSectionFeedback } from './use-section-feedback'

interface LinesSectionProps {
  lines: ProductionLine[]
  machines: Machine[]
  openOrders: Record<string, number>
}

export function LinesSection({ lines, machines, openOrders }: LinesSectionProps) {
  const [dialog, setDialog] = useState<{ mode: 'add' } | { mode: 'edit'; line: ProductionLine } | null>(null)
  const feedback = useSectionFeedback()
  const create = useSettingsAction((v: { name: string; code: string }, actor) => createLine(v, actor))
  const update = useSettingsAction((v: { id: string; name: string }, actor) => updateLine(v.id, { name: v.name }, actor))
  const toggle = useSettingsAction((v: { id: string; isActive: boolean }, actor) => setLineActive(v.id, v.isActive, actor))

  const addFields: FieldSpec[] = [
    { name: 'name', label: 'Line name', kind: 'text' },
    { name: 'code', label: 'Code', kind: 'text', placeholder: 'CUT', hint: 'Used in report numbers and cannot be changed later.' },
  ]

  const validate = (exceptId?: string) => (v: Record<string, string>) => ({
    name: validateName(v.name ?? '') ?? (isDuplicateName(lines, v.name ?? '', exceptId) ? 'A line with this name already exists.' : undefined),
    code: exceptId
      ? undefined
      : (validateLineCode(v.code ?? '') ?? (lines.some((l) => l.code === (v.code ?? '').trim()) ? 'This code is already used.' : undefined)),
  })

  return (
    <SectionShell
      title="Production lines"
      description="The lines machines belong to. A line cannot be deactivated while it has open orders or active machines."
      addLabel="Add line"
      onAdd={() => setDialog({ mode: 'add' })}
      notice={feedback.notice}
      error={feedback.error}
    >
      <Table>
        <THead>
          <Tr>
            <Th>Line</Th>
            <Th>Code</Th>
            <Th className="text-right">Active machines</Th>
            <Th className="text-right">Open orders</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {lines.map((l) => (
            <Tr key={l.id}>
              <Td className="font-medium text-ink">{l.name}</Td>
              <Td>{l.code}</Td>
              <Td className="text-right tabular-nums">{machines.filter((m) => m.lineId === l.id && m.isActive).length}</Td>
              <Td className="text-right tabular-nums">{openOrders[l.id] ?? 0}</Td>
              <Td>
                <StatusBadge status={l.isActive ? 'active' : 'inactive'} />
              </Td>
              <Td>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setDialog({ mode: 'edit', line: l })} aria-label={`Rename ${l.name}`}>
                    Rename
                  </Button>
                  <ActiveToggle
                    name={l.name}
                    isActive={l.isActive}
                    consequence="New orders and machines cannot use it. Existing orders and reports keep it."
                    onChange={(isActive) =>
                      toggle.mutateAsync({ id: l.id, isActive }).then(
                        () => feedback.success(`${l.name} was ${isActive ? 'reactivated' : 'deactivated'}.`),
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
          title="Add production line"
          fields={addFields}
          initial={{ name: '', code: '' }}
          submitLabel="Add line"
          validate={validate()}
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            await create.mutateAsync({ name: v.name ?? '', code: (v.code ?? '').trim() })
            feedback.success(`${(v.name ?? '').trim()} was added.`)
          }}
        />
      ) : null}
      {dialog?.mode === 'edit' ? (
        <FieldsDialog
          title={`Rename ${dialog.line.name}`}
          fields={[{ name: 'name', label: 'Line name', kind: 'text' }, { name: 'code', label: 'Code', kind: 'text', readOnly: true, hint: 'The code is part of report numbers, so it is fixed.' }]}
          initial={{ name: dialog.line.name, code: dialog.line.code }}
          submitLabel="Save"
          validate={validate(dialog.line.id)}
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            await update.mutateAsync({ id: dialog.line.id, name: v.name ?? '' })
            feedback.success('Line renamed.')
          }}
        />
      ) : null}
    </SectionShell>
  )
}
