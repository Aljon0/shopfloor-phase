import { isApiMode } from '@/lib/config'
import * as api from './reports-summary-api-service'
import * as mock from './reports-summary-mock-service'

/** The one entry point screens import; VITE_DATA_SOURCE picks the browser demo or the real API. */
const impl = isApiMode ? api : mock

export const fetchSummary = impl.fetchSummary
