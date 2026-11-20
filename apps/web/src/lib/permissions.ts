import type { Role } from '@/types/roles'

/**
 * UI-level permission checks used to show or hide actions.
 * These are NOT security: the backend API must enforce the same rules.
 */
export function canManageOrders(role: Role | undefined): boolean {
  return role === 'supervisor'
}

/**
 * Operators record production reports. Supervisors review them (Phase 6) and managers read them.
 * Assumption to confirm: supervisors cannot file reports on an operator's behalf.
 */
export function canRecordReports(role: Role | undefined): boolean {
  return role === 'operator'
}

/**
 * Operators and supervisors record downtime; managers read it.
 * Assumption to confirm: the blueprint says "according to permissions" without naming roles.
 */
export function canRecordDowntime(role: Role | undefined): boolean {
  return role === 'operator' || role === 'supervisor'
}

/**
 * Supervisors review reports: approve, return for correction, or reopen an approved report.
 * Assumption to confirm: managers see reports and the approval history but do not decide.
 */
export function canReviewReports(role: Role | undefined): boolean {
  return role === 'supervisor'
}

/**
 * Supervisors act as inspectors and manage inspection records; managers read them. Operators
 * do not see Quality Control in the navigation. Assumption to confirm.
 */
export function canManageInspections(role: Role | undefined): boolean {
  return role === 'supervisor'
}

/**
 * Administrators manage users and reference data. Assumption to confirm: managers and supervisors
 * can see what they need through the other screens but cannot change configuration.
 */
export function canManageSettings(role: Role | undefined): boolean {
  return role === 'administrator'
}
