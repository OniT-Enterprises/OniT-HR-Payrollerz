# OniT HR/Payroll AI Chatbot - Feature Scope

## Overview

An intelligent chatbot assistant embedded in the OniT HR/Payroll system that helps users navigate Timor-Leste employment law, tax regulations, payroll calculations, and system features.

---

## Core Capabilities

### 1. Timor-Leste Tax & Payroll Expert

**What it knows:**
- **Withholding Income Tax (WIT)**: 10% on income >$500/month for residents, 10% on all income for non-residents
- **INSS Social Security**: 4% employee + 6% employer contributions
- **Minimum Wage**: $115 USD/month
- **13th Month Salary (Subsídiu Anual)**: Full month salary by December 20th
- **Overtime Rates**: 150% standard, 200% holidays/rest days, 125% night shift
- **Leave Entitlements**: 12-22 days annual leave, 90 days maternity, 12 sick days
- **Severance Pay**: 30 days salary per year of service

**Example Questions:**
- "How much tax will I pay on a $800 salary?"
- "What's the INSS contribution for my team?"
- "Is per diem taxable in Timor-Leste?"
- "How do I calculate 13th month for a new hire?"
- "What are the overtime rates for working on Independence Day?"

### 2. System Field Awareness

**Fields the chatbot understands:**
```
Employee Fields:
├── Personal: name, DOB, phone, address, nationality
├── IDs: nationalIdNumber, electoralCard, INSS, SEFOPE, passport
├── Job: department, position, hireDate, contractType
├── Pay: monthlySalary, payFrequency, bankAccount
└── Leave: annualLeaveDays, sickDaysUsed

Payroll Fields:
├── Hours: regular, overtime, nightShift, holiday, absence
├── Earnings: base, overtime, bonuses, allowances, per diem
├── Deductions: WIT, INSS, loans, advances, court orders
└── Totals: gross, taxable, net, employer cost

Accounting Fields:
├── Accounts: assets, liabilities, equity, revenue, expenses
└── Entries: debits, credits, journal entries
```

**Example Questions:**
- "What fields do I need to fill for a new employee?"
- "Where do I enter the employee's INSS number?"
- "What's the difference between per diem and food allowance?"

### 3. Smart Page Navigation

**Pages the chatbot can redirect to:**

| Intent | Route | Page |
|--------|-------|------|
| Add employee | `/people/add` | Add Employee |
| View staff | `/people/employees` | All Employees |
| Run payroll | `/payroll/run` | Run Payroll |
| Check tax reports | `/payroll/taxes` | Tax Reports |
| Submit leave | `/people/leave` | Leave Requests |
| Track time | `/people/time-tracking` | Time Tracking |
| See attendance | `/people/attendance` | Attendance |
| View paystubs | `/payroll/history` | Payroll History |
| Manage benefits | `/payroll/benefits` | Benefits Enrollment |
| Performance review | `/people/reviews` | Performance Reviews |
| Department reports | `/reports/departments` | Department Reports |
| Accounting entries | `/accounting/journal-entries` | Journal Entries |

**Example Triggers:**
- "I need to add a new employee" → Redirects to `/people/add`
- "How do I run payroll?" → Explains + offers to go to `/payroll/run`
- "Where can I see my team's attendance?" → Redirects to `/people/attendance`

### 4. Interactive Calculators

**Built-in Calculations:**
1. **Tax Calculator**: Input salary → Output WIT amount
2. **Net Pay Estimator**: Gross salary → Net after all deductions
3. **Overtime Calculator**: Hours + type → Total overtime pay
4. **Leave Accrual**: Hire date + years → Annual leave days
5. **13th Month Calculator**: Months worked → Pro-rata amount
6. **Severance Calculator**: Years of service → Severance amount

**Example Interactions:**
```
User: "Calculate tax on $1,200 salary for a resident"
Bot:  "For a Timor-Leste resident earning $1,200/month:
       - Taxable amount: $1,200 - $500 = $700
       - WIT (10%): $70
       - INSS (4%): $48
       - Net estimate: ~$1,082

       Want me to take you to Run Payroll?"
```

---

## User Experience

### Chat Interface Location

**Option A: Floating Widget (Recommended)**
- Fixed position bottom-right corner
- Collapsible/expandable
- Persistent across all pages
- Badge shows unread count

**Option B: Sidebar Panel**
- Slides in from right side
- Full-height panel
- Toggle button in header

**Option C: Dedicated Page**
- `/assistant` route
- Full-page chat experience
- Good for complex conversations

### Chat Features

```
┌─────────────────────────────────────────┐
│  OniT Assistant                    ─ □ X│
├─────────────────────────────────────────┤
│                                         │
│  👋 Bondia! I'm your HR/Payroll        │
│  assistant. Ask me about:               │
│                                         │
│  • Tax & INSS calculations              │
│  • Leave entitlements                   │
│  • Payroll questions                    │
│  • Finding the right page               │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  [User message bubbles]                 │
│  [Bot response bubbles]                 │
│                                         │
├─────────────────────────────────────────┤
│  Quick Actions:                         │
│  [💰 Tax Calc] [📋 Run Payroll] [➕ Add]│
├─────────────────────────────────────────┤
│  Type your question...           [Send] │
└─────────────────────────────────────────┘
```

