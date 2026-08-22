/**
 * Attendance Page - Timor-Leste Version
 * Track and manage employee attendance with fingerprint import support
 */

import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import { getTLPublicHolidays } from "@/lib/payroll/tl-holidays";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/layout/PageHeader";
import { ContextualHelpLink } from "@/components/help/ContextualHelpLink";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCurrentEmployeeId,
  useTenant,
  useTenantId,
} from "@/contexts/TenantContext";
import {
  Plus,
  Download,
  Clock,
  Upload,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Loader2,
  Pencil,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TimePicker } from "@/components/ui/time-picker";

import { useEmployeeDirectory } from "@/hooks/useEmployees";
import { useAllDepartments } from "@/hooks/useDepartments";
import { useSettings } from "@/hooks/useSettings";
import {
  useAttendanceByDate,
  useMarkAttendance,
  useAdjustAttendance,
  useDeleteAttendance,
  attendanceKeys,
} from "@/hooks/useAttendance";
import { type Employee } from "@/services/employeeService";
import {
  leaveService,
  calculateWorkingDays,
  DEFAULT_WORKING_WEEKDAYS,
  type LeaveType,
} from "@/services/leaveService";
import {
  useEmployeesOnLeave,
  useLeaveBalance,
} from "@/hooks/useLeaveRequests";
import { useShiftsByRange } from "@/hooks/useShifts";
import { buildAttendanceWorkQueue } from "@/lib/attendanceCalculations";
import {
  attendanceService,
  computeEntryHours,
  needsBreakWarning,
  MAX_REASONABLE_ENTRY_HOURS,
  type AttendanceRecord,
  type AttendanceStatus,
} from "@/services/attendanceService";
import { SEO, seoConfig } from "@/components/SEO";
import {
  addDaysISO,
  getTodayTL,
  formatDateTL,
  parseDateISO,
} from "@/lib/dateUtils";
import { extractTable } from "@/lib/aiExtract";
import type { ExtractedAttendanceRow } from "@/lib/aiExtract";
import {
  dedupeAttendanceRows,
  excelCellToText,
  isLegacyXlsFile,
  pickWorksheetName,
  planExtraction,
  worksheetToTableText,
} from "@/lib/attendance/spreadsheet-text";
import {
  parseImportTime,
  describeSkippedImport,
  type SkippedImportReason,
  type SkippedImportRow,
} from "@/lib/attendance/import-helpers";
import MoreDetailsSection from "@/components/MoreDetailsSection";

type AttendanceImportRow = Record<string, string>;

function normalizeImportHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Cell-to-text for the STRICT parser too, not just the AI fallback.
 *
 * This used to render every Date cell as YYYY-MM-DD, which silently destroyed
 * clock times: Excel stores a time-only cell ("09:23") as a date on the 1899
 * epoch, so a clock-in arrived as the text "1899-12-30". Both import paths now
 * share the unit-tested conversion.
 */
function excelCellText(value: unknown): string {
  return excelCellToText(value);
}

async function parseAttendanceImport(
  file: File,
): Promise<AttendanceImportRow[]> {
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];
    const headers = (worksheet.getRow(1).values as unknown[])
      .slice(1)
      .map((value) => normalizeImportHeader(excelCellText(value)));
    const rows: AttendanceImportRow[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = (row.values as unknown[]).slice(1);
      const item: AttendanceImportRow = {};
      headers.forEach((header, index) => {
        if (header) item[header] = excelCellText(values[index]);
      });
      if (Object.values(item).some(Boolean)) rows.push(item);
    });
    return rows;
  }

  const { default: Papa } = await import("papaparse");
  const result = Papa.parse<Record<string, string>>(await file.text(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeImportHeader,
    transform: (value) => value.trim(),
  });
  if (result.errors.some((error) => error.type === "Quotes")) {
    throw new Error(result.errors[0]?.message || "Invalid CSV file");
  }
  return result.data;
}

/**
 * Convert an import file to the text the extractor reads.
 *
 * The conversion itself lives in client/lib/attendance/spreadsheet-text.ts, which
 * is unit-tested against real TL workbooks — it preserves clock times (Excel
 * stores a time-only cell as a date on the 1899 epoch, and rendering those as
 * YYYY-MM-DD destroyed every time in the file), drops print-layout spacer rows,
 * and picks the right sheet in a workbook that holds one sheet per month.
 */
async function fileToTableText(
  file: File,
  targetMonth?: { year: number; month: number },
): Promise<{ text: string; sheetName?: string; sheetCount?: number }> {
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const names = workbook.worksheets.map((sheet) => sheet.name);
    const chosen = pickWorksheetName(names, targetMonth);
    const worksheet = workbook.worksheets.find((sheet) => sheet.name === chosen);
    if (!worksheet) return { text: "" };
    return {
      text: worksheetToTableText(worksheet),
      sheetName: worksheet.name,
      sheetCount: names.length,
    };
  }
  return { text: await file.text() };
}

