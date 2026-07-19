import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  LayoutGrid,
  List,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import MoreDetailsSection from "@/components/MoreDetailsSection";
import { SEO, seoConfig } from "@/components/SEO";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useAllDepartments } from "@/hooks/useDepartments";
import { useEmployeeDirectory } from "@/hooks/useEmployees";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useSettings } from "@/hooks/useSettings";
import {
  useCopyWeekShifts,
  useCreateShift,
  useDeleteShift,
  usePublishDraftShifts,
  useSaveShiftSlots,
  useShiftSlots,
  useShiftsByRange,
  useUpdateShift,
} from "@/hooks/useShifts";
import LocationGridView from "@/components/shifts/LocationGridView";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  addDaysISO,
  formatDateTL,
  getTodayTL,
  getWeekStartTL,
  parseDateISO,
} from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import {
  calcShiftHours,
  type ShiftRecord,
  type ShiftStatus,
} from "@/services/shiftService";

const MAX_WEEKLY_HOURS = 44;

interface ShiftForm {
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  status: ShiftStatus;
}

function shiftBounds(date: string, startTime: string, endTime: string): [number, number] {
  const dayStart = parseDateISO(date).getTime() / 60_000;
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const start = dayStart + startHour * 60 + startMinute;
  let end = dayStart + endHour * 60 + endMinute;
  if (end <= start) end += 24 * 60;
  return [start, end];
}

function overlaps(left: ShiftForm, right: ShiftRecord): boolean {
  const [leftStart, leftEnd] = shiftBounds(left.date, left.startTime, left.endTime);
  const [rightStart, rightEnd] = shiftBounds(right.date, right.startTime, right.endTime);
  return leftStart < rightEnd && rightStart < leftEnd;
}

function hasShortRest(left: ShiftForm, right: ShiftRecord): boolean {
  const [leftStart, leftEnd] = shiftBounds(left.date, left.startTime, left.endTime);
  const [rightStart, rightEnd] = shiftBounds(right.date, right.startTime, right.endTime);
  if (leftStart < rightStart) return rightStart - leftEnd < 12 * 60;
  return leftStart - rightEnd < 12 * 60;
}

function emptyForm(date: string, location = ""): ShiftForm {
  return {
    employeeId: "",
    date,
    startTime: "08:00",
    endTime: "17:00",
    location,
    notes: "",
    status: "draft",
  };
}

