# NGO Payroll Stress Test

## Test Context
**Organization**: Timor-Leste NGO with 120 staff
**Situation**: Donor audit in 10 days, month-end payroll due
**Constraints**: Mixed contracts, some compliance gaps, time pressure

---

## Scenario 1: Month-End with Donor Audit Pressure

### The Reality
- 120 employees across 5 departments
- 8 employees have missing contracts (hired quickly for project)
- 3 employees missing INSS numbers (new hires, paperwork delayed)
- 2 pending leave requests (manager on vacation)
- Donor requires payroll report by Friday
- INSS payment due in 5 days

### Walk-Through: Power User Path

#### Step 1: Dashboard Check
**Action**: Open Dashboard
**Expected**: See alerts about blocked employees, compliance deadlines
**Current State**: ✅ Dashboard shows KPIs and alerts

**Friction Check**:
- [ ] Can user see "11 employees with issues" at a glance?
- [ ] Is the severity clear (blocking vs warning)?
- [ ] Can user click directly to fix issues?

#### Step 2: People Hub → Check Blocked Employees
**Action**: Navigate to People Hub
**Expected**: "Attention Required" section shows 11 employees blocking payroll

**Friction Check**:
- [ ] Does "Attention Required" show count by issue type?
- [ ] Can user filter employees by "missing contract" vs "missing INSS"?
- [ ] Is there a "View all blocking issues" action?

#### Step 3: All Employees → Filter by Issues
**Action**: Go to All Employees, filter for compliance issues
**Expected**: See list of 11 employees with specific issues flagged

**Questions**:
- Can user see which employees are blocking payroll?
- Can user see WHAT is missing (contract, INSS, bank details)?
- Can user fix issues inline or must navigate to each profile?

#### Step 4: Leave Requests → Approve Pending
**Action**: Navigate to Leave Requests
**Expected**: See 2 pending requests, approve or delegate

**Friction Check**:
- [ ] Can another manager approve (delegation)?
- [ ] Is there "auto-approve after X days" option?
- [ ] Can payroll proceed with pending leave? (Warning, not blocking?)

#### Step 5: Run Payroll → Handle Exceptions
**Action**: Start payroll run
**Expected**: System should handle partial compliance gracefully

**Critical Questions**:
1. Can user run payroll EXCLUDING the 11 blocked employees?
2. Can user override blocks with reason? ("Waiting for contract, will add retroactively")
3. Is there clear audit trail of "who was excluded and why"?
4. Can user add excluded employees to a "catch-up" payroll later?

#### Step 6: Donor Report Generation
**Action**: Generate payroll report for donor
**Expected**: Report shows costs by department/project/funding source

**Friction Check**:
- [ ] Can reports filter by "funding source" or "project code"?
- [ ] Does report show employee-level detail or summary only?
- [ ] Can report show "paid" vs "pending" for excluded employees?

---

## Scenario 2: Retroactive Payroll Correction

### The Reality
- Payroll was run last week
- Discovered: Employee Maria's salary was entered as $800/month, should be $850
- Need to correct without re-running entire payroll
- Auditor needs to see the correction trail

### Walk-Through

#### Step 1: Identify the Error
**Action**: Review Payroll History
**Expected**: Can find Maria's payslip, see the error

**Friction Check**:
- [ ] Can user search payroll by employee name?
- [ ] Can user see calculation breakdown?
- [ ] Is there "Flag for correction" option?

#### Step 2: Make the Correction
**Action**: Correct Maria's salary

**Critical Questions**:
1. Can user correct salary in Employee Profile without affecting past records?
2. Is there a "Payroll Adjustment" feature?
3. Can user create a one-time "correction" entry?
4. Does the correction appear in the NEXT payroll as adjustment?

#### Step 3: Audit Trail
**Action**: Verify correction is documented

**Friction Check**:
- [ ] Does system log who made the change and when?
- [ ] Is there a "reason for correction" field?
- [ ] Can auditor see before/after values?

---

## Scenario 3: Compliance Exception - "Run Anyway"

### The Reality
- 3 employees missing INSS numbers
- INSS office is closed for 2 weeks (holiday)
- Employees MUST be paid
- Organization accepts compliance risk temporarily

