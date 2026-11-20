import { useState } from 'react'
import { describeApiError } from '@/lib/api-client'
import { isApiMode } from '@/lib/config'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { useAuth } from '@/hooks/use-auth'
import { ROLE_LABELS, ROLES } from '@/types/roles'
import type { Role } from '@/types/roles'
import type { AppUser } from '@/types/domain'
import { isDuplicateEmail, isDuplicateName, validateEmail, validateName } from '../lib/settings-rules'
import { useSettingsAction } from '../hooks/use-settings'
import { createUser, resetUserPassword, setUserActive, updateUser, type UserInput } from '../services/settings-service'
import { ActiveToggle } from './active-toggle'
import { FieldsDialog, type FieldSpec } from './fields-dialog'
import { SectionShell } from './section-shell'
import { useSectionFeedback } from './use-section-feedback'

const PASSWORD_FIELD: FieldSpec = { name: 'password', label: 'Initial password', kind: 'password', hint: 'At least 10 characters. Share it with the person privately; they can change it after signing in.' }
const RESET_FIELDS: FieldSpec[] = [{ name: 'password', label: 'New password', kind: 'password', hint: 'At least 10 characters. Signs the person out everywhere.' }]

const FIELDS: FieldSpec[] = [
  { name: 'name', label: 'Full name', kind: 'text' },
  { name: 'email', label: 'Email', kind: 'text', placeholder: 'name@company.com' },
  { name: 'role', label: 'Role', kind: 'select', options: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
]

export function UsersSection({ users }: { users: AppUser[] }) {
  const { user: me } = useAuth()
  const [dialog, setDialog] = useState<{ mode: 'add' } | { mode: 'edit'; user: AppUser } | { mode: 'reset'; user: AppUser } | null>(null)
  const feedback = useSectionFeedback()
  const create = useSettingsAction((v: UserInput, actor) => createUser(v, actor))
  const update = useSettingsAction((v: { id: string; input: UserInput }, actor) => updateUser(v.id, v.input, actor))
  const toggle = useSettingsAction((v: { id: string; isActive: boolean }, actor) => setUserActive(v.id, v.isActive, actor))

  const validate = (exceptId?: string) => (v: Record<string, string>) => ({
    name: validateName(v.name ?? '') ?? (isDuplicateName(users, v.name ?? '', exceptId) ? 'Another user has this name.' : undefined),
    email: validateEmail(v.email ?? '') ?? (isDuplicateEmail(users, v.email ?? '', exceptId) ? 'Another user has this email.' : undefined),
    role: v.role ? undefined : 'Select a role.',
    ...(isApiMode && !exceptId ? { password: (v.password ?? '').length >= 10 ? undefined : 'Use at least 10 characters.' } : {}),
  })
  const asInput = (v: Record<string, string>): UserInput => ({ name: v.name ?? '', email: v.email ?? '', role: (v.role ?? '') as Role, ...(v.password ? { password: v.password } : {}) })

  return (
    <SectionShell
      title="Users and roles"
      description={
        isApiMode
          ? 'Who can sign in and what they can do. Deactivating a user or changing their role takes effect on their very next request.'
          : 'Who can use ShopFloor and what they can do. Sign-in is still a name and role prototype, so changes here do not yet control who can log in.'
      }
      addLabel="Add user"
      onAdd={() => setDialog({ mode: 'add' })}
      notice={feedback.notice}
      error={feedback.error}
    >
      <Table>
        <THead>
          <Tr>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {users.map((u) => (
            <Tr key={u.id}>
              <Td className="font-medium text-ink">
                {u.name}
                {me && (isApiMode ? me.id === u.id : me.name.trim().toLowerCase() === u.name.toLowerCase()) ? <span className="ml-2 text-xs font-normal text-muted">(you)</span> : null}
              </Td>
              <Td>{u.email}</Td>
              <Td>{ROLE_LABELS[u.role]}</Td>
              <Td>
                <StatusBadge status={u.isActive ? 'active' : 'inactive'} />
              </Td>
              <Td>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setDialog({ mode: 'edit', user: u })} aria-label={`Edit ${u.name}`}>
                    Edit
                  </Button>
                  {isApiMode ? (
                    <Button variant="ghost" size="sm" onClick={() => setDialog({ mode: 'reset', user: u })} aria-label={`Reset password for ${u.name}`}>
                      Reset password
                    </Button>
                  ) : null}
                  <ActiveToggle
                    name={u.name}
                    isActive={u.isActive}
                    consequence="They are marked inactive. Their past reports and history stay as they are."
                    onChange={(isActive) =>
                      toggle.mutateAsync({ id: u.id, isActive }).then(
                        () => feedback.success(`${u.name} was ${isActive ? 'reactivated' : 'deactivated'}.`),
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
          title="Add user"
          fields={isApiMode ? [...FIELDS, PASSWORD_FIELD] : FIELDS}
          initial={{ name: '', email: '', role: '', password: '' }}
          submitLabel="Add user"
          validate={validate()}
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            const created = await create.mutateAsync(asInput(v))
            feedback.success(`${(created as AppUser).name} was added.`)
          }}
        />
      ) : null}
      {dialog?.mode === 'edit' ? (
        <FieldsDialog
          title={`Edit ${dialog.user.name}`}
          fields={FIELDS}
          initial={{ name: dialog.user.name, email: dialog.user.email, role: dialog.user.role }}
          submitLabel="Save changes"
          validate={validate(dialog.user.id)}
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            await update.mutateAsync({ id: dialog.user.id, input: asInput(v) })
            feedback.success(`${dialog.user.name} was updated.`)
          }}
        />
      ) : null}
      {dialog?.mode === 'reset' ? (
        <FieldsDialog
          title={`Reset password for ${dialog.user.name}`}
          fields={RESET_FIELDS}
          initial={{ password: '' }}
          submitLabel="Reset password"
          validate={(v) => ({ password: (v.password ?? '').length >= 10 ? undefined : 'Use at least 10 characters.' })}
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            try {
              await resetUserPassword(dialog.user.id, v.password ?? '')
            } catch (error) {
              throw describeApiError(error)
            }
            feedback.success(`Password reset for ${dialog.user.name}. They were signed out everywhere.`)
          }}
        />
      ) : null}
    </SectionShell>
  )
}
