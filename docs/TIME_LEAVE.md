# Time & Leave

This is the current product and data contract for Xefe Time & Leave. It replaces
the older split between “Time Tracking” and “Attendance”.

## Product shape

Time & Leave has three task-first destinations:

| Task | Route | Who can use it |
|---|---|---|
| Record and review attendance | `/time-leave/attendance` | Owner/HR: all; manager: their department; accountant: read-only; employee: self |
| Request and decide leave | `/time-leave/leave` | Owner/HR: all; manager: their department; accountant: read-only; employee: self |
| Plan weekly shifts | `/time-leave/shifts` | Owner/HR and department managers |

Leave policy and holiday configuration is contextual at
`/time-leave/settings` and is restricted to owners and HR admins.

Old Time Tracking URLs redirect to Attendance. Do not add a second hours-entry
screen: clock times, adjustments, imports, and payroll-ready hours all belong in
Attendance.

The dashboard stays short: attention rows plus one card each for Attendance,
Leave, and (when authorized) Shifts. It has no charts, filter bar, or second KPI
row.

## Canonical Firestore model

| Data | Canonical path | Authority |
|---|---|---|
| Attendance records | `/attendance/{id}` with `tenantId` | Owner/HR or scoped manager writes |
| Attendance import batches | `/attendanceImports/{id}` with `tenantId` | Owner/HR writes |
| Leave requests | `/leave_requests/{id}` with `tenantId` | `createLeaveRequest` creates; `approveLeaveRequest` decides; employee can cancel pending own requests |
| Leave balances | `/leave_balances/{tenant_employee_year}` with `tenantId` | Cloud Functions projection; clients read only |
| Shifts | `/tenants/{tid}/shifts/{id}` | Owner/HR or scoped manager writes |
| Weekly timesheets | `/tenants/{tid}/timesheets/{employee_week}` | Cloud Functions projection; clients read only |
| Policies | `/tenants/{tid}/settings/config.timeOffPolicies` | Owner/HR writes |
| Holiday overrides | `/tenants/{tid}/holidays/{YYYY-MM-DD}` | Owner/HR writes |

The old `/tenants/{tid}/leaveRequests`, `/tenants/{tid}/leaveBalances`, and
top-level `/timesheets` schemas are retired and blocked for ordinary clients.
Do not introduce new reads or writes to them.

Every canonical top-level document must carry `tenantId`. Department-scoped
records also carry `departmentId`; manager queries must include that equality
constraint so Firestore can prove the query is authorized.

## Workflow invariants

### Attendance

- “Not recorded” is unknown, not absent. Only an explicit `absent` record is an
  absence.
- Manual entries and CSV/XLSX imports use the same hour, break, lateness, and
  overtime calculations.
- More than 16 net hours in one entry is rejected as likely input error.
- Scheduled shift times are used for lateness when available; otherwise the TL
  day defaults apply.
- Managers can read and change only records for employees in their department.
- Imports are owner/HR-only and are chunked below Firestore batch limits.

### Leave

- New requests go through `createLeaveRequest` and start as `pending`.
  Decisions go through `approveLeaveRequest`; the employee may directly cancel
  only their own pending request.
- Duration is working days. Weekends, built-in Timor-Leste public holidays, and
  tenant holiday overrides are excluded; half-days remain `0.5`.
- The bundled calendar includes fixed legal holidays and officially announced
  variable dates when available (including Idul Fitri and Idul Adha for 2026).
  Overrides cover later proclamations and company-specific corrections.
- Calendar changes must be checked against the
  [Government of Timor-Leste public-holiday calendar](https://timor-leste.gov.tl/?lang=en&p=46595)
  and its linked Jornal da República notice before release.
- The configured policy list is the source of truth for leave types,
  entitlement, paid percentage, and certificate requirements.
- Clients never edit balances. `onLeaveRequestWrite` recomputes the employee’s
  year projection from source requests, making retries idempotent.
- Approval cancels overlapping non-cancelled shifts and recomputes affected
  weekly timesheets.

### Shifts and timesheets

- Shift create/update goes through the `createOrUpdateShift` callable.
- The callable validates tenant role, manager department, employee department,
  date/time format, maximum duration, overlaps, 12-hour rest, and approved
  leave conflicts.
- Shifts may cross midnight. A start and end at the same time is not a valid
  24-hour shift.
- Editing an employee or date recomputes both the old and new weekly timesheet.
- Paid/unpaid leave hours use the configured policy’s paid percentage.

## Roles

| Role | Attendance | Leave | Shifts | Settings |
|---|---|---|---|---|
| Owner / HR admin | Read/write all | Read/create/decide all | Read/write all | Read/write |
| Manager | Read/write own department | Read/create/decide own department, plus own requests | Read/write own department | No |
| Accountant | Read all | Read all | No | No |
| Viewer / employee | Read self | Read/create/cancel self | Own published shifts in Ekipa | No |

UI visibility is not authorization. Keep `firestore.rules`, callable checks,
service query constraints, and mobile queries aligned whenever this matrix
changes.

## Verification

Before merging Time & Leave changes, run:

```bash
pnpm typecheck
pnpm test
pnpm --dir functions build
pnpm exec tsc -p mobile/ekipa/tsconfig.json --noEmit
JAVA_HOME=/opt/homebrew/opt/openjdk@21 pnpm emul:rules
JAVA_HOME=/opt/homebrew/opt/openjdk@21 pnpm test:api
```

Relevant coverage includes `tests/rules/time-leave-access.test.ts`,
`tests/rules/ekipa-mobile-permissions.test.ts`, attendance/shift calculation
unit tests, dashboard guardrails, and Xefe API tenant-isolation tests.
