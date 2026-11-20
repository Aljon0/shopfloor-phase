import { factoryDateOf } from '@shopfloor/shared'
import { isApiMode } from '@/lib/config'
import { mockRepository } from '@/mocks/repository'

/**
 * Current factory-local calendar date. The browser demo uses a fixed date so the sample data lines up;
 * with the real API it is today's date in the factory time zone (the server uses the same zone).
 */
export function getFactoryToday(): string {
  return isApiMode ? factoryDateOf(new Date().toISOString()) : mockRepository.getFactoryToday()
}
