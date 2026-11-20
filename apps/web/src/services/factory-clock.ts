import { mockRepository } from '@/mocks/repository'

/** Current factory-local calendar date. Mock value for now; a real clock once the API exists. */
export function getFactoryToday(): string {
  return mockRepository.getFactoryToday()
}
