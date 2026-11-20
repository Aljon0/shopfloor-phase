# ShopFloor API reference (Phase 8A–10)

Base path `/api`. JSON in and out. The session is the `shopfloor_session` cookie (httpOnly); the web app sends it automatically.

Errors always look like `{ "error": { "code": "...", "message": "...", "details": { "field": "message" } } }`.

| Code | HTTP | Meaning |
|---|---|---|
| VALIDATION | 400 | Input is not valid; `details` has per-field messages |
| UNAUTHENTICATED | 401 | Not signed in, session expired or revoked, or wrong credentials |
| FORBIDDEN | 403 | Signed in but the role is not allowed |
| NOT_FOUND | 404 | Record does not exist |
| CONFLICT | 409 | Duplicate or clashing change |
| RULE | 422 | A business rule blocks the change (for example, last administrator) |
| RATE_LIMITED | 429 | Too many sign-in attempts |
| INTERNAL | 500 | Unexpected error (details are logged, not returned) |

## Public
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ "status": "ok" }` |
| POST | `/auth/login` | `{ email, password }` → sets cookie, returns `{ user }`. Same message for unknown email and wrong password. |
| POST | `/auth/logout` | Clears the cookie |

## Any signed-in user
| Method | Path | Notes |
|---|---|---|
| GET | `/auth/me` | `{ user: { id, name, email, role } }` |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }`; signs out other sessions, keeps this one |
| GET | `/reference` | Lines, products, machines, defect types, shifts (for forms) |

## Production orders (8B)
Read: manager, supervisor, operator. Write: supervisor only. Administrators get 403.

| Method | Path | Notes |
|---|---|---|
| GET | `/orders` | List of `{ order, productName, lineName, progress, overdue }`. Progress counts approved reports only; pending reports are shown separately. |
| GET | `/orders/:orderNumber` | Detail: order, progress, reports, downtime, timeline (order history). 404 if missing. |
| POST | `/orders` | `{ productId, lineId, plannedQuantity, plannedStart, dueDate, priority, instructions, status }`, status `draft` or `planned`. Number `PO-<year>-NNN` is assigned by the server (factory time zone Asia/Manila), never reused. 201. |
| PATCH | `/orders/:orderNumber` | Same fields without `status`. Product and line are locked once In Progress; planned quantity cannot drop below the quantity already reported; Completed and Cancelled orders cannot be edited. |
| POST | `/orders/:orderNumber/status` | `{ to, reason? }`. Draft→Planned→In Progress→Completed; any open status→Cancelled (reason of 3+ characters required). |

Every create, edit and status change writes an order history entry with the actor taken from the session. Changes to one order are serialised with a row lock, so simultaneous requests cannot overwrite each other.
Report, downtime and quality activity appears on an order once those modules move to the API (8C/8D).

## Production reports (8C)
Read: manager, supervisor, operator. Write: operator only, and only on reports they filed (another operator gets 403). Administrators get 403.

| Method | Path | Notes |
|---|---|---|
| GET | `/reports` | List of `{ report, productName, lineName, machineName, metrics }` |
| GET | `/reports/reference` | Orders (id, status, plannedStart, line), lines, machines with shift targets, and `today` at the factory |
| GET | `/reports/:reportId` | Detail with metrics, downtime, inspections, history timeline. 404 if missing. |
| POST | `/reports` | `{ orderId, machineId, shift, reportDate, producedQuantity, rejectedQuantity, notes, mode }`, mode `draft` or `submit`. Order must be In Progress; machine must be active and on the order's line; one report per machine, shift and date. Number `RPT-YYYYMMDD-<line code>-<AM\|PM>` with `-2`, `-3`… when taken. 201. |
| PATCH | `/reports/:reportId` | Same body. Only Draft or Returned reports; the order cannot change. `mode: submit` also sends it (Draft→Pending Review, Returned→Revised). |
| POST | `/reports/:reportId/submit` | Submits a stored draft or returned report as it is |
| DELETE | `/reports/:reportId` | Drafts only; 204 |

Quantities must be whole numbers, 0 or more; rejected cannot exceed produced; the date cannot be in the future or before the order's planned start. The shift target is copied from the machine when the report is saved.

## Approvals (8C)
Supervisor only (everyone else gets 403).

| Method | Path | Notes |
|---|---|---|
| GET | `/approvals` | Every submitted (non-draft) report with its downtime minutes |
| POST | `/approvals/:reportId/approve` | Pending Review or Revised → Approved. Refused if the quantities are inconsistent. |
| POST | `/approvals/:reportId/return` | `{ reason }` (5–300 characters). → Returned for Correction |
| POST | `/approvals/:reportId/reopen` | `{ reason }`. Approved → Returned for Correction, out of the official figures until approved again |

A reviewer cannot decide on a report they filed (checked by account, not by name). Each decision is stored in the approvals table and in the report's history. Decisions and edits on one report are serialised with a row lock, so two simultaneous decisions give one success and one 422.

## Downtime (8D)
Read: manager, supervisor, operator. Write: operator and supervisor. Administrators get 403.

