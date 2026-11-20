import { isApiMode } from '@/lib/config'
import * as api from './quality-api-service'
import * as mock from './quality-mock-service'

/** The one entry point screens import; VITE_DATA_SOURCE picks the browser demo or the real API. */
const impl = isApiMode ? api : mock

export { QualityRuleError } from './quality-mock-service'

export const getQualityReference = impl.getQualityReference
export const listInspectionItems = impl.listInspectionItems
export const getInspectionItem = impl.getInspectionItem
export const createInspection = impl.createInspection
export const updateInspection = impl.updateInspection
