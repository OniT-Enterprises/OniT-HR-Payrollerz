import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarDays,
  Check,
  Clock,
  Loader2,
  Plus,
  X,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
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
import { useAuth } from "@/contexts/AuthContext";
import {
  useCurrentEmployeeId,
  useTenant,
  useTenantId,
} from "@/contexts/TenantContext";
import { useAllDepartments } from "@/hooks/useDepartments";
import { useEmployeeById, useEmployeeDirectory } from "@/hooks/useEmployees";
import {
  useApproveLeaveRequest,
  useCancelLeaveRequest,
  useCreateLeaveRequest,
  useEmployeeLeaveRequests,
  useLeaveBalance,
  useLeaveRequests,
  useRejectLeaveRequest,
} from "@/hooks/useLeaveRequests";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTL, parseDateISO } from "@/lib/dateUtils";
import { getTLPublicHolidays } from "@/lib/payroll/tl-holidays";
import { cn } from "@/lib/utils";
import { holidayService } from "@/services/holidayService";
import {
  calculateWorkingDays,
  leaveService,
  type LeaveBalance,
  type LeaveBalanceItem,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
} from "@/services/leaveService";
import { settingsService } from "@/services/settingsService";
import type { Employee } from "@/services/employeeService";
import type { LeaveTypeConfig, TimeOffPolicies } from "@/types/settings";

type RequestFilter = "all" | LeaveStatus;

const KNOWN_LEAVE_TYPES = new Set([
  "annual",
  "sick",
  "maternity",
  "paternity",
  "bereavement",
  "unpaid",
  "marriage",
  "study",
  "custom",
]);

function policyOptions(policies: TimeOffPolicies): LeaveTypeConfig[] {
  return [
    policies.annualLeave,
    policies.sickLeave,
    policies.maternityLeave,
    policies.paternityLeave,
    policies.unpaidLeave,
    ...policies.customLeaveTypes,
  ].filter((policy) => policy.isActive);
}

function employeeName(employee: Employee | null | undefined): string {
  if (!employee) return "";
  return `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`.trim();
}

function balanceItem(
  balance: LeaveBalance | null | undefined,
  leaveType: string,
): LeaveBalanceItem | undefined {
  if (!balance) return undefined;
  const dynamicBalance = balance as unknown as Record<string, unknown>;
  const value = dynamicBalance[leaveType];
  if (!value || typeof value !== "object") return undefined;
  return value as LeaveBalanceItem;
}

