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

  async function callApi(endpoint: string) {
    const requestId = createRequestId();
    const url = `${apiBaseUrl}/api/tenants/${tenantId}${endpoint}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "X-Request-Id": requestId,
        },
      });
    } catch (error: any) {
      throw new Error(
        `[${requestId}] Network error calling ${endpoint}: ${error?.message || "Unknown network error"}`
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
      throw new Error(`[${requestId}] API ${response.status} ${endpoint}: ${compactMessage}`);
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

  console.log("[meza-hr] Plugin loaded — 29 tools, 5 commands registered");
}
