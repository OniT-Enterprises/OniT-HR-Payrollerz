// HR Chatbot Service - OpenAI-powered AI assistant for Timor-Leste HR/Payroll
import { toast } from 'sonner';
import {
  TL_TAX_RULES,
  TL_LABOR_LAW,
  TL_PUBLIC_HOLIDAYS_2025,
  TL_REGULATORY_BODIES,
  HR_NAVIGATION_ROUTES,
} from '../lib/chatbot/tl-knowledge';

// Types for chatbot actions
export interface HRChatAction {
  type: 'calculation' | 'navigation' | 'query' | 'clarification' | 'employee' | 'payroll';
  action: 'calculate' | 'navigate' | 'explain' | 'create' | 'update' | 'list';
  data: Record<string, unknown>;
  missingFields?: string[];
  confirmationMessage?: string;
  navigateTo?: string;
}

export interface HRChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  action?: HRChatAction;
  pendingAction?: HRChatAction;
}

export interface HRChatContext {
  tenantId: string;
  tenantName: string;
  userId: string;
  userEmail: string;
  userRole: string;
  currentPage: string;
}

// System prompt for the AI assistant
const getSystemPrompt = (context: HRChatContext) => `You are an HR/Payroll assistant for ${context.tenantName} in Timor-Leste. You help staff with employment law, tax calculations, payroll, and system navigation.

CURRENT CONTEXT:
- Company: ${context.tenantName} (ID: ${context.tenantId})
- User: ${context.userEmail} (Role: ${context.userRole})
- Current Page: ${context.currentPage}

=== TIMOR-LESTE TAX RULES (Law 8/2008) ===
WITHHOLDING INCOME TAX (WIT - Impostu Retidu):
- Residents: 10% on income EXCEEDING $${TL_TAX_RULES.wit.residentThreshold}/month
  Example: $1,200 salary → ($1,200 - $500) × 10% = $70 tax
- Non-residents: 10% on ALL income (no threshold)
- Tax-free: Per diem, travel allowances

SOCIAL SECURITY (INSS - Decree-Law 19/2016):
- Employee contribution: ${TL_TAX_RULES.inss.employeeRate * 100}% of gross
- Employer contribution: ${TL_TAX_RULES.inss.employerRate * 100}% of gross
- Minimum wage: $${TL_TAX_RULES.minimumWage}/month

=== LABOR LAW (Law 4/2012) ===
13TH MONTH (Subsídiu Anual - Article 40):
- One full month's salary by December 20th
- Pro-rata for <12 months: (months_worked / 12) × monthly_salary

OVERTIME RATES:
- Standard (>44 hrs/week): ${TL_LABOR_LAW.overtimeRates.standard * 100}%
- Night shift (10pm-6am): ${TL_LABOR_LAW.overtimeRates.nightShift * 100}%
- Public holiday: ${TL_LABOR_LAW.overtimeRates.holiday * 100}%
- Rest day/Sunday: ${TL_LABOR_LAW.overtimeRates.restDay * 100}%

ANNUAL LEAVE (Article 38):
- 0-3 years: ${TL_LABOR_LAW.annualLeave.base} days
- 3-6 years: ${TL_LABOR_LAW.annualLeave.after3Years} days
- 6-9 years: ${TL_LABOR_LAW.annualLeave.after6Years} days
- 9+ years: ${TL_LABOR_LAW.annualLeave.after9Years} days

SICK LEAVE (Article 42):
- Max ${TL_LABOR_LAW.sickLeave.maxDaysPerYear} days/year with medical certificate
- First ${TL_LABOR_LAW.sickLeave.fullPayDays} days: 100% pay
- Next ${TL_LABOR_LAW.sickLeave.halfPayDays} days: 50% pay

MATERNITY LEAVE (Article 44):
- ${TL_LABOR_LAW.maternityLeave.totalDays} days total (${TL_LABOR_LAW.maternityLeave.prenatalDays} pre + ${TL_LABOR_LAW.maternityLeave.postnatalDays} post)
- 100% paid

SEVERANCE (Article 51):
- ${TL_LABOR_LAW.severance.daysPerYear} days salary per year of service
- Minimum ${TL_LABOR_LAW.severance.minimumService} months to qualify

=== YOUR CAPABILITIES ===
1. CALCULATE TAX - "How much tax on $1,200 salary?" → Show WIT calculation
2. CALCULATE INSS - "What's INSS on $800?" → Show employee + employer amounts
3. CALCULATE NET PAY - "Net pay for $1,000 gross?" → Full breakdown
4. CALCULATE OVERTIME - "10 holiday hours at $5/hr?" → Apply 200% rate
5. CALCULATE LEAVE - "Leave for 5 years service?" → 15 days
6. CALCULATE 13TH MONTH - "13th month hired in July?" → Pro-rata calculation
7. CALCULATE SEVERANCE - "Severance for 4 years at $600?" → 30 days × 4 years
8. EXPLAIN LAW - "Is per diem taxable?" → Cite relevant law
9. NAVIGATE - "Go to run payroll" → Redirect to page
10. FIELD HELP - "What's SEFOPE number?" → Explain the field

=== NAVIGATION ROUTES ===
${Object.entries(HR_NAVIGATION_ROUTES).map(([key, path]) => `- "${key}": ${path}`).join('\n')}

=== REGULATORY CONTACTS ===
${Object.values(TL_REGULATORY_BODIES).map(body => `- ${body.name}: ${body.role}`).join('\n')}

RESPONSE FORMAT:
Always respond with valid JSON in this exact format:
{
  "message": "Your helpful response with step-by-step calculations if applicable",
  "action": {
    "type": "calculation|navigation|query|clarification",
    "action": "calculate|navigate|explain",
    "data": { ...relevant data like amounts, rates used... },
    "navigateTo": "/path/to/page"
  }
}

IMPORTANT RULES:
1. ALWAYS cite the relevant law (e.g., "Under Law 8/2008..." or "Per Article 38...")
2. Show step-by-step calculations with actual numbers
3. Use both English and Tetun terms where appropriate
4. Offer to navigate to relevant pages after answering
5. If unsure about specific company policies, suggest checking with HR or the relevant authority
6. Format currency as USD with $ symbol
7. Be concise but thorough - users are busy HR staff`;

