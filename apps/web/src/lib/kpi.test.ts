import { describe, expect, it } from 'vitest'
import {
  downtimeMinutes,
  goodQuantity,
  rejectionRate,
  summarizeQuantities,
  targetAchievement,
  validateQuantities,
} from './kpi'

describe('validateQuantities', () => {
  it('accepts valid quantities, including zero', () => {
    expect(validateQuantities({ producedQuantity: 210, rejectedQuantity: 8 })).toEqual([])
    expect(validateQuantities({ producedQuantity: 0, rejectedQuantity: 0 })).toEqual([])
  })

  it('rejects negative, fractional and NaN values', () => {
    expect(validateQuantities({ producedQuantity: -1, rejectedQuantity: 0 })).not.toEqual([])
    expect(validateQuantities({ producedQuantity: 10, rejectedQuantity: -2 })).not.toEqual([])
    expect(validateQuantities({ producedQuantity: 10.5, rejectedQuantity: 0 })).not.toEqual([])
    expect(validateQuantities({ producedQuantity: Number.NaN, rejectedQuantity: 0 })).not.toEqual([])
  })

  it('rejects rejected quantity above produced quantity', () => {
    const errors = validateQuantities({ producedQuantity: 5, rejectedQuantity: 6 })
    expect(errors).toEqual(['Rejected quantity cannot exceed produced quantity.'])
  })
})

describe('official calculations', () => {
  it('matches the blueprint sample report (210 produced, 8 rejected, 202 good)', () => {
    expect(goodQuantity({ producedQuantity: 210, rejectedQuantity: 8 })).toBe(202)
    expect(targetAchievement(202, 500)).toBeCloseTo(40.4, 5)
    expect(rejectionRate(8, 210)).toBeCloseTo(3.8095, 3)
  })

  it('never divides by zero', () => {
    expect(rejectionRate(0, 0)).toBeNull()
    expect(targetAchievement(100, 0)).toBeNull()
  })
})

describe('summarizeQuantities', () => {
  it('derives ratios from summed quantities, not averaged percentages', () => {
    const summary = summarizeQuantities([
      { producedQuantity: 100, rejectedQuantity: 50, plannedQuantity: 100 }, // 50% achieved
      { producedQuantity: 900, rejectedQuantity: 0, plannedQuantity: 900 }, // 100% achieved
    ])
    expect(summary.producedQuantity).toBe(1000)
    expect(summary.goodQuantity).toBe(950)
    expect(summary.plannedQuantity).toBe(1000)
    expect(summary.targetAchievement).toBeCloseTo(95, 5) // an unweighted average would give 75
    expect(summary.rejectionRate).toBeCloseTo(5, 5) // an unweighted average would give 25
  })

  it('returns null ratios for an empty set', () => {
    const summary = summarizeQuantities([])
    expect(summary.producedQuantity).toBe(0)
    expect(summary.rejectionRate).toBeNull()
    expect(summary.targetAchievement).toBeNull()
  })

  it('keeps produced and good output distinct', () => {
    const summary = summarizeQuantities([{ producedQuantity: 210, rejectedQuantity: 8, plannedQuantity: 250 }])
    expect(summary.producedQuantity).toBe(210)
    expect(summary.goodQuantity).toBe(202)
  })
})

describe('downtimeMinutes', () => {
  it('calculates the sample 35 minute downtime', () => {
    expect(downtimeMinutes('2026-11-03T09:10:00+08:00', '2026-11-03T09:45:00+08:00')).toBe(35)
  })

  it('returns null for invalid or reversed timestamps', () => {
    expect(downtimeMinutes('nope', '2026-11-03T09:45:00+08:00')).toBeNull()
    expect(downtimeMinutes('2026-11-03T10:00:00+08:00', '2026-11-03T09:45:00+08:00')).toBeNull()
  })
})
