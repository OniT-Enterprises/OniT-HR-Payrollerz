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

Leave policy and holiday configuration lives at `/time-leave/settings`,
restricted to owners and HR admins. It is reached through the Settings area
(sidebar-footer Settings → `/settings` hub → Time Off Policies card), NOT
from the Time & Leave module nav — module navs are task-only and carry no
settings entries.

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

### Leave types

Built-in types (defaults; per-tenant slots in `timeOffPolicies` may change the
numbers). Every id below must stay in sync across `TL_LEAVE_TYPES`
(client/services/leaveService.ts), `TL_DEFAULT_LEAVE_POLICIES`
(client/types/settings.ts), `DEFAULT_ENTITLEMENTS` + `entitlementsFromConfig`
+ `leavePayFraction` (functions/src/timeleave.ts), `policyOptions` +
`KNOWN_LEAVE_TYPES` (LeaveRequests.tsx), `LEAVE_TYPE_COLORS`
(LeaveCalendar.tsx), the Ekipa picker (mobile/ekipa), and the Xefe API
whitelist (server/xefe-api/index.js).

| id | Policy slot | Statute | Default days/yr | Employer pay default | Notes |
|---|---|---|---|---|---|
| `annual` | `annualLeave` | Art. 32 | 12 working days | 100% | Carry-over configurable; probation-gated |
| `sick` | `sickLeave` | Art. 34 | 12 | Statutory banding (6 @ 100%, 6 @ 50%) applied by the payroll engine | Medical certificate |
| `maternity` | `maternityLeave` | Art. 59(1) | 84 (12 weeks, ≥10 after birth) | **Unpaid** — INSS parental subsidy (DL 18/2017) | See INSS section below |
| `paternity` | `paternityLeave` | Art. 60 | 5 working days | **Unpaid** — INSS parental subsidy | See INSS section below |
| `miscarriage` | `miscarriageLeave` | Art. 59(4): “licença com a duração de 4 semanas” | 20 working days (≈4 weeks) | **Unpaid** — same INSS regime as maternity | Medical certificate. Clinical-risk PRE-birth leave (Art. 59(3)) has no fixed length — record it as sick leave with a certificate |
| `special` | `specialLeave` | Art. 33(3) | 3 | 100% | One pooled allotment: marriage + family death + community/religious events; proof per Art. 33(7) |
| `unpaid` | `unpaidLeave` | — | 30 | 0% | |
| `study` | `studyLeave` | Art. 76(3): “sem perda da remuneração … para realização de provas de avaliação” | 3 (Xefe default; the statute sets no cap) | 100% | Exams only, worker-students; proof of enrolment/exam schedule per Art. 76(5) |
| (custom) | `customLeaveTypes[]` | — | tenant-set | tenant-set | Created in Settings → Time Off Policies; id charset `[a-zA-Z0-9_-]`, must not shadow built-ins; deactivate instead of delete |

Legacy render-only ids `bereavement`/`marriage` still display but are not
requestable (pooled into `special`).

### Breastfeeding and prenatal exams (Art. 62) — deliberately note-only

Art. 62 grants the returning mother **two 1-hour paid breaks per day until the
child is 6 months old** (“dois períodos diários, com a duração de uma hora
cada”, “sem perda de remuneração”) and grants pregnant workers paid absence
for medical exams. These are hour-level dispensations inside a worked day —
they do not fit the working-day leave model (a request would wrongly consume
day-based balance and cancel shifts), and inventing a parallel hour-based
leave workflow would contradict the one-hours-entry-screen rule. So Xefe
implements them as guidance only: an informational note in the maternity
policy editor and in the maternity request dialog telling the operator to
record the time in Attendance as **worked time and never dock it**. No
attendance code change is needed — attendance records whatever hours the
operator enters; the note is what keeps the two hours from being deducted.

### Maternity, paternity, and miscarriage (INSS-funded, employer-unpaid by default)

- Since DL 18/2017 (June 2017) the INSS parental subsidy replaced the
  employer's Lei 4/2012 Art. 61 salary duty: a worker with 6 months of
  contributions in the last 12 claims a subsidy of **100% of the reference
  wage directly from INSS** (maternity paid monthly, up to 90 days; paternity
  5 working days in one payment). The claim window is 6 months from the first
  day of the license.
- Defaults are therefore **employer-unpaid**: `TL_DEFAULT_LEAVE_POLICIES` and
  `TL_LEAVE_TYPES` set maternity/paternity `isPaid: false, paidPercentage: 0`,
  and the functions `leavePayFraction` fallback treats unconfigured
  maternity/paternity as 0 (unpaid). In payroll the leave days become unpaid
  absence (docked), matching real firm practice ($0 pay + "Dias de
  parentalidade" on the DR).
- **Miscarriage leave (Art. 59(4), 4 weeks / 20 working days) follows the
  same regime**: employer-unpaid by default, the worker claims the INSS
  parental subsidy directly, and the Art. 21(3) voiding rule applies
  identically if a tenant configures a paid percentage.
- **Voiding rule** (DL 18/2017 Art. 21(3)): the subsidy is non-cumulable with
  salary — paying salary for license days voids the subsidy for those days. A
  tenant may still explicitly configure a paid percentage (deliberate
  employer-paid option, which replaces — not tops up — the subsidy); the
  settings UI keeps `isPaid` in sync with the percentage and shows an amber
  warning when it is > 0. **Existing tenants with persisted
  `isPaid: true` policies keep employer-paid behavior unchanged** — only the
  defaults moved.
- **Employer declaration** (DL 18/2017 Art. 25(1)(c)): approved
  maternity/paternity requests on the Leave page offer an "INSS declaration"
  PDF (`client/lib/pdf/inssParentalDeclaration.tsx`, Xefe's own layout,
  PT primary/EN secondary) stating the first day, total days, and days with
  remuneration (zero by default, with the explicit no-payment sentence) for
  the worker's subsidy claim.
- **Non-qualified workers** (fail 6-in-12 contributions): INSS pays nothing
  and whether the employer must pay instead is legally unsettled — the UI
  says "confirm with your accountant" rather than deciding.

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
