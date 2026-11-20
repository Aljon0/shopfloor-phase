import { isApiMode } from '@/lib/config'
import * as api from './orders-api-service'
import * as mock from './orders-mock-service'

/**
 * The one entry point screens import. VITE_DATA_SOURCE decides whether orders live in the browser
 * (demo) or in the database behind the API; both expose the same functions.
 */
const impl = isApiMode ? api : mock

export { OrderRuleError } from './orders-mock-service'
export type { OrderReferenceData } from './orders-mock-service'

export const getOrderReference = impl.getOrderReference
export const listOrderItems = impl.listOrderItems
export const getOrderDetail = impl.getOrderDetail
export const createOrder = impl.createOrder
export const updateOrder = impl.updateOrder
export const changeOrderStatus = impl.changeOrderStatus
