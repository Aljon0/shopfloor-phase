import { describe, expect, it } from 'vitest'
import { fetchInsights, fetchNarrative } from './insights-mock-service'

describe('insights in demo mode', () => {
  it('computes trends and flags with the shared rules over the sample data', async () => {
    const r = await fetchInsights({ from: '2026-11-01', to: '2026-11-07' })
    expect(r.trends.map((t) => t.metric)).toEqual(['rejectionRate', 'targetAchievement', 'goodOutput', 'downtimeMinutes'])
    expect(r.aiConfigured).toBe(false)
    expect(r.previousRange).toEqual({ from: '2026-10-25', to: '2026-10-31' })
  })
  it('rejects an invalid range', async () => {
    await expect(fetchInsights({ from: '2026-11-07', to: '2026-11-01' })).rejects.toThrow(/start date/)
  })
  it('says AI is unavailable in demo mode', async () => {
    expect(await fetchNarrative({ from: '2026-11-01', to: '2026-11-07' })).toMatchObject({ status: 'unavailable', reason: 'not_configured' })
  })
})
