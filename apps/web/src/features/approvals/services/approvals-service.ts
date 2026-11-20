import { isApiMode } from '@/lib/config'
import * as api from './approvals-api-service'
import * as mock from './approvals-mock-service'

/** The one entry point screens import; VITE_DATA_SOURCE picks the browser demo or the real API. */
const impl = isApiMode ? api : mock

export { ApprovalRuleError } from './approvals-mock-service'

export const listApprovalItems = impl.listApprovalItems
export const approveReport = impl.approveReport
export const returnReport = impl.returnReport
export const reopenReport = impl.reopenReport
