import type { OpenclawPluginApi } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";

export default function register(api: OpenclawPluginApi) {
  const config = api.config.plugins?.entries?.["meza-hr"]?.config || {};
  const apiBaseUrl = config.apiBaseUrl || "http://127.0.0.1:3201";
  const apiKey = config.apiKey;
  const tenantId = config.defaultTenantId;

  if (!apiKey) {
    console.warn("[meza-hr] API key not configured. Please add to openclaw.json");
    return;
  }

  if (!tenantId) {
    console.warn("[meza-hr] Default tenant ID not configured. Please add to openclaw.json");
    return;
  }

  // ============================================================================
  // Helper: Call Meza API
  // ============================================================================

  function createRequestId() {
    return `mza-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function callApi(endpoint: string, options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown>;
  }) {
    const requestId = createRequestId();
    const method = options?.method || 'GET';
    const url = `${apiBaseUrl}/api/tenants/${tenantId}${endpoint}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "X-Request-Id": requestId,
        },
        ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
      });
    } catch (error: any) {
      throw new Error(
        `[${requestId}] Network error calling ${method} ${endpoint}: ${error?.message || "Unknown network error"}`
      );
    }

    const text = await response.text();
    let parsed: any = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // Non-JSON body
      }
    }

    if (!response.ok) {
      const apiMessage = parsed?.message || parsed?.error || text || "Unknown API error";
      const compactMessage = String(apiMessage).replace(/\s+/g, " ").trim().slice(0, 500);
      throw new Error(`[${requestId}] API ${response.status} ${method} ${endpoint}: ${compactMessage}`);
    }

    return parsed ?? {};
  }

  /** Format currency (USD for now, TL uses USD) */
  function fmtMoney(amount: number): string {
    return `$${(amount || 0).toFixed(2)}`;
  }

  /** Text result helper */
  function textResult(text: string) {
    return { content: [{ type: "text" as const, text }] };
  }

  /** Error result helper */
  function errorResult(action: string, error: any) {
    return textResult(`Error ${action}: ${error.message}`);
  }

  // ============================================================================
  // EMPLOYEE TOOLS (6)
  // ============================================================================

  api.registerTool({
    name: "list_employees",
    description:
      "List all employees with optional filters. Returns name, position, department, and status for each employee.",
    parameters: Type.Object({
      status: Type.Optional(
        Type.String({ description: "Filter by status: active, inactive, terminated, probation" })
      ),
      department: Type.Optional(Type.String({ description: "Filter by department ID" })),
      limit: Type.Optional(Type.Number({ description: "Max results (default 100)" })),
    }),
    async execute(_id, params) {
      try {
        const qs = new URLSearchParams();
        if (params.status) qs.set("status", params.status);
        if (params.department) qs.set("department", params.department);
        if (params.limit) qs.set("limit", String(params.limit));

        const data = await callApi(`/employees?${qs}`);

        if (!data.success || data.employees.length === 0) {
          return textResult("No employees found matching the criteria.");
        }

        let summary = `**Employees** (${data.count})\n\n`;
        for (const emp of data.employees) {
          const name =
            `${emp.personalInfo?.firstName || ""} ${emp.personalInfo?.lastName || ""}`.trim() ||
            "Unknown";
          const pos = emp.jobDetails?.positionTitle || emp.jobDetails?.position || "";
          const dept = emp.jobDetails?.departmentName || emp.jobDetails?.department || "";
          const statusIcon =
            emp.status === "active" ? "🟢" : emp.status === "probation" ? "🟡" : "🔴";
          summary += `${statusIcon} **${name}**`;
          if (pos) summary += ` — ${pos}`;
          if (dept) summary += ` (${dept})`;
          summary += `\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("listing employees", error);
      }
    },
  });

  api.registerTool({
    name: "search_employees",
    description: "Search employees by name, email, or employee ID.",
    parameters: Type.Object({
      query: Type.String({ description: "Search term (name, email, or employee ID)" }),
    }),
    async execute(_id, params) {
      try {
        const data = await callApi(`/employees?search=${encodeURIComponent(params.query)}`);

        if (!data.success || data.employees.length === 0) {
          return textResult(`No employees found matching "${params.query}".`);
        }

        let summary = `**Search Results** for "${params.query}" (${data.count})\n\n`;
        for (const emp of data.employees) {
          const name =
            `${emp.personalInfo?.firstName || ""} ${emp.personalInfo?.lastName || ""}`.trim();
          const email = emp.personalInfo?.email || "";
          const pos = emp.jobDetails?.positionTitle || "";
          summary += `• **${name}** — ${pos}\n`;
          if (email) summary += `  Email: ${email}\n`;
          summary += `  ID: ${emp.id}\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("searching employees", error);
      }
    },
  });

  api.registerTool({
    name: "get_employee_details",
    description:
      "Get detailed information about a specific employee including personal info, job details, compensation, and documents.",
    parameters: Type.Object({
      employeeId: Type.String({ description: "The employee document ID" }),
    }),
    async execute(_id, params) {
      try {
        const data = await callApi(`/employees/${params.employeeId}`);

        if (!data.success) {
          return textResult("Employee not found.");
        }

        const emp = data.employee;
        const pi = emp.personalInfo || {};
        const jd = emp.jobDetails || {};
        const comp = emp.compensation || {};

        let summary = `**Employee Details**\n\n`;
        summary += `**Name:** ${pi.firstName || ""} ${pi.lastName || ""}\n`;
        summary += `**Status:** ${emp.status || "unknown"}\n`;
        if (pi.email) summary += `**Email:** ${pi.email}\n`;
        if (pi.phone) summary += `**Phone:** ${pi.phone}\n`;
        if (pi.dateOfBirth) summary += `**DOB:** ${pi.dateOfBirth}\n`;
        summary += `\n**Job Details:**\n`;
        if (jd.positionTitle || jd.position) summary += `  Position: ${jd.positionTitle || jd.position}\n`;
        if (jd.departmentName || jd.department) summary += `  Department: ${jd.departmentName || jd.department}\n`;
        if (jd.employmentType) summary += `  Type: ${jd.employmentType}\n`;
        if (jd.startDate || jd.hireDate) summary += `  Start Date: ${jd.startDate || jd.hireDate}\n`;
        if (comp.salary || comp.monthlySalary) {
          summary += `\n**Compensation:**\n`;
          summary += `  Salary: ${fmtMoney(comp.salary || comp.monthlySalary)}/month\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching employee details", error);
      }
    },
  });

  api.registerTool({
    name: "get_employee_counts",
    description:
      "Get a breakdown of employee counts by status (active, inactive, terminated, probation).",
    parameters: Type.Object({}),
    async execute() {
      try {
        const data = await callApi("/employees/counts");
        const c = data.counts;

        const summary =
          `**Employee Counts**\n\n` +
          `👥 Total: **${c.total}**\n` +
          `🟢 Active: ${c.active}\n` +
          `🟡 Probation: ${c.probation}\n` +
          `🔴 Inactive: ${c.inactive}\n` +
          `⚫ Terminated: ${c.terminated}\n`;

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching employee counts", error);
      }
    },
  });

  api.registerTool({
    name: "get_employees_by_department",
    description: "Get active employees grouped by department with headcount per department.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const data = await callApi("/employees/by-department");

        if (!data.success || data.departments.length === 0) {
          return textResult("No department data available.");
        }

        let summary = `**Employees by Department** (${data.count} departments)\n\n`;
        for (const dept of data.departments) {
          summary += `**${dept.name}** (${dept.count})\n`;
          for (const emp of dept.employees.slice(0, 10)) {
            summary += `  • ${emp.name}`;
            if (emp.position) summary += ` — ${emp.position}`;
            summary += `\n`;
          }
          if (dept.employees.length > 10) {
            summary += `  _...and ${dept.employees.length - 10} more_\n`;
          }
          summary += `\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching department data", error);
      }
    },
  });

  api.registerTool({
    name: "get_active_employees",
    description: "Get a list of all currently active employees.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const data = await callApi("/employees?status=active");

        if (!data.success || data.employees.length === 0) {
          return textResult("No active employees found.");
        }

        let summary = `**Active Employees** (${data.count})\n\n`;
        for (const emp of data.employees) {
          const name =
            `${emp.personalInfo?.firstName || ""} ${emp.personalInfo?.lastName || ""}`.trim();
          const pos = emp.jobDetails?.positionTitle || emp.jobDetails?.position || "";
          summary += `• **${name}**`;
          if (pos) summary += ` — ${pos}`;
          summary += `\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching active employees", error);
      }
    },
  });

  // ============================================================================
  // PAYROLL TOOLS (4)
  // ============================================================================

  api.registerTool({
    name: "list_payroll_runs",
    description: "List recent payroll runs with their status, period, and totals.",
    parameters: Type.Object({
      status: Type.Optional(
        Type.String({ description: "Filter by status: draft, processing, approved, paid" })
      ),
      limit: Type.Optional(Type.Number({ description: "Max results (default 12)" })),
    }),
    async execute(_id, params) {
      try {
        const qs = new URLSearchParams();
        if (params.status) qs.set("status", params.status);
        if (params.limit) qs.set("limit", String(params.limit));

        const data = await callApi(`/payroll/runs?${qs}`);

        if (!data.success || data.runs.length === 0) {
          return textResult("No payroll runs found.");
        }

        let summary = `**Payroll Runs** (${data.count})\n\n`;
        for (const run of data.runs) {
          const statusIcon =
            run.status === "paid"
              ? "✅"
              : run.status === "approved"
                ? "🟢"
                : run.status === "draft"
                  ? "📝"
                  : "🔄";
          summary += `${statusIcon} **${run.id}** — ${run.status}\n`;
          if (run.periodStart && run.periodEnd)
            summary += `  Period: ${run.periodStart} to ${run.periodEnd}\n`;
          if (run.totalNetPay) summary += `  Net Pay: ${fmtMoney(run.totalNetPay)}\n`;
          if (run.employeeCount) summary += `  Employees: ${run.employeeCount}\n`;
          summary += `\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("listing payroll runs", error);
      }
    },
  });

  api.registerTool({
    name: "get_payroll_run",
    description:
      "Get details for a specific payroll run by period (YYYYMM format, e.g. 202602 for February 2026).",
    parameters: Type.Object({
      period: Type.String({ description: "Payroll period in YYYYMM format (e.g. 202602)" }),
    }),
    async execute(_id, params) {
      try {
        const data = await callApi(`/payroll/runs/${params.period}`);

        if (!data.success) {
          return textResult(`No payroll run found for period ${params.period}.`);
        }

        const run = data.run;
        let summary = `**Payroll Run: ${run.id}**\n\n`;
        summary += `Status: ${run.status}\n`;
        if (run.periodStart) summary += `Period: ${run.periodStart} to ${run.periodEnd}\n`;
        if (run.payDate) summary += `Pay Date: ${run.payDate}\n`;
        summary += `\n**Totals:**\n`;
        if (run.totalGrossPay) summary += `  Gross Pay: ${fmtMoney(run.totalGrossPay)}\n`;
        if (run.totalDeductions) summary += `  Deductions: ${fmtMoney(run.totalDeductions)}\n`;
        if (run.totalNetPay) summary += `  Net Pay: ${fmtMoney(run.totalNetPay)}\n`;
        if (run.totalEmployerTaxes)
          summary += `  Employer Taxes: ${fmtMoney(run.totalEmployerTaxes)}\n`;
        if (run.employeeCount) summary += `  Employees: ${run.employeeCount}\n`;
        if (run.createdBy) summary += `\nCreated by: ${run.createdBy}\n`;
        if (run.approvedBy) summary += `Approved by: ${run.approvedBy}\n`;

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching payroll run", error);
      }
    },
  });

  api.registerTool({
    name: "get_payroll_payslips",
    description: "Get all payslips for a specific payroll run period.",
    parameters: Type.Object({
      period: Type.String({ description: "Payroll period in YYYYMM format" }),
    }),
    async execute(_id, params) {
      try {
        const data = await callApi(`/payroll/runs/${params.period}/payslips`);

        if (!data.success || data.payslips.length === 0) {
          return textResult(`No payslips found for period ${params.period}.`);
        }

        let summary = `**Payslips for ${params.period}** (${data.count})\n\n`;
        for (const slip of data.payslips) {
          const name = slip.employeeName || slip.id;
          summary += `• **${name}**`;
          if (slip.netPay) summary += ` — Net: ${fmtMoney(slip.netPay)}`;
          if (slip.totalGrossPay) summary += ` (Gross: ${fmtMoney(slip.totalGrossPay)})`;
          summary += `\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching payslips", error);
      }
    },
  });

  api.registerTool({
    name: "get_payroll_summary",
    description:
      "Get a high-level payroll summary including the latest run status and key financial totals.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const data = await callApi("/payroll/runs?limit=3");

        if (!data.success || data.runs.length === 0) {
          return textResult("No payroll data available yet.");
        }

        const latest = data.runs[0];
        let summary = `**Payroll Summary**\n\n`;
        summary += `**Latest Run:** ${latest.id} — ${latest.status}\n`;
        if (latest.totalNetPay) summary += `Net Pay: ${fmtMoney(latest.totalNetPay)}\n`;
        if (latest.totalGrossPay) summary += `Gross Pay: ${fmtMoney(latest.totalGrossPay)}\n`;
        if (latest.employeeCount) summary += `Employees: ${latest.employeeCount}\n`;

        if (data.runs.length > 1) {
          summary += `\n**Previous Runs:**\n`;
          for (const run of data.runs.slice(1)) {
            summary += `  • ${run.id} — ${run.status} — Net: ${fmtMoney(run.totalNetPay || 0)}\n`;
          }
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching payroll summary", error);
      }
    },
  });

  // ============================================================================
  // LEAVE TOOLS (5)
  // ============================================================================

  api.registerTool({
    name: "get_pending_leave_requests",
    description: "Get all pending leave requests that need approval.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const data = await callApi("/leave/pending");

        if (!data.success || data.requests.length === 0) {
          return textResult("No pending leave requests.");
        }

        let summary = `**Pending Leave Requests** (${data.count})\n\n`;
        for (const req of data.requests) {
          summary += `• **${req.employeeName || req.employeeId}** — ${req.leaveType}\n`;
          summary += `  ${req.startDate} to ${req.endDate}`;
          if (req.totalDays || req.days) summary += ` (${req.totalDays || req.days} days)`;
          summary += `\n`;
          if (req.reason) summary += `  Reason: ${req.reason}\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching pending leave", error);
      }
    },
  });

  api.registerTool({
    name: "get_leave_balances",
    description: "Get leave balances for all employees for the current year.",
    parameters: Type.Object({
      year: Type.Optional(Type.String({ description: "Year (default: current year)" })),
    }),
    async execute(_id, params) {
      try {
        const qs = params.year ? `?year=${params.year}` : "";
        const data = await callApi(`/leave/balances${qs}`);

        if (!data.success || data.balances.length === 0) {
          return textResult(`No leave balance data for ${data.year || "current year"}.`);
        }

        let summary = `**Leave Balances** (${data.count} employees, ${data.year})\n\n`;
        for (const bal of data.balances.slice(0, 20)) {
          const name = bal.employeeName || bal.id;
          summary += `**${name}**\n`;
          if (bal.balances) {
            for (const [type, info] of Object.entries(bal.balances) as any[]) {
              if (info && typeof info === "object") {
                summary += `  ${type}: ${info.remaining ?? "?"} remaining / ${info.entitled ?? "?"} entitled\n`;
              }
            }
          }
        }

        if (data.balances.length > 20) {
          summary += `\n_...and ${data.balances.length - 20} more employees_`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching leave balances", error);
      }
    },
  });

  api.registerTool({
    name: "get_leave_stats",
    description: "Get leave request statistics including counts by status.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const [pending, all] = await Promise.all([
          callApi("/leave/pending"),
          callApi("/leave/requests?limit=200"),
        ]);

        const requests = all.requests || [];
        const byStatus: Record<string, number> = {};
        const byType: Record<string, number> = {};

        for (const req of requests) {
          byStatus[req.status] = (byStatus[req.status] || 0) + 1;
          byType[req.leaveType] = (byType[req.leaveType] || 0) + 1;
        }

        let summary = `**Leave Statistics**\n\n`;
        summary += `**By Status:**\n`;
        for (const [status, count] of Object.entries(byStatus)) {
          const icon =
            status === "pending"
              ? "🟡"
              : status === "approved"
                ? "🟢"
                : status === "rejected"
                  ? "🔴"
                  : "⚪";
          summary += `  ${icon} ${status}: ${count}\n`;
        }
        summary += `\n**By Type:**\n`;
        for (const [type, count] of Object.entries(byType)) {
          summary += `  • ${type}: ${count}\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching leave stats", error);
      }
    },
  });

  api.registerTool({
    name: "get_employees_on_leave_today",
    description: "Get a list of employees who are on approved leave today.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const data = await callApi("/leave/on-leave-today");

        if (!data.success || data.count === 0) {
          return textResult(`No employees on leave today (${data.date}).`);
        }

        let summary = `**On Leave Today** (${data.date}) — ${data.count} employee(s)\n\n`;
        for (const emp of data.employees) {
          summary += `• **${emp.employeeName || emp.employeeId}** — ${emp.leaveType}\n`;
          summary += `  ${emp.startDate} to ${emp.endDate}`;
          if (emp.days) summary += ` (${emp.days} days)`;
          summary += `\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching on-leave data", error);
      }
    },
  });

  api.registerTool({
    name: "get_employee_leave",
    description: "Get leave requests for a specific employee.",
    parameters: Type.Object({
      employeeId: Type.String({ description: "The employee ID" }),
    }),
    async execute(_id, params) {
      try {
        const data = await callApi(
          `/leave/requests?employeeId=${encodeURIComponent(params.employeeId)}`
        );

        if (!data.success || data.requests.length === 0) {
          return textResult("No leave requests found for this employee.");
        }

        let summary = `**Leave Requests** (${data.count})\n\n`;
        for (const req of data.requests) {
          const icon =
            req.status === "pending"
              ? "🟡"
              : req.status === "approved"
                ? "🟢"
                : "🔴";
          summary += `${icon} **${req.leaveType}** — ${req.status}\n`;
          summary += `  ${req.startDate} to ${req.endDate}`;
          if (req.totalDays || req.days) summary += ` (${req.totalDays || req.days} days)`;
          summary += `\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching employee leave", error);
      }
    },
  });

  // ============================================================================
  // ATTENDANCE TOOLS (2)
  // ============================================================================

  api.registerTool({
    name: "get_daily_attendance",
    description: "Get the attendance report for a specific date.",
    parameters: Type.Object({
      date: Type.Optional(
        Type.String({ description: "Date in YYYY-MM-DD format (default: today)" })
      ),
    }),
    async execute(_id, params) {
      try {
        const qs = params.date ? `?date=${params.date}` : "";
        const data = await callApi(`/attendance/daily${qs}`);

        if (!data.success || data.count === 0) {
          return textResult(`No attendance records for ${data.date}.`);
        }

        let summary = `**Attendance Report** (${data.date}) — ${data.count} records\n\n`;
        for (const rec of data.records) {
          const name = rec.employeeName || rec.employeeId || rec.id;
          summary += `• **${name}**`;
          if (rec.clockIn) summary += ` — In: ${rec.clockIn}`;
          if (rec.clockOut) summary += `, Out: ${rec.clockOut}`;
          if (rec.totalHours) summary += ` (${rec.totalHours}h)`;
          summary += `\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching attendance", error);
      }
    },
  });

  api.registerTool({
    name: "get_attendance_summary",
    description: "Get a summary of today's attendance status.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const [attendance, empCounts, onLeave] = await Promise.all([
          callApi("/attendance/daily"),
          callApi("/employees/counts"),
          callApi("/leave/on-leave-today"),
        ]);

        const totalActive = empCounts.counts?.active || 0;
        const present = attendance.count || 0;
        const absent = totalActive - present - (onLeave.count || 0);

        const summary =
          `**Attendance Summary** (${attendance.date})\n\n` +
          `👥 Active Employees: ${totalActive}\n` +
          `✅ Present: ${present}\n` +
          `🏖️ On Leave: ${onLeave.count || 0}\n` +
          `❓ Unaccounted: ${Math.max(0, absent)}\n`;

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching attendance summary", error);
      }
    },
  });

  // ============================================================================
  // RECRUITMENT TOOLS (4)
  // ============================================================================

  api.registerTool({
    name: "get_open_jobs",
    description: "Get all open job positions that are currently accepting applications.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const data = await callApi("/jobs/open");

        if (!data.success || data.jobs.length === 0) {
          return textResult("No open job positions.");
        }

        let summary = `**Open Positions** (${data.count})\n\n`;
        for (const job of data.jobs) {
          summary += `• **${job.title || job.name}**\n`;
          if (job.department) summary += `  Department: ${job.department}\n`;
          if (job.location) summary += `  Location: ${job.location}\n`;
          if (job.applicantCount !== undefined) summary += `  Applicants: ${job.applicantCount}\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching open jobs", error);
      }
    },
  });

  api.registerTool({
    name: "get_today_interviews",
    description: "Get all interviews scheduled for today.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const data = await callApi("/interviews/today");

        if (!data.success || data.count === 0) {
          return textResult(`No interviews scheduled for today (${data.date}).`);
        }

        let summary = `**Today's Interviews** (${data.date}) — ${data.count}\n\n`;
        for (const int of data.interviews) {
          summary += `• **${int.candidateName || "Unknown"}**`;
          if (int.position || int.jobTitle) summary += ` for ${int.position || int.jobTitle}`;
          summary += `\n`;
          if (int.scheduledTime || int.time)
            summary += `  Time: ${int.scheduledTime || int.time}\n`;
          if (int.interviewerName) summary += `  Interviewer: ${int.interviewerName}\n`;
          if (int.type) summary += `  Type: ${int.type}\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching today's interviews", error);
      }
    },
  });

  api.registerTool({
    name: "get_upcoming_interviews",
    description: "Get interviews scheduled for the next 7 days.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const data = await callApi("/interviews/upcoming");

        if (!data.success || data.count === 0) {
          return textResult(`No upcoming interviews in the next 7 days.`);
        }

        let summary = `**Upcoming Interviews** (${data.from} to ${data.to}) — ${data.count}\n\n`;
        for (const int of data.interviews) {
          const date = (int.scheduledDate || int.date || "").split("T")[0];
          summary += `• **${date}** — ${int.candidateName || "Unknown"}`;
          if (int.position || int.jobTitle) summary += ` for ${int.position || int.jobTitle}`;
          summary += `\n`;
          if (int.scheduledTime || int.time)
            summary += `  Time: ${int.scheduledTime || int.time}\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching upcoming interviews", error);
      }
    },
  });

  api.registerTool({
    name: "get_candidates",
    description: "Get all job postings with their status.",
    parameters: Type.Object({
      status: Type.Optional(
        Type.String({ description: "Filter by job status: open, closed, draft" })
      ),
    }),
    async execute(_id, params) {
      try {
        const qs = params.status ? `?status=${params.status}` : "";
        const data = await callApi(`/jobs${qs}`);

        if (!data.success || data.jobs.length === 0) {
          return textResult("No job postings found.");
        }

        let summary = `**Job Postings** (${data.count})\n\n`;
        for (const job of data.jobs) {
          const icon =
            job.status === "open" ? "🟢" : job.status === "closed" ? "🔴" : "📝";
          summary += `${icon} **${job.title || job.name}** — ${job.status}\n`;
          if (job.department) summary += `  Department: ${job.department}\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching job postings", error);
      }
    },
  });

  // ============================================================================
  // FINANCE TOOLS (5)
  // ============================================================================

  api.registerTool({
    name: "get_overdue_invoices",
    description: "Get all overdue invoices (accounts receivable) with total overdue amount.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const data = await callApi("/invoices/overdue");

        if (!data.success || data.count === 0) {
          return textResult("No overdue invoices. All receivables are current.");
        }

        let summary = `**Overdue Invoices** (${data.count}) — Total: ${fmtMoney(data.totalOverdue)}\n\n`;
        for (const inv of data.invoices) {
          summary += `• **${inv.invoiceNumber || inv.id}** — ${inv.customerName || "Unknown"}\n`;
          summary += `  Due: ${inv.dueDate} — Balance: ${fmtMoney(inv.balanceDue || inv.total)}\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching overdue invoices", error);
      }
    },
  });

  api.registerTool({
    name: "get_overdue_bills",
    description: "Get all overdue bills (accounts payable) with total overdue amount.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const data = await callApi("/bills/overdue");

        if (!data.success || data.count === 0) {
          return textResult("No overdue bills. All payables are current.");
        }

        let summary = `**Overdue Bills** (${data.count}) — Total: ${fmtMoney(data.totalOverdue)}\n\n`;
        for (const bill of data.bills) {
          summary += `• **${bill.billNumber || bill.id}** — ${bill.vendorName || "Unknown"}\n`;
          summary += `  Due: ${bill.dueDate} — Balance: ${fmtMoney(bill.balanceDue || bill.total)}\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching overdue bills", error);
      }
    },
  });

  api.registerTool({
    name: "get_expenses_this_month",
    description: "Get expenses for the current month grouped by category with totals.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const data = await callApi("/expenses/this-month");

        if (!data.success || data.count === 0) {
          return textResult("No expenses recorded this month.");
        }

        let summary = `**Expenses This Month** (${data.period.start} to ${data.period.end})\n\n`;
        summary += `**Total:** ${fmtMoney(data.total)}\n\n`;

        if (data.byCategory) {
          summary += `**By Category:**\n`;
          for (const [cat, info] of Object.entries(data.byCategory) as any[]) {
            summary += `  • ${cat}: ${fmtMoney(info.total)} (${info.count} items)\n`;
          }
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching monthly expenses", error);
      }
    },
  });

  api.registerTool({
    name: "get_invoices_by_status",
    description: "Get invoices filtered by status (draft, sent, viewed, paid, partial, overdue).",
    parameters: Type.Object({
      status: Type.String({
        description: "Invoice status: draft, sent, viewed, paid, partial, overdue, cancelled",
      }),
    }),
    async execute(_id, params) {
      try {
        const data = await callApi(`/invoices?status=${encodeURIComponent(params.status)}`);

        if (!data.success || data.invoices.length === 0) {
          return textResult(`No invoices with status "${params.status}".`);
        }

        let summary = `**Invoices — ${params.status}** (${data.count})\n\n`;
        for (const inv of data.invoices) {
          summary += `• **${inv.invoiceNumber || inv.id}** — ${inv.customerName || "Unknown"}\n`;
          summary += `  Total: ${fmtMoney(inv.total)}`;
          if (inv.balanceDue && inv.balanceDue !== inv.total)
            summary += ` (Balance: ${fmtMoney(inv.balanceDue)})`;
          if (inv.dueDate) summary += ` — Due: ${inv.dueDate}`;
          summary += `\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching invoices", error);
      }
    },
  });

  api.registerTool({
    name: "get_financial_summary",
    description:
      "Get a financial overview including overdue receivables, overdue payables, and monthly expenses.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const [invoices, bills, expenses] = await Promise.all([
          callApi("/invoices/overdue"),
          callApi("/bills/overdue"),
          callApi("/expenses/this-month"),
        ]);

        let summary = `**Financial Summary**\n\n`;
        summary += `**Accounts Receivable:**\n`;
        summary += `  Overdue Invoices: ${invoices.count || 0}\n`;
        summary += `  Total Overdue: ${fmtMoney(invoices.totalOverdue || 0)}\n\n`;
        summary += `**Accounts Payable:**\n`;
        summary += `  Overdue Bills: ${bills.count || 0}\n`;
        summary += `  Total Overdue: ${fmtMoney(bills.totalOverdue || 0)}\n\n`;
        summary += `**Monthly Expenses:**\n`;
        summary += `  This Month: ${fmtMoney(expenses.total || 0)} (${expenses.count || 0} items)\n`;

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching financial summary", error);
      }
    },
  });

  // ============================================================================
  // OVERVIEW TOOL (1)
  // ============================================================================

  api.registerTool({
    name: "get_company_overview",
    description:
      "Get a comprehensive company overview including employee headcount, pending leave, open recruitment, payroll status, and financial health. This is the best tool to get a quick snapshot of the entire organization.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const data = await callApi("/stats");

        if (!data.success) {
          return textResult("Failed to fetch company overview.");
        }

        const s = data.stats;
        let summary = `**Company Overview** (${s.date})\n\n`;

        // Employees
        summary += `👥 **Employees:**\n`;
        summary += `  Total: ${s.employees.total} | Active: ${s.employees.active}`;
        if (s.employees.probation) summary += ` | Probation: ${s.employees.probation}`;
        summary += `\n\n`;

        // Leave
        summary += `🏖️ **Leave:**\n`;
        summary += `  Pending Requests: ${s.leave.pendingRequests}\n`;
        summary += `  On Leave Today: ${s.leave.onLeaveToday}\n`;
        if (s.leave.onLeaveDetails?.length) {
          for (const emp of s.leave.onLeaveDetails) {
            summary += `    • ${emp.employeeName} (${emp.leaveType})\n`;
          }
        }
        summary += `\n`;

        // Recruitment
        summary += `📋 **Recruitment:**\n`;
        summary += `  Open Positions: ${s.recruitment.openJobs}\n`;
        summary += `  Interviews Today: ${s.recruitment.interviewsToday}\n`;
        if (s.recruitment.interviewDetails?.length) {
          for (const int of s.recruitment.interviewDetails) {
            summary += `    • ${int.candidateName} for ${int.position}`;
            if (int.time) summary += ` at ${int.time}`;
            summary += `\n`;
          }
        }
        summary += `\n`;

        // Finance
        summary += `💰 **Finance:**\n`;
        summary += `  Overdue Invoices: ${s.finance.overdueInvoices} (${fmtMoney(s.finance.totalOverdueAR)})\n`;
        summary += `  Overdue Bills: ${s.finance.overdueBills} (${fmtMoney(s.finance.totalOverdueAP)})\n`;
        summary += `  Monthly Expenses: ${fmtMoney(s.finance.monthlyExpenses)}\n\n`;

        // Payroll
        if (s.payroll) {
          summary += `💵 **Latest Payroll** (${s.payroll.period}):\n`;
          summary += `  Status: ${s.payroll.status}\n`;
          summary += `  Net Pay: ${fmtMoney(s.payroll.totalNetPay)}\n`;
          summary += `  Employees: ${s.payroll.employeeCount}\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching company overview", error);
      }
    },
  });

  // ============================================================================
  // DEPARTMENT TOOLS (2)
  // ============================================================================

  api.registerTool({
    name: "list_departments",
    description: "List all departments in the organization.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const data = await callApi("/departments");

        if (!data.success || data.departments.length === 0) {
          return textResult("No departments found.");
        }

        let summary = `**Departments** (${data.count})\n\n`;
        for (const dept of data.departments) {
          summary += `• **${dept.name}**`;
          if (dept.head || dept.manager) summary += ` — Head: ${dept.head || dept.manager}`;
          summary += `\n`;
          if (dept.description) summary += `  ${dept.description}\n`;
        }

        return textResult(summary);
      } catch (error: any) {
        return errorResult("listing departments", error);
      }
    },
  });

  api.registerTool({
    name: "get_department_headcount",
    description: "Get employee headcount by department.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const data = await callApi("/employees/by-department");

        if (!data.success || data.departments.length === 0) {
          return textResult("No department headcount data available.");
        }

        let summary = `**Department Headcount**\n\n`;
        let totalCount = 0;
        for (const dept of data.departments) {
          summary += `• **${dept.name}**: ${dept.count} employees\n`;
          totalCount += dept.count;
        }
        summary += `\n**Total Active:** ${totalCount}`;

        return textResult(summary);
      } catch (error: any) {
        return errorResult("fetching department headcount", error);
      }
    },
  });

  // ============================================================================
  // WRITE TOOLS — Payroll (6)
  // ============================================================================

  api.registerTool({
    name: "calculate_payroll",
    description:
      "Calculate payroll for a period WITHOUT posting. Returns summary and per-employee breakdown with warnings. Use this first, then confirm with the user before calling run_payroll.",
    parameters: Type.Object({
      periodStart: Type.String({ description: "Period start date (YYYY-MM-DD)" }),
      periodEnd: Type.String({ description: "Period end date (YYYY-MM-DD)" }),
      payDate: Type.String({ description: "Pay date (YYYY-MM-DD)" }),
      payFrequency: Type.Optional(
        Type.String({ description: "monthly (default), biweekly, weekly" })
      ),
    }),
    async execute(_id, params) {
      try {
        const result = await callApi("/payroll/calculate", {
          method: "POST",
          body: params,
        });

        let text = `**Payroll Calculation — ${params.periodStart} to ${params.periodEnd}**\n\n`;
        text += `| | Amount |\n|---|---:|\n`;
        text += `| Employees | ${result.summary.employeeCount} |\n`;
        text += `| Gross Pay | ${fmtMoney(result.summary.totalGross)} |\n`;
        text += `| WIT (Income Tax) | ${fmtMoney(result.summary.totalWIT)} |\n`;
        text += `| INSS (Employee 4%) | ${fmtMoney(result.summary.totalINSSEmployee)} |\n`;
        text += `| INSS (Employer 6%) | ${fmtMoney(result.summary.totalINSSEmployer)} |\n`;
        text += `| Net Pay | ${fmtMoney(result.summary.totalNet)} |\n\n`;

        if (result.warnings?.length) {
          text += `**Warnings:**\n`;
          result.warnings.forEach((w: string) => {
            text += `- ${w}\n`;
          });
          text += "\n";
        }

        // Compact per-employee table (top 10)
        const top = result.records.slice(0, 10);
        if (top.length > 0) {
          text += `**Per Employee (top ${top.length}/${result.records.length}):**\n`;
          text += `| Employee | Gross | WIT | INSS | Net |\n|---|---:|---:|---:|---:|\n`;
          for (const r of top) {
            text += `| ${r.employeeName} | ${fmtMoney(r.grossPay)} | ${fmtMoney(r.witAmount)} | ${fmtMoney(r.inssEmployee)} | ${fmtMoney(r.netPay)} |\n`;
          }
          text += "\n";
        }

        text += `Say **"confirm"** to create this payroll run, or ask me to adjust.`;
        return textResult(text);
      } catch (error: any) {
        return errorResult("calculating payroll", error);
      }
    },
  });

  api.registerTool({
    name: "run_payroll",
    description:
      "Post a calculated payroll run to the system. Creates payroll records and run entry. Only call AFTER calculate_payroll and user confirmation.",
    parameters: Type.Object({
      periodStart: Type.String({ description: "Period start date" }),
      periodEnd: Type.String({ description: "Period end date" }),
      payDate: Type.String({ description: "Pay date" }),
      payFrequency: Type.Optional(Type.String({ description: "monthly, biweekly, weekly" })),
      createdBy: Type.String({ description: "Email of the person authorizing" }),
    }),
    async execute(_id, params) {
      try {
        // First calculate to get the records
        const calc = await callApi("/payroll/calculate", {
          method: "POST",
          body: {
            periodStart: params.periodStart,
            periodEnd: params.periodEnd,
            payDate: params.payDate,
            payFrequency: params.payFrequency || "monthly",
          },
        });

        if (!calc.records?.length) {
          return textResult("No employees to process. Check that employees have salary configured.");
        }

        // Build payroll run and records for storage
        const payrollRun = {
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
          payDate: params.payDate,
          payFrequency: params.payFrequency || "monthly",
          totalGrossPay: calc.summary.totalGross,
          totalNetPay: calc.summary.totalNet,
          totalDeductions: calc.summary.totalGross - calc.summary.totalNet,
          totalEmployerTaxes: calc.summary.totalINSSEmployer,
          employeeCount: calc.summary.employeeCount,
        };

        const records = calc.records.map((r: any) => ({
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          employeeNumber: r.employeeNumber,
          department: r.department,
          position: r.position,
          totalGrossPay: r.grossPay,
          netPay: r.netPay,
          totalDeductions: r.totalDeductions,
          earnings: [
            { type: "regular", description: "Base Salary", amount: r.grossPay, isTaxable: true, isINSSBase: true },
          ],
          deductions: [
            { type: "income_tax", description: "WIT (10%)", amount: r.witAmount, isPreTax: false, isPercentage: true, percentage: 10 },
            { type: "inss_employee", description: "INSS Employee (4%)", amount: r.inssEmployee, isPreTax: false, isPercentage: true, percentage: 4 },
            ...r.deductionLines,
          ],
          employerTaxes: [
            { type: "inss_employer", description: "INSS Employer (6%)", amount: r.inssEmployer },
          ],
          totalEmployerTaxes: r.inssEmployer,
        }));

        const result = await callApi("/payroll/runs", {
          method: "POST",
          body: { payrollRun, records, createdBy: params.createdBy },
        });

        let text = `Payroll run created (ID: ${result.runId})\n`;
        text += `- ${result.recordIds.length} employee records written\n`;
        text += `- Status: ${result.status} (needs approval)\n`;
        text += `- Total net pay: ${fmtMoney(calc.summary.totalNet)}\n`;
        return textResult(text);
      } catch (error: any) {
        return errorResult("creating payroll run", error);
      }
    },
  });

  api.registerTool({
    name: "approve_payroll",
    description:
      "Approve a payroll run. The approver must be a different person than the creator (two-person rule).",
    parameters: Type.Object({
      runId: Type.String({ description: "Payroll run ID" }),
      approvedBy: Type.String({ description: "Email of the approver (must differ from creator)" }),
    }),
    async execute(_id, params) {
      try {
        await callApi(`/payroll/runs/${params.runId}/approve`, {
          method: "PUT",
          body: { approvedBy: params.approvedBy },
        });
        return textResult(`Payroll run ${params.runId} approved by ${params.approvedBy}.`);
      } catch (error: any) {
        return errorResult("approving payroll", error);
      }
    },
  });

  api.registerTool({
    name: "reject_payroll",
    description: "Reject a payroll run. Requires a reason.",
    parameters: Type.Object({
      runId: Type.String({ description: "Payroll run ID" }),
      rejectedBy: Type.String({ description: "Email of the person rejecting" }),
      reason: Type.String({ description: "Reason for rejection" }),
    }),
    async execute(_id, params) {
      try {
        await callApi(`/payroll/runs/${params.runId}/reject`, {
          method: "PUT",
          body: { rejectedBy: params.rejectedBy, reason: params.reason },
        });
        return textResult(`Payroll run ${params.runId} rejected: ${params.reason}`);
      } catch (error: any) {
        return errorResult("rejecting payroll", error);
      }
    },
  });

  api.registerTool({
    name: "mark_payroll_paid",
    description: "Mark an approved payroll run as paid.",
    parameters: Type.Object({
      runId: Type.String({ description: "Payroll run ID" }),
    }),
    async execute(_id, params) {
      try {
        await callApi(`/payroll/runs/${params.runId}/mark-paid`, {
          method: "PUT",
          body: {},
        });
        return textResult(`Payroll run ${params.runId} marked as paid.`);
      } catch (error: any) {
        return errorResult("marking payroll as paid", error);
      }
    },
  });

  api.registerTool({
    name: "repair_payroll_run",
    description:
      "Repair a stuck payroll run (status: writing_records). Checks how many records were written and either finalizes or deletes the run.",
    parameters: Type.Object({
      runId: Type.String({ description: "Payroll run ID that is stuck" }),
    }),
    async execute(_id, params) {
      try {
        const result = await callApi(`/payroll/runs/${params.runId}/repair`, {
          method: "POST",
          body: {},
        });
        return textResult(`Repair result: ${result.message}`);
      } catch (error: any) {
        return errorResult("repairing payroll run", error);
      }
    },
  });

  // ============================================================================
  // READ TOOLS — Accounting Reports (3)
  // ============================================================================

  api.registerTool({
    name: "get_trial_balance",
    description:
      "Get the trial balance report showing all account balances (debits and credits). Optionally specify an as-of date.",
    parameters: Type.Object({
      asOf: Type.Optional(Type.String({ description: "As-of date in YYYY-MM-DD format (defaults to today)" })),
    }),
    async execute(_id, params) {
      try {
        const qp = params.asOf ? `?asOf=${params.asOf}` : "";
        const rows = await callApi(`/trial-balance${qp}`);

        if (!Array.isArray(rows) || rows.length === 0) {
          return textResult("No trial balance data found. The general ledger may be empty.");
        }

        let totalDebit = 0, totalCredit = 0;
        let text = `**Trial Balance**${params.asOf ? ` (as of ${params.asOf})` : ""}\n\n`;
        text += `| Account | Type | Debit | Credit |\n`;
        text += `|---------|------|------:|-------:|\n`;

        for (const row of rows) {
          const debit = row.debit || 0;
          const credit = row.credit || 0;
          totalDebit += debit;
          totalCredit += credit;
          text += `| ${row.accountCode} ${row.accountName} | ${row.accountType} | ${fmtMoney(debit)} | ${fmtMoney(credit)} |\n`;
        }

        text += `\n**Totals:** Debit ${fmtMoney(totalDebit)} | Credit ${fmtMoney(totalCredit)}`;
        const diff = Math.abs(totalDebit - totalCredit);
        text += diff < 0.01 ? ` — **Balanced**` : ` — **IMBALANCED** (diff: ${fmtMoney(diff)})`;

        return textResult(text);
      } catch (error: any) {
        return errorResult("fetching trial balance", error);
      }
    },
  });

  api.registerTool({
    name: "get_income_statement",
    description:
      "Get the Profit & Loss (income statement) report for a date range. Shows revenue, expenses, and net profit. Defaults to current month if no dates provided.",
    parameters: Type.Object({
      start: Type.Optional(Type.String({ description: "Period start date YYYY-MM-DD (defaults to 1st of current month)" })),
      end: Type.Optional(Type.String({ description: "Period end date YYYY-MM-DD (defaults to end of current month)" })),
    }),
    async execute(_id, params) {
      try {
        const qp: string[] = [];
        if (params.start) qp.push(`start=${params.start}`);
        if (params.end) qp.push(`end=${params.end}`);
        const qs = qp.length ? `?${qp.join("&")}` : "";
        const result = await callApi(`/reports/pnl${qs}`);

        let text = `**Income Statement** (${result.periodStart} to ${result.periodEnd})\n\n`;

        text += `**Revenue:**\n`;
        for (const line of (result.revenue?.lines || [])) {
          text += `  ${line.accountCode} ${line.accountName}: ${fmtMoney(line.amount)}\n`;
        }
        text += `  **Total Revenue: ${fmtMoney(result.revenue?.total || 0)}**\n\n`;

        text += `**Expenses:**\n`;
        for (const line of (result.expenses?.lines || [])) {
          text += `  ${line.accountCode} ${line.accountName}: ${fmtMoney(line.amount)}\n`;
        }
        text += `  **Total Expenses: ${fmtMoney(result.expenses?.total || 0)}**\n\n`;

        const netProfit = result.netProfit || 0;
        text += `**${netProfit >= 0 ? "Net Profit" : "Net Loss"}: ${fmtMoney(netProfit)}**`;

        return textResult(text);
      } catch (error: any) {
        return errorResult("fetching income statement", error);
      }
    },
  });

  api.registerTool({
    name: "get_balance_sheet",
    description:
      "Get the balance sheet report showing assets, liabilities, and equity. Optionally specify an as-of date.",
    parameters: Type.Object({
      asOf: Type.Optional(Type.String({ description: "As-of date in YYYY-MM-DD format (defaults to today)" })),
    }),
    async execute(_id, params) {
      try {
        const qp = params.asOf ? `?asOf=${params.asOf}` : "";
        const result = await callApi(`/reports/balance-sheet${qp}`);

        let text = `**Balance Sheet** (as of ${result.asOf})\n\n`;

        text += `**Assets:**\n`;
        for (const line of (result.assets?.lines || [])) {
          text += `  ${line.accountCode} ${line.accountName}: ${fmtMoney(line.amount)}\n`;
        }
        text += `  **Total Assets: ${fmtMoney(result.assets?.total || 0)}**\n\n`;

        text += `**Liabilities:**\n`;
        for (const line of (result.liabilities?.lines || [])) {
          text += `  ${line.accountCode} ${line.accountName}: ${fmtMoney(line.amount)}\n`;
        }
        text += `  **Total Liabilities: ${fmtMoney(result.liabilities?.total || 0)}**\n\n`;

        text += `**Equity:**\n`;
        for (const line of (result.equity?.lines || [])) {
          text += `  ${line.accountCode} ${line.accountName}: ${fmtMoney(line.amount)}\n`;
        }
        text += `  **Total Equity: ${fmtMoney(result.equity?.total || 0)}**\n\n`;

        const totalLE = (result.liabilities?.total || 0) + (result.equity?.total || 0);
        const balanced = Math.abs((result.assets?.total || 0) - totalLE) < 0.01;
        text += balanced ? `Assets = Liabilities + Equity — **Balanced**` : `**IMBALANCED** — Assets ≠ Liabilities + Equity`;

        return textResult(text);
      } catch (error: any) {
        return errorResult("fetching balance sheet", error);
      }
    },
  });

  // ============================================================================
  // WRITE TOOLS — Accounting (3)
  // ============================================================================

  api.registerTool({
    name: "create_journal_entry",
    description:
      "Create a manual journal entry. Debits must equal credits. Can be created as draft or posted.",
    parameters: Type.Object({
      date: Type.String({ description: "Entry date (YYYY-MM-DD)" }),
      description: Type.String({ description: "What this entry is for" }),
      lines: Type.Array(
        Type.Object({
          accountId: Type.String({ description: "Account ID from chart of accounts" }),
          accountCode: Type.String({ description: "Account code (e.g., 1010)" }),
          accountName: Type.String({ description: "Account name (e.g., Cash)" }),
          debit: Type.Number({ description: "Debit amount (0 if credit)" }),
          credit: Type.Number({ description: "Credit amount (0 if debit)" }),
          description: Type.Optional(Type.String({ description: "Line description" })),
        })
      ),
      status: Type.Optional(
        Type.String({ description: "'draft' (default) or 'posted'" })
      ),
      createdBy: Type.String({ description: "Email of creator" }),
    }),
    async execute(_id, params) {
      try {
        const result = await callApi("/journal-entries", {
          method: "POST",
          body: { ...params, source: "manual" },
        });
        return textResult(
          `Journal entry created: ${result.entryNumber} (${result.status})`
        );
      } catch (error: any) {
        return errorResult("creating journal entry", error);
      }
    },
  });

  api.registerTool({
    name: "post_journal_entry",
    description:
      "Post a draft journal entry. This creates GL entries and makes the entry permanent.",
    parameters: Type.Object({
      entryId: Type.String({ description: "Journal entry ID" }),
      postedBy: Type.String({ description: "Email of person posting" }),
    }),
    async execute(_id, params) {
      try {
        const result = await callApi(`/journal-entries/${params.entryId}/post`, {
          method: "PUT",
          body: { postedBy: params.postedBy },
        });
        return textResult(`Journal entry ${result.entryNumber} posted.`);
      } catch (error: any) {
        return errorResult("posting journal entry", error);
      }
    },
  });

  api.registerTool({
    name: "void_journal_entry",
    description:
      "Void a posted journal entry. Creates reversing GL entries. Requires a reason.",
    parameters: Type.Object({
      entryId: Type.String({ description: "Journal entry ID" }),
      voidedBy: Type.String({ description: "Email of person voiding" }),
      reason: Type.String({ description: "Why this entry is being voided" }),
    }),
    async execute(_id, params) {
      try {
        await callApi(`/journal-entries/${params.entryId}/void`, {
          method: "PUT",
          body: { voidedBy: params.voidedBy, reason: params.reason },
        });
        return textResult(
          `Journal entry ${params.entryId} voided. Reversing entries created.`
        );
      } catch (error: any) {
        return errorResult("voiding journal entry", error);
      }
    },
  });

  // ============================================================================
  // WRITE TOOLS — Fiscal Periods (5)
  // ============================================================================

  api.registerTool({
    name: "create_fiscal_year",
    description: "Create a fiscal year with 12 monthly periods.",
    parameters: Type.Object({
      year: Type.Number({ description: "The fiscal year (e.g., 2026)" }),
      createdBy: Type.Optional(Type.String({ description: "Email of creator" })),
    }),
    async execute(_id, params) {
      try {
        const result = await callApi("/fiscal-years", {
          method: "POST",
          body: params,
        });
        return textResult(
          `Fiscal year ${result.year} created with ${result.periodIds.length} periods.`
        );
      } catch (error: any) {
        return errorResult("creating fiscal year", error);
      }
    },
  });

  api.registerTool({
    name: "close_fiscal_period",
    description:
      "Close a fiscal period. No new entries can be posted to closed periods.",
    parameters: Type.Object({
      periodId: Type.String({ description: "Fiscal period ID" }),
      closedBy: Type.String({ description: "Email of person closing" }),
    }),
    async execute(_id, params) {
      try {
        const result = await callApi(`/fiscal-periods/${params.periodId}/close`, {
          method: "PUT",
          body: { closedBy: params.closedBy },
        });
        return textResult(result.message);
      } catch (error: any) {
        return errorResult("closing fiscal period", error);
      }
    },
  });

  api.registerTool({
    name: "reopen_fiscal_period",
    description:
      "Reopen a closed fiscal period. Cannot reopen locked periods.",
    parameters: Type.Object({
      periodId: Type.String({ description: "Fiscal period ID" }),
      reopenedBy: Type.String({ description: "Email of person reopening" }),
    }),
    async execute(_id, params) {
      try {
        const result = await callApi(`/fiscal-periods/${params.periodId}/reopen`, {
          method: "PUT",
          body: { reopenedBy: params.reopenedBy },
        });
        return textResult(result.message);
      } catch (error: any) {
        return errorResult("reopening fiscal period", error);
      }
    },
  });

  api.registerTool({
    name: "lock_fiscal_period",
    description:
      "Lock a fiscal period permanently. Must be closed first. Cannot be unlocked.",
    parameters: Type.Object({
      periodId: Type.String({ description: "Fiscal period ID" }),
      lockedBy: Type.String({ description: "Email of person locking" }),
    }),
    async execute(_id, params) {
      try {
        const result = await callApi(`/fiscal-periods/${params.periodId}/lock`, {
          method: "PUT",
          body: { lockedBy: params.lockedBy },
        });
        return textResult(result.message);
      } catch (error: any) {
        return errorResult("locking fiscal period", error);
      }
    },
  });

  api.registerTool({
    name: "post_opening_balances",
    description:
      "Post opening balances for a fiscal year. Creates a journal entry with opening balance GL entries.",
    parameters: Type.Object({
      yearId: Type.String({ description: "Fiscal year document ID" }),
      lines: Type.Array(
        Type.Object({
          accountId: Type.String(),
          accountCode: Type.String(),
          accountName: Type.String(),
          debit: Type.Number(),
          credit: Type.Number(),
        })
      ),
      createdBy: Type.Optional(Type.String({ description: "Email of creator" })),
    }),
    async execute(_id, params) {
      try {
        const result = await callApi(
          `/fiscal-years/${params.yearId}/opening-balances`,
          {
            method: "POST",
            body: { lines: params.lines, createdBy: params.createdBy },
          }
        );
        return textResult(
          `Opening balances posted: ${result.entryNumber}`
        );
      } catch (error: any) {
        return errorResult("posting opening balances", error);
      }
    },
  });

  // ============================================================================
  // WRITE TOOLS — Leave Management (2)
  // ============================================================================

  api.registerTool({
    name: "approve_leave",
    description: "Approve a pending leave request.",
    parameters: Type.Object({
      requestId: Type.String({ description: "Leave request ID" }),
      approvedBy: Type.String({ description: "Email/ID of the approver" }),
      approverName: Type.Optional(Type.String({ description: "Name of the approver" })),
    }),
    async execute(_id, params) {
      try {
        await callApi(`/leave/requests/${params.requestId}/approve`, {
          method: "PUT",
          body: {
            approvedBy: params.approvedBy,
            approverName: params.approverName || params.approvedBy,
          },
        });
        return textResult(`Leave request ${params.requestId} approved.`);
      } catch (error: any) {
        return errorResult("approving leave request", error);
      }
    },
  });

  api.registerTool({
    name: "reject_leave",
    description: "Reject a pending leave request. Requires a reason.",
    parameters: Type.Object({
      requestId: Type.String({ description: "Leave request ID" }),
      rejectedBy: Type.String({ description: "Email/ID of the person rejecting" }),
      reason: Type.String({ description: "Reason for rejection" }),
    }),
    async execute(_id, params) {
      try {
        await callApi(`/leave/requests/${params.requestId}/reject`, {
          method: "PUT",
          body: { rejectedBy: params.rejectedBy, reason: params.reason },
        });
        return textResult(
          `Leave request ${params.requestId} rejected: ${params.reason}`
        );
      } catch (error: any) {
        return errorResult("rejecting leave request", error);
      }
    },
  });

  // ============================================================================
  // VERIFICATION TOOLS (3)
  // ============================================================================

  api.registerTool({
    name: "verify_payroll",
    description:
      "Verify a payroll run: checks record count, totals match, tax math is correct. Use after run_payroll to self-audit.",
    parameters: Type.Object({
      runId: Type.String({ description: "Payroll run ID to verify" }),
    }),
    async execute(_id, params) {
      try {
        const result = await callApi(`/verify/payroll/${params.runId}`);

        let text = `**Payroll Verification — ${params.runId}**\n`;
        text += `Status: ${result.status} | Records: ${result.recordCount}\n`;
        text += `Totals: Gross ${fmtMoney(result.totals.gross)}, Net ${fmtMoney(result.totals.net)}\n\n`;

        if (result.passed) {
          text += `**PASSED** — No errors found.\n`;
        } else {
          text += `**FAILED** — Issues found:\n`;
        }

        if (result.issues?.length) {
          for (const issue of result.issues) {
            const icon = issue.severity === "error" ? "ERROR" : "WARN";
            text += `- [${icon}] ${issue.message}\n`;
          }
        }

        return textResult(text);
      } catch (error: any) {
        return errorResult("verifying payroll", error);
      }
    },
  });

  api.registerTool({
    name: "verify_trial_balance",
    description:
      "Check that the trial balance balances (total debits == total credits). Optionally filter by year and period.",
    parameters: Type.Object({
      year: Type.Optional(Type.Number({ description: "Fiscal year to filter" })),
      period: Type.Optional(Type.Number({ description: "Fiscal period (1-12) to filter" })),
    }),
    async execute(_id, params) {
      try {
        let endpoint = "/verify/trial-balance";
        const qp: string[] = [];
        if (params.year) qp.push(`year=${params.year}`);
        if (params.period) qp.push(`period=${params.period}`);
        if (qp.length) endpoint += `?${qp.join("&")}`;

        const result = await callApi(endpoint);

        let text = `**Trial Balance Verification**\n`;
        text += `Total Debit: ${fmtMoney(result.totalDebit)} | Total Credit: ${fmtMoney(result.totalCredit)}\n`;
        text += `Difference: ${fmtMoney(result.difference)} | Accounts: ${result.accountCount} | GL Entries: ${result.glEntryCount}\n\n`;

        if (result.passed) {
          text += `**BALANCED** — Trial balance is correct.\n`;
        } else {
          text += `**IMBALANCED** — Trial balance does not balance!\n`;
          for (const issue of result.issues) {
            text += `- ${issue.message}\n`;
          }
        }

        return textResult(text);
      } catch (error: any) {
        return errorResult("verifying trial balance", error);
      }
    },
  });

  api.registerTool({
    name: "check_compliance",
    description:
      "Run compliance checks: missing tax IDs, salaries below minimum wage, missing INSS numbers, missing bank details, missing fiscal year setup.",
    parameters: Type.Object({}),
    async execute() {
      try {
        const result = await callApi("/verify/compliance");

        let text = `**Compliance Check**\n`;
        text += `Employees: ${result.summary.employees} | Errors: ${result.summary.errors} | Warnings: ${result.summary.warnings}\n\n`;

        if (result.passed) {
          text += `**PASSED** — No critical errors.\n`;
        } else {
          text += `**FAILED** — ${result.summary.errors} error(s) found.\n`;
        }

        if (result.issues?.length) {
          // Group by category
          const grouped: Record<string, any[]> = {};
          for (const issue of result.issues) {
            const cat = issue.category || "general";
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(issue);
          }
          for (const [cat, issues] of Object.entries(grouped)) {
            text += `\n**${cat.charAt(0).toUpperCase() + cat.slice(1)}:**\n`;
            for (const issue of issues) {
              const icon = issue.severity === "error" ? "ERROR" : issue.severity === "warning" ? "WARN" : "INFO";
              text += `- [${icon}] ${issue.message}\n`;
            }
          }
        }

        return textResult(text);
      } catch (error: any) {
        return errorResult("running compliance check", error);
      }
    },
  });

  // ============================================================================
  // AUTO-REPLY COMMANDS (5)
  // ============================================================================

  api.registerCommand({
    name: "staff",
    description: "Quick employee headcount summary",
    handler: async () => {
      try {
        const [counts, depts] = await Promise.all([
          callApi("/employees/counts"),
          callApi("/employees/by-department"),
        ]);

        const c = counts.counts;
        let text =
          `👥 *Staff Summary*\n\n` +
          `Total: ${c.total}\n` +
          `Active: ${c.active}\n` +
          `Probation: ${c.probation}\n` +
          `Inactive: ${c.inactive}\n` +
          `Terminated: ${c.terminated}\n`;

        if (depts.departments?.length) {
          text += `\n*By Department:*\n`;
          for (const dept of depts.departments) {
            text += `  ${dept.name}: ${dept.count}\n`;
          }
        }

        return { text };
      } catch (error: any) {
        return { text: `Error: ${error.message}` };
      }
    },
  });

  api.registerCommand({
    name: "payroll",
    description: "Current payroll run status",
    handler: async () => {
      try {
        const data = await callApi("/payroll/runs?limit=1");

        if (!data.runs?.length) {
          return { text: "No payroll runs found." };
        }

        const run = data.runs[0];
        const statusIcon =
          run.status === "paid"
            ? "✅"
            : run.status === "approved"
              ? "🟢"
              : run.status === "draft"
                ? "📝"
                : "🔄";

        return {
          text:
            `💵 *Payroll Status*\n\n` +
            `${statusIcon} Period: ${run.id}\n` +
            `Status: ${run.status}\n` +
            `Net Pay: ${fmtMoney(run.totalNetPay || 0)}\n` +
            `Employees: ${run.employeeCount || 0}`,
        };
      } catch (error: any) {
        return { text: `Error: ${error.message}` };
      }
    },
  });

  api.registerCommand({
    name: "leave",
    description: "Pending leave requests overview",
    handler: async () => {
      try {
        const [pending, onLeave] = await Promise.all([
          callApi("/leave/pending"),
          callApi("/leave/on-leave-today"),
        ]);

        let text = `🏖️ *Leave Overview*\n\n`;
        text += `Pending Requests: ${pending.count || 0}\n`;
        text += `On Leave Today: ${onLeave.count || 0}\n`;

        if (pending.requests?.length) {
          text += `\n*Pending:*\n`;
          for (const req of pending.requests.slice(0, 5)) {
            text += `  • ${req.employeeName || req.employeeId} — ${req.leaveType} (${req.totalDays || req.days || "?"} days)\n`;
          }
          if (pending.count > 5) text += `  _...and ${pending.count - 5} more_\n`;
        }

        if (onLeave.employees?.length) {
          text += `\n*On Leave Today:*\n`;
          for (const emp of onLeave.employees) {
            text += `  • ${emp.employeeName || emp.employeeId} — ${emp.leaveType}\n`;
          }
        }

        return { text };
      } catch (error: any) {
        return { text: `Error: ${error.message}` };
      }
    },
  });

  api.registerCommand({
    name: "today",
    description: "Today's interviews and who's on leave",
    handler: async () => {
      try {
        const [interviews, onLeave] = await Promise.all([
          callApi("/interviews/today"),
          callApi("/leave/on-leave-today"),
        ]);

        let text = `📅 *Today's Schedule*\n\n`;

        text += `*Interviews:* ${interviews.count || 0}\n`;
        if (interviews.interviews?.length) {
          for (const int of interviews.interviews) {
            text += `  • ${int.candidateName || "Unknown"}`;
            if (int.position || int.jobTitle) text += ` for ${int.position || int.jobTitle}`;
            if (int.scheduledTime || int.time) text += ` at ${int.scheduledTime || int.time}`;
            text += `\n`;
          }
        }

        text += `\n*On Leave:* ${onLeave.count || 0}\n`;
        if (onLeave.employees?.length) {
          for (const emp of onLeave.employees) {
            text += `  • ${emp.employeeName || emp.employeeId} — ${emp.leaveType}\n`;
          }
        }

        return { text };
      } catch (error: any) {
        return { text: `Error: ${error.message}` };
      }
    },
  });

  api.registerCommand({
    name: "money",
    description: "Financial overview - overdue invoices, bills, and expenses",
    handler: async () => {
      try {
        const [invoices, bills, expenses] = await Promise.all([
          callApi("/invoices/overdue"),
          callApi("/bills/overdue"),
          callApi("/expenses/this-month"),
        ]);

        let text = `💰 *Financial Overview*\n\n`;
        text += `*Receivables:*\n`;
        text += `  Overdue Invoices: ${invoices.count || 0}\n`;
        text += `  Total Overdue: ${fmtMoney(invoices.totalOverdue || 0)}\n\n`;
        text += `*Payables:*\n`;
        text += `  Overdue Bills: ${bills.count || 0}\n`;
        text += `  Total Overdue: ${fmtMoney(bills.totalOverdue || 0)}\n\n`;
        text += `*Expenses This Month:*\n`;
        text += `  Total: ${fmtMoney(expenses.total || 0)} (${expenses.count || 0} items)\n`;

        return { text };
      } catch (error: any) {
        return { text: `Error: ${error.message}` };
      }
    },
  });

  console.log("[meza-hr] Plugin loaded — 51 tools (32 read + 19 write/verify), 5 commands registered");
}
