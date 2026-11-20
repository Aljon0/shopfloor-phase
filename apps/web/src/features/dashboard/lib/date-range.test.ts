import { describe, expect, it } from 'vitest'
import { resolveRange } from './date-range'

const today = '2026-11-07'
const custom = { from: '2026-11-01', to: '2026-11-05' }

describe('resolveRange', () => {
  it('resolves presets inclusively, ending today', () => {
    expect(resolveRange('today', today, custom).range).toEqual({ from: '2026-11-07', to: '2026-11-07' })
    expect(resolveRange('last7', today, custom).range).toEqual({ from: '2026-11-01', to: '2026-11-07' })
    expect(resolveRange('last14', today, custom).range).toEqual({ from: '2026-10-25', to: '2026-11-07' })
  })

  it('accepts a valid custom range', () => {
    expect(resolveRange('custom', today, custom).range).toEqual(custom)
  })

  it('rejects missing, invalid, reversed and oversized custom ranges', () => {
    expect(resolveRange('custom', today, { from: '', to: '2026-11-05' }).range).toBeNull()
    expect(resolveRange('custom', today, { from: '2026-02-30', to: '2026-03-01' }).error).toBeDefined()
    expect(resolveRange('custom', today, { from: '2026-11-05', to: '2026-11-01' }).error).toMatch(/on or before/)
    expect(resolveRange('custom', today, { from: '2024-01-01', to: '2026-11-01' }).error).toMatch(/366/)
  })
})
