import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import type { Product } from '@/types/domain'
import { isDuplicateName, validateName } from '../lib/settings-rules'
import { useSettingsAction } from '../hooks/use-settings'
import { createProduct, setProductActive, updateProduct } from '../services/settings-service'
import { ActiveToggle } from './active-toggle'
import { FieldsDialog, type FieldSpec } from './fields-dialog'
import { SectionShell } from './section-shell'
import { useSectionFeedback } from './use-section-feedback'

const FIELDS: FieldSpec[] = [{ name: 'name', label: 'Product name', kind: 'text' }]

interface ProductsSectionProps {
  products: Product[]
  openOrders: Record<string, number>
}

export function ProductsSection({ products, openOrders }: ProductsSectionProps) {
  const [dialog, setDialog] = useState<{ mode: 'add' } | { mode: 'edit'; product: Product } | null>(null)
  const feedback = useSectionFeedback()
  const create = useSettingsAction((v: string, actor) => createProduct({ name: v }, actor))
  const update = useSettingsAction((v: { id: string; name: string }, actor) => updateProduct(v.id, { name: v.name }, actor))
  const toggle = useSettingsAction((v: { id: string; isActive: boolean }, actor) => setProductActive(v.id, v.isActive, actor))

  const validate = (exceptId?: string) => (v: Record<string, string>) => ({
    name: validateName(v.name ?? '') ?? (isDuplicateName(products, v.name ?? '', exceptId) ? 'A product with this name already exists.' : undefined),
  })

  return (
    <SectionShell
      title="Products"
      description="What the factory makes. An inactive product stays on past orders but cannot be chosen for new ones."
      addLabel="Add product"
      onAdd={() => setDialog({ mode: 'add' })}
      notice={feedback.notice}
      error={feedback.error}
    >
      <Table>
        <THead>
          <Tr>
            <Th>Product</Th>
            <Th className="text-right">Open orders</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {products.map((p) => (
            <Tr key={p.id}>
              <Td className="font-medium text-ink">{p.name}</Td>
              <Td className="text-right tabular-nums">{openOrders[p.id] ?? 0}</Td>
              <Td>
                <StatusBadge status={p.isActive ? 'active' : 'inactive'} />
              </Td>
              <Td>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setDialog({ mode: 'edit', product: p })} aria-label={`Rename ${p.name}`}>
                    Rename
                  </Button>
                  <ActiveToggle
                    name={p.name}
                    isActive={p.isActive}
                    consequence="It can no longer be chosen for new orders. Existing orders and reports keep it."
                    onChange={(isActive) =>
                      toggle.mutateAsync({ id: p.id, isActive }).then(
                        () => feedback.success(`${p.name} was ${isActive ? 'reactivated' : 'deactivated'}.`),
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
          title="Add product"
          fields={FIELDS}
          initial={{ name: '' }}
          submitLabel="Add product"
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
          title={`Rename ${dialog.product.name}`}
          fields={FIELDS}
          initial={{ name: dialog.product.name }}
          submitLabel="Save"
          validate={validate(dialog.product.id)}
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            await update.mutateAsync({ id: dialog.product.id, name: v.name ?? '' })
            feedback.success('Product renamed.')
          }}
        />
      ) : null}
    </SectionShell>
  )
}
