import { isApiMode } from '@/lib/config'
import * as api from './reports-api-service'
import * as mock from './reports-mock-service'

/**
 * The one entry point screens import. VITE_DATA_SOURCE decides whether reports live in the browser
 * (demo) or in the database behind the API; both expose the same functions.
 */
const impl = isApiMode ? api : mock

export { ReportRuleError } from './reports-mock-service'

export const getReportReference = impl.getReportReference
export const listReportItems = impl.listReportItems
export const getReportDetail = impl.getReportDetail
export const createReport = impl.createReport
export const updateReport = impl.updateReport
export const submitReport = impl.submitReport
export const deleteReport = impl.deleteReport
