import { isApiMode } from '@/lib/config'
import * as api from './settings-api-service'
import * as mock from './settings-mock-service'

/**
 * The one entry point screens import. VITE_DATA_SOURCE decides whether Settings runs against
 * browser mock data or the real API; both expose the same functions.
 */
const impl = isApiMode ? api : mock

export { SettingsRuleError } from './settings-mock-service'
export type { LineInput, MachineInput, SettingsData, UserInput } from './settings-mock-service'

export const getSettingsData = impl.getSettingsData
export const createUser = impl.createUser
export const updateUser = impl.updateUser
export const setUserActive = impl.setUserActive
export const createProduct = impl.createProduct
export const updateProduct = impl.updateProduct
export const setProductActive = impl.setProductActive
export const createLine = impl.createLine
export const updateLine = impl.updateLine
export const setLineActive = impl.setLineActive
export const createMachine = impl.createMachine
export const updateMachine = impl.updateMachine
export const setMachineActive = impl.setMachineActive
export const createDefectType = impl.createDefectType
export const updateDefectType = impl.updateDefectType
export const setDefectTypeActive = impl.setDefectTypeActive
export const updateShift = impl.updateShift
export { resetUserPassword } from './settings-api-service'
