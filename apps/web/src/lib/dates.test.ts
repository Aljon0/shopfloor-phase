import { describe, expect, it } from 'vitest'
import { addDays, eachDate, factoryDateOf, formatDate, isValidDateString } from './dates'

describe('dates', () => {
  it('validates calendar dates', () => {
    expect(isValidDateString('2026-11-07')).toBe(true)
    expect(isValidDateString('2026-02-30')).toBe(false)
    expect(isValidDateString('11/07/2026')).toBe(false)
  })

  it('adds days across month boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
  })

  it('lists an inclusive date range and rejects reversed ranges', () => {
    expect(eachDate('2026-11-01', '2026-11-03')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
    expect(eachDate('2026-11-03', '2026-11-01')).toEqual([])
  })

  it('formats dates without shifting the day', () => {
    expect(formatDate('2026-11-03')).toBe('Nov 3')
    expect(formatDate('2026-11-03', true)).toBe('Nov 3, 2026')
  })

  it('resolves the factory-local date of a timestamp', () => {
    // 23:30 UTC on Nov 6 is already Nov 7 in Manila (UTC+8)
    expect(factoryDateOf('2026-11-06T23:30:00Z')).toBe('2026-11-07')
  })
})
