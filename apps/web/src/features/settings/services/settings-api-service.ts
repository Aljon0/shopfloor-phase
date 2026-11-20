import { api, describeApiError } from '@/lib/api-client'
import type { AppUser, DefectType, Machine, Product, ProductionLine, ShiftConfig, ShiftId } from '@/types/domain'
import { SettingsRuleError, type LineInput, type MachineInput, type SettingsData, type UserInput } from './settings-mock-service'

/**
 * Settings over the real API. Same exports as the mock service so screens do not care which is active.
 * The server enforces every rule (administrator only, duplicates, last admin, open orders); `actor` is
 * ignored here because the server takes the actor from the signed-in session, never from the request.
 */
async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    const e = describeApiError(error)
    throw new SettingsRuleError(e.message)
  }
}

export const getSettingsData = (): Promise<SettingsData> => call(() => api.get<SettingsData>('/settings'))

// users
export const createUser = (input: UserInput, _actor: string): Promise<AppUser> => call(() => api.post<AppUser>('/settings/users', input))
export const updateUser = (id: string, input: UserInput, _actor: string): Promise<AppUser> =>
  call(() => api.patch<AppUser>(`/settings/users/${id}`, { name: input.name, email: input.email, role: input.role }))
export const setUserActive = (id: string, isActive: boolean, _actor: string): Promise<AppUser> =>
  call(() => api.post<AppUser>(`/settings/users/${id}/${isActive ? 'activate' : 'deactivate'}`))
export const resetUserPassword = (id: string, password: string): Promise<void> =>
  call(() => api.post(`/settings/users/${id}/reset-password`, { password }))

// products
export const createProduct = (input: { name: string }, _actor: string): Promise<Product> => call(() => api.post<Product>('/settings/products', input))
export const updateProduct = (id: string, input: { name: string }, _actor: string): Promise<Product> => call(() => api.patch<Product>(`/settings/products/${id}`, input))
export const setProductActive = (id: string, isActive: boolean, _actor: string): Promise<Product> =>
  call(() => api.post<Product>(`/settings/products/${id}/${isActive ? 'activate' : 'deactivate'}`))

// lines
export const createLine = (input: LineInput, _actor: string): Promise<ProductionLine> => call(() => api.post<ProductionLine>('/settings/lines', input))
export const updateLine = (id: string, input: { name: string }, _actor: string): Promise<ProductionLine> => call(() => api.patch<ProductionLine>(`/settings/lines/${id}`, input))
export const setLineActive = (id: string, isActive: boolean, _actor: string): Promise<ProductionLine> =>
  call(() => api.post<ProductionLine>(`/settings/lines/${id}/${isActive ? 'activate' : 'deactivate'}`))

// machines
export const createMachine = (input: MachineInput, _actor: string): Promise<Machine> => call(() => api.post<Machine>('/settings/machines', input))
export const updateMachine = (id: string, input: { name: string; shiftTarget: number }, _actor: string): Promise<Machine> =>
  call(() => api.patch<Machine>(`/settings/machines/${id}`, input))
export const setMachineActive = (id: string, isActive: boolean, _actor: string): Promise<Machine> =>
  call(() => api.post<Machine>(`/settings/machines/${id}/${isActive ? 'activate' : 'deactivate'}`))

// defect types
export const createDefectType = (input: { name: string }, _actor: string): Promise<DefectType> => call(() => api.post<DefectType>('/settings/defect-types', input))
export const updateDefectType = (id: string, input: { name: string }, _actor: string): Promise<DefectType> =>
  call(() => api.patch<DefectType>(`/settings/defect-types/${id}`, input))
export const setDefectTypeActive = (id: string, isActive: boolean, _actor: string): Promise<DefectType> =>
  call(() => api.post<DefectType>(`/settings/defect-types/${id}/${isActive ? 'activate' : 'deactivate'}`))

// shifts
export const updateShift = (id: ShiftId, input: { startTime: string; endTime: string }, _actor: string): Promise<ShiftConfig> =>
  call(() => api.patch<ShiftConfig>(`/settings/shifts/${id}`, input))
