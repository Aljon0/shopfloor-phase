import { FieldsDialog, type FieldSpec } from '@/features/settings/components/fields-dialog'
import { api, describeApiError } from '@/lib/api-client'

const FIELDS: FieldSpec[] = [
  { name: 'currentPassword', label: 'Current password', kind: 'password' },
  { name: 'newPassword', label: 'New password', kind: 'password', hint: 'At least 10 characters.' },
  { name: 'confirm', label: 'Confirm new password', kind: 'password' },
]

/** API mode only. Changing the password signs out your other sessions; this one stays signed in. */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  return (
    <FieldsDialog
      title="Change password"
      fields={FIELDS}
      initial={{ currentPassword: '', newPassword: '', confirm: '' }}
      submitLabel="Change password"
      validate={(v) => ({
        currentPassword: v.currentPassword ? undefined : 'Enter your current password.',
        newPassword: (v.newPassword ?? '').length >= 10 ? undefined : 'Use at least 10 characters.',
        confirm: v.confirm === v.newPassword ? undefined : 'The two passwords do not match.',
      })}
      onClose={onClose}
      onSubmit={async (v) => {
        try {
          await api.post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword })
        } catch (error) {
          throw describeApiError(error)
        }
      }}
    />
  )
}
