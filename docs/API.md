# ShopFloor API reference (Phase 8A)

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