export default function Attendance() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const { session } = useTenant();
  const tenantId = useTenantId();
  const currentEmployeeId = useCurrentEmployeeId() ?? undefined;
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const attendanceMode =
    settings?.timeOffPolicies?.attendanceMode ?? "exceptions";
  const role = session?.role;
  const isAttendanceAdmin = role === "owner" || role === "hr-admin";
  const isAttendanceManager = role === "manager";
  const managerDepartmentId = isAttendanceManager
    ? session?.member.departmentId
    : undefined;
  const canManageAttendance =
    isAttendanceAdmin || Boolean(isAttendanceManager && managerDepartmentId);
  const canReadAllAttendance = isAttendanceAdmin || role === "accountant";
  const scopedEmployeeId =
    canReadAllAttendance || managerDepartmentId ? undefined : currentEmployeeId;
  const canReadAttendance =
    canReadAllAttendance || Boolean(managerDepartmentId || scopedEmployeeId);

  // Today's date as default
  const today = getTodayTL();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showMarkDialog, setShowMarkDialog] = useState(false);

  // "Record an absence" — the missing half of this screen. The Mark dialog
  // hard-requires a clock-in, so until now a non-worked day could not be
  // recorded here at all: the owner either invented clock times or left the
  // day blank, and a blank day is UNKNOWN, not an absence (docs/TIME_LEAVE.md).
  // A sick worker therefore silently got no sick pay and no record.
  const [showAbsenceDialog, setShowAbsenceDialog] = useState(false);
  const [savingAbsence, setSavingAbsence] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({
    employeeId: "",
    date: "",
    // Absences run in spells, not single days. A week off sick was five
    // separate recordings before this.
    endDate: "",
    halfDay: false,
    reason: "" as "" | "sick" | "special" | "unpaid" | "unjustified",
    hasCertificate: false,
    notes: "",
  });
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRecord | null>(
    null,
  );
  const [editForm, setEditForm] = useState({
    clockIn: "",
    clockOut: "",
    status: "present" as AttendanceStatus,
    reason: "",
  });

  // Is today selected?
  const isToday = selectedDate === today;

  // Data fetching via React Query
  const deptQuery = useAllDepartments(
    tenantId,
    100,
    canManageAttendance || isAttendanceManager,
  );
  const departments = useMemo(() => deptQuery.data ?? [], [deptQuery.data]);
  const managerDepartmentName = departments.find(
    (department) => department.id === managerDepartmentId,
  )?.name;
  const employeesQuery = useEmployeeDirectory(
    {
      status: "active",
      ...(isAttendanceManager && managerDepartmentName
        ? { department: managerDepartmentName }
        : {}),
    },
    canManageAttendance &&
      (!isAttendanceManager || Boolean(managerDepartmentName)),
  );
  const attendanceQuery = useAttendanceByDate(
    selectedDate,
    scopedEmployeeId,
    canReadAttendance,
    managerDepartmentId,
  );
  const shiftsQuery = useShiftsByRange(
    selectedDate,
    selectedDate,
    canManageAttendance && attendanceMode === "daily",
    managerDepartmentId,
  );
  const leaveOnDateQuery = useEmployeesOnLeave(
    selectedDate,
    selectedDate,
    canManageAttendance && attendanceMode === "daily",
    managerDepartmentId,
  );
  const markAttendanceMutation = useMarkAttendance();
  const adjustAttendanceMutation = useAdjustAttendance();
  const deleteAttendanceMutation = useDeleteAttendance();

  const loading =
    (canManageAttendance &&
      (employeesQuery.isLoading ||
        deptQuery.isLoading ||
        shiftsQuery.isLoading ||
        leaveOnDateQuery.isLoading)) ||
    attendanceQuery.isLoading;
  const allEmployees = useMemo(
    () => employeesQuery.data ?? [],
    [employeesQuery.data],
  );
  const employees = useMemo(
    () =>
      isAttendanceManager
        ? allEmployees.filter(
            (employee) =>
              employee.jobDetails.department === managerDepartmentName,
          )
        : allEmployees,
    [allEmployees, isAttendanceManager, managerDepartmentName],
  );
  const attendanceRecords = useMemo(
    () => attendanceQuery.data ?? [],
    [attendanceQuery.data],
  );
  const recordedEmployeeIds = useMemo(
    () => new Set(attendanceRecords.map((record) => record.employeeId)),
    [attendanceRecords],
  );
  const workQueue = useMemo(
    () =>
      attendanceMode !== "daily" ||
      selectedDate > today ||
      shiftsQuery.isError ||
      leaveOnDateQuery.isError
        ? []
        : buildAttendanceWorkQueue({
            employeeIds: employees
              .map((employee) => employee.id)
              .filter((id): id is string => Boolean(id)),
            recordedEmployeeIds,
            shifts: shiftsQuery.data ?? [],
            leave: leaveOnDateQuery.data ?? [],
            date: selectedDate,
          }),
    [
      employees,
      attendanceMode,
      leaveOnDateQuery.data,
      leaveOnDateQuery.isError,
      recordedEmployeeIds,
      selectedDate,
      shiftsQuery.data,
      shiftsQuery.isError,
      today,
    ],
  );
  const workQueueByEmployee = useMemo(
    () => new Map(workQueue.map((entry) => [entry.employeeId, entry])),
    [workQueue],
  );
  const unrecordedEmployees = useMemo(
    () => employees.filter((employee) =>
      Boolean(employee.id && workQueueByEmployee.has(employee.id))),
    [employees, workQueueByEmployee],
  );

  // Form data
  const [formData, setFormData] = useState({
    employeeId: "",
    date: selectedDate,
    clockIn: "",
    clockOut: "",
    notes: "",
  });

  // Import data
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  // Rows the last import dropped (bad date/time or no employee match), surfaced
  // so an admin never silently loses rows from a fingerprint/CSV export.
  const [skippedRows, setSkippedRows] = useState<SkippedImportRow[]>([]);
  const [skippedTotal, setSkippedTotal] = useState(0);

  const skipReasonLabel = (reason: SkippedImportReason) => {
    switch (reason) {
      case "employee":
        return (
          t("timeLeave.attendance.import.skipEmployee") ||
          "no matching employee"
        );
      case "date":
        return t("timeLeave.attendance.import.skipDate") || "invalid date";
      case "time":
        return t("timeLeave.attendance.import.skipTime") || "invalid time";
      default:
        return reason;
    }
  };

  // Format date for display
  const formatDateLabel = (dateStr: string) => {
    const date = parseDateISO(dateStr);
    const dayName = formatDateTL(date, { weekday: "long" });
    const monthDay = formatDateTL(date, { month: "short", day: "numeric" });
    return `${dayName}, ${monthDay}`;
  };

  const goToPreviousDay = () => {
    setSelectedDate(addDaysISO(selectedDate, -1));
  };

  const goToNextDay = () => {
    setSelectedDate(addDaysISO(selectedDate, 1));
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const recordedEmployees = new Set(
      attendanceRecords.map((record) => record.employeeId),
    ).size;
    const totalEmployees = canManageAttendance
      ? recordedEmployees + workQueue.length
      : 0;
    const clockedIn = attendanceRecords.filter(
      (record) => Boolean(record.clockIn) && !record.clockOut,
    ).length;
    const present = attendanceRecords.filter(
      (record) =>
        (record.status === "present" || record.status === "late") &&
        !(record.clockIn && !record.clockOut),
    ).length;
    const late = attendanceRecords.filter((r) => r.status === "late").length;
    const absent = attendanceRecords.filter(
      (r) => r.status === "absent",
    ).length;
    const onLeave = attendanceRecords.filter(
      (r) => r.status === "leave",
    ).length;
    const notRecorded = attendanceMode === "daily" ? workQueue.length : 0;
    const totalOvertimeHours = attendanceRecords.reduce(
      (sum, r) => sum + r.overtimeHours,
      0,
    );

    return {
      totalEmployees,
      recordedEmployees,
      clockedIn,
      present,
      late,
      absent,
      onLeave,
      notRecorded,
      totalOvertimeHours,
    };
  }, [attendanceMode, attendanceRecords, canManageAttendance, workQueue.length]);

  // Filter records
  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter((record) => {
      if (
        selectedDepartment !== "all" &&
        record.department !== selectedDepartment
      ) {
        return false;
      }
      if (selectedStatus !== "all" && record.status !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [attendanceRecords, selectedDepartment, selectedStatus]);
  const departmentNames = useMemo(() => {
    return [
      ...new Set([
        ...departments.map((department) => department.name),
        ...attendanceRecords.map((record) => record.department).filter(Boolean),
      ]),
    ].sort((left, right) => left.localeCompare(right));
  }, [attendanceRecords, departments]);

  const statusConfig: Record<
    AttendanceStatus,
    { color: string; dot: string; label: string }
  > = {
    present: {
      color:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      dot: "bg-emerald-500",
      label: t("timeLeave.attendance.status.present"),
    },
    late: {
      color:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      dot: "bg-amber-500",
      label: t("timeLeave.attendance.status.late"),
    },
    absent: {
      color:
        "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
      dot: "bg-red-500",
      label: t("timeLeave.attendance.status.absent"),
    },
    half_day: {
      color:
        "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
      dot: "bg-orange-500",
      label: t("timeLeave.attendance.status.halfDay"),
    },
    leave: {
      color:
        "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
      dot: "bg-blue-500",
      label: t("timeLeave.attendance.status.leave"),
    },
    holiday: {
      color:
        "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
      dot: "bg-purple-500",
      label: t("timeLeave.attendance.status.holiday"),
    },
  };

  const getStatusBadge = (record: AttendanceRecord) => {
    const cfg = record.clockIn && !record.clockOut
      ? {
          color:
            "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20",
          dot: "bg-cyan-500",
          label: t("timeLeave.attendance.status.clockedIn"),
        }
      : statusConfig[record.status] || {
          color: "bg-muted text-muted-foreground border border-border",
          dot: "bg-muted-foreground",
          label: record.status,
        };
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
          cfg.color,
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
        {cfg.label}
      </span>
    );
  };

  const getStatusLabel = (status: AttendanceStatus) => {
    switch (status) {
      case "present":
        return t("timeLeave.attendance.status.present");
      case "late":
        return t("timeLeave.attendance.status.late");
      case "absent":
        return t("timeLeave.attendance.status.absent");
      case "half_day":
        return t("timeLeave.attendance.status.halfDay");
      case "leave":
        return t("timeLeave.attendance.status.leave");
      case "holiday":
        return t("timeLeave.attendance.status.holiday");
      default:
        return status;
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetMarkForm = (date = selectedDate) => {
    setFormData({
      employeeId: "",
      date,
      clockIn: "",
      clockOut: "",
      notes: "",
    });
  };

  // Sick balance for the picked employee, so the owner can see what the day
  // costs BEFORE recording it — the Art. 33(4) bands drop to half pay after 6
  // days and stop after 12.
  const absenceBalance = useLeaveBalance(absenceForm.employeeId || undefined);

  // A weekend or public holiday carries no leave, and the callable rejects it
  // with "Leave must include at least one working day". The default date is
  // `getTodayTL()` — Timor-Leste's today — so an owner working Friday evening
  // in another timezone lands on Saturday by default and would have hit that
  // raw server error. Say it plainly here instead.
  // Tenants stored before this field existed keep the old Mon–Fri behaviour.
  const workingDays =
    settings?.timeOffPolicies?.workingDays ?? DEFAULT_WORKING_WEEKDAYS;

  // An empty end date means a single day, so the spell is always well-formed.
  const absenceEndDate = absenceForm.endDate || absenceForm.date;

  const absenceWorkingDays = useMemo(() => {
    if (!absenceForm.date) return 0;
    const year = Number(absenceForm.date.slice(0, 4));
    if (!Number.isFinite(year)) return 0;
    // A spell can cross a year boundary, so take holidays from both.
    const endYear = Number(absenceEndDate.slice(0, 4));
    const holidays = [
      ...getTLPublicHolidays(year),
      ...(Number.isFinite(endYear) && endYear !== year
        ? getTLPublicHolidays(endYear)
        : []),
    ].map((holiday) => holiday.date);
    const days = calculateWorkingDays(
      absenceForm.date,
      absenceEndDate,
      holidays,
      workingDays,
    );
    // Art. 33(4) and the rest are counted in working days; a half-day is only
    // meaningful on a single date, which is what the server enforces too.
    return absenceForm.halfDay && days === 1 ? 0.5 : days;
  }, [absenceForm.date, absenceEndDate, absenceForm.halfDay, workingDays]);

  const absenceIsNonWorkingDay = useMemo(() => {
    if (!absenceForm.date) return false;
    return absenceWorkingDays === 0;
  }, [absenceForm.date, absenceWorkingDays]);

  const [markingWorked, setMarkingWorked] = useState(false);
  // A 300-employee tenant needs to reach the 40th name, not just the first 8.
  const [showAllUnrecorded, setShowAllUnrecorded] = useState(false);
  // An `absent` record we are correcting. Art. 33(5) makes an unjustified
  // absence a disciplinary fact — lost pay, deducted seniority, grounds for
  // dismissal — so a day wrongly marked that way must be fixable, not just
  // fixable-going-forward. Anything CSV-imported, or marked before the reason
  // picker existed, is in that state.
  const [reclassifying, setReclassifying] = useState<AttendanceRecord | null>(
    null,
  );

  /**
   * Record a normal working day for people who have none.
   *
   * Deliberately writes an EXPLICIT record per employee rather than treating a
   * blank day as present. Inferring attendance would pay people for days
   * nobody checked and would erase the difference between "worked" and "we
   * never looked" — the invariant in docs/TIME_LEAVE.md. This keeps the
   * keystroke saving and keeps every day attributable.
   */
  const markWorkedNormally = async (list: Employee[]) => {
    if (list.length === 0) return;
    setMarkingWorked(true);
    try {
      // Chunked: a 300-employee tenant should not open 300 parallel writes.
      for (let i = 0; i < list.length; i += 10) {
        await Promise.all(
          list.slice(i, i + 10).map((employee) => {
            const planned = employee.id
              ? workQueueByEmployee.get(employee.id)
              : undefined;
            if (!planned) {
              throw new Error("Employee is no longer awaiting attendance");
            }
            return attendanceService.markAttendance(tenantId, {
              employeeId: employee.id!,
              employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
              department: employee.jobDetails.department,
              departmentId: departments.find(
                (department) =>
                  department.name === employee.jobDetails.department,
              )?.id,
              date: selectedDate,
              clockIn: planned.startTime,
              clockOut: planned.endTime,
              source: "manual",
            });
          }),
        );
      }
      await queryClient.invalidateQueries({
        queryKey: attendanceKeys.all(tenantId),
      });
      toast({
        title: t("timeLeave.attendance.toast.successTitle"),
        description: t("timeLeave.attendance.unrecorded.marked", {
          count: list.length,
        }),
      });
    } catch {
      toast({
        title: t("timeLeave.attendance.toast.errorTitle"),
        description: t("timeLeave.attendance.toast.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setMarkingWorked(false);
    }
  };

  const openReclassifyDialog = (record: AttendanceRecord) => {
    setReclassifying(record);
    setAbsenceForm({
      employeeId: record.employeeId,
      date: record.date,
      endDate: record.date,
      halfDay: false,
      reason: "",
      hasCertificate: false,
      notes: "",
    });
    setShowAbsenceDialog(true);
  };

  const openAbsenceDialog = (date = selectedDate) => {
    setReclassifying(null);
    setAbsenceForm({
      employeeId: "",
      date,
      endDate: "",
      halfDay: false,
      reason: "",
      hasCertificate: false,
      notes: "",
    });
    setShowAbsenceDialog(true);
  };

  /**
   * Record a non-worked day.
   *
   * Everything except "didn't show up" is written as an ALREADY-APPROVED leave
   * request, never as an attendance status. That is deliberate: payroll derives
   * sick banding and paid-leave hours from `leave_requests`, so an
   * attendance-only "sick" would look right on screen and pay nothing. The
   * attendance row then shows `leave`, exactly as it does for a request raised
   * on the Leave page — one source of truth, money chain untouched.
   */
  const handleRecordAbsence = async () => {
    const employee = employees.find((e) => e.id === absenceForm.employeeId);
    if (!employee || !absenceForm.date || !absenceForm.reason) {
      toast({
        title: t("timeLeave.attendance.toast.validationTitle"),
        description: t("timeLeave.attendance.absence.chooseReason"),
        variant: "destructive",
      });
      return;
    }

    const employeeName = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
    const departmentId = departments.find(
      (department) => department.name === employee.jobDetails.department,
    )?.id;

    setSavingAbsence(true);
    try {
      if (absenceForm.reason === "unjustified") {
        // No clock times => determineStatus() yields `absent`. This is the ONLY
        // reason that carries Art. 33(5) weight (lost pay, deducted seniority,
        // and grounds for dismissal), which is why it is never the default.
        await attendanceService.markAttendance(tenantId, {
          employeeId: employee.id!,
          employeeName,
          department: employee.jobDetails.department,
          departmentId,
          date: absenceForm.date,
          source: "manual",
          notes: absenceForm.notes || "",
        });
      } else {
        const leaveType = absenceForm.reason as LeaveType;
        const requestId = await leaveService.createLeaveRequest(tenantId, {
          employeeId: employee.id!,
          employeeName,
          department: employee.jobDetails.department,
          departmentId: departmentId ?? "",
          leaveType,
          leaveTypeLabel: t(
            `timeLeave.attendance.absence.reasons.${absenceForm.reason}`,
          ),
          startDate: absenceForm.date,
          endDate: absenceEndDate,
          // The server recomputes this (calculateCanonicalLeaveDuration) and is
          // authoritative; sending our own count keeps the optimistic UI honest.
          duration: absenceWorkingDays,
          halfDay: absenceForm.halfDay,
          reason:
            absenceForm.notes ||
            t(`timeLeave.attendance.absence.reasons.${absenceForm.reason}`),
          // Art. 33(4) requires a medical certificate for sick leave. Recorded,
          // never blocking — it routinely arrives after the absence starts.
          hasCertificate:
            absenceForm.reason === "sick" ? absenceForm.hasCertificate : false,
        });
        // The owner is recording a day that already happened, so it is decided
        // on the spot rather than left pending against themselves.
        await leaveService.approveLeaveRequest(
          tenantId,
          requestId,
          user?.uid || "unknown",
          session?.config?.name || "Xefe",
        );
      }

      // Correcting an existing `absent` row: the leave request now covers the
      // day, so the attendance record must go or the day counts twice — once as
      // leave and once as an unjustified absence. Only for the leave-backed
      // reasons; "did not come" just overwrites the same record in place.
      if (reclassifying?.id && absenceForm.reason !== "unjustified") {
        await deleteAttendanceMutation.mutateAsync(reclassifying.id);
      }

      await queryClient.invalidateQueries({
        queryKey: attendanceKeys.all(tenantId),
      });
      toast({
        title: t("timeLeave.attendance.toast.successTitle"),
        description: t("timeLeave.attendance.absence.recorded", {
          name: employeeName,
        }),
      });
      setReclassifying(null);
      setShowAbsenceDialog(false);
    } catch (error) {
      toast({
        title: t("timeLeave.attendance.toast.errorTitle"),
        description:
          error instanceof Error
            ? error.message
            : t("timeLeave.attendance.toast.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setSavingAbsence(false);
    }
  };

  const openMarkDialog = (date = selectedDate) => {
    resetMarkForm(date);
    setShowMarkDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employeeId || !formData.date || !formData.clockIn) {
      toast({
        title: t("timeLeave.attendance.toast.validationTitle"),
        description: t("timeLeave.attendance.toast.validationDesc"),
        variant: "destructive",
      });
      return;
    }

    // Catch reversed clock-out typos before they become a 20-hour payroll day
    const preview = computeEntryHours(formData.clockIn, formData.clockOut);
    if (formData.clockOut && preview.totalHours > MAX_REASONABLE_ENTRY_HOURS) {
      toast({
        title: t("timeLeave.attendance.toast.validationTitle"),
        description: t("timeLeave.timeTracking.dialog.tooLong", {
          hours: preview.totalHours.toFixed(1),
        }),
        variant: "destructive",
      });
      return;
    }

    const employee = employees.find((e) => e.id === formData.employeeId);
    if (!employee) {
      toast({
        title: t("timeLeave.attendance.toast.errorTitle"),
        description: t("timeLeave.attendance.toast.employeeNotFound"),
        variant: "destructive",
      });
      return;
    }

    markAttendanceMutation.mutate(
      {
        employeeId: formData.employeeId,
        employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        department: employee.jobDetails.department,
        departmentId: departments.find(
          (department) => department.name === employee.jobDetails.department,
        )?.id,
        date: formData.date,
        clockIn: formData.clockIn,
        clockOut: formData.clockOut || undefined,
        source: "manual",
        notes: formData.notes || "",
      },
      {
        onSuccess: () => {
          // Non-blocking Lei 4/2012 Art. 25(2) nudge: the entry spans more
          // than 5h of continuous work without the 1h break entitlement (the
          // dialog records no break, so this fires only on 5–6h spans, where
          // the 60-min default-break assumption does not apply). Folded into
          // the success toast because the toaster shows one toast at a time.
          const breakWarning = needsBreakWarning(
            formData.clockIn,
            formData.clockOut,
          );
          toast({
            title: t("timeLeave.attendance.toast.successTitle"),
            description: breakWarning
              ? `${t("timeLeave.attendance.toast.successDesc")} ${
                  t("timeLeave.attendance.toast.breakEntitlement") ||
                  "Art. 25(2): a worker is entitled to a 1-hour break after 5 hours of continuous work."
                }`
              : t("timeLeave.attendance.toast.successDesc"),
          });
          resetMarkForm(selectedDate);
          setShowMarkDialog(false);
        },
        onError: () => {
          toast({
            title: t("timeLeave.attendance.toast.errorTitle"),
            description: t("timeLeave.attendance.toast.saveFailed"),
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleExportCSV = async () => {
    const headers = [
      t("timeLeave.attendance.csv.employeeName"),
      t("timeLeave.attendance.csv.department"),
      t("timeLeave.attendance.csv.date"),
      t("timeLeave.attendance.csv.clockIn"),
      t("timeLeave.attendance.csv.clockOut"),
      t("timeLeave.attendance.csv.regularHours"),
      t("timeLeave.attendance.csv.overtimeHours"),
      t("timeLeave.attendance.csv.lateMinutes"),
      t("timeLeave.attendance.csv.status"),
    ];

    const rows = filteredRecords.map((record) => [
      record.employeeName,
      record.department,
      record.date,
      record.clockIn || t("timeLeave.attendance.csv.notAvailable"),
      record.clockOut || t("timeLeave.attendance.csv.notAvailable"),
      record.regularHours.toFixed(2),
      record.overtimeHours.toFixed(2),
      record.lateMinutes,
      getStatusLabel(record.status),
    ]);

    const { default: Papa } = await import("papaparse");
    const csv = Papa.unparse([headers, ...rows]);
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: t("timeLeave.attendance.toast.exportTitle"),
      description: t("timeLeave.attendance.toast.exportDesc"),
    });
  };

  const handleImportFile = async () => {
    if (!importFile) {
      toast({
        title: t("timeLeave.attendance.toast.errorTitle"),
        description: t("timeLeave.attendance.toast.importSelect"),
        variant: "destructive",
      });
      return;
    }

    // Old-format .xls (fingerprint devices export it) cannot be read by exceljs,
    // and the fallback turns the binary into garbage that wastes an extraction
    // call and imports nothing. Say what to do instead of failing mutely.
    if (await isLegacyXlsFile(importFile)) {
      toast({
        title: t("timeLeave.attendance.toast.errorTitle"),
        description:
          t("timeLeave.attendance.toast.importLegacyXls") ||
          "This is an old .xls file. Open it in Excel or Google Sheets and save it as .xlsx or CSV, then import that.",
        variant: "destructive",
      });
      return;
    }

    try {
      setImporting(true);
      setSkippedRows([]);
      setSkippedTotal(0);

      const rows = await parseAttendanceImport(importFile);

      const records: {
        employeeId: string;
        employeeName: string;
        department: string;
        departmentId?: string;
        date: string;
        clockIn?: string;
        clockOut?: string;
      }[] = [];

      // Build lookup maps once so CSV import is O(rows + employees), not O(rows * employees)
      const employeesById = new Map<string, Employee>();
      const employeesByJobId = new Map<string, Employee>();
      const employeesByName = new Map<string, Employee>();
      for (const emp of employees) {
        if (emp.id) employeesById.set(emp.id, emp);
        if (emp.jobDetails?.employeeId)
          employeesByJobId.set(emp.jobDetails.employeeId, emp);
        const fullName =
          `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`.toLowerCase();
        employeesByName.set(fullName, emp);
      }

      const readValue = (row: AttendanceImportRow, ...aliases: string[]) => {
        for (const alias of aliases) {
          const value = row[normalizeImportHeader(alias)];
          if (value) return value.trim();
        }
        return "";
      };

      // Rows that fail parsing/matching are collected with a reason instead of
      // being silently dropped, so the admin sees exactly what didn't import.
      const skipped: SkippedImportRow[] = [];
      let rowNumber = 1; // header is row 1; data rows start at 2
      for (const row of rows) {
        rowNumber += 1;
        const importedDate = readValue(row, "date", "work_date");
        const importedClockIn = readValue(
          row,
          "clock_in",
          "clockin",
          "check_in",
        );
        const importedClockOut = readValue(
          row,
          "clock_out",
          "clockout",
          "check_out",
        );

        if (!/^\d{4}-\d{2}-\d{2}$/.test(importedDate)) {
          skipped.push({
            rowNumber,
            reason: "date",
            detail: importedDate || "(empty)",
          });
          continue;
        }
        const clockIn = parseImportTime(importedClockIn);
        if (!clockIn) {
          skipped.push({
            rowNumber,
            reason: "time",
            detail: importedClockIn || "(empty)",
          });
          continue;
        }
        const clockOut = importedClockOut
          ? (parseImportTime(importedClockOut) ?? "")
          : "";

        // Find employee
        let employee: Employee | undefined;
        const importedEmployeeId = readValue(
          row,
          "employee_id",
          "employeeid",
          "staff_id",
        );
        if (importedEmployeeId) {
          const key = importedEmployeeId;
          employee = employeesById.get(key) || employeesByJobId.get(key);
        }
        const importedName = readValue(
          row,
          "name",
          "employee_name",
          "staff_name",
        );
        if (!employee && importedName) {
          employee = employeesByName.get(importedName.toLowerCase());
        }

        if (employee) {
          const department = employee.jobDetails.department;
          records.push({
            employeeId: employee.id!,
            employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            department,
            departmentId: departments.find((item) => item.name === department)
              ?.id,
            date: importedDate,
            clockIn,
            clockOut,
          });
        } else {
          skipped.push({
            rowNumber,
            reason: "employee",
            detail: importedName || importedEmployeeId || "(no name/ID)",
          });
        }
      }
      let totalRows = rows.length;

      // Strict parse found nothing usable — let XefeBot normalize the messy
      // file server-side (any columns, date or time formats), then run the
      // same deterministic employee matching over the normalized rows.
      let usedAi = false;
      if (records.length === 0) {
        try {
          const { text: tableText, sheetName, sheetCount } =
            await fileToTableText(importFile);
          if (tableText.trim()) {
            // One request per chunk: a wide monthly grid expands into one record
            // per employee per day, which does not fit a single call.
            const plan = planExtraction(tableText);
            const collected: ExtractedAttendanceRow[] = [];
            for (const chunk of plan.chunks) {
              collected.push(...(await extractTable(chunk, tenantId, "attendance")));
            }
            const aiRows = dedupeAttendanceRows(collected);
            if (plan.skippedLines > 0) {
              // Never let a cap look like a complete import.
              skipped.push({
                rowNumber: 0,
                reason: "employee",
                detail:
                  `${plan.skippedLines} further rows were not read (file too large for one import` +
                  `${sheetCount && sheetCount > 1 ? `; sheet "${sheetName}" of ${sheetCount}` : ""}` +
                  ") — split the file and import the rest",
              });
            }
            // The AI re-parsed the whole file, so strict-pass skips no longer
            // apply — track the AI pass's own no-match drops instead.
            skipped.length = 0;
            totalRows = aiRows.length;
            let aiRowNumber = 0;
            for (const row of aiRows) {
              aiRowNumber += 1;
              const employee =
                employeesById.get(row.employee) ||
                employeesByJobId.get(row.employee) ||
                employeesByName.get(row.employee.toLowerCase());
              if (!employee) {
                skipped.push({
                  rowNumber: aiRowNumber,
                  reason: "employee",
                  detail: row.employee || "(no name/ID)",
                });
                continue;
              }
              const department = employee.jobDetails.department;
              records.push({
                employeeId: employee.id!,
                employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
                department,
                departmentId: departments.find(
                  (item) => item.name === department,
                )?.id,
                date: row.date,
                clockIn: row.clockIn,
                clockOut: row.clockOut || "",
              });
            }
            usedAi = records.length > 0;
          }
        } catch (aiError) {
          console.warn("AI attendance import fallback failed:", aiError);
        }
      }

      // Surface skipped rows (in-dialog list) regardless of the outcome below.
      setSkippedRows(skipped);
      setSkippedTotal(totalRows);
      const skippedSummary = describeSkippedImport(skipped, totalRows);

      if (records.length === 0) {
        toast({
          title: t("timeLeave.attendance.toast.importErrorTitle"),
          description: skippedSummary
            ? `${t("timeLeave.attendance.toast.importEmpty")} ${skippedSummary}`
            : t("timeLeave.attendance.toast.importEmpty"),
          variant: "destructive",
        });
        return; // keep the dialog open so the skipped list stays visible
      }

      if (usedAi) {
        toast({
          title: t("timeLeave.attendance.toast.importAiTitle"),
          description: t("timeLeave.attendance.toast.importAiDesc", {
            count: records.length,
          }),
        });
      }

      const result = await attendanceService.importFromDevice(
        tenantId,
        records,
        {
          fileName: importFile.name,
          deviceType: "other",
          importedBy: user?.uid || "unknown",
        },
      );

      const importCompleteDesc = t(
        "timeLeave.attendance.toast.importCompleteDesc",
        {
          success: result.stats.success,
          duplicates: result.stats.duplicates,
          errors: result.stats.errors,
        },
      );
      toast({
        title: t("timeLeave.attendance.toast.importCompleteTitle"),
        description: skippedSummary
          ? `${importCompleteDesc} ${skippedSummary}`
          : importCompleteDesc,
        variant: skipped.length > 0 ? "destructive" : undefined,
      });

      // Invalidate attendance queries to refetch
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all(tenantId) });

      setImportFile(null);
      // Keep the dialog open when rows were skipped so the admin can review the
      // list; otherwise close as before.
      if (skipped.length === 0) {
        setShowImportDialog(false);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: t("timeLeave.attendance.toast.importErrorTitle"),
        description: t("timeLeave.attendance.toast.importFailed"),
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const openEditDialog = (record: AttendanceRecord) => {
    setEditRecord(record);
    setEditForm({
      clockIn: record.clockIn || "",
      clockOut: record.clockOut || "",
      status: record.status,
      reason: "",
    });
  };

  const saveAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editRecord?.id || !editForm.reason.trim()) {
      toast({
        title: t("timeLeave.attendance.toast.validationTitle"),
        description: t("timeLeave.timeTracking.edit.reasonRequired"),
        variant: "destructive",
      });
      return;
    }
    const preview = computeEntryHours(editForm.clockIn, editForm.clockOut);
    if (editForm.clockOut && preview.totalHours > MAX_REASONABLE_ENTRY_HOURS) {
      toast({
        title: t("timeLeave.attendance.toast.validationTitle"),
        description: t("timeLeave.timeTracking.dialog.tooLong", {
          hours: preview.totalHours.toFixed(1),
        }),
        variant: "destructive",
      });
      return;
    }
    try {
      await adjustAttendanceMutation.mutateAsync({
        recordId: editRecord.id,
        adjustments: {
          clockIn: editForm.clockIn || undefined,
          clockOut: editForm.clockOut || undefined,
          status: editForm.status,
          reason: editForm.reason.trim(),
          adjustedBy: user?.uid || "unknown",
        },
      });
      // Non-blocking Art. 25(2) nudge (see handleSubmit). An adjusted record
      // keeps its explicitly recorded break, if any, so pass it through:
      // an explicit break under 60min on a >5h span also warns.
      const breakWarning = needsBreakWarning(
        editForm.clockIn,
        editForm.clockOut,
        editRecord.breakStart && editRecord.breakEnd
          ? editRecord.breakMinutes
          : undefined,
      );
      setEditRecord(null);
      toast({
        title: t("timeLeave.attendance.toast.successTitle"),
        description: breakWarning
          ? `${t("timeLeave.timeTracking.edit.adjustSuccess")} ${
              t("timeLeave.attendance.toast.breakEntitlement") ||
              "Art. 25(2): a worker is entitled to a 1-hour break after 5 hours of continuous work."
            }`
          : t("timeLeave.timeTracking.edit.adjustSuccess"),
      });
    } catch {
      toast({
        title: t("timeLeave.attendance.toast.errorTitle"),
        description: t("timeLeave.attendance.toast.saveFailed"),
        variant: "destructive",
      });
    }
  };

  const deleteRecord = async () => {
    if (!deleteTarget?.id) return;
    try {
      await deleteAttendanceMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      setEditRecord(null);
      toast({
        title: t("timeLeave.attendance.toast.successTitle"),
        description: t("timeLeave.timeTracking.edit.deleteSuccess"),
      });
    } catch {
      toast({
        title: t("timeLeave.attendance.toast.errorTitle"),
        description: t("timeLeave.attendance.toast.saveFailed"),
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-background">
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <PageHeader
            title={
              isToday
                ? t("timeLeave.attendance.titleToday")
                : t("timeLeave.attendance.title")
            }
            subtitle={
              isToday ? (
                <>
                  {formatDateLabel(selectedDate)}
                  <span className="text-muted-foreground/70">
                    {" "}
                    · {t("timeLeave.attendance.payrollHint")}
                  </span>
                </>
              ) : (
                formatDateLabel(selectedDate)
              )
            }
            icon={Clock}
            iconColor="text-cyan-500"
            actions={
              canManageAttendance ? (
                <>
                  {isAttendanceAdmin && (
                    <Skeleton className="h-9 w-24 rounded-md" />
                  )}
                  <Skeleton className="h-9 w-32 rounded-md" />
                </>
              ) : undefined
            }
          />

          {/* Inline Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-[180px] rounded-md" />
              <Skeleton className="h-9 w-20 rounded-md" />
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>

          <div className="mb-6">
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>

        {/* Attendance Records */}
          <div className="space-y-1.5">
            <div className="hidden md:grid md:grid-cols-[1fr_140px_140px_80px_80px_80px_100px] gap-3 px-5 py-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12 ml-auto" />
              <Skeleton className="h-3 w-14 ml-auto" />
              <Skeleton className="h-3 w-10 ml-auto" />
              <Skeleton className="h-3 w-14 ml-auto" />
            </div>

            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-border/50 bg-card"
              >
                {/* Desktop layout */}
                <div className="hidden md:grid md:grid-cols-[1fr_140px_140px_80px_80px_80px_100px] gap-3 items-center px-5 py-3">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-10 ml-auto" />
                  <Skeleton className="h-4 w-10 ml-auto" />
                  <Skeleton className="h-4 w-8 ml-auto" />
                  <Skeleton className="h-5 w-20 rounded-full ml-auto" />
                </div>

                {/* Mobile layout */}
                <div className="md:hidden px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <SEO {...seoConfig.attendance} />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={
            isToday
              ? t("timeLeave.attendance.titleToday")
              : t("timeLeave.attendance.title")
          }
          subtitle={
            isToday ? (
              <>
                {formatDateLabel(selectedDate)}
                <span className="text-muted-foreground/70">
                  {" "}
                  · {t("timeLeave.attendance.payrollHint")}
                </span>
              </>
            ) : (
              formatDateLabel(selectedDate)
            )
          }
          icon={Clock}
          iconColor="text-cyan-500"
          actions={
            canManageAttendance ? (
              <>
                {isAttendanceAdmin && (
                  <Button
                    variant="outline"
                    onClick={() => setShowImportDialog(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {t("timeLeave.attendance.actions.import")}
                  </Button>
                )}
                {/* Which of these is the primary action follows the company's
                    recording mode: in `exceptions` mode the only thing you
                    routinely do here is record an absence. */}
                <Button
                  variant={
                    attendanceMode === "exceptions" ? "default" : "outline"
                  }
                  onClick={() => openAbsenceDialog()}
                >
                  {t("timeLeave.attendance.absence.action")}
                </Button>
                <Button
                  variant={
                    attendanceMode === "exceptions" ? "outline" : "default"
                  }
                  onClick={() => openMarkDialog()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isToday
                    ? t("timeLeave.attendance.actions.markToday")
                    : t("timeLeave.attendance.actions.mark")}
                </Button>
              </>
            ) : undefined
          }
        />

        <div className="-mt-2 mb-2 flex justify-end">
          <ContextualHelpLink slug="time-and-leave" anchor="attendance" />
        </div>

        {/* Import Dialog */}
        <Dialog
          open={showImportDialog}
          onOpenChange={(open) => {
            setShowImportDialog(open);
            if (!open) {
              setSkippedRows([]);
              setSkippedTotal(0);
            }
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {t("timeLeave.attendance.import.title")}
              </DialogTitle>
              <DialogDescription>
                {t("timeLeave.attendance.import.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("timeLeave.attendance.import.selectFile")}</Label>
                <Input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] || null);
                    setSkippedRows([]);
                    setSkippedTotal(0);
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("timeLeave.attendance.import.format")}
                </p>
              </div>

              {skippedRows.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <p className="text-sm font-medium text-foreground">
                    {(
                      t("timeLeave.attendance.import.skippedSummary") ||
                      "{{count}} of {{total}} rows were skipped and not imported"
                    )
                      .replace("{{count}}", String(skippedRows.length))
                      .replace("{{total}}", String(skippedTotal))}
                  </p>
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {skippedRows.map((skippedRow, index) => (
                      <li key={`${skippedRow.rowNumber}-${index}`}>
                        {t("timeLeave.attendance.import.rowLabel") || "Row"}{" "}
                        {skippedRow.rowNumber}:{" "}
                        {skipReasonLabel(skippedRow.reason)}
                        {skippedRow.detail ? ` — ${skippedRow.detail}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportDialog(false);
                  setSkippedRows([]);
                  setSkippedTotal(0);
                }}
              >
                {t("timeLeave.attendance.actions.cancel")}
              </Button>
              <Button
                onClick={handleImportFile}
                disabled={importing || !importFile}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("timeLeave.attendance.import.importing")}
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4 mr-2" />
                    {t("timeLeave.attendance.actions.import")}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mark Attendance Dialog */}
        <Dialog
          open={showMarkDialog}
          onOpenChange={(open) => {
            setShowMarkDialog(open);
            if (!open) {
              resetMarkForm(selectedDate);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("timeLeave.attendance.mark.title")}</DialogTitle>
              <DialogDescription>
                {t("timeLeave.attendance.mark.description")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>{t("timeLeave.attendance.mark.employee")}</Label>
                <Select
                  value={formData.employeeId}
                  onValueChange={(value) =>
                    handleInputChange("employeeId", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t(
                        "timeLeave.attendance.mark.employeePlaceholder",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id!}>
                        {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("timeLeave.attendance.mark.date")}</Label>
                <DatePicker
                  value={formData.date}
                  onChange={(value) => handleInputChange("date", value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("timeLeave.attendance.mark.clockIn")}</Label>
                  <TimePicker
                    value={formData.clockIn}
                    onChange={(v) => handleInputChange("clockIn", v)}
                    placeholder={t("timeLeave.attendance.mark.clockIn")}
                    required
                  />
                </div>
                <div>
                  <Label>{t("timeLeave.attendance.mark.clockOut")}</Label>
                  <TimePicker
                    value={formData.clockOut}
                    onChange={(v) => handleInputChange("clockOut", v)}
                    placeholder={t("timeLeave.attendance.mark.clockOut")}
                  />
                </div>
              </div>
              <MoreDetailsSection>
                <div>
                  <Label>{t("timeLeave.attendance.mark.notes")}</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder={t(
                      "timeLeave.attendance.mark.notesPlaceholder",
                    )}
                  />
                </div>
              </MoreDetailsSection>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowMarkDialog(false)}
                >
                  {t("timeLeave.attendance.actions.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={markAttendanceMutation.isPending}
                >
                  {markAttendanceMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("timeLeave.attendance.mark.saving")}
                    </>
                  ) : (
                    t("timeLeave.attendance.actions.mark")
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {/* Record an absence — a non-worked day, reason first. */}
        <Dialog open={showAbsenceDialog} onOpenChange={setShowAbsenceDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("timeLeave.attendance.absence.title")}
              </DialogTitle>
              <DialogDescription>
                {reclassifying
                  ? t("timeLeave.attendance.absence.reclassifyDescription")
                  : t("timeLeave.attendance.absence.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="absence-employee">
                  {t("timeLeave.attendance.mark.employee")}
                </Label>
                <Select
                  value={absenceForm.employeeId}
                  onValueChange={(employeeId) =>
                    setAbsenceForm((current) => ({ ...current, employeeId }))
                  }
                >
                  <SelectTrigger id="absence-employee">
                    <SelectValue
                      placeholder={t("timeLeave.attendance.mark.employeePlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id!}>
                        {employee.personalInfo.firstName}{" "}
                        {employee.personalInfo.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("timeLeave.attendance.absence.firstDay")}</Label>
                <DatePicker
                  value={absenceForm.date}
                  onChange={(date) =>
                    setAbsenceForm((current) => ({ ...current, date }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{t("timeLeave.attendance.absence.lastDay")}</Label>
                <DatePicker
                  value={absenceEndDate}
                  onChange={(endDate) =>
                    setAbsenceForm((current) => ({ ...current, endDate }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {absenceWorkingDays > 0
                    ? t("timeLeave.attendance.absence.spellLength", {
                        days: absenceWorkingDays,
                      })
                    : t("timeLeave.attendance.absence.lastDayHint")}
                </p>
              </div>

              {/* Only offered on a single date — the server rejects a half-day
                  spanning two, and half of a week is not a thing anyone means. */}
              {absenceForm.date && absenceEndDate === absenceForm.date && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="absence-half-day"
                    checked={absenceForm.halfDay}
                    onCheckedChange={(halfDay) =>
                      setAbsenceForm((current) => ({ ...current, halfDay }))
                    }
                  />
                  <Label htmlFor="absence-half-day">
                    {t("timeLeave.attendance.absence.halfDay")}
                  </Label>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="absence-reason">
                  {t("timeLeave.attendance.absence.reasonLabel")}
                </Label>
                <Select
                  value={absenceForm.reason}
                  onValueChange={(reason) =>
                    setAbsenceForm((current) => ({
                      ...current,
                      reason: reason as typeof current.reason,
                    }))
                  }
                >
                  <SelectTrigger id="absence-reason">
                    <SelectValue
                      placeholder={t(
                        "timeLeave.attendance.absence.reasonPlaceholder",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="sick" value="sick">
                      {t("timeLeave.attendance.absence.reasons.sick")}
                    </SelectItem>
                    <SelectItem key="special" value="special">
                      {t("timeLeave.attendance.absence.reasons.special")}
                    </SelectItem>
                    <SelectItem key="unpaid" value="unpaid">
                      {t("timeLeave.attendance.absence.reasons.unpaid")}
                    </SelectItem>
                    <SelectItem key="unjustified" value="unjustified">
                      {t("timeLeave.attendance.absence.reasons.unjustified")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {absenceForm.reason && (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      `timeLeave.attendance.absence.help.${absenceForm.reason}`,
                    )}
                  </p>
                )}
              </div>

              {absenceForm.reason === "sick" && (
                <>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="absence-certificate"
                      checked={absenceForm.hasCertificate}
                      onCheckedChange={(hasCertificate) =>
                        setAbsenceForm((current) => ({
                          ...current,
                          hasCertificate,
                        }))
                      }
                    />
                    <Label htmlFor="absence-certificate">
                      {t("timeLeave.attendance.absence.certificate")}
                    </Label>
                  </div>
                  {!absenceForm.hasCertificate && (
                    <p className="text-xs text-muted-foreground">
                      {t("timeLeave.attendance.absence.certificateHint")}
                    </p>
                  )}
                  {absenceBalance.data?.sick && (
                    <p className="text-xs text-muted-foreground">
                      {t("timeLeave.attendance.absence.sickBalance", {
                        used: absenceBalance.data.sick.used,
                        entitled: absenceBalance.data.sick.entitled,
                      })}
                    </p>
                  )}
                </>
              )}

              {absenceIsNonWorkingDay && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{t("timeLeave.attendance.absence.nonWorkingDay")}</p>
                </div>
              )}

              {/* The one reason that counts against the worker. Amber, with
                  words — never a bare colour. */}
              {absenceForm.reason === "unjustified" && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{t("timeLeave.attendance.absence.unjustifiedWarning")}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="absence-notes">
                  {t("timeLeave.attendance.mark.notes")}
                </Label>
                <Input
                  id="absence-notes"
                  value={absenceForm.notes}
                  onChange={(event) =>
                    setAbsenceForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAbsenceDialog(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleRecordAbsence}
                disabled={
                  savingAbsence ||
                  absenceIsNonWorkingDay ||
                  !absenceForm.employeeId ||
                  !absenceForm.date ||
                  !absenceForm.reason
                }
              >
                {savingAbsence && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("timeLeave.attendance.absence.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Inline Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
          {/* Date navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={goToPreviousDay}
            >
              <ChevronLeft className="h-4 w-4 mr-1.5" />
              {t("common.previous")}
            </Button>
            <DatePicker
              value={selectedDate}
              onChange={(value) => setSelectedDate(value)} className="h-9 w-[180px] text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={goToNextDay}
            >
              {t("common.next")}
              <ChevronRight className="h-4 w-4 ml-1.5" />
            </Button>
            {!isToday && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                onClick={() => setSelectedDate(today)}
              >
                {t("timeLeave.attendance.actions.today") || "Today"}
              </Button>
            )}
          </div>

          {/* Inline Stats */}
          {attendanceRecords.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 lg:ml-auto text-xs text-muted-foreground">
              {stats.clockedIn > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-500" />
                  {stats.clockedIn}{" "}
                  {t("timeLeave.attendance.status.clockedIn")}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {stats.present} {t("timeLeave.attendance.status.present")}
              </span>
              {stats.late > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {stats.late} {t("timeLeave.attendance.status.late")}
                </span>
              )}
              {stats.absent > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {stats.absent} {t("timeLeave.attendance.status.absent")}
                </span>
              )}
              {stats.notRecorded > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                  {stats.notRecorded}{" "}
                  {t("timeLeave.attendance.stats.notRecorded")}
                </span>
              )}
              <span className="font-medium text-foreground">
                {canManageAttendance && stats.totalEmployees > 0
                  ? `${stats.recordedEmployees} / ${stats.totalEmployees}`
                  : stats.recordedEmployees}
              </span>
            </div>
          )}
        </div>

        <MoreDetailsSection
          className="mb-6"
          title={t("timeLeave.attendance.filters.title")}
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-2">
            <Select
              value={selectedDepartment}
              onValueChange={setSelectedDepartment}
            >
              <SelectTrigger className="h-9 w-full lg:w-[180px] text-sm">
                <SelectValue
                  placeholder={t("timeLeave.attendance.filters.allDepartments")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("timeLeave.attendance.filters.allDepartments")}
                </SelectItem>
                {departmentNames.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-9 w-full lg:w-[160px] text-sm">
                <SelectValue
                  placeholder={t("timeLeave.attendance.filters.allStatuses")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("timeLeave.attendance.filters.allStatuses")}
                </SelectItem>
                <SelectItem value="present">
                  {t("timeLeave.attendance.status.present")}
                </SelectItem>
                <SelectItem value="late">
                  {t("timeLeave.attendance.status.late")}
                </SelectItem>
                <SelectItem value="absent">
                  {t("timeLeave.attendance.status.absent")}
                </SelectItem>
                <SelectItem value="half_day">
                  {t("timeLeave.attendance.status.halfDay")}
                </SelectItem>
                <SelectItem value="leave">
                  {t("timeLeave.attendance.status.leave")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 lg:ml-auto"
              onClick={handleExportCSV}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {t("timeLeave.attendance.actions.export")}
            </Button>
          </div>
        </MoreDetailsSection>

        {canManageAttendance && attendanceMode === "exceptions" && (
          <p className="mb-4 text-xs text-muted-foreground">
            {t("timeLeave.attendance.modeNote")}
          </p>
        )}

        {/* Nobody said what happened to these people. Named and actionable —
            a count with a grey dot is not something an owner can act on. */}
        {canManageAttendance &&
          attendanceMode === "daily" &&
          unrecordedEmployees.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium">
                    {t("timeLeave.attendance.unrecorded.title", {
                      count: unrecordedEmployees.length,
                      date: formatDateTL(parseDateISO(selectedDate)),
                    })}
                  </p>
                  <p className="mt-0.5">
                    {t("timeLeave.attendance.unrecorded.explain")}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={markingWorked}
                onClick={() => markWorkedNormally(unrecordedEmployees)}
              >
                {markingWorked && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("timeLeave.attendance.unrecorded.allWorked")}
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {(showAllUnrecorded
                ? unrecordedEmployees
                : unrecordedEmployees.slice(0, 8)
              ).map((employee) => (
                <div
                  key={employee.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background/60 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm">
                    {employee.personalInfo.firstName}{" "}
                    {employee.personalInfo.lastName}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={markingWorked}
                      onClick={() => markWorkedNormally([employee])}
                    >
                      {t("timeLeave.attendance.unrecorded.worked")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAbsenceForm({
                          employeeId: employee.id!,
                          date: selectedDate,
                          endDate: "",
                          halfDay: false,
                          reason: "",
                          hasCertificate: false,
                          notes: "",
                        });
                        setShowAbsenceDialog(true);
                      }}
                    >
                      {t("timeLeave.attendance.unrecorded.wasAway")}
                    </Button>
                  </div>
                </div>
              ))}
              {unrecordedEmployees.length > 8 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllUnrecorded((open) => !open)}
                >
                  {showAllUnrecorded
                    ? t("timeLeave.attendance.unrecorded.showFewer")
                    : t("timeLeave.attendance.unrecorded.andMore", {
                        count: unrecordedEmployees.length - 8,
                      })}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Attendance Records */}
        {filteredRecords.length === 0 ? (
          <div className="text-center py-16">
            <div className="p-4 bg-cyan-500/10 rounded-full w-fit mx-auto mb-4">
              <Clock className="h-12 w-12 text-cyan-500" />
            </div>
            <h3 className="font-semibold text-lg text-foreground mb-1">
              {isToday
                ? t("timeLeave.attendance.empty.titleToday")
                : t("timeLeave.attendance.empty.title")}
            </h3>
            {canManageAttendance && (
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                {t("timeLeave.attendance.empty.instructions")}
              </p>
            )}
            <div className="flex justify-center gap-3">
              {canManageAttendance && (
                <>
                  {isAttendanceAdmin && (
                    <Button
                      variant="outline"
                      onClick={() => setShowImportDialog(true)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {t("timeLeave.attendance.empty.importButton")}
                    </Button>
                  )}
                  <Button onClick={() => openMarkDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    {isToday
                      ? t("timeLeave.attendance.actions.markToday")
                      : t("timeLeave.attendance.actions.mark")}
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Column headers */}
            <div className="hidden md:grid md:grid-cols-[1fr_140px_140px_80px_80px_80px_100px] gap-3 px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>{t("timeLeave.attendance.table.employee")}</span>
              <span>{t("timeLeave.attendance.table.clockIn")}</span>
              <span>{t("timeLeave.attendance.table.clockOut")}</span>
              <span className="text-right">
                {t("timeLeave.attendance.table.regular")}
              </span>
              <span className="text-right">
                {t("timeLeave.attendance.table.overtime")}
              </span>
              <span className="text-right">
                {t("timeLeave.attendance.table.late")}
              </span>
              <span className="text-right">
                {t("timeLeave.attendance.table.status")}
              </span>
            </div>

            {filteredRecords.map((record) => (
              <div
                key={record.id}
                className={cn(
                  "group rounded-lg border border-border/50 bg-card hover:bg-accent/50 transition-colors",
                )}
              >
                {/* Desktop layout */}
                <div className="hidden md:grid md:grid-cols-[1fr_140px_140px_80px_80px_80px_100px] gap-3 items-center px-5 py-3">
                  <div>
                    <p className="font-medium text-sm text-foreground">
                      {record.employeeName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {record.department}
                    </p>
                  </div>
                  <span className="font-mono text-sm text-foreground">
                    {record.clockIn || "—"}
                  </span>
                  <span className="font-mono text-sm text-foreground">
                    {record.clockOut || "—"}
                  </span>
                  <span className="font-mono text-sm text-right text-foreground">
                    {record.regularHours.toFixed(1)}h
                  </span>
                  <span className="font-mono text-sm text-right">
                    {record.overtimeHours > 0 ? (
                      <span className="text-orange-600 dark:text-orange-400">
                        +{record.overtimeHours.toFixed(1)}h
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  <span className="font-mono text-sm text-right">
                    {record.lateMinutes > 0 ? (
                      <span className="text-red-600 dark:text-red-400">
                        {record.lateMinutes}m
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  <div className="flex items-center justify-end gap-1">
                    {getStatusBadge(record)}
                    {record.status === "absent" && canManageAttendance && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openReclassifyDialog(record)}
                      >
                        {t("timeLeave.attendance.absence.reclassify")}
                      </Button>
                    )}
                    {canManageAttendance && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => openEditDialog(record)}
                        aria-label={t("timeLeave.timeTracking.edit.title")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Mobile layout */}
                <div className="md:hidden px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {record.employeeName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {record.department}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {getStatusBadge(record)}
                      {record.status === "absent" && canManageAttendance && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openReclassifyDialog(record)}
                        >
                          {t("timeLeave.attendance.absence.reclassify")}
                        </Button>
                      )}
                      {canManageAttendance && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => openEditDialog(record)}
                          aria-label={t("timeLeave.timeTracking.edit.title")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-mono">
                      {record.clockIn || "—"} → {record.clockOut || "—"}
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      {record.regularHours.toFixed(1)}h
                    </span>
                    {record.overtimeHours > 0 && (
                      <span className="font-mono text-orange-600 dark:text-orange-400">
                        +{record.overtimeHours.toFixed(1)}h{" "}
                        {t("timeLeave.attendance.table.overtime")}
                      </span>
                    )}
                    {record.lateMinutes > 0 && (
                      <span className="font-mono text-red-600 dark:text-red-400">
                        {record.lateMinutes}m{" "}
                        {t("timeLeave.attendance.table.late")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(editRecord)}
        onOpenChange={(open) => !open && setEditRecord(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("timeLeave.timeTracking.edit.title")}</DialogTitle>
            <DialogDescription>
              {editRecord
                ? t("timeLeave.timeTracking.edit.description", {
                    name: editRecord.employeeName,
                    date: formatDateTL(editRecord.date),
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveAdjustment} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("timeLeave.attendance.mark.clockIn")}</Label>
                <TimePicker
                  value={editForm.clockIn}
                  onChange={(clockIn) =>
                    setEditForm((current) => ({ ...current, clockIn }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("timeLeave.attendance.mark.clockOut")}</Label>
                <TimePicker
                  value={editForm.clockOut}
                  onChange={(clockOut) =>
                    setEditForm((current) => ({ ...current, clockOut }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("timeLeave.attendance.filters.status")}</Label>
              <Select
                value={editForm.status}
                onValueChange={(status: AttendanceStatus) =>
                  setEditForm((current) => ({ ...current, status }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      "present",
                      "late",
                      "absent",
                      "half_day",
                      "leave",
                      "holiday",
                    ] as AttendanceStatus[]
                  ).map((status) => (
                    <SelectItem key={status} value={status}>
                      {getStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance-adjustment-reason">
                {t("timeLeave.timeTracking.edit.reason")}
              </Label>
              <Input
                id="attendance-adjustment-reason"
                value={editForm.reason}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                placeholder={t("timeLeave.timeTracking.edit.reasonPlaceholder")}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={() => editRecord && setDeleteTarget(editRecord)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("timeLeave.timeTracking.edit.deleteConfirm")}
              </Button>
              <div className="flex gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditRecord(null)}
                >
                  {t("timeLeave.attendance.actions.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={adjustAttendanceMutation.isPending}
                >
                  {adjustAttendanceMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("timeLeave.timeTracking.edit.save")}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("timeLeave.timeTracking.edit.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? t("timeLeave.timeTracking.edit.deleteDesc", {
                    name: deleteTarget.employeeName,
                    date: formatDateTL(deleteTarget.date),
                  })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("timeLeave.attendance.actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void deleteRecord()}
              disabled={deleteAttendanceMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("timeLeave.timeTracking.edit.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