export default function LeaveRequests() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const { session } = useTenant();
  const tenantId = useTenantId();
  const currentEmployeeId = useCurrentEmployeeId() ?? undefined;
  const role = session?.role;
  const isAdmin = role === "owner" || role === "hr-admin";
  const isManager = role === "manager";
  const isAccountant = role === "accountant";
  const managerDepartmentId = isManager ? session?.member.departmentId : undefined;
  const canDecide = isAdmin || isManager;
  const canSelectEmployee = isAdmin || isManager;
  const canReadAll = isAdmin || isAccountant;

  const [filter, setFilter] = useState<RequestFilter>("all");
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [approveTarget, setApproveTarget] = useState<LeaveRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [form, setForm] = useState({
    employeeId: "",
    leaveType: "",
    startDate: "",
    endDate: "",
    halfDay: false,
    halfDayType: "morning" as "morning" | "afternoon",
    reason: "",
  });

  const teamQueryEnabled = canReadAll || Boolean(isManager && managerDepartmentId);
  const teamRequestsQuery = useLeaveRequests(
    isManager && managerDepartmentId ? { departmentId: managerDepartmentId } : undefined,
    teamQueryEnabled,
  );
  const ownRequestsQuery = useEmployeeLeaveRequests(
    !canReadAll && currentEmployeeId ? currentEmployeeId : undefined,
  );
  const ownEmployeeQuery = useEmployeeById(currentEmployeeId);

  const departmentsQuery = useAllDepartments(
    tenantId,
    100,
    showRequestDialog && canSelectEmployee,
  );
  const departments = departmentsQuery.data ?? [];
  const managerDepartmentName = departments.find(
    (department) => department.id === managerDepartmentId,
  )?.name;
  const directoryQuery = useEmployeeDirectory(
    {
      status: "active",
      ...(isManager && managerDepartmentName
        ? { department: managerDepartmentName }
        : {}),
    },
    showRequestDialog && canSelectEmployee &&
      (!isManager || Boolean(managerDepartmentName)),
  );
  const settingsQuery = useQuery({
    queryKey: ["tenants", tenantId, "settings"],
    queryFn: () => settingsService.getSettings(tenantId),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1_000,
  });

  const requestYears = useMemo(() => {
    const years = new Set<number>();
    if (form.startDate) years.add(Number(form.startDate.slice(0, 4)));
    if (form.endDate) years.add(Number(form.endDate.slice(0, 4)));
    if (years.size === 0) years.add(new Date().getFullYear());
    return [...years].filter(Number.isFinite).sort();
  }, [form.startDate, form.endDate]);
  const holidaysQuery = useQuery({
    queryKey: ["tenants", tenantId, "leave-holidays", requestYears],
    queryFn: async () => {
      const overrides = await Promise.all(
        requestYears.map((year) => holidayService.listTenantHolidayOverrides(tenantId, year)),
      );
      const dates = new Set(requestYears.flatMap((year) =>
        getTLPublicHolidays(year).map((holiday) => holiday.date),
      ));
      for (const override of overrides.flat()) {
        if (override.isHoliday) dates.add(override.date);
        else dates.delete(override.date);
      }
      return [...dates];
    },
    enabled: Boolean(tenantId && showRequestDialog),
    staleTime: 10 * 60 * 1_000,
  });

  const requests = useMemo(() => {
    if (canReadAll) return teamRequestsQuery.data ?? [];
    const scoped = isManager ? (teamRequestsQuery.data ?? []) : [];
    const own = ownRequestsQuery.data ?? [];
    const byId = new Map<string, LeaveRequest>();
    for (const request of [...scoped, ...own]) {
      if (request.id) byId.set(request.id, request);
    }
    return [...byId.values()].sort((left, right) =>
      right.requestDate.localeCompare(left.requestDate),
    );
  }, [canReadAll, isManager, ownRequestsQuery.data, teamRequestsQuery.data]);

  const policies = settingsQuery.data?.timeOffPolicies;
  const leaveTypes = useMemo(() => policies ? policyOptions(policies) : [], [policies]);
  const directoryEmployees = directoryQuery.data ?? [];
  const availableEmployees = !isManager
    ? directoryEmployees
    : managerDepartmentName
      ? directoryEmployees.filter(
          (employee) => employee.jobDetails.department === managerDepartmentName,
        )
      : [];

  const effectiveEmployeeId = canSelectEmployee
    ? form.employeeId
    : currentEmployeeId ?? "";
  const selectedEmployee = availableEmployees.find(
    (employee) => employee.id === effectiveEmployeeId,
  ) ?? (effectiveEmployeeId === currentEmployeeId ? ownEmployeeQuery.data : undefined);
  const selectedBalanceQuery = useLeaveBalance(
    showRequestDialog && effectiveEmployeeId ? effectiveEmployeeId : undefined,
    isManager && effectiveEmployeeId !== currentEmployeeId ? managerDepartmentId : undefined,
  );
  const selectedPolicy = leaveTypes.find((policy) => policy.id === form.leaveType);
  const selectedBalanceItem = balanceItem(selectedBalanceQuery.data, form.leaveType);

  const duration = useMemo(() => {
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) return 0;
    if (form.halfDay && form.startDate === form.endDate) return 0.5;
    return calculateWorkingDays(
      form.startDate,
      form.endDate,
      holidaysQuery.data ?? [],
    );
  }, [form.endDate, form.halfDay, form.startDate, holidaysQuery.data]);

  const filteredRequests = filter === "all"
    ? requests
    : requests.filter((request) => request.status === filter);
  const pendingCount = requests.filter((request) => request.status === "pending").length;
  const loading = settingsQuery.isLoading ||
    (teamQueryEnabled && teamRequestsQuery.isLoading) ||
    (!canReadAll && Boolean(currentEmployeeId) && ownRequestsQuery.isLoading);

  const leaveTypeLabel = (leaveType: string, fallback?: string) => {
    if (KNOWN_LEAVE_TYPES.has(leaveType)) {
      return t(`timeLeave.leaveRequests.leaveTypes.${leaveType}`);
    }
    return leaveTypes.find((policy) => policy.id === leaveType)?.name || fallback || leaveType;
  };

  const statusLabel = (status: LeaveStatus) =>
    t(`timeLeave.leaveRequests.status.${status}`);

  const statusClass = (status: LeaveStatus) => {
    if (status === "approved") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    if (status === "pending") return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    if (status === "rejected") return "border-destructive/25 bg-destructive/10 text-destructive";
    return "border-border bg-muted text-muted-foreground";
  };

  const resetForm = () => {
    setForm({
      employeeId: canSelectEmployee ? "" : currentEmployeeId ?? "",
      leaveType: "",
      startDate: "",
      endDate: "",
      halfDay: false,
      halfDayType: "morning",
      reason: "",
    });
  };

  const openRequestDialog = () => {
    resetForm();
    setShowRequestDialog(true);
  };

  const createMutation = useCreateLeaveRequest();
  const approveMutation = useApproveLeaveRequest();
  const rejectMutation = useRejectLeaveRequest();
  const cancelMutation = useCancelLeaveRequest();
  const saving = createMutation.isPending || approveMutation.isPending ||
    rejectMutation.isPending || cancelMutation.isPending;

  const notifyDecision = async (
    request: LeaveRequest,
    decision: "approved" | "rejected",
    reason?: string,
  ) => {
    try {
      const emailed = await leaveService.notifyLeaveDecision(tenantId, request, decision, {
        approverName: user?.displayName || user?.email || "HR",
        reason,
      });
      if (!emailed) {
        toast({
          title: t("timeLeave.leaveRequests.toast.noEmailTitle"),
          description: t("timeLeave.leaveRequests.toast.noEmailDesc", {
            name: request.employeeName,
          }),
        });
      }
    } catch {
      toast({
        title: t("timeLeave.leaveRequests.toast.noEmailTitle"),
        description: t("timeLeave.leaveRequests.toast.emailFailedDesc", {
          name: request.employeeName,
        }),
      });
    }
  };

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!effectiveEmployeeId || !form.leaveType || !form.startDate ||
      !form.endDate || !form.reason.trim() || duration <= 0 || !selectedEmployee) {
      toast({
        title: t("timeLeave.leaveRequests.toast.validationTitle"),
        description: t("timeLeave.leaveRequests.toast.validationDesc"),
        variant: "destructive",
      });
      return;
    }
    if (form.endDate < form.startDate) {
      toast({
        title: t("timeLeave.leaveRequests.toast.validationTitle"),
        description: t("timeLeave.leaveRequests.toast.dateOrder"),
        variant: "destructive",
      });
      return;
    }

    const departmentName = selectedEmployee.jobDetails.department ||
      t("timeLeave.leaveRequests.dialog.unassigned");
    const departmentId = departments.find(
      (department) => department.name === departmentName,
    )?.id ?? session?.member.departmentId ?? "";
    try {
      await createMutation.mutateAsync({
        employeeId: effectiveEmployeeId,
        employeeName: employeeName(selectedEmployee) || user?.displayName || user?.email || "Employee",
        department: departmentName,
        departmentId,
        leaveType: form.leaveType as LeaveType,
        leaveTypeLabel: leaveTypeLabel(form.leaveType, selectedPolicy?.name),
        startDate: form.startDate,
        endDate: form.endDate,
        duration,
        halfDay: form.halfDay && form.startDate === form.endDate,
        halfDayType: form.halfDay && form.startDate === form.endDate
          ? form.halfDayType
          : undefined,
        reason: form.reason.trim(),
        hasCertificate: false,
        certificateType: selectedPolicy?.certificateType,
      });
      setShowRequestDialog(false);
      resetForm();
      toast({
        title: t("timeLeave.leaveRequests.toast.successTitle"),
        description: t("timeLeave.leaveRequests.toast.successDesc"),
      });
    } catch {
      toast({
        title: t("timeLeave.leaveRequests.toast.errorTitle"),
        description: t("timeLeave.leaveRequests.toast.submitFailed"),
        variant: "destructive",
      });
    }
  };

  const approve = async () => {
    if (!approveTarget?.id) return;
    const request = approveTarget;
    const requestId = approveTarget.id;
    try {
      await approveMutation.mutateAsync({
        requestId,
        approverId: user?.uid || "",
        approverName: user?.displayName || user?.email || "HR",
      });
      setApproveTarget(null);
      toast({
        title: t("timeLeave.leaveRequests.toast.approvedTitle"),
        description: t("timeLeave.leaveRequests.toast.approvedDesc", {
          name: request.employeeName,
        }),
      });
      void notifyDecision(request, "approved");
    } catch {
      toast({
        title: t("timeLeave.leaveRequests.toast.errorTitle"),
        description: t("timeLeave.leaveRequests.toast.approveFailed"),
        variant: "destructive",
      });
    }
  };

  const reject = async () => {
    if (!rejectTarget?.id || !rejectionReason.trim()) {
      toast({
        title: t("timeLeave.leaveRequests.toast.validationTitle"),
        description: t("timeLeave.leaveRequests.toast.rejectionReasonMissing"),
        variant: "destructive",
      });
      return;
    }
    const request = rejectTarget;
    const requestId = rejectTarget.id;
    const reason = rejectionReason.trim();
    try {
      await rejectMutation.mutateAsync({
        requestId,
        approverId: user?.uid || "",
        approverName: user?.displayName || user?.email || "HR",
        reason,
      });
      setRejectTarget(null);
      setRejectionReason("");
      toast({
        title: t("timeLeave.leaveRequests.toast.rejectedTitle"),
        description: t("timeLeave.leaveRequests.toast.rejectedDesc", {
          name: request.employeeName,
        }),
      });
      void notifyDecision(request, "rejected", reason);
    } catch {
      toast({
        title: t("timeLeave.leaveRequests.toast.errorTitle"),
        description: t("timeLeave.leaveRequests.toast.rejectFailed"),
        variant: "destructive",
      });
    }
  };

  const cancel = async () => {
    if (!cancelTarget?.id) return;
    try {
      await cancelMutation.mutateAsync(cancelTarget.id);
      setCancelTarget(null);
      toast({
        title: t("timeLeave.leaveRequests.toast.successTitle"),
        description: t("timeLeave.leaveRequests.toast.cancelledDesc"),
      });
    } catch {
      toast({
        title: t("timeLeave.leaveRequests.toast.errorTitle"),
        description: t("timeLeave.leaveRequests.toast.cancelFailed"),
        variant: "destructive",
      });
    }
  };

  const canCreate = Boolean(currentEmployeeId || canSelectEmployee);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SEO {...seoConfig.leave} />
        <main className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <PageHeader
            title={t("timeLeave.leaveRequests.title")}
            subtitle={t("timeLeave.leaveRequests.subtitle")}
            cardIcon="tl-leave"
            icon={CalendarDays}
            iconColor="text-cyan-600"
            actions={canCreate ? (
              <Button disabled>
                <Plus className="mr-2 h-4 w-4" />
                {t("timeLeave.leaveRequests.actions.newRequest")}
              </Button>
            ) : undefined}
          />

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
            {(["all", "pending", "approved", "rejected", "cancelled"] as RequestFilter[]).map((status) => (
              <Button
                key={status}
                type="button"
                variant={filter === status ? "secondary" : "ghost"}
                size="sm"
                role="tab"
                aria-selected={filter === status}
                disabled
                className="shrink-0"
              >
                {status === "all"
                  ? t("timeLeave.leaveRequests.tabs.all")
                  : statusLabel(status)}
              </Button>
            ))}
          </div>

          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <article
                key={index}
                className="rounded-xl border border-border/70 bg-card p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-56" />
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-9 w-20" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.leave} />
      <main className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={t("timeLeave.leaveRequests.title")}
          subtitle={t("timeLeave.leaveRequests.subtitle")}
          cardIcon="tl-leave"
          icon={CalendarDays}
          iconColor="text-cyan-600"
          actions={canCreate ? (
            <Button onClick={openRequestDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t("timeLeave.leaveRequests.actions.newRequest")}
            </Button>
          ) : undefined}
        />

        {isManager && !managerDepartmentId && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <p>{t("timeLeave.leaveRequests.scopeMissing")}</p>
          </div>
        )}

        {canDecide && pendingCount > 0 && (
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className="mb-4 flex min-h-11 w-full items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left text-sm transition-colors hover:bg-amber-500/15"
          >
            <Clock className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            <span className="font-semibold tabular-nums">{pendingCount}</span>
            <span>{t("timeLeave.leaveRequests.stats.pending")}</span>
          </button>
        )}

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
          {(["all", "pending", "approved", "rejected", "cancelled"] as RequestFilter[]).map((status) => (
            <Button
              key={status}
              type="button"
              variant={filter === status ? "secondary" : "ghost"}
              size="sm"
              role="tab"
              aria-selected={filter === status}
              onClick={() => setFilter(status)}
              className="shrink-0"
            >
              {status === "all"
                ? t("timeLeave.leaveRequests.tabs.all")
                : statusLabel(status)}
            </Button>
          ))}
        </div>

        {filteredRequests.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-card px-4 py-12 text-center">
            <CalendarDays className="mx-auto mb-3 h-10 w-10 text-cyan-600" />
            <h2 className="font-semibold">{t("timeLeave.leaveRequests.table.empty")}</h2>
            {canCreate && (
              <Button className="mt-5" onClick={openRequestDialog}>
                <Plus className="mr-2 h-4 w-4" />
                {t("timeLeave.leaveRequests.actions.newRequest")}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((request) => {
              const isOwn = request.employeeId === currentEmployeeId;
              return (
                <article
                  key={request.id}
                  className="rounded-xl border border-border/70 bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{request.employeeName}</h2>
                        <Badge variant="outline" className={statusClass(request.status)}>
                          {statusLabel(request.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground/90">
                        {leaveTypeLabel(request.leaveType, request.leaveTypeLabel)}
                        <span className="font-normal text-muted-foreground">
                          {" · "}{t("timeLeave.leaveRequests.table.durationValue", { days: request.duration })}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateTL(parseDateISO(request.startDate), { day: "numeric", month: "short", year: "numeric" })}
                        {request.endDate !== request.startDate && (
                          <> — {formatDateTL(parseDateISO(request.endDate), { day: "numeric", month: "short", year: "numeric" })}</>
                        )}
                        {request.department ? <> · {request.department}</> : null}
                      </p>
                      {request.reason && (
                        <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{request.reason}</p>
                      )}
                      {request.status === "rejected" && request.rejectionReason && (
                        <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                          {request.rejectionReason}
                        </p>
                      )}
                    </div>

                    {request.status === "pending" && (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {canDecide && (!isManager || request.departmentId === managerDepartmentId) && (
                          <>
                            <Button size="sm" onClick={() => setApproveTarget(request)}>
                              <Check className="mr-1.5 h-4 w-4" />
                              {t("timeLeave.leaveRequests.actions.approve")}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setRejectTarget(request)}>
                              <X className="mr-1.5 h-4 w-4" />
                              {t("timeLeave.leaveRequests.actions.reject")}
                            </Button>
                          </>
                        )}
                        {isOwn && (
                          <Button size="sm" variant="ghost" onClick={() => setCancelTarget(request)}>
                            {t("timeLeave.leaveRequests.actions.cancel")}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={showRequestDialog} onOpenChange={(open) => {
        setShowRequestDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("timeLeave.leaveRequests.dialog.title")}</DialogTitle>
            <DialogDescription>{t("timeLeave.leaveRequests.dialog.description")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRequest} className="space-y-4">
            {canSelectEmployee ? (
              <div className="space-y-2">
                <Label>{t("timeLeave.leaveRequests.dialog.employee")}</Label>
                <Select value={form.employeeId} onValueChange={(employeeId) =>
                  setForm((current) => ({ ...current, employeeId }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("timeLeave.leaveRequests.dialog.employeePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEmployees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id!}>
                        {employeeName(employee)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm font-medium">
                {employeeName(ownEmployeeQuery.data) || user?.displayName || user?.email}
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("timeLeave.leaveRequests.dialog.leaveType")}</Label>
              <Select value={form.leaveType} onValueChange={(leaveType) =>
                setForm((current) => ({ ...current, leaveType }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t("timeLeave.leaveRequests.dialog.leaveTypePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      {leaveTypeLabel(policy.id, policy.name)} · {t("timeLeave.leaveRequests.dialog.daysPerYear", { days: policy.daysPerYear })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.leaveType && (
              <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium">{t("timeLeave.leaveRequests.dialog.balanceTitle")}</p>
                <p className="mt-1 text-muted-foreground">
                  {selectedBalanceItem
                    ? t("timeLeave.leaveRequests.dialog.balanceSummary", {
                        remaining: selectedBalanceItem.remaining,
                        used: selectedBalanceItem.used,
                        pending: selectedBalanceItem.pending,
                      })
                    : t("timeLeave.leaveRequests.dialog.balanceSummary", {
                        remaining: selectedPolicy?.daysPerYear ?? 0,
                        used: 0,
                        pending: 0,
                      })}
                </p>
                {selectedPolicy?.requiresCertificate && selectedPolicy.certificateType && (
                  <p className="mt-1 text-amber-700 dark:text-amber-300">
                    {t("timeLeave.leaveRequests.dialog.requiresCertificate", {
                      certificate: selectedPolicy.certificateType,
                    })}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leave-start">{t("timeLeave.leaveRequests.dialog.startDate")}</Label>
                <Input
                  id="leave-start"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                    halfDay: current.halfDay && event.target.value === current.endDate,
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leave-end">{t("timeLeave.leaveRequests.dialog.endDate")}</Label>
                <Input
                  id="leave-end"
                  type="date"
                  min={form.startDate || undefined}
                  value={form.endDate}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    endDate: event.target.value,
                    halfDay: current.halfDay && event.target.value === current.startDate,
                  }))}
                />
              </div>
            </div>

            {form.startDate && form.startDate === form.endDate && (
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.halfDay}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    halfDay: event.target.checked,
                  }))}
                  className="h-4 w-4 accent-primary"
                />
                {t("timeLeave.leaveRequests.dialog.halfDay")}
                {form.halfDay && (
                  <Select value={form.halfDayType} onValueChange={(halfDayType: "morning" | "afternoon") =>
                    setForm((current) => ({ ...current, halfDayType }))}>
                    <SelectTrigger className="ml-auto h-9 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">{t("timeLeave.leaveRequests.dialog.halfDayMorning")}</SelectItem>
                      <SelectItem value="afternoon">{t("timeLeave.leaveRequests.dialog.halfDayAfternoon")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </label>
            )}

            {form.startDate && form.endDate && (
              <p className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium",
                duration > 0 ? "bg-cyan-500/10 text-cyan-800 dark:text-cyan-200" : "bg-destructive/10 text-destructive",
              )}>
                {t("timeLeave.leaveRequests.dialog.durationValue", { days: duration })}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="leave-reason">{t("timeLeave.leaveRequests.dialog.reason")}</Label>
              <Textarea
                id="leave-reason"
                value={form.reason}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder={t("timeLeave.leaveRequests.dialog.reasonPlaceholder")}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowRequestDialog(false)}>
                {t("timeLeave.leaveRequests.actions.cancel")}
              </Button>
              <Button type="submit" disabled={saving || holidaysQuery.isLoading}>
                {(saving || holidaysQuery.isLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("timeLeave.leaveRequests.actions.submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(approveTarget)} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("timeLeave.leaveRequests.approveConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {approveTarget ? t("timeLeave.leaveRequests.approveConfirm.description", {
                name: approveTarget.employeeName,
                type: leaveTypeLabel(approveTarget.leaveType, approveTarget.leaveTypeLabel),
                days: approveTarget.duration,
              }) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("timeLeave.leaveRequests.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void approve()} disabled={saving}>
              {t("timeLeave.leaveRequests.approveConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => {
        if (!open) {
          setRejectTarget(null);
          setRejectionReason("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("timeLeave.leaveRequests.reject.title")}</DialogTitle>
            <DialogDescription>
              {rejectTarget ? t("timeLeave.leaveRequests.reject.description", { name: rejectTarget.employeeName }) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">{t("timeLeave.leaveRequests.reject.reason")}</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder={t("timeLeave.leaveRequests.reject.placeholder")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              {t("timeLeave.leaveRequests.actions.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void reject()} disabled={saving}>
              {t("timeLeave.leaveRequests.reject.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(cancelTarget)} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("timeLeave.leaveRequests.actions.cancel")}</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget
                ? t("timeLeave.leaveRequests.approveConfirm.description", {
                    name: cancelTarget.employeeName,
                    type: leaveTypeLabel(cancelTarget.leaveType, cancelTarget.leaveTypeLabel),
                    days: cancelTarget.duration,
                  })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.back")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void cancel()} disabled={saving}>
              {t("timeLeave.leaveRequests.actions.cancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