// Main chat function that calls OpenAI directly
export const sendHRChatMessage = async (
  message: string,
  context: HRChatContext,
  conversationHistory: HRChatMessage[],
  apiKey: string | null
): Promise<{ message: string; action?: HRChatAction }> => {
  try {
    if (!apiKey) {
      return {
        message: "AI assistant is not configured. Please add your OpenAI API key in Settings.",
      };
    }

    // Build conversation history (last 10 messages for context)
    const history = conversationHistory.slice(-10).map((msg) => ({
      role: msg.role,
      content: msg.role === 'assistant' && msg.action
        ? JSON.stringify({ message: msg.content, action: msg.action })
        : msg.content,
    }));

    const openAIMessages = [
      { role: "system", content: getSystemPrompt(context) },
      ...history,
      { role: "user", content: message },
    ];

    // Call OpenAI API directly
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: openAIMessages,
        temperature: 0.7,
        max_completion_tokens: 1000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      if (response.status === 401) {
        throw new Error("Invalid API key. Please check your OpenAI API key in Settings.");
      }
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again in a moment.");
      }
      throw new Error(`OpenAI request failed (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();
    const assistantMessage = data?.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      throw new Error("No response content from OpenAI");
    }

    try {
      const parsed = JSON.parse(assistantMessage);
      return {
        message: typeof parsed?.message === "string" ? parsed.message : assistantMessage,
        action: parsed?.action,
      };
    } catch {
      // If JSON parsing fails, return raw message
      return { message: assistantMessage };
    }
  } catch (error: unknown) {
    console.error('HR Chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      message: `I'm having trouble connecting right now. ${errorMessage}`,
    };
  }
};

// Detect navigation intent from user message
export const detectNavigationIntent = (message: string): string | null => {
  const lowerMessage = message.toLowerCase().trim();

  // Check for navigation keywords
  const navKeywords = ['go to', 'take me to', 'open', 'show me', 'navigate to', 'where is', 'find'];
  const hasNavIntent = navKeywords.some(keyword => lowerMessage.includes(keyword));

  if (!hasNavIntent) return null;

  // Check against known routes
  for (const [intent, route] of Object.entries(HR_NAVIGATION_ROUTES)) {
    if (lowerMessage.includes(intent)) {
      return route;
    }
  }

  return null;
};

// Generate a unique message ID
export const generateMessageId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Quick calculation helpers for inline responses
export const quickCalculations = {
  wit: (salary: number, isResident = true): string => {
    if (isResident) {
      const taxable = Math.max(0, salary - 500);
      const tax = taxable * 0.10;
      return `WIT on $${salary}: ($${salary} - $500) × 10% = **$${tax.toFixed(2)}**`;
    }
    const tax = salary * 0.10;
    return `WIT on $${salary} (non-resident): $${salary} × 10% = **$${tax.toFixed(2)}**`;
  },

  inss: (salary: number): string => {
    const employee = salary * 0.04;
    const employer = salary * 0.06;
    return `INSS on $${salary}:\n- Employee (4%): **$${employee.toFixed(2)}**\n- Employer (6%): **$${employer.toFixed(2)}**`;
  },

  netPay: (salary: number, isResident = true): string => {
    const taxable = isResident ? Math.max(0, salary - 500) : salary;
    const wit = taxable * 0.10;
    const inss = salary * 0.04;
    const net = salary - wit - inss;
    return `Net pay for $${salary}:\n- Gross: $${salary}\n- WIT: -$${wit.toFixed(2)}\n- INSS: -$${inss.toFixed(2)}\n- **Net: $${net.toFixed(2)}**`;
  },
};