| Method | Path | Notes |
|---|---|---|
| GET | `/downtime` | List of `{ event, minutes, lineName, machineName, reportStatus }`. Minutes are calculated from start and end, never stored. |
| GET | `/downtime/reference` | Lines, machines, orders, reports and `today` at the factory |
| GET | `/downtime/:id` | One item; 404 if missing |
| POST | `/downtime` | `{ machineId, orderId, reportId, startTime, endTime, category, notes }`. Times are factory-local `YYYY-MM-DDTHH:mm`; `orderId` and `reportId` may be `""`. Number `DT-NNNN`. 201. |
| PATCH | `/downtime/:id` | Same body. Operators change only events they recorded; supervisors change any. |

Rules: at most 24 hours, not in the future, end after start, no overlap with another event on the same machine (checked under a machine lock, so simultaneous requests cannot both succeed), the order must be on the machine's line, the report must be on the same machine, and an event linked to an Approved report is locked and cannot be linked to one.

## Quality inspections (8D)
Read: manager, supervisor. Write: supervisor (acting as inspector). Operators and administrators get 403.

| Method | Path | Notes |
|---|---|---|
| GET | `/quality` | List of `{ inspection, productName, lineName, defectName, reportStatus, passRate }` |
| GET | `/quality/reference` | Orders (with planned start), reports, defect types, `today` |
| GET | `/quality/:id` | One item; 404 if missing |
| POST | `/quality` | `{ orderId, reportId, inspectionDate, inspectedQuantity, failedQuantity, defectId, notes }`. Passed = inspected − failed (calculated). Order must be In Progress or Completed. Number `QI-YYYY-NNNN`. 201. |
| PATCH | `/quality/:id` | Same body; the order cannot change |

Rules: a defect is required when anything failed and dropped when nothing failed; a linked report must be on the same order and cover the inspected quantity; inactive defect types cannot be newly chosen (an existing one may be kept).

## Dashboard, Analytics and report summary (8D)
Computed on the server from the database with the same shared builders the browser demo uses, so both modes give identical figures. Production figures count Approved reports only; downtime counts events that started in the range; the pending queue covers all dates.

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` | administrator, manager, supervisor | KPIs, daily series, per-line rows, downtime by category, pending approvals, recent activity |
| GET | `/analytics?from=&to=` | manager | Totals plus breakdowns by line, machine, product and shift |
| GET | `/report-summary?kind=daily\|weekly&date=YYYY-MM-DD` | manager, supervisor | Weekly = Monday to Sunday; "generated by" is the signed-in user |

A range must be valid, start on or before its end, and span at most 366 days (otherwise 400). Other roles get 403.

Recent activity has no table of its own: it is derived from report history (submitted, resubmitted, approved, returned) and downtime events, newest first.

## Insights (Phase 10)
Roles: manager, supervisor. Others get 403.

| Method | Path | Notes |
|---|---|---|
| GET | `/insights?from=&to=` | Trends against the previous period of the same length, plus anomaly flags with evidence and a "why" text. Rule-based, offline. Includes `aiConfigured`. |
| POST | `/insights/narrative` | Body `{ from, to }`. Optional AI-written paragraph. Always HTTP 200: `status` is `ok`, `unavailable` (`not_configured`, `unreachable`, `error`) or `unverified` (the AI used a figure that is not in the facts, so it was withheld). 6 per minute per client. |

Thresholds are constants in `packages/shared/src/insights.ts` (`INSIGHT_THRESHOLDS`): rejection rate 5% warning / 10% critical, target achievement under 80% / 60%, a downtime category at least 1.5x the previous period (and 60 minutes; 2x is critical), reports waiting 24 hours / 72 hours for review, and at least 3 approved reports before periods are compared.

## Administrator only
| Method | Path | Notes |
|---|---|---|
| GET | `/settings` | Users, products, lines, machines, defect types, shifts, last 200 audit entries, open-order counts |
| POST | `/settings/users` | `{ name, email, role, password }` |
| PATCH | `/settings/users/:id` | `{ name, email, role }` |
| POST | `/settings/users/:id/activate` · `/deactivate` | |
| POST | `/settings/users/:id/reset-password` | `{ password }`; 204 |
| POST / PATCH | `/settings/products`, `/settings/products/:id` | `{ name }` |
| POST | `/settings/products/:id/activate` · `/deactivate` | Blocked while the product has open orders |
| POST / PATCH | `/settings/lines`, `/settings/lines/:id` | create `{ name, code }`; edit `{ name }` (code is fixed) |
| POST | `/settings/lines/:id/activate` · `/deactivate` | Blocked with open orders or active machines |
| POST / PATCH | `/settings/machines`, `/settings/machines/:id` | create `{ name, lineId, shiftTarget }`; edit `{ name, shiftTarget }` |
| POST | `/settings/machines/:id/activate` · `/deactivate` | Activation needs an active line |
| POST / PATCH | `/settings/defect-types`, `/settings/defect-types/:id` | `{ name }` |
| POST | `/settings/defect-types/:id/activate` · `/deactivate` | At least one must stay active |
| PATCH | `/settings/shifts/:id` | `{ startTime, endTime }` as `HH:MM` |

Rules enforced by the server: unique names/emails (case-insensitive), the last active administrator and your own account cannot be deactivated or lose the administrator role, nothing is deleted.