### Bilingual Support

The chatbot should respond in the same language the user writes:
- **English** → English responses
- **Tetun** → Tetun responses
- Mix of legal terms in both languages

---

## Technical Architecture

### Option 1: OpenAI API (Recommended for MVP)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   React UI   │────▶│  Edge Func   │────▶│  OpenAI API  │
│  (Chat Box)  │◀────│  (Supabase/  │◀────│  (GPT-4o)    │
│              │     │   Firebase)  │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Knowledge    │
                     │ Base (JSON)  │
                     │ - TL Rules   │
                     │ - Routes     │
                     │ - Fields     │
                     └──────────────┘
```

**Components:**
1. **React Chat Component**: UI with message bubbles, input, quick actions
2. **Firebase Edge Function**: Handles API calls, injects knowledge context
3. **Knowledge Base**: JSON files with TL rules, field definitions, route mappings
4. **OpenAI API**: GPT-4o-mini for fast, cost-effective responses

### Option 2: Anthropic Claude API

Same architecture but using Claude API:
- Better for nuanced legal/compliance answers
- Slightly higher cost but excellent accuracy

### Option 3: Local LLM (Ollama)

For privacy-conscious deployments:
- Run Llama 3 or Mistral locally
- No external API calls
- Requires server with GPU

---

## Knowledge Base Structure

```
client/lib/chatbot/
├── knowledge/
│   ├── tl-tax-rules.json        # All tax rates, thresholds
│   ├── tl-labor-law.json        # Leave, overtime, severance
│   ├── tl-inss.json             # Social security rules
│   ├── tl-holidays.json         # Public holidays
│   ├── field-definitions.json   # All system fields
│   ├── routes.json              # Page routes + descriptions
│   └── faq.json                 # Common Q&A pairs
├── prompts/
│   ├── system-prompt.ts         # Main system prompt
│   └── intent-detection.ts      # Route detection prompt
├── components/
│   ├── ChatWidget.tsx           # Floating chat UI
│   ├── ChatMessage.tsx          # Message bubble
│   ├── QuickActions.tsx         # Quick action buttons
│   └── Calculator.tsx           # Inline calculators
├── hooks/
│   ├── useChat.ts               # Chat state management
│   └── useNavigation.ts         # Smart navigation
└── services/
    └── chatService.ts           # API communication
```

### System Prompt Template

```typescript
const SYSTEM_PROMPT = `
You are the OniT HR/Payroll Assistant, an expert in Timor-Leste employment law,
tax regulations, and the OniT HR system. You help users with:

1. TAX & PAYROLL: Calculate WIT, INSS, net pay, overtime, 13th month
2. LABOR LAW: Explain leave, contracts, severance, working hours
3. NAVIGATION: Guide users to the right page in the system
4. FIELDS: Explain what data fields mean and where to find them

KNOWLEDGE BASE:
${JSON.stringify(knowledgeBase)}

AVAILABLE PAGES:
${JSON.stringify(routes)}

RULES:
- Always cite the relevant law (e.g., "Under Law 8/2008...")
- Provide specific numbers when calculating
- Offer to navigate to relevant pages when appropriate
- Use Tetun terms alongside English where helpful
- If unsure, say so and suggest contacting DNRE, INSS, or SEFOPE

RESPONSE FORMAT:
- Keep answers concise but complete
- Use bullet points for lists
- Include calculations step-by-step
- End with a helpful follow-up question or navigation offer
`;
```

---

## Navigation Logic

### Intent Detection

```typescript
const NAVIGATION_INTENTS = {
  'add employee': '/people/add',
  'new hire': '/people/add',
  'employee list': '/people/employees',
  'run payroll': '/payroll/run',
  'payroll history': '/payroll/history',
  'tax report': '/payroll/taxes',
  'leave request': '/people/leave',
  'time tracking': '/people/time-tracking',
  'attendance': '/people/attendance',
  'performance review': '/people/reviews',
  'training': '/people/training',
  'departments': '/people/departments',
  'org chart': '/people/org-chart',
  'journal entries': '/accounting/journal-entries',
  'chart of accounts': '/accounting/chart-of-accounts',
  // ... more mappings
};

function detectNavigationIntent(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  for (const [intent, route] of Object.entries(NAVIGATION_INTENTS)) {
    if (lowerMessage.includes(intent)) {
      return route;
    }
  }
  return null;
}
```

### Smart Redirect Component

```tsx
// In chat response, render navigation buttons
<ChatMessage>
  To add a new employee, you'll need their:
  - National ID (Bilhete de Identidade)
  - INSS number
  - Bank account details

  <NavigateButton to="/people/add">
    ➕ Go to Add Employee
  </NavigateButton>
