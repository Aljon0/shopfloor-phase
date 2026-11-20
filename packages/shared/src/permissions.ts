import type { Role } from './roles'

/**
 * Single source of truth for who may do what. The web app uses it to hide controls; the API uses it
 * to refuse requests. Hiding a button is not security, so the API is always the one that decides.
 */
export const canManageSettings = (role: Role | undefined): boolean => role === 'administrator'
export const canViewReference = (role: Role | undefined): boolean => role !== undefined
