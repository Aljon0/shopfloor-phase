import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import type { OrderStatus } from '@/types/status'
import {
  changeOrderStatus,
  createOrder,
  getOrderDetail,
  getOrderReference,
  listOrderItems,
  updateOrder,
} from '../services/orders-service'
import type { InitialOrderStatus, OrderInput } from '../types'

const keys = {
  all: ['orders'] as const,
  list: ['orders', 'list'] as const,
  reference: ['orders', 'reference'] as const,
  detail: (orderNumber: string) => ['orders', 'detail', orderNumber] as const,
}

export function useOrderItems() {
  return useQuery({ queryKey: keys.list, queryFn: listOrderItems })
}

export function useOrderReference() {
  return useQuery({ queryKey: keys.reference, queryFn: getOrderReference, staleTime: Infinity })
}

export function useOrderDetail(orderNumber: string) {
  return useQuery({ queryKey: keys.detail(orderNumber), queryFn: () => getOrderDetail(orderNumber) })
}

function useActor(): string {
  return useAuth().user?.name ?? 'Unknown user'
}

/** Order changes affect the list, the detail views and the dashboard's pending list names. */
function useRefreshAfterChange() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.all }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
}

export function useCreateOrder() {
  const actor = useActor()
  const refresh = useRefreshAfterChange()
  return useMutation({
    mutationFn: ({ input, status }: { input: OrderInput; status: InitialOrderStatus }) =>
      createOrder(input, status, actor),
    onSuccess: refresh,
  })
}

export function useUpdateOrder(orderNumber: string) {
  const actor = useActor()
  const refresh = useRefreshAfterChange()
  return useMutation({
    mutationFn: (input: OrderInput) => updateOrder(orderNumber, input, actor),
    onSuccess: refresh,
  })
}

export function useChangeOrderStatus(orderNumber: string) {
  const actor = useActor()
  const refresh = useRefreshAfterChange()
  return useMutation({
    mutationFn: ({ to, reason }: { to: OrderStatus; reason?: string }) =>
      changeOrderStatus(orderNumber, to, actor, reason),
    onSuccess: refresh,
  })
}
