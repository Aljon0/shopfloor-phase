import { Navigate, createBrowserRouter, type RouteObject } from 'react-router-dom'
import type { ComponentType } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { RouteLoading } from '@/components/shared/route-loading'
import { LoginPage } from '@/features/auth/login-page'
import { RequireAuth, RequireRoleAccess } from './route-guards'

/**
 * Feature screens load on demand so the initial bundle stays small
 * (the dashboard pulls in the charting library).
 */
function page(path: string, load: () => Promise<{ default: ComponentType }>): RouteObject {
  return {
    path,
    lazy: async () => ({ Component: (await load()).default }),
  }
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    HydrateFallback: RouteLoading,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            element: <RequireRoleAccess />,
            children: [
              page('/dashboard', () => import('@/features/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage }))),
              page('/production-orders', () => import('@/features/production-orders/production-orders-page').then((m) => ({ default: m.ProductionOrdersPage }))),
              page('/production-orders/new', () => import('@/features/production-orders/order-form-page').then((m) => ({ default: m.OrderFormPage }))),
              page('/production-orders/:orderId', () => import('@/features/production-orders/order-detail-page').then((m) => ({ default: m.OrderDetailPage }))),
              page('/production-orders/:orderId/edit', () => import('@/features/production-orders/order-form-page').then((m) => ({ default: m.OrderFormPage }))),
              page('/production-reports', () => import('@/features/production-reports/production-reports-page').then((m) => ({ default: m.ProductionReportsPage }))),
              page('/production-reports/new', () => import('@/features/production-reports/report-form-page').then((m) => ({ default: m.ReportFormPage }))),
              page('/production-reports/:reportId', () => import('@/features/production-reports/report-detail-page').then((m) => ({ default: m.ReportDetailPage }))),
              page('/production-reports/:reportId/edit', () => import('@/features/production-reports/report-form-page').then((m) => ({ default: m.ReportFormPage }))),
              page('/downtime', () => import('@/features/downtime/downtime-page').then((m) => ({ default: m.DowntimePage }))),
              page('/downtime/new', () => import('@/features/downtime/downtime-form-page').then((m) => ({ default: m.DowntimeFormPage }))),
              page('/downtime/:eventId/edit', () => import('@/features/downtime/downtime-form-page').then((m) => ({ default: m.DowntimeFormPage }))),
              page('/quality', () => import('@/features/quality/quality-page').then((m) => ({ default: m.QualityPage }))),
              page('/quality/new', () => import('@/features/quality/quality-form-page').then((m) => ({ default: m.QualityFormPage }))),
              page('/quality/:inspectionId', () => import('@/features/quality/quality-detail-page').then((m) => ({ default: m.QualityDetailPage }))),
              page('/quality/:inspectionId/edit', () => import('@/features/quality/quality-form-page').then((m) => ({ default: m.QualityFormPage }))),
              page('/approvals', () => import('@/features/approvals/approvals-page').then((m) => ({ default: m.ApprovalsPage }))),
              page('/approvals/:reportId', () => import('@/features/approvals/approval-review-page').then((m) => ({ default: m.ApprovalReviewPage }))),
              page('/analytics', () => import('@/features/analytics/analytics-page').then((m) => ({ default: m.AnalyticsPage }))),
              page('/reports', () => import('@/features/reports/reports-page').then((m) => ({ default: m.ReportsPage }))),
              page('/settings', () => import('@/features/settings/settings-page').then((m) => ({ default: m.SettingsPage }))),
              page('/settings/:section', () => import('@/features/settings/settings-page').then((m) => ({ default: m.SettingsPage }))),
            ],
          },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
