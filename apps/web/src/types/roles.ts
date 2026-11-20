export type Role = 'administrator' | 'manager' | 'supervisor' | 'operator'

export const ROLES: readonly Role[] = ['administrator', 'manager', 'supervisor', 'operator']

export const ROLE_LABELS: Record<Role, string> = {
  administrator: 'Administrator',
  manager: 'Manager',
  supervisor: 'Supervisor',
  operator: 'Operator',
}

export interface SessionUser {
  id: string
  name: string
  role: Role
}