### Walk-Through

#### Step 1: Payroll Blocked
**Action**: Try to run payroll
**Expected**: System blocks because 3 employees missing INSS

**Critical Question**:
- Is the block a HARD block (cannot proceed) or SOFT block (warning)?

#### Step 2: Override with Acknowledgment
**Action**: User wants to proceed anyway

**What Should Happen**:
1. System shows: "3 employees missing INSS numbers"
2. User can check: "I acknowledge compliance risk"
3. User provides reason: "INSS office closed, will add within 30 days"
4. System allows payroll but:
   - Flags those 3 payslips as "Pending Compliance"
   - Creates task to fix within 30 days
   - Excludes from INSS submission until resolved
   - Logs the override for audit

**Current State**: [To be verified]

#### Step 3: Follow-Up Task
**Action**: 30 days later, need to add INSS numbers

**Expected**:
- System reminds about pending compliance
- Once fixed, system can generate retroactive INSS submission
- Audit trail shows the gap and resolution

---

## Findings Summary

### Legend
- ✅ Smooth - current design handles this well
- ⚠️ Friction - possible but awkward
- ❌ Gap - not currently supported, needs addition

### Scenario 1 Results: Month-End with Audit Pressure

| Step | Status | Notes |
|------|--------|-------|
| Dashboard alerts | ✅ | Shows blocking issues count, links to fix |
| Blocked employee visibility | ✅ | PayrollDashboard counts blocked employees |
| Navigate to blocked list | ⚠️ | Links to `/people/employees?filter=blocking-issues` but **filter param not implemented** |
| Filter by issue type | ❌ | AllEmployees doesn't parse URL filter params |
| Leave delegation | ❌ | No delegation or auto-approve after X days |
| Partial payroll (exclude blocked) | ❌ | RunPayroll includes all employees, no exclusion option |
| Override with reason | ❌ | No override/acknowledgment mechanism |
| Donor report by funding source | ❌ | No funding source / project code field exists |

### Scenario 2 Results: Retroactive Correction

| Step | Status | Notes |
|------|--------|-------|
| Find employee in payroll history | ⚠️ | PayrollHistory exists but no employee search |
| Payroll adjustment entry | ⚠️ | Type has `adjustmentReason` field but no UI for it |
| Audit trail for corrections | ❌ | No `modifiedBy`, `changedAt`, or change history |

### Scenario 3 Results: Compliance Exception

| Step | Status | Notes |
|------|--------|-------|
| Soft vs hard compliance blocks | ❌ | No block/warning distinction - all employees included |
| Override with acknowledgment | ❌ | No acknowledgment checkbox or reason field |
| Pending compliance flag | ❌ | No "Pending Compliance" status for payslips |
| Follow-up task creation | ❌ | No task system for compliance follow-ups |
| Retroactive submission | ❌ | No way to generate catch-up INSS submissions |

---

## Exception Handling Doctrine

Based on stress test findings, here's the doctrine for OniT:

### Principle 1: Blocks vs Warnings
- **Hard Block**: Cannot proceed at all
  - No bank account = can't pay (money has nowhere to go)
  - No salary defined = can't calculate
- **Soft Block (Warning)**: Can proceed with acknowledgment
  - Missing contract = compliance risk but payable
  - Missing INSS = compliance risk but payable
  - Pending leave = payroll can proceed, leave recorded separately

### Principle 2: Override Requires
1. Explicit acknowledgment checkbox: "I understand the compliance risk"
2. Written reason: Required text field
3. Audit log entry: Who, when, why
4. Follow-up task: System creates reminder to fix within 30 days

### Principle 3: Partial Execution
- Payroll can run for SOME employees (exclude specific people)
- Excluded employees clearly marked with reason
- "Catch-up" payroll available for exclusions later
- Reports show "Paid" vs "Pending" breakdown

### Principle 4: Corrections, Not Deletions
- Never delete payroll records
- Always create adjustment entries
- Before/after values always visible
- Change reason required

### Principle 5: Delegation for Approvals
- Leave requests can have backup approver
- Auto-approve after configurable days (e.g., 7 days)
- Escalation to HR admin if no action