export default function ShiftScheduling() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const { session } = useTenant();
  const role = session?.role;
  const isManager = role === "manager";
  const managerDepartmentId = isManager ? session?.member.departmentId : undefined;
  const canLoadSchedule = !isManager || Boolean(managerDepartmentId);

  const [weekStart, setWeekStart] = useState(() => getWeekStartTL(getTodayTL()));
  const weekEnd = addDaysISO(weekStart, 6);
  // Coverage grid (site × shift-slot) is the default — a flat list of hundreds
  // of shifts can't answer "is every post covered?". The list stays as a
  // fallback for anyone who wants the raw per-day view.
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShiftRecord | null>(null);
  const [form, setForm] = useState<ShiftForm>(() => emptyForm(getTodayTL()));

  const departmentsQuery = useAllDepartments(session?.tid ?? "", 100, true);
  const departments = useMemo(
    () => departmentsQuery.data ?? [],
    [departmentsQuery.data],
  );
  const managerDepartmentName = departments.find(
    (department) => department.id === managerDepartmentId,
  )?.name;
  const employeesQuery = useEmployeeDirectory(
    {
      status: "active",
      ...(isManager && managerDepartmentName ? { department: managerDepartmentName } : {}),
    },
    canLoadSchedule && (!isManager || Boolean(managerDepartmentName)),
  );
  const settingsQuery = useSettings();
  const shiftsQuery = useShiftsByRange(
    weekStart,
    weekEnd,
    canLoadSchedule,
    managerDepartmentId,
  );
  const leaveQuery = useLeaveRequests(
    managerDepartmentId ? { departmentId: managerDepartmentId } : undefined,
    canLoadSchedule,
  );
  const slotsQuery = useShiftSlots();
  const slots = useMemo(() => slotsQuery.data ?? [], [slotsQuery.data]);
  const saveSlotsMutation = useSaveShiftSlots();

  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const workLocations = useMemo(
    () => (settingsQuery.data?.companyStructure.workLocations ?? [])
      .filter((location) => location.isActive),
    [settingsQuery.data?.companyStructure.workLocations],
  );
  const shifts = useMemo(() => shiftsQuery.data ?? [], [shiftsQuery.data]);
  const approvedLeave = (leaveQuery.data ?? []).filter((request) => request.status === "approved");
  const createMutation = useCreateShift();
  const updateMutation = useUpdateShift();
  const deleteMutation = useDeleteShift();
  const publishMutation = usePublishDraftShifts();
  const copyMutation = useCopyWeekShifts();
  const saving = createMutation.isPending || updateMutation.isPending;

  const locations = useMemo(() => [...new Set([
    ...workLocations.map((location) => location.name),
    ...shifts.map((shift) => shift.location).filter(Boolean),
  ])].sort((left, right) => left.localeCompare(right)), [shifts, workLocations]);

  const visibleShifts = useMemo(() => shifts.filter((shift) => {
    if (departmentFilter !== "all" && shift.department !== departmentFilter) return false;
    if (locationFilter !== "all" && shift.location !== locationFilter) return false;
    return true;
  }), [departmentFilter, locationFilter, shifts]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDaysISO(weekStart, index)),
    [weekStart],
  );
  const draftCount = visibleShifts.filter((shift) => shift.status === "draft").length;

  // Employees mapped to the coverage grid's shape.
  const gridEmployees = useMemo(
    () => employees
      .filter((employee): employee is typeof employee & { id: string } => Boolean(employee.id))
      .map((employee) => ({
        id: employee.id,
        name: `${employee.personalInfo?.firstName ?? ""} ${employee.personalInfo?.lastName ?? ""}`.trim()
          || employee.personalInfo?.firstName
          || "—",
        department: employee.jobDetails?.department ?? "",
        position: employee.jobDetails?.position ?? "",
      })),
    [employees],
  );

  // The grid keys off configured WorkLocations, but a tenant may already have
  // shifts at sites they never formally added in Settings. Synthesize entries
  // for those so the grid works without forcing location setup first.
  const gridLocations = useMemo(() => {
    const byName = new Map(workLocations.map((location) => [location.name, location]));
    for (const name of shifts.map((shift) => shift.location).filter(Boolean)) {
      if (!byName.has(name)) {
        byName.set(name, {
          id: `derived:${name}`,
          name,
          address: "",
          city: "",
          isHeadquarters: false,
          isActive: true,
        });
      }
    }
    return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [workLocations, shifts]);

  const activeSlots = useMemo(() => slots.filter((slot) => slot.enabled), [slots]);

  // Coverage: how many location × slot × day cells have at least one guard.
  // "Needed staff per post" isn't modelled, so ≥1 assigned = covered — enough
  // to answer "where are the holes this week?" at a glance.
  const coverage = useMemo(() => {
    if (activeSlots.length === 0 || gridLocations.length === 0) {
      return { staffed: 0, total: 0, open: 0 };
    }
    const inSlot = (time: string, start: string, end: string) =>
      start === end ? time === start
        : start < end ? time >= start && time < end
        : time >= start || time < end; // overnight slot
    const slotIdForShift = (shift: ShiftRecord): string | undefined => {
      if (shift.slotId && activeSlots.some((slot) => slot.id === shift.slotId)) return shift.slotId;
      return activeSlots.find((slot) => inSlot(shift.startTime, slot.startTime, slot.endTime))?.id;
    };
    const staffedCells = new Set<string>();
    for (const shift of visibleShifts) {
      if (shift.status === "cancelled") continue;
      const slotId = slotIdForShift(shift);
      if (!slotId) continue;
      staffedCells.add(`${shift.location}|${shift.date}|${slotId}`);
    }
    const total = gridLocations.length * activeSlots.length * 7;
    return { staffed: staffedCells.size, total, open: Math.max(0, total - staffedCells.size) };
  }, [visibleShifts, activeSlots, gridLocations]);

  // Employees over the TL 44h/week cap (across all their shifts this week).
  const overCapCount = useMemo(() => {
    const byEmployee = new Map<string, number>();
    for (const shift of shifts) {
      if (shift.status === "cancelled") continue;
      byEmployee.set(
        shift.employeeId,
        (byEmployee.get(shift.employeeId) ?? 0) + (Number.isFinite(shift.hours) ? shift.hours : 0),
      );
    }
    let count = 0;
    byEmployee.forEach((hours) => { if (hours > MAX_WEEKLY_HOURS) count += 1; });
    return count;
  }, [shifts]);
  const selectedEmployee = employees.find((employee) => employee.id === form.employeeId);
  const formHours = calcShiftHours(form.startTime, form.endTime);
  const selectedEmployeeWeekHours = shifts
    .filter((shift) => shift.employeeId === form.employeeId && shift.id !== editingShift?.id && shift.status !== "cancelled")
    .reduce((total, shift) => total + shift.hours, 0) + formHours;

  const statusClass = (status: ShiftStatus) => {
    if (status === "published" || status === "confirmed") {
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    }
    if (status === "draft") {
      return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    }
    return "border-border bg-muted text-muted-foreground";
  };

  const openCreate = (date = weekStart) => {
    setEditingShift(null);
    setForm(emptyForm(date, locations[0] ?? ""));
    setFormOpen(true);
  };

  const openEdit = (shift: ShiftRecord) => {
    setEditingShift(shift);
    setForm({
      employeeId: shift.employeeId,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      location: shift.location,
      notes: shift.notes,
      status: shift.status,
    });
    setFormOpen(true);
  };

  const submitShift = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEmployee || !form.date || !form.startTime || !form.endTime || !form.location.trim()) {
      toast({
        title: t("timeLeave.shiftScheduling.toast.validationTitle"),
        description: t("timeLeave.shiftScheduling.toast.validationDesc"),
        variant: "destructive",
      });
      return;
    }
    if (formHours <= 0 || formHours >= 24) {
      toast({
        title: t("timeLeave.shiftScheduling.toast.validationTitle"),
        description: t("timeLeave.shiftScheduling.toast.validationDesc"),
        variant: "destructive",
      });
      return;
    }

    const employeeShifts = shifts.filter((shift) =>
      shift.employeeId === form.employeeId &&
      shift.id !== editingShift?.id &&
      shift.status !== "cancelled",
    );
    if (employeeShifts.some((shift) => overlaps(form, shift))) {
      toast({
        title: t("timeLeave.shiftScheduling.toast.validationTitle"),
        description: t("timeLeave.shiftScheduling.toast.overlapDesc"),
        variant: "destructive",
      });
      return;
    }
    if (employeeShifts.some((shift) => hasShortRest(form, shift))) {
      toast({
        title: t("timeLeave.shiftScheduling.toast.validationTitle"),
        description: t("timeLeave.shiftScheduling.toast.restDesc"),
        variant: "destructive",
      });
      return;
    }
    if (approvedLeave.some((leave) =>
      leave.employeeId === form.employeeId &&
      leave.startDate <= form.date &&
      leave.endDate >= form.date)) {
      toast({
        title: t("timeLeave.shiftScheduling.toast.validationTitle"),
        description: t("timeLeave.shiftScheduling.toast.leaveConflictDesc"),
        variant: "destructive",
      });
      return;
    }

    const department = selectedEmployee.jobDetails.department || "";
    const departmentId = departments.find((item) => item.name === department)?.id;
    if (isManager && departmentId !== managerDepartmentId) {
      toast({
        title: t("timeLeave.shiftScheduling.toast.validationTitle"),
        description: t("timeLeave.shiftScheduling.scopeMissing"),
        variant: "destructive",
      });
      return;
    }

    const payload = {
      employeeId: selectedEmployee.id!,
      employeeName: `${selectedEmployee.personalInfo.firstName} ${selectedEmployee.personalInfo.lastName}`.trim(),
      department,
      ...(departmentId ? { departmentId } : {}),
      position: selectedEmployee.jobDetails.position || "",
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      hours: formHours,
      status: form.status,
      location: form.location.trim(),
      notes: form.notes.trim(),
      createdBy: editingShift?.createdBy || user?.uid || "",
    };

    try {
      if (editingShift?.id) {
        await updateMutation.mutateAsync({ shiftId: editingShift.id, data: payload });
        toast({
          title: t("timeLeave.shiftScheduling.toast.successTitle"),
          description: t("timeLeave.shiftScheduling.toast.updateSuccessDesc"),
        });
      } else {
        await createMutation.mutateAsync(payload);
        toast({
          title: t("timeLeave.shiftScheduling.toast.successTitle"),
          description: t("timeLeave.shiftScheduling.toast.createSuccessDesc"),
        });
      }
      setFormOpen(false);
      setEditingShift(null);
    } catch {
      toast({
        title: t("timeLeave.shiftScheduling.toast.errorTitle"),
        description: editingShift
          ? t("timeLeave.shiftScheduling.toast.updateErrorDesc")
          : t("timeLeave.shiftScheduling.toast.createErrorDesc"),
        variant: "destructive",
      });
    }
  };

  const publishDrafts = async () => {
    try {
      const count = await publishMutation.mutateAsync({
        startDate: weekStart,
        endDate: weekEnd,
        departmentId: managerDepartmentId,
      });
      toast({
        title: t("timeLeave.shiftScheduling.toast.schedulePublishedTitle"),
        description: t("timeLeave.shiftScheduling.toast.schedulePublishedDesc", { count }),
      });
    } catch {
      toast({
        title: t("timeLeave.shiftScheduling.toast.errorTitle"),
        description: t("timeLeave.shiftScheduling.toast.updateErrorDesc"),
        variant: "destructive",
      });
    }
  };

  const copyWeek = async () => {
    try {
      const { created, skipped } = await copyMutation.mutateAsync({
        startDate: weekStart,
        endDate: weekEnd,
        createdBy: user?.uid || "",
        departmentId: managerDepartmentId,
      });
      if (created > 0) {
        toast({
          title: t("timeLeave.shiftScheduling.toast.copiedTitle"),
          description: skipped > 0
            ? t("timeLeave.shiftScheduling.toast.copiedWithSkippedDesc", { count: created, skipped })
            : t("timeLeave.shiftScheduling.toast.copiedDesc", { count: created }),
        });
      } else if (skipped > 0) {
        // Source shifts existed but every one already had a copy next week (or
        // the employee is on leave) — an idempotent no-op, not an empty week.
        toast({
          title: t("timeLeave.shiftScheduling.toast.copyAllSkippedTitle"),
          description: t("timeLeave.shiftScheduling.toast.copyAllSkippedDesc", { skipped }),
        });
      } else {
        toast({
          title: t("timeLeave.shiftScheduling.toast.copyEmptyTitle"),
          description: t("timeLeave.shiftScheduling.toast.copyEmptyDesc"),
        });
      }
    } catch {
      toast({
        title: t("timeLeave.shiftScheduling.toast.errorTitle"),
        description: t("timeLeave.shiftScheduling.toast.updateErrorDesc"),
        variant: "destructive",
      });
    }
  };

  const exportWeek = async () => {
    if (visibleShifts.length === 0) {
      toast({
        title: t("timeLeave.shiftScheduling.toast.exportEmptyTitle"),
        description: t("timeLeave.shiftScheduling.toast.exportEmptyDesc"),
      });
      return;
    }
    const { exportToCSV } = await import("@/lib/csvExport");
    exportToCSV(
      visibleShifts as unknown as Record<string, unknown>[],
      `shifts_${weekStart}`,
      [
        { key: "date", label: t("timeLeave.shiftScheduling.create.date") },
        { key: "employeeName", label: t("timeLeave.shiftScheduling.create.employee") },
        { key: "department", label: t("timeLeave.shiftScheduling.controls.department") },
        { key: "startTime", label: t("timeLeave.shiftScheduling.create.startTime") },
        { key: "endTime", label: t("timeLeave.shiftScheduling.create.endTime") },
        { key: "hours", label: t("timeLeave.shiftScheduling.summary.totalHours") },
        { key: "location", label: t("timeLeave.shiftScheduling.controls.location") },
        { key: "status", label: t("timeLeave.shiftScheduling.grid.status") },
      ],
    );
    toast({
      title: t("timeLeave.shiftScheduling.toast.exportedTitle"),
      description: t("timeLeave.shiftScheduling.toast.exportedDesc", { count: visibleShifts.length }),
    });
  };

  const removeShift = async () => {
    if (!deleteTarget?.id) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      setFormOpen(false);
      toast({
        title: t("timeLeave.shiftScheduling.toast.successTitle"),
        description: t("timeLeave.shiftScheduling.toast.deleteSuccessDesc"),
      });
    } catch {
      toast({
        title: t("timeLeave.shiftScheduling.toast.errorTitle"),
        description: t("timeLeave.shiftScheduling.toast.deleteErrorDesc"),
        variant: "destructive",
      });
    }
  };

  const loading = departmentsQuery.isLoading || settingsQuery.isLoading ||
    (canLoadSchedule && (shiftsQuery.isLoading || leaveQuery.isLoading || employeesQuery.isLoading));
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <PageHeader
            title={t("timeLeave.shiftScheduling.title")}
            subtitle={t("timeLeave.shiftScheduling.subtitle")}
            icon={Calendar}
            iconColor="text-cyan-600"
          />

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-9 w-9 rounded-md" />
              <Skeleton className="h-9 w-20 rounded-md" />
              <Skeleton className="h-9 w-9 rounded-md" />
              <Skeleton className="ml-1 h-4 w-36" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>

          <Skeleton className="mb-4 h-11 w-full rounded-lg" />

          <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            {Array.from({ length: 7 }, (_, dayIndex) => (
              <div key={dayIndex} className={cn("p-4", dayIndex > 0 && "border-t border-border/70")}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-28 rounded-md" />
                </div>
                <div className="space-y-2">
                  {Array.from({ length: dayIndex < 2 ? 2 : 1 }, (_, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-40" />
                      </span>
                      <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                      <Skeleton className="h-4 w-4 shrink-0 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.schedules} />
      <main className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={t("timeLeave.shiftScheduling.title")}
          subtitle={t("timeLeave.shiftScheduling.subtitle")}
          icon={Calendar}
          iconColor="text-cyan-600"
          actions={canLoadSchedule ? (
            <Button onClick={() => openCreate()}>
              <Plus className="mr-2 h-4 w-4" />
              {t("timeLeave.shiftScheduling.actions.createShift")}
            </Button>
          ) : undefined}
        />

        {!canLoadSchedule ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            {t("timeLeave.shiftScheduling.scopeMissing")}
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* The coverage grid carries its own week navigation; only the
                  list view needs these outer controls. */}
              {viewMode === "list" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setWeekStart(addDaysISO(weekStart, -7))} aria-label={t("common.previous")}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setWeekStart(getWeekStartTL(getTodayTL()))}>
                    {t("timeLeave.attendance.actions.today")}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setWeekStart(addDaysISO(weekStart, 7))} aria-label={t("common.next")}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="ml-1 text-sm font-semibold">
                    {formatDateTL(parseDateISO(weekStart), { day: "numeric", month: "short" })}
                    {" — "}
                    {formatDateTL(parseDateISO(weekEnd), { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              ) : <div />}
              <div className="flex flex-wrap items-center gap-3">
                {coverage.total > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground tabular-nums">{coverage.staffed}</span>
                      {" / "}{coverage.total} {t("timeLeave.shiftScheduling.summary.postsStaffed")}
                    </span>
                    {coverage.open > 0 && (
                      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300 tabular-nums">
                        {t("timeLeave.shiftScheduling.summary.openPosts", { count: coverage.open })}
                      </span>
                    )}
                    {overCapCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300 tabular-nums">
                        <AlertTriangle className="h-3 w-3" />
                        {t("timeLeave.shiftScheduling.summary.overCap", { count: overCapCount })}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    aria-pressed={viewMode === "grid"}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      viewMode === "grid" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    {t("timeLeave.shiftScheduling.view.grid")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    aria-pressed={viewMode === "list"}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      viewMode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <List className="h-3.5 w-3.5" />
                    {t("timeLeave.shiftScheduling.view.list")}
                  </button>
                </div>
              </div>
            </div>

            {draftCount > 0 && (
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm">
                  <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                  <span>{t("timeLeave.shiftScheduling.actions.publishSchedule", { count: draftCount })}</span>
                </div>
                <Button variant="outline" onClick={() => void publishDrafts()} disabled={publishMutation.isPending}>
                  {publishMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {t("timeLeave.shiftScheduling.actions.publishSchedule", { count: draftCount })}
                </Button>
              </div>
            )}

            <MoreDetailsSection className="mb-4" title={t("timeLeave.shiftScheduling.controls.title")}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]">
                {!isManager && (
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger><SelectValue placeholder={t("timeLeave.shiftScheduling.controls.allDepartments")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("timeLeave.shiftScheduling.controls.allDepartments")}</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.name}>{department.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger><SelectValue placeholder={t("timeLeave.shiftScheduling.controls.allLocations")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("timeLeave.shiftScheduling.controls.allLocations")}</SelectItem>
                    {locations.map((location) => <SelectItem key={location} value={location}>{location}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => void copyWeek()} disabled={copyMutation.isPending}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t("timeLeave.shiftScheduling.actions.copyWeek")}
                </Button>
                <Button variant="outline" onClick={() => void exportWeek()}>
                  <Download className="mr-2 h-4 w-4" />
                  {t("timeLeave.shiftScheduling.actions.export")}
                </Button>
              </div>
            </MoreDetailsSection>

            {viewMode === "grid" ? (
              <LocationGridView
                employees={gridEmployees}
                shifts={visibleShifts}
                selectedWeek={weekStart}
                locations={gridLocations}
                slots={slots}
                onSlotsChange={(next) => saveSlotsMutation.mutate(next)}
                onCreateShift={(data) => createMutation.mutateAsync(data)}
                onDeleteShift={(shiftId) => deleteMutation.mutateAsync(shiftId)}
                onSelectWeek={setWeekStart}
                goToPreviousWeek={() => setWeekStart(addDaysISO(weekStart, -7))}
                goToNextWeek={() => setWeekStart(addDaysISO(weekStart, 7))}
              />
            ) : (
            <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              {weekDays.map((date, dayIndex) => {
                const dayShifts = visibleShifts
                  .filter((shift) => shift.date === date)
                  .sort((left, right) => left.startTime.localeCompare(right.startTime));
                return (
                  <div key={date} className={cn("p-4", dayIndex > 0 && "border-t border-border/70")}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">
                          {formatDateTL(parseDateISO(date), { weekday: "long" })}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTL(parseDateISO(date), { day: "numeric", month: "short" })}
                          {dayShifts.length > 0
                            ? ` · ${t("timeLeave.shiftScheduling.calendar.daySummary", {
                                count: dayShifts.length,
                                hours: dayShifts.reduce((total, shift) => total + shift.hours, 0).toFixed(1),
                              })}`
                            : ""}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openCreate(date)}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        {t("timeLeave.shiftScheduling.actions.createShift")}
                      </Button>
                    </div>

                    {dayShifts.length === 0 ? (
                      <p className="rounded-lg bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                        {t("timeLeave.shiftScheduling.grid.empty")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {dayShifts.map((shift) => (
                          <button
                            key={shift.id}
                            type="button"
                            onClick={() => openEdit(shift)}
                            className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{shift.employeeName}</span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                <span>{shift.startTime} — {shift.endTime}</span>
                                <span>{shift.hours.toFixed(1)}h</span>
                                {shift.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{shift.location}</span>}
                              </span>
                            </span>
                            <Badge variant="outline" className={statusClass(shift.status)}>
                              {t(`timeLeave.shiftScheduling.status.${shift.status}`)}
                            </Badge>
                            <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
            )}
          </>
        )}
      </main>

      <Dialog open={formOpen} onOpenChange={(open) => {
        setFormOpen(open);
        if (!open) setEditingShift(null);
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingShift
                ? t("timeLeave.shiftScheduling.edit.title")
                : t("timeLeave.shiftScheduling.create.title")}
            </DialogTitle>
            <DialogDescription>
              {editingShift
                ? t("timeLeave.shiftScheduling.edit.description")
                : t("timeLeave.shiftScheduling.create.description")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitShift} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("timeLeave.shiftScheduling.create.employee")}</Label>
              <Select value={form.employeeId} onValueChange={(employeeId) =>
                setForm((current) => ({ ...current, employeeId }))}>
                <SelectTrigger><SelectValue placeholder={t("timeLeave.shiftScheduling.create.employeePlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id!}>
                      {employee.personalInfo.firstName} {employee.personalInfo.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedEmployee && (
                <p className="text-xs text-muted-foreground">
                  {selectedEmployee.jobDetails.department} · {selectedEmployee.jobDetails.position}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="shift-date">{t("timeLeave.shiftScheduling.create.date")}</Label>
              <Input id="shift-date" type="date" value={form.date} onChange={(event) =>
                setForm((current) => ({ ...current, date: event.target.value }))} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("timeLeave.shiftScheduling.create.startTime")}</Label>
                <TimePicker value={form.startTime} onChange={(startTime) =>
                  setForm((current) => ({ ...current, startTime }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("timeLeave.shiftScheduling.create.endTime")}</Label>
                <TimePicker value={form.endTime} onChange={(endTime) =>
                  setForm((current) => ({ ...current, endTime }))} />
              </div>
            </div>
            <p className={cn(
              "rounded-lg px-3 py-2 text-sm",
              selectedEmployeeWeekHours > MAX_WEEKLY_HOURS
                ? "bg-amber-500/10 text-amber-800 dark:text-amber-200"
                : "bg-muted/40 text-muted-foreground",
            )}>
              {t("timeLeave.shiftScheduling.create.totalHours", { hours: formHours.toFixed(1) })}
              {selectedEmployeeWeekHours > MAX_WEEKLY_HOURS && selectedEmployee
                ? ` · ${t("timeLeave.shiftScheduling.recommendations.overworkedTitle", { name: selectedEmployee.personalInfo.firstName })}`
                : ""}
            </p>

            <div className="space-y-2">
              <Label>{t("timeLeave.shiftScheduling.create.location")}</Label>
              {locations.length > 0 ? (
                <Select value={form.location} onValueChange={(location) =>
                  setForm((current) => ({ ...current, location }))}>
                  <SelectTrigger><SelectValue placeholder={t("timeLeave.shiftScheduling.create.locationPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => <SelectItem key={location} value={location}>{location}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.location} onChange={(event) =>
                  setForm((current) => ({ ...current, location: event.target.value }))}
                  placeholder={t("timeLeave.shiftScheduling.create.locationPlaceholder")} />
              )}
            </div>

            {editingShift && (
              <div className="space-y-2">
                <Label>{t("timeLeave.shiftScheduling.grid.status")}</Label>
                <Select value={form.status} onValueChange={(status: ShiftStatus) =>
                  setForm((current) => ({ ...current, status }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["draft", "published", "confirmed", "cancelled"] as ShiftStatus[]).map((status) => (
                      <SelectItem key={status} value={status}>{t(`timeLeave.shiftScheduling.status.${status}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="shift-notes">{t("timeLeave.shiftScheduling.create.notes")}</Label>
              <Textarea id="shift-notes" value={form.notes} onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder={t("timeLeave.shiftScheduling.create.notesPlaceholder")} rows={3} />
            </div>

            <DialogFooter className="sm:justify-between">
              {editingShift ? (
                <Button type="button" variant="destructive" onClick={() => setDeleteTarget(editingShift)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("timeLeave.shiftScheduling.actions.delete")}
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  {t("timeLeave.shiftScheduling.actions.cancel")}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingShift
                    ? t("timeLeave.shiftScheduling.actions.update")
                    : t("timeLeave.shiftScheduling.actions.createShift")}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("timeLeave.shiftScheduling.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("timeLeave.shiftScheduling.delete.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("timeLeave.shiftScheduling.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void removeShift()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("timeLeave.shiftScheduling.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
