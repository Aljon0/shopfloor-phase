import { isApiMode } from '@/lib/config'
import * as api from './insights-api-service'
import * as mock from './insights-mock-service'

/** The one entry point screens import; VITE_DATA_SOURCE picks the browser demo or the real API. */
const impl = isApiMode ? api : mock

export const fetchInsights = impl.fetchInsights
export const fetchNarrative = impl.fetchNarrative