---

## Recommended UI Additions

Based on stress test findings, these additions fit within existing navigation (no new pages):

### 1. AllEmployees: URL Filter Support
**Location**: `/people/employees` work page
**Change**: Parse `?filter=` URL param to pre-apply filters
**Filters needed**:
- `missing-contract` - employees without work contract
- `missing-inss` - employees without INSS number
- `missing-bank` - employees without bank details
- `blocking-issues` - any of the above
**Effort**: Small (add useSearchParams, update filter state)

### 2. RunPayroll: Compliance Warning Banner
**Location**: `/payroll/run` wizard, Step 1
**Change**: Show warning banner if blocked employees exist
**UI**:
```
⚠️ 5 employees have compliance issues
   [ ] Include anyway (I acknowledge compliance risk)
   [ ] Exclude from this payroll run
   Reason: [________________]
```
**Effort**: Medium (add validation step, state for exclusions)

### 3. RunPayroll: Employee Exclusion Checkboxes
**Location**: `/payroll/run` employee table
**Change**: Add checkbox column to exclude specific employees
**UI**: Checkbox per row, excluded employees grayed out
**Effort**: Small (add state, filter in calculations)

### 4. LeaveRequests: Auto-Approve Setting
**Location**: Settings → Time Off tab (already exists)
**Change**: Add "Auto-approve after X days if no action" toggle
**Effort**: Small (add setting, background job)

### 5. Employee Type: Funding Source Field
**Location**: Employee Profile → Job Details tab
**Change**: Add optional `fundingSource` field
**Values**: Dropdown with configurable options (e.g., "USAID", "EU Grant", "Core Budget")
**Effort**: Small (add field to type, form, and reports)

### 6. Payroll: Adjustment Entry
**Location**: Payroll History → View Payrun → employee row
**Change**: Add "Adjust" action that creates correction entry
**UI**: Opens dialog with before/after/reason
**Effort**: Medium (new dialog, update payrollService)

---

## Summary: What's Blocking vs What's Tolerable

### Critical Gaps (Must Fix for NGO Use)
1. **URL filter support in AllEmployees** - Links from Dashboard/PayrollHub don't work
2. **Partial payroll execution** - Can't exclude blocked employees
3. **Funding source field** - Can't generate donor reports

### Important but Deferrable
4. **Payroll adjustment entries** - Workaround: manual journal entry
5. **Leave auto-approve** - Workaround: approve before payroll
6. **Change audit trail** - Workaround: external tracking

### Navigation Impact: NONE
All additions fit within existing pages:
- AllEmployees = work page (add filter logic)
- RunPayroll = work page (add warning step)
- Settings = work page with tabs (add setting)
- Employee Profile = work page with tabs (add field)

**No new hubs. No new navigation. Contract intact.**

---

---

## Implementation Status

### Implemented (January 2026)

1. **URL Filter Support in AllEmployees** ✅
   - Added `useSearchParams` hook
   - Supports: `?filter=missing-contract`, `?filter=missing-inss`, `?filter=missing-bank`, `?filter=blocking-issues`
   - Shows amber alert banner when compliance filter is active
   - Clear filter button removes URL params

2. **Funding Source Field in Employee Type** ✅
   - Added `fundingSource?: string` to `jobDetails`
   - Added `projectCode?: string` to `jobDetails`
   - Ready for NGO donor reporting

3. **Compliance Warning in RunPayroll** ✅
   - Detects employees missing contracts or INSS numbers
   - Shows warning banner with list of affected employees
   - Checkbox to exclude specific employees from payroll
   - Acknowledgment checkbox with required reason for audit trail
   - Totals recalculate to exclude excluded employees

### Remaining (Deferred)

4. **Payroll Adjustment Entries** - Workaround: manual journal entry
5. **Leave Auto-Approve** - Workaround: approve before payroll
6. **Full Audit Trail** - Workaround: external tracking

---

*Test conducted: January 2026*
*Tested against: Navigation Map v1.0*
*Result: 3 critical gaps fixed, 3 important gaps deferred, 0 navigation changes needed*
