import { ApiError, api, describeApiError } from '@/lib/api-client'
import type { ProductionOrder } from '@/types/domain'
import type { OrderStatus } from '@/types/status'
import type { InitialOrderStatus, OrderDetail, OrderInput, OrderListItem } from '../types'
import { OrderRuleError, type OrderReferenceData } from './orders-mock-service'

/**
 * Production orders over the real API. Same exports as the mock service so screens do not care which is active.
 * The server enforces every rule and takes the actor from the signed-in session, so `actor` is ignored here.
 * Until reports and downtime move to the API (8C/8D), an order's progress, report list and activity
 * come only from what is stored in the database, so they start empty.
 */
async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw new OrderRuleError(describeApiError(error).message)
  }
}

export const getOrderReference = (): Promise<OrderReferenceData> =>
  call(async () => {
    const ref = await api.get<OrderReferenceData>('/reference')
    return { products: ref.products, lines: ref.lines }
  })

export const listOrderItems = (): Promise<OrderListItem[]> => call(() => api.get<OrderListItem[]>('/orders'))

/** Returns null when the order does not exist. */
export async function getOrderDetail(orderNumber: string): Promise<OrderDetail | null> {
  try {
    return await api.get<OrderDetail>(`/orders/${encodeURIComponent(orderNumber)}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw new OrderRuleError(describeApiError(error).message)
  }
}

export const createOrder = (input: OrderInput, status: InitialOrderStatus, _actor: string): Promise<ProductionOrder> =>
  call(() => api.post<ProductionOrder>('/orders', { ...input, status }))

export const updateOrder = (orderNumber: string, input: OrderInput, _actor: string): Promise<ProductionOrder> =>
  call(() => api.patch<ProductionOrder>(`/orders/${encodeURIComponent(orderNumber)}`, input))

export const changeOrderStatus = (orderNumber: string, to: OrderStatus, _actor: string, reason?: string): Promise<ProductionOrder> =>
  call(() => api.post<ProductionOrder>(`/orders/${encodeURIComponent(orderNumber)}/status`, { to, ...(reason === undefined ? {} : { reason }) }))
