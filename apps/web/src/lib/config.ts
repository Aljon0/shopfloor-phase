/**
 * Where data comes from. `mock` keeps everything in the browser (the default).
 * `api` signs in against the real backend and sends Settings to it.
 * Set VITE_DATA_SOURCE=api in apps/web/.env.local to switch.
 */
export type DataSource = 'mock' | 'api'

export const DATA_SOURCE: DataSource = import.meta.env.VITE_DATA_SOURCE === 'api' ? 'api' : 'mock'
export const isApiMode: boolean = DATA_SOURCE === 'api'
