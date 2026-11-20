import { isApiMode } from '@/lib/config'
import * as api from './analytics-api-service'
import * as mock from './analytics-mock-service'

/** The one entry point screens import; VITE_DATA_SOURCE picks the browser demo or the real API. */
const impl = isApiMode ? api : mock

export const fetchAnalytics = impl.fetchAnalytics
