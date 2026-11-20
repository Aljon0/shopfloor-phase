import { beforeAll, describe, expect, it } from 'vitest'
import { setMockLatency, mockRepository } from '@/mocks/repository'
import { ReportRuleError, createReport, getReportDetail, listReportItems, submitReport } from '@/features/production-reports/services/reports-service'
import type { ReportInput } from '@/features/production-reports/types'
import { ApprovalRuleError, approveReport, listApprovalItems, reopenReport, returnReport } from './approvals-mock-service'

const base: ReportInput = {
  orderId: 'PO-2026-003',
  machineId: 'mc-sh-02',
  shift: 'morning',
  reportDate: '2026-11-07',
  producedQuantity: 120,
  rejectedQuantity: 4,
  notes: '',
}
const operator = 'Juan Dela Cruz'
const supervisor = 'Rosa Villanueva'

beforeAll(() => setMockLatency(0))

/** Creates and submits a report in the first free machine/date/shift slot on PO-2026-003. */
async function submitted(): Promise<string> {
  for (const reportDate of ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']) {
    for (const machineId of ['mc-sh-02', 'mc-lc-01']) {
      for (const shift of ['morning', 'night'] as const) {
        try {
          const draft = await createReport({ ...base, reportDate, machineId, shift }, 'draft', operator)
          await submitReport(draft.id, operator)
          return draft.id
        } catch (error) {
          if (!(error instanceof ReportRuleError)) throw error
        }
      }
    }
  }
  throw new Error('No free report slot left for the test')
}

async function approvedProduced(): Promise<number> {
  return (await listReportItems()).filter((i) => i.report.status === 'approved').reduce((s, i) => s + i.report.producedQuantity, 0)
}

describe('approvals service (mock backend)', () => {
  it('lists only submitted work, never drafts', async () => {
    const items = await listApprovalItems()
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.report.status !== 'draft')).toBe(true)
    expect(items.find((i) => i.report.id === 'RPT-20261103-CUT-AM')?.downtimeMinutes).toBe(35)
  })

  it('approves: official figures grow, history and activity are written, review fields set', async () => {
    const id = await submitted()
    const before = await approvedProduced()
    const report = await approveReport(id, supervisor)
    expect(report.status).toBe('approved')
    expect(report.reviewedBy).toBe(supervisor)
    expect(report.reviewedAt).toBeTruthy()
    expect(await approvedProduced()).toBe(before + 120)
    const detail = await getReportDetail(id)
    expect(detail?.timeline[0]?.description).toBe('approved the report')
    expect((await mockRepository.listActivity()).some((a) => a.reportId === id && a.kind === 'report_approved')).toBe(true)
  })

  it('refuses to approve or return a report that is not waiting for review', async () => {
    await expect(approveReport('RPT-20261103-CUT-AM', supervisor)).rejects.toBeInstanceOf(ApprovalRuleError)
    await expect(returnReport('RPT-20261103-CUT-AM', supervisor, 'Not allowed')).rejects.toBeInstanceOf(ApprovalRuleError)
    await expect(approveReport('RPT-NOPE', supervisor)).rejects.toBeInstanceOf(ApprovalRuleError)
  })

  it('blocks self-review', async () => {
    const id = await submitted()
    await expect(approveReport(id, 'juan dela cruz')).rejects.toThrow(/another/i)
    await expect(returnReport(id, operator, 'Checking my own work')).rejects.toBeInstanceOf(ApprovalRuleError)
    expect((await getReportDetail(id))?.report.status).toBe('pending_review')
  })

  it('refuses to approve a report whose quantities are inconsistent', async () => {
    const id = await submitted()
    const stored = (await getReportDetail(id))!.report
    mockRepository.replaceReport({ ...stored, rejectedQuantity: stored.producedQuantity + 5 }, [])
    await expect(approveReport(id, supervisor)).rejects.toBeInstanceOf(ApprovalRuleError)
    expect((await getReportDetail(id))?.report.status).toBe('pending_review')
  })

  it('returns with a required reason, keeps it on the report and in history', async () => {
    const id = await submitted()
    await expect(returnReport(id, supervisor, '  ')).rejects.toBeInstanceOf(ApprovalRuleError)
    const report = await returnReport(id, supervisor, 'Rejected count looks too low')
    expect(report.status).toBe('returned')
    expect(report.returnReason).toBe('Rejected count looks too low')
    const detail = await getReportDetail(id)
    expect(detail?.timeline[0]?.description).toBe('returned the report for correction')
    expect(detail?.timeline[0]?.detail).toContain('Rejected count looks too low')
  })

  it('reopens an approved report with a reason and removes it from the official figures', async () => {
    const id = await submitted()
    await approveReport(id, supervisor)
    const withIt = await approvedProduced()
    await expect(reopenReport(id, supervisor, '')).rejects.toBeInstanceOf(ApprovalRuleError)
    const report = await reopenReport(id, supervisor, 'Wrong shift entered')
    expect(report.status).toBe('returned')
    expect(await approvedProduced()).toBe(withIt - 120)
    const detail = await getReportDetail(id)
    expect(detail?.report.status).toBe('returned')
    expect(detail?.timeline.map((t) => t.description).join('|')).toContain('reopened the approved report')
    // a report that is not approved cannot be reopened
    await expect(reopenReport(id, supervisor, 'Again please')).rejects.toBeInstanceOf(ApprovalRuleError)
  })

  it('clears the old return reason when a resubmitted report is approved, but keeps it in history', async () => {
    const id = await submitted()
    await returnReport(id, supervisor, 'Please fix the count')
    await submitReport(id, operator)
    const approved = await approveReport(id, supervisor)
    expect(approved.returnReason).toBeUndefined()
    const text = (await getReportDetail(id))!.timeline.map((t) => t.detail).join('|')
    expect(text).toContain('Please fix the count')
  })
})
