# UX Improvements - Low Brain Power Usability

## Goal
Make the HR/Payroll system **powerful but easy to use** - minimal cognitive load for everyday tasks.

## Design Principles

1. **One-Click Actions** - Common tasks within 1-2 clicks
2. **Progressive Disclosure** - Show basics first, details on demand
3. **Guided Workflows** - Step-by-step wizards for complex tasks
4. **Visual Hierarchy** - Most important things are biggest/boldest
5. **Smart Defaults** - TL-specific values pre-filled

---

## Phase 1: Navigation Simplification

### Current Problem
- People dropdown has 17+ items in mega-menu
- 3+ clicks to reach most features
- No breadcrumbs

### Solution: Flat Tab Navigation

```
[Dashboard] [People] [Payroll] [Reports] [Settings]
```

Each tab leads to a **section dashboard** with:
- Stats cards at top
- Quick action buttons
- Recent items / tables below

### People Section Dashboard
Shows sub-navigation as cards or sidebar:
- Staff (Employees, Departments, Org Chart)
- Hiring (Jobs, Candidates, Onboarding)
- Time & Leave (Attendance, Leave, Schedules)
- Performance (Goals, Reviews, Training)

---

## Phase 2: Action-First Dashboard

### Current Problem
- Dashboard shows numbers only
- No guidance on what to do next
- Pending items not prominent

### Solution: Command Center Dashboard

```
+------------------------------------------+
|  Good morning, [Name]                    |
|  Here's what needs your attention:       |
+------------------------------------------+

+----------------+ +----------------+ +----------------+
| 3 PENDING      | | PAYROLL DUE    | | 2 NEW          |
| Leave Requests | | in 5 days      | | Candidates     |
| [Review Now]   | | [Run Payroll]  | | [View]         |
+----------------+ +----------------+ +----------------+

+------------------------------------------+
| QUICK ACTIONS                            |
| [+ Add Employee] [+ Request Leave] [Run Payroll]
+------------------------------------------+

| Recent Activity        | Team Overview    |
| - Maria approved leave | 45 Employees     |
| - Payroll completed    | 6 Departments    |
| - New hire: João       | $52,450 Payroll  |
+------------------------------------------+
```

---

## Phase 3: Step Wizard for Forms

### Current Problem
- AddEmployee: 20+ fields, long scrolling page
- No progress indicator
- No save draft

### Solution: 4-Step Wizard

```
Step 1: Basic Info     Step 2: Job Details
[=======]              [===============]
  25%                       50%

+------------------------------------------+
| STEP 1: Basic Information                |
+------------------------------------------+
| First Name: [________] Last Name: [____] |
| Email: [______________]                  |
| Phone: [______________]                  |
|                                          |
| Emergency Contact                        |
| Name: [___________] Phone: [___________] |
|                                          |
|            [Save Draft]  [Next Step ->]  |
+------------------------------------------+
```

**Steps:**
1. **Basic Info** - Name, contact, emergency contact
2. **Job Details** - Department, position, start date, manager
3. **Compensation** - Salary, payment method, bank details
4. **Documents** - ID, contracts, uploads

---

## Phase 4: Consistent Page Template

Every page follows same structure:

```
[Breadcrumb: Dashboard > People > Employees]

[Page Title]                    [Primary Action Button]
[Subtitle/description]

+----------+ +----------+ +----------+ +----------+
| Stat 1   | | Stat 2   | | Stat 3   | | Stat 4   |
+----------+ +----------+ +----------+ +----------+

[Filters/Search bar]

+------------------------------------------+
| Main Content (Table/Cards/Form)          |
+------------------------------------------+
```

---

## Implementation Order

### Sprint 1: Navigation & Dashboard - COMPLETE
- [x] Simplify MainNavigation to 5 tabs
- [x] Create section dashboards (People, Payroll, Reports)
- [x] Build action-first main Dashboard
- [x] Add breadcrumb component (AutoBreadcrumb)

### Sprint 2: Form Wizards - COMPLETE
- [x] Create reusable StepWizard component
- [x] Convert AddEmployee to 4-step wizard
- [x] Add form validation per step (basic)
- [ ] Add draft save functionality (future)

### Sprint 3: Consistency Pass - COMPLETE
- [x] Create PageTemplate component
- [x] Create StatsCard/StatsRow components
- [x] Document usage patterns
- [ ] Gradually apply to existing pages (ongoing)

### Sprint 4: Polish - COMPLETE
- [x] Add keyboard shortcuts for power users (g+d, g+e, n+e, etc.)
- [x] Add "Recent Hires" to dashboard
- [x] Keyboard shortcuts help dialog (?  or Cmd+/)
- [ ] Mobile responsive improvements (future)
- [ ] Contextual help tooltips (future)

---

## Component Inventory

### Created Components
1. `AutoBreadcrumb.tsx` - Auto-generates breadcrumbs from URL path
2. `StepWizard.tsx` - Multi-step form wizard with progress indicator
3. `PageTemplate.tsx` - Consistent page layout wrapper
4. `StatsCard.tsx` - Reusable stats display with icon, badge, trend

### Modified Components
1. `MainNavigation.tsx` - Simplified to 5 flat tabs
2. `Dashboard.tsx` - Action-first command center design
3. `AddEmployee.tsx` - Converted to 4-step wizard
4. `PeopleDashboard.tsx` - New section hub
5. `PayrollDashboard.tsx` - New section hub
6. `ReportsDashboard.tsx` - New section hub

---

## Usage Examples

### PageTemplate Usage

```tsx
import { PageTemplate } from "@/components/layout/PageTemplate";
import { StatsCard, StatsRow } from "@/components/ui/StatsCard";
import { Users, Plus, Download } from "lucide-react";

export default function MyPage() {
  return (
    <PageTemplate
      title="Employees"
      subtitle="Manage your team members"
      icon={Users}
      iconColor="text-blue-500"
      primaryAction={{
        label: "Add Employee",
        icon: Plus,
        onClick: () => navigate("/people/add"),
      }}
      secondaryActions={[
        { label: "Export", icon: Download, onClick: handleExport },
      ]}
      stats={
        <StatsRow>
          <StatsCard
            value={42}
            label="Total Employees"
            icon={Users}
            iconBg="bg-blue-100"
            iconColor="text-blue-500"
            onClick={() => {}}
          />
          {/* More stats... */}
        </StatsRow>
      }
    >
      {/* Page content goes here */}
    </PageTemplate>
  );
}
```

### StepWizard Usage

```tsx
import { StepWizard, StepContent, WizardStep } from "@/components/ui/StepWizard";

const STEPS: WizardStep[] = [
  { id: "info", title: "Basic Info", icon: User },
  { id: "details", title: "Details", icon: Briefcase },
  { id: "review", title: "Review", icon: Check, isOptional: true },
];

function MyForm() {
  const [step, setStep] = useState(0);

  return (
    <StepWizard
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      onComplete={handleSubmit}
      canProceed={validateStep(step)}
    >
      <StepContent stepId="info" currentStepId={STEPS[step].id}>
        {/* Step 1 fields */}
      </StepContent>
      <StepContent stepId="details" currentStepId={STEPS[step].id}>
        {/* Step 2 fields */}
      </StepContent>
    </StepWizard>
  );
}
```

---

## Success Metrics

- **Time to complete common tasks** reduced by 50%
- **Clicks to reach any feature** max 2-3
- **Form completion rate** increased
- **User errors** reduced through validation
