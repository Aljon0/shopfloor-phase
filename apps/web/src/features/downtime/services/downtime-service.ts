import { isApiMode } from '@/lib/config'
import * as api from './downtime-api-service'
import * as mock from './downtime-mock-service'

/** The one entry point screens import; VITE_DATA_SOURCE picks the browser demo or the real API. */
const impl = isApiMode ? api : mock

export { DowntimeRuleError } from './downtime-mock-service'

export const getDowntimeReference = impl.getDowntimeReference
export const listDowntimeItems = impl.listDowntimeItems
export const getDowntimeItem = impl.getDowntimeItem
export const createDowntimeEvent = impl.createDowntimeEvent
export const updateDowntimeEvent = impl.updateDowntimeEvent
