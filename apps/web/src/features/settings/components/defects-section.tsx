import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import type { DefectType } from '@/types/domain'
import { isDuplicateName, validateName } from '../lib/settings-rules'
import { useSettingsAction } from '../hooks/use-settings'
import { createDefectType, setDefectTypeActive, updateDefectType } from '../services/settings-service'
import { ActiveToggle } from './active-toggle'
import { FieldsDialog, type FieldSpec } from './fields-dialog'
import { SectionShell } from './section-shell'
import { useSectionFeedback } from './use-section-feedback'

const FIELDS: FieldSpec[] = [{ name: 'name', label: 'Defect type', kind: 'text' }]

export function DefectsSection({ defects }: { defects: DefectType[] }) {
  const [dialog, setDialog] = useState<{ mode: 'add' } | { mode: 'edit'; defect: DefectType } | null>(null)
  const feedback = useSectionFeedback()
  const create = useSettingsAction((v: string, actor) => createDefectType({ name: v }, actor))
  const update = useSettingsAction((v: { id: string; name: string }, actor) => updateDefectType(v.id, { name: v.name }, actor))
  const toggle = useSettingsAction((v: { id: string; isActive: boolean }, actor) => setDefectTypeActive(v.id, v.isActive, actor))

  const validate = (exceptId?: string) => (v: Record<string, string>) => ({
    name: validateName(v.name ?? '') ?? (isDuplicateName(defects, v.name ?? '', exceptId) ? 'This defect type already exists.' : undefined),
  })

  return (
    <SectionShell
      title="Defect types"
      description="Classifications used on quality inspections. An inactive type stays on past inspections but cannot be chosen for new ones."
      addLabel="Add defect type"
      onAdd={() => setDialog({ mode: 'add' })}
      notice={feedback.notice}
      error={feedback.error}
    >
      <Table>
        <THead>
          <Tr>
            <Th>Defect type</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {defects.map((d) => (
            <Tr key={d.id}>
              <Td className="font-medium text-ink">{d.name}</Td>
              <Td>
                <StatusBadge status={d.isActive ? 'active' : 'inactive'} />
              </Td>
              <Td>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setDialog({ mode: 'edit', defect: d })} aria-label={`Rename ${d.name}`}>
                    Rename
                  </Button>
                  <ActiveToggle
                    name={d.name}
                    isActive={d.isActive}
                    consequence="It can no longer be chosen on new inspections. Past inspections keep it."
                    onChange={(isActive) =>
                      toggle.mutateAsync({ id: d.id, isActive }).then(
                        () => feedback.success(`${d.name} was ${isActive ? 'reactivated' : 'deactivated'}.`),
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
          title="Add defect type"
          fields={FIELDS}
          initial={{ name: '' }}
          submitLabel="Add defect type"
          validate={validate()}
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            await create.mutateAsync(v.name ?? '')
            feedback.success(`${(v.name ?? '').trim()} was added.`)
          }}
        />
      ) : null}
      {dialog?.mode === 'edit' ? (
        <FieldsDialog
          title={`Rename ${dialog.defect.name}`}
          fields={FIELDS}
          initial={{ name: dialog.defect.name }}
          submitLabel="Save"
          validate={validate(dialog.defect.id)}
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            await update.mutateAsync({ id: dialog.defect.id, name: v.name ?? '' })
            feedback.success('Defect type renamed.')
          }}
        />
      ) : null}
    </SectionShell>
  )
}
