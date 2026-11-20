import type { Role } from './roles'

/**
 * Single source of truth for who may do what. The web app uses it to hide controls; the API uses it
 * to refuse requests. Hiding a button is not security, so the API is always the one that decides.
 */
export const canManageSettings = (role: Role | undefined): boolean => role === 'administrator'
export const canViewReference = (role: Role | undefined): boolean => role !== undefined

/** Supervisors create, edit and move production orders; managers, supervisors and operators can read them (administrators do not use production screens). */
export const canManageOrders = (role: Role | undefined): boolean => role === 'supervisor'
export const canViewOrders = (role: Role | undefined): boolean => role === 'manager' || role === 'supervisor' || role === 'operator'

/** Operators record production reports (their own); managers, supervisors and operators read them. */
export const canRecordReports = (role: Role | undefined): boolean => role === 'operator'
export const canViewReports = (role: Role | undefined): boolean => role === 'manager' || role === 'supervisor' || role === 'operator'
/** Supervisors decide on reports: approve, return, reopen. */
export const canReviewReports = (role: Role | undefined): boolean => role === 'supervisor'

/** Operators and supervisors record downtime; managers, supervisors and operators read it. */
export const canRecordDowntime = (role: Role | undefined): boolean => role === 'operator' || role === 'supervisor'
export const canViewDowntime = (role: Role | undefined): boolean => role === 'manager' || role === 'supervisor' || role === 'operator'
/** Supervisors act as inspectors; managers and supervisors read inspections. */
export const canManageInspections = (role: Role | undefined): boolean => role === 'supervisor'
export const canViewQuality = (role: Role | undefined): boolean => role === 'manager' || role === 'supervisor'