</ChatMessage>
```

---

## Quick Action Buttons

Pre-defined prompts for common tasks:

| Button | Prompt Sent |
|--------|-------------|
| 💰 Tax Calculator | "Help me calculate income tax" |
| 📋 Run Payroll | "How do I run payroll?" |
| ➕ Add Employee | "I need to add a new employee" |
| 📅 Leave Balance | "How is annual leave calculated?" |
| 🧮 INSS Calculator | "Calculate INSS contributions" |
| 📊 Reports | "What reports are available?" |

---

## Implementation Phases

### Phase 1: MVP (2-3 weeks effort)
- [ ] Floating chat widget UI
- [ ] Basic OpenAI integration
- [ ] TL tax rules knowledge base
- [ ] Simple navigation detection
- [ ] 5 quick action buttons

### Phase 2: Enhanced (2 weeks effort)
- [ ] Interactive calculators (tax, net pay, overtime)
- [ ] Bilingual responses (English/Tetun)
- [ ] Conversation history persistence
- [ ] More comprehensive FAQ

### Phase 3: Advanced (3 weeks effort)
- [ ] Context-aware suggestions based on current page
- [ ] Integration with actual employee/payroll data
- [ ] Voice input support
- [ ] Analytics dashboard (common questions, etc.)

---

## Cost Estimates

### OpenAI API (GPT-4o-mini)
- ~$0.15 per 1M input tokens
- ~$0.60 per 1M output tokens
- **Estimated**: $5-20/month for small team usage

### Anthropic Claude (claude-3-haiku)
- ~$0.25 per 1M input tokens
- ~$1.25 per 1M output tokens
- **Estimated**: $10-40/month for small team usage

### Firebase Edge Functions
- 2M invocations free/month
- **Estimated**: $0-5/month

---

## Security Considerations

1. **API Key Protection**: Store OpenAI/Anthropic keys in Firebase secrets
2. **Rate Limiting**: Max 10 requests/minute per user
3. **Content Filtering**: Block sensitive data in prompts
4. **Audit Logging**: Log all chat interactions for compliance
5. **No PII in Context**: Don't send actual employee data to LLM

---

## Sample Conversations

### Tax Calculation
```
User: How much tax on $1,500 salary?

Bot: For a Timor-Leste resident earning $1,500/month:

📊 **Tax Calculation:**
- Monthly salary: $1,500
- Tax-free threshold: $500
- Taxable amount: $1,000
- **WIT (10%): $100**

📋 **INSS Deductions:**
- Employee (4%): $60
- Employer (6%): $90

💵 **Estimated Net Pay:** ~$1,340

Would you like me to take you to Run Payroll to process this?
[Go to Run Payroll →]
```

### Navigation Help
```
User: Where do I see attendance records?

Bot: You can view attendance records at **People → Attendance**.

This page shows:
- Daily attendance logs
- Clock-in/clock-out times
- Absence tracking
- Late arrivals

[Go to Attendance →]

Would you also like to see the Time Tracking page for detailed hours?
```

### Labor Law Question
```
User: How much severance for 5 years?

Bot: Under **Timor-Leste Labor Code (Law 4/2012, Article 51)**:

📋 **Severance Calculation:**
- Rate: 30 days salary per year of service
- Years worked: 5
- **Total: 150 days of salary (5 months)**

Example for $800/month salary:
- Severance = $800 × 5 = **$4,000**

⚠️ Note: Employee must have completed minimum 3 months to qualify.

Need help with offboarding documentation?
[Go to Offboarding →]
```

---

## Files to Create

1. `client/components/chatbot/ChatWidget.tsx` - Main widget
2. `client/components/chatbot/ChatMessage.tsx` - Message component
3. `client/components/chatbot/QuickActions.tsx` - Action buttons
4. `client/hooks/useChat.ts` - Chat state hook
5. `client/lib/chatbot/knowledge.ts` - Knowledge base loader
6. `client/lib/chatbot/prompts.ts` - System prompts
7. `client/services/chatService.ts` - API service
8. `functions/src/chat.ts` - Firebase function for OpenAI proxy

---

## Success Metrics

- **Adoption**: % of users who use chatbot weekly
- **Resolution Rate**: % of questions answered without escalation
- **Navigation Usage**: # of page redirects from chatbot
- **Satisfaction**: User ratings on responses
- **Common Topics**: Most frequently asked questions

---

## Next Steps

1. **Choose AI Provider**: OpenAI GPT-4o-mini (recommended) or Claude
2. **Design UI**: Finalize chat widget design
3. **Build Knowledge Base**: Compile all TL rules into JSON
4. **Implement MVP**: Basic chat with tax knowledge
5. **Test with Users**: Get feedback on accuracy and usefulness
6. **Iterate**: Add more features based on usage patterns
