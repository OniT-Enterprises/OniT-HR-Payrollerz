import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeDirectory } from "@/hooks/useEmployees";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO, seoConfig } from "@/components/SEO";
import {
  UserMinus,
  FileText,
  Mail,
  Key,
  CreditCard,
  Building,
  CheckCircle,
  Clock,
  DollarSign,
  Archive,
  Download,
  Search,
  Loader2,
  AlertTriangle,
  CalendarClock,
  Landmark,
  ShieldAlert,
} from "lucide-react";
import {
  useActiveCases,
  useCompletedCases,
  useCreateOffboardingCase,
  useSaveArticle56FinalPay,
  useSetSeveranceIncluded,
  useUpdateChecklistItem,
  useUpdateExitInterviewField,
} from "@/hooks/useHiring";
import {
  type OffboardingCase,
  type OffboardingChecklist,
  type DepartureReason,
  DEPARTURE_REASONS,
  getChecklistProgress,
  severanceDefaultForReason,
} from "@/services/offboardingService";
import {
  onboardingService,
  type EquipmentAsset,
  type OnboardingCase,
} from "@/services/onboardingService";
import { disciplinaryService } from "@/services/disciplinaryService";
import {
  requiredNoticeDays,
  noticeDaysGiven,
  noticeShortfallDays,
  inssCessationDeadline,
  art55IndemnityMonths,
  art55Indemnity,
} from "@/lib/payroll/leaver-final-pay";
import { useEmployeeById } from "@/hooks/useEmployees";
import { exportToCSV } from "@/lib/csvExport";
import {
  EXIT_INTERVIEW_CSV_COLUMNS,
  hasExitInterviewAnswers,
  recommendLabel,
  satisfactionLabel,
  toExitInterviewRows,
} from "@/lib/hiring/exit-interview-export";
import { useSettings } from "@/hooks/useSettings";
import { useTenantId } from "@/contexts/TenantContext";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import { formatDateTL } from "@/lib/dateUtils";

export default function Offboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedEmployeeId = searchParams.get("employeeId") || searchParams.get("employee") || "";
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const tenantId = useTenantId();
  const { data: employees = [], isLoading: employeesLoading } = useEmployeeDirectory({ status: 'active' });

  // Data via React Query
  const { data: activeCases = [], isLoading: activeCasesLoading } = useActiveCases();
  const { data: completedCases = [], isLoading: completedCasesLoading } = useCompletedCases();
  const createOffboardingMutation = useCreateOffboardingCase();
  const updateChecklistMutation = useUpdateChecklistItem();
  const updateExitInterviewMutation = useUpdateExitInterviewField();
  const saveArticle56Mutation = useSaveArticle56FinalPay();
  const setSeveranceMutation = useSetSeveranceIncluded();

  const loading = activeCasesLoading || completedCasesLoading;

  const [selectedCase, setSelectedCase] = useState<OffboardingCase | null>(null);
  const [showDialog, setShowDialog] = useState(Boolean(requestedEmployeeId));
  const queryClient = useQueryClient();

  const onboardingQueryKey = ["onboarding", "byEmployee", tenantId, selectedCase?.employeeId ?? ""];
  const onboardingQuery = useQuery({
    queryKey: onboardingQueryKey,
    queryFn: () =>
      selectedCase?.employeeId
        ? onboardingService.getCaseByEmployee(tenantId, selectedCase.employeeId)
        : Promise.resolve(null),
    enabled: !!tenantId && !!selectedCase?.employeeId,
    staleTime: 5 * 60 * 1000,
  });

  const onboardingCase = onboardingQuery.data ?? null;

  // Employee master record for the selected case (hire date for the notice
  // computation and the Art. 57 certificate). Works even once terminated.
  const selectedEmployeeQuery = useEmployeeById(selectedCase?.employeeId);
  const { data: settings } = useSettings();

  // E8 (Arts. 50(4), 51, 55): dismissal for cause without a concluded written
  // disciplinary process is automatically unlawful — soft-gate warning only.
  const caseDisciplinaryQuery = useQuery({
    queryKey: ["disciplinary", "byEmployee", tenantId, selectedCase?.employeeId ?? ""],
    queryFn: () => disciplinaryService.getEmployeeRecords(tenantId, selectedCase!.employeeId),
    enabled:
      !!tenantId && !!selectedCase?.employeeId && selectedCase?.departureReason === "termination",
    staleTime: 60 * 1000,
  });
  const disciplinaryWarningText =
    t("hiring.offboarding.disciplinary.noConcludedWarning") ||
    "No concluded disciplinary case is on file for this employee. Dismissal for cause without the Art. 50(4) written process (accusation, defence, reasoned decision) is automatically unlawful (Art. 51) and exposes you to Art. 55 indemnity — confirm with your accountant.";
  const showCaseDisciplinaryWarning =
    selectedCase?.departureReason === "termination" &&
    caseDisciplinaryQuery.isSuccess &&
    !caseDisciplinaryQuery.data.some((r) => r.status === "closed");
  // E7 (Arts. 49(8)-(9), 53(2)-(3)): statutory notice for the selected case.
  const selectedHireDate = selectedEmployeeQuery.data?.jobDetails?.hireDate || "";
  const noticeReq =
    selectedCase?.lastWorkingDay
      ? requiredNoticeDays(selectedCase.departureReason, selectedHireDate, selectedCase.lastWorkingDay)
      : null;
  const noticeGiven =
    selectedCase?.noticeDate && selectedCase?.lastWorkingDay
      ? noticeDaysGiven(selectedCase.noticeDate, selectedCase.lastWorkingDay)
      : null;
  const noticeShortfall =
    noticeReq && selectedCase?.noticeDate && selectedCase?.lastWorkingDay
      ? noticeShortfallDays(selectedCase.noticeDate, selectedCase.lastWorkingDay, noticeReq.days)
      : null;

  // F12 (DL 20/2017 Art. 5(2)-(3)): concrete INSS cessation deadline.
  const inssDeadline = selectedCase?.lastWorkingDay
    ? inssCessationDeadline(selectedCase.lastWorkingDay)
    : null;

  // Art. 55(3) unlawful-dismissal indemnity — REFERENCE figure only.
  // COURT-AWARDED money: shown only on employer-initiated causes so the
  // employer sees the exposure; never a payroll earning, never auto-paid.
  const art55Applicable =
    selectedCase?.departureReason === "redundancy" ||
    selectedCase?.departureReason === "termination";
  const art55Months =
    art55Applicable && selectedCase?.lastWorkingDay
      ? art55IndemnityMonths(selectedHireDate, selectedCase.lastWorkingDay)
      : 0;
  // Same salary source the Art. 56 card shows: the frozen case snapshot when
  // one was calculated, else the live employee master record.
  const art55MonthlySalary =
    selectedCase?.article56FinalPay?.monthlySalary ??
    selectedEmployeeQuery.data?.compensation?.monthlySalary ??
    0;
  const art55Amount =
    art55Months > 0 && art55MonthlySalary > 0 && selectedCase?.lastWorkingDay
      ? art55Indemnity(art55MonthlySalary, selectedHireDate, selectedCase.lastWorkingDay)
      : 0;

  // F11 (Art. 57): bilingual work certificate, generated client-side.
  const [certGenerating, setCertGenerating] = useState(false);
  const generateWorkCertificate = async () => {
    if (!selectedCase) return;
    try {
      setCertGenerating(true);
      // Dynamic import keeps @react-pdf out of the page bundle.
      const { downloadWorkCertificate } = await import("@/lib/pdf/workCertificate");
      await downloadWorkCertificate({
        companyDetails: settings?.companyDetails,
        workerName: selectedCase.employeeName,
        position: selectedCase.position || selectedEmployeeQuery.data?.jobDetails?.position || "",
        department: selectedCase.department,
        hireDate: selectedEmployeeQuery.data?.jobDetails?.hireDate || "",
        lastWorkingDay: selectedCase.lastWorkingDay,
      });
    } catch (error) {
      toast({
        title: t("common.error") || "Error",
        description: error instanceof Error ? error.message : "Could not generate the certificate",
        variant: "destructive",
      });
    } finally {
      setCertGenerating(false);
    }
  };

  const toggleAssetReturned = async (assetId: string, returned: boolean) => {
    if (!onboardingCase?.id) return;
    const previous = onboardingCase;
    const updatedEquipment = (onboardingCase.equipment || []).map((a) =>
      a.id === assetId
        ? { ...a, returned, returnedAt: returned ? new Date().toISOString() : undefined }
        : a,
    );
    queryClient.setQueryData<OnboardingCase | null>(onboardingQueryKey, {
      ...onboardingCase,
      equipment: updatedEquipment,
    });
    try {
      await onboardingService.updateCase(tenantId, onboardingCase.id, {
        equipment: updatedEquipment,
      });
      const allReturned =
        updatedEquipment.length > 0 && updatedEquipment.every((a) => a.returned);
      if (selectedCase?.id && allReturned !== selectedCase.checklist.equipmentReturned) {
        updateChecklist(selectedCase.id, "equipmentReturned", allReturned);
      }
    } catch (error) {
      queryClient.setQueryData<OnboardingCase | null>(onboardingQueryKey, previous);
      toast({
        title: "Could not update",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  // New offboarding form data
  const [newOffboarding, setNewOffboarding] = useState({
    employeeId: requestedEmployeeId,
    departureReason: "" as DepartureReason | "",
    lastWorkingDay: "",
    noticeDate: "",
    notes: "",
    department: "all",
    search: "",
  });

  // E8 warning at CREATE time too: same soft gate for the dialog's selection.
  const dialogDisciplinaryQuery = useQuery({
    queryKey: ["disciplinary", "byEmployee", tenantId, newOffboarding.employeeId],
    queryFn: () => disciplinaryService.getEmployeeRecords(tenantId, newOffboarding.employeeId),
    enabled:
      !!tenantId && !!newOffboarding.employeeId && newOffboarding.departureReason === "termination",
    staleTime: 60 * 1000,
  });
  const showDialogDisciplinaryWarning =
    newOffboarding.departureReason === "termination" &&
    !!newOffboarding.employeeId &&
    dialogDisciplinaryQuery.isSuccess &&
    !dialogDisciplinaryQuery.data.some((r) => r.status === "closed");

  // Filter employees for selection
  const filteredEmployees = employees.filter((employee) => {
    const matchesDepartment =
      newOffboarding.department === "all" ||
      employee.jobDetails.department === newOffboarding.department;

    const matchesSearch =
      !newOffboarding.search ||
      `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
        .toLowerCase()
        .includes(newOffboarding.search.toLowerCase());

    return matchesDepartment && matchesSearch;
  });

  const departments = Array.from(
    new Set(employees.map((emp) => emp.jobDetails.department))
  ).sort();

  const handleStartOffboarding = () => {
    if (
      !newOffboarding.employeeId
      || !newOffboarding.departureReason
      || !newOffboarding.lastWorkingDay
    ) {
      toast({
        title: t("hiring.offboarding.toast.validationTitle"),
        description: t("hiring.offboarding.toast.validationDesc"),
        variant: "destructive",
      });
      return;
    }

    const employee = employees.find((emp) => emp.id === newOffboarding.employeeId);
    if (!employee) return;

    createOffboardingMutation.mutate(
      {
        employeeId: employee.id!,
        employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        department: employee.jobDetails.department,
        position: employee.jobDetails.position,
        departureReason: newOffboarding.departureReason as DepartureReason,
        lastWorkingDay: newOffboarding.lastWorkingDay,
        noticeDate: newOffboarding.noticeDate,
        notes: newOffboarding.notes || "",
        createdBy: user?.email || "Unknown",
      },
      {
        onSuccess: () => {
          toast({
            title: t("hiring.offboarding.toast.startedTitle"),
            description: t("hiring.offboarding.toast.startedDesc", {
              name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            }),
          });
          setShowDialog(false);
          setNewOffboarding({
            employeeId: "",
            departureReason: "",
            lastWorkingDay: "",
            noticeDate: "",
            notes: "",
            department: "all",
            search: "",
          });
        },
        onError: () => {
          toast({
            title: t("hiring.offboarding.toast.errorTitle"),
            description: "Failed to start offboarding process",
            variant: "destructive",
          });
        },
      }
    );
  };

  const updateChecklist = (caseId: string, item: keyof OffboardingChecklist, value: boolean) => {
    updateChecklistMutation.mutate(
      { caseId, item, value },
      {
        onSuccess: () => {
          // Optimistically update selected case
          if (selectedCase?.id === caseId) {
            const updatedChecklist = { ...selectedCase.checklist, [item]: value };
            const progress = getChecklistProgress(updatedChecklist);
            if (progress === 100) {
              setSelectedCase(null);
            } else {
              setSelectedCase({
                ...selectedCase,
                checklist: updatedChecklist,
                status: progress > 0 ? "in_progress" : "pending",
              } as OffboardingCase);
            }
          }
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to update checklist",
            variant: "destructive",
          });
        },
      }
    );
  };

  const updateExitInterview = (caseId: string, field: string, value: string) => {
    updateExitInterviewMutation.mutate(
      { caseId, field: field as keyof OffboardingCase["exitInterview"], value },
      {
        onSuccess: () => {
          // Optimistically update selected case
          if (selectedCase?.id === caseId) {
            setSelectedCase({
              ...selectedCase,
              exitInterview: { ...selectedCase.exitInterview, [field]: value },
            });
          }
        },
      }
    );
  };

  const saveArticle56FinalPay = () => {
    if (!selectedCase?.id || !user?.uid) return;
    saveArticle56Mutation.mutate(
      { caseId: selectedCase.id, calculatedBy: user.uid },
      {
        onSuccess: (snapshot) => {
          const checklist = { ...selectedCase.checklist, finalPayCalculated: true };
          if (getChecklistProgress(checklist) === 100) {
            setSelectedCase(null);
          } else {
            setSelectedCase({
              ...selectedCase,
              article56FinalPay: snapshot,
              checklist,
              status: "in_progress",
            });
          }
          toast({
            title: t("hiring.offboarding.finalPay.savedTitle") || "Article 56 calculation saved",
            description: t("hiring.offboarding.finalPay.savedDescription")
              || "The source salary, service dates, and statutory result were frozen on this case.",
          });
        },
        onError: (error) => {
          // Engine RangeErrors (bad dates on the source records) mean the
          // record needs fixing, not that the app failed — frame them that way.
          toast({
            title: error instanceof RangeError
              ? t("common.needsReviewTitle")
              : t("hiring.offboarding.finalPay.errorTitle") || "Could not calculate final pay",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        },
      },
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20";
      case "in_progress":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20";
      case "pending":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return t("hiring.offboarding.status.completed");
      case "in_progress":
        return t("hiring.offboarding.status.inProgress");
      case "pending":
        return t("hiring.offboarding.status.pending");
      default:
        return status;
    }
  };

  const getDepartureReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      resignation: t("hiring.offboarding.dialog.reasons.resignation") || "Resignation",
      redundancy: t("hiring.offboarding.dialog.reasons.redundancy") || "Redundancy",
      termination: t("hiring.offboarding.dialog.reasons.termination") || "Termination",
      retirement: t("hiring.offboarding.dialog.reasons.retirement") || "Retirement",
      contract_end: t("hiring.offboarding.dialog.reasons.contractEnd") || "Contract end",
      mutual_agreement:
        t("hiring.offboarding.dialog.reasons.mutualAgreement") || "Mutual agreement",
      death: t("hiring.offboarding.dialog.reasons.death") || "Death of employee",
      other: t("hiring.offboarding.dialog.reasons.other") || "Other",
    };
    return labels[reason] || reason;
  };

  // Exit-interview surfacing: answers are captured live on each case above;
  // this is the read-only view + CSV export over the completed cases.
  const completedWithInterviews = completedCases.filter(hasExitInterviewAnswers);

  const getSatisfactionLabel = (value: string) => {
    const keys: Record<string, string> = {
      "very-satisfied": "verySatisfied",
      satisfied: "satisfied",
      neutral: "neutral",
      dissatisfied: "dissatisfied",
      "very-dissatisfied": "veryDissatisfied",
    };
    const key = keys[value];
    return (
      (key && t(`hiring.offboarding.exit.overallOptions.${key}`)) ||
      satisfactionLabel(value)
    );
  };

  const getRecommendLabel = (value: string) =>
    t(`hiring.offboarding.exit.recommendOptions.${value}`) || recommendLabel(value);

  const exportExitInterviews = () => {
    const columns = EXIT_INTERVIEW_CSV_COLUMNS.map((col) => ({
      key: col.key,
      label: t(`hiring.offboarding.exitInterviews.csv.${col.key}`) || col.label,
    }));
    exportToCSV(toExitInterviewRows(completedCases), "exit_interviews", columns);
    toast({
      title: t("hiring.offboarding.exitInterviews.exportedTitle") || "Export ready",
      description:
        t("hiring.offboarding.exitInterviews.exportedDesc") ||
        "Exit interview answers downloaded as a CSV file.",
    });
  };

  if (loading || employeesLoading) {
    return (
      <div className="min-h-screen bg-background">
          <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.offboarding} />

      {/* Main Content */}
      <div className="mx-auto max-w-screen-2xl px-6 py-5">
        <PageHeader
          title={t("hiring.offboarding.title")}
          subtitle={t("hiring.offboarding.subtitle")}
          icon={UserMinus}
          iconColor="text-blue-500"
          actions={
            employees.length > 0 ? (
              <Button
                onClick={() => setShowDialog(true)}
              >
                <UserMinus className="mr-2 h-4 w-4" />
                {t("hiring.offboarding.actions.start")}
              </Button>
            ) : undefined
          }
        />

        {/* Start Offboarding Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("hiring.offboarding.dialog.title")}</DialogTitle>
              <DialogDescription>{t("hiring.offboarding.dialog.description")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("hiring.offboarding.dialog.department")}</Label>
                  <Select
                    value={newOffboarding.department}
                    onValueChange={(value) =>
                      setNewOffboarding((prev) => ({ ...prev, department: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("hiring.offboarding.dialog.departmentAll")}
                      </SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("hiring.offboarding.dialog.search")}</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t("hiring.offboarding.dialog.searchPlaceholder")}
                      value={newOffboarding.search}
                      onChange={(e) =>
                        setNewOffboarding((prev) => ({ ...prev, search: e.target.value }))
                      }
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  {t("hiring.offboarding.dialog.selectEmployee", {
                    count: filteredEmployees.length,
                  })}
                </Label>
                <Select
                  value={newOffboarding.employeeId}
                  onValueChange={(value) =>
                    setNewOffboarding((prev) => ({ ...prev, employeeId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("hiring.offboarding.dialog.selectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredEmployees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id || ""}>
                        {employee.personalInfo.firstName} {employee.personalInfo.lastName} -{" "}
                        {employee.jobDetails.department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("hiring.offboarding.dialog.reason")}</Label>
                <Select
                  value={newOffboarding.departureReason}
                  onValueChange={(value) =>
                    setNewOffboarding((prev) => ({ ...prev, departureReason: value as DepartureReason }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("hiring.offboarding.dialog.reasonPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTURE_REASONS.map((reason) => (
                      <SelectItem key={reason.id} value={reason.id}>
                        {getDepartureReasonLabel(reason.id) || reason.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {showDialogDisciplinaryWarning && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      {disciplinaryWarningText}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("hiring.offboarding.dialog.lastDay")}</Label>
                  <Input
                    type="date"
                    value={newOffboarding.lastWorkingDay}
                    required
                    onChange={(e) =>
                      setNewOffboarding((prev) => ({ ...prev, lastWorkingDay: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("hiring.offboarding.dialog.noticeDate")}</Label>
                  <Input
                    type="date"
                    value={newOffboarding.noticeDate}
                    onChange={(e) =>
                      setNewOffboarding((prev) => ({ ...prev, noticeDate: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("hiring.offboarding.dialog.notes")}</Label>
                <Textarea
                  placeholder={t("hiring.offboarding.dialog.notesPlaceholder")}
                  value={newOffboarding.notes}
                  onChange={(e) =>
                    setNewOffboarding((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                {t("hiring.offboarding.dialog.cancel")}
              </Button>
              <Button onClick={handleStartOffboarding} disabled={createOffboardingMutation.isPending}>
                {createOffboardingMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  t("hiring.offboarding.dialog.confirm")
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {employees.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="text-center py-16">
              <div className="p-4 rounded-full bg-muted inline-flex mb-4">
                <UserMinus className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {t("hiring.offboarding.empty.noEmployeesTitle")}
              </h3>
              <p className="text-muted-foreground mb-6">
                {t("hiring.offboarding.empty.noEmployeesDesc")}
              </p>
              <Button variant="outline" onClick={() => navigate("/people/add")}>
                Add Employees
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Ongoing Departures */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    {t("hiring.offboarding.ongoing.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("hiring.offboarding.ongoing.description", { count: activeCases.length })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {activeCases.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="p-3 rounded-full bg-muted inline-flex mb-4">
                        <Clock className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t("hiring.offboarding.ongoing.empty")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeCases.map((case_) => (
                        <Card
                          key={case_.id}
                          className={`cursor-pointer transition-all duration-200 border-border/50 ${
                            selectedCase?.id === case_.id
                              ? "ring-2 ring-blue-500 shadow-lg"
                              : "hover:bg-muted/30 hover:shadow-md"
                          }`}
                          onClick={() => setSelectedCase(case_)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarFallback>
                                    {case_.employeeName.split(" ").map((n) => n[0]).join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <h4 className="font-semibold">{case_.employeeName}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {case_.department} • {case_.position}
                                  </p>
                                </div>
                              </div>
                              <Badge className={getStatusColor(case_.status)}>
                                {getStatusLabel(case_.status)}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>{t("hiring.offboarding.progress.label")}</span>
                                <span>
                                  {t("hiring.offboarding.progress.completed", {
                                    percent: getChecklistProgress(case_.checklist),
                                  })}
                                </span>
                              </div>
                              <Progress value={getChecklistProgress(case_.checklist)} className="h-2" />
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">
                                  {t("hiring.offboarding.progress.reason", {
                                    reason: getDepartureReasonLabel(case_.departureReason),
                                  })}
                                </span>
                                <span className="text-muted-foreground">
                                  {t("hiring.offboarding.progress.lastDay", {
                                    date: case_.lastWorkingDay || t("hiring.offboarding.progress.tbd"),
                                  })}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Offboarding Checklist */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    {selectedCase
                      ? t("hiring.offboarding.checklist.titleWithName", { name: selectedCase.employeeName })
                      : t("hiring.offboarding.checklist.title")}
                  </CardTitle>
                  <CardDescription>
                    {selectedCase
                      ? t("hiring.offboarding.checklist.description")
                      : t("hiring.offboarding.checklist.empty")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedCase ? (
                    <div className="text-center py-8">
                      <div className="p-3 rounded-full bg-muted inline-flex mb-4">
                        <CheckCircle className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t("hiring.offboarding.checklist.emptyPrompt")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Progress Summary */}
                      <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{t("hiring.offboarding.progress.overall")}</span>
                          <span className="text-sm text-blue-600 dark:text-blue-400 font-semibold">
                            {getChecklistProgress(selectedCase.checklist)}%
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${getChecklistProgress(selectedCase.checklist)}%` }}
                          />
                        </div>
                      </div>

                      {/* E8 — Arts. 50(4), 51, 55: dismissal-without-process soft gate.
                          Non-blocking: the staged disciplinary workflow is its own cycle. */}
                      {showCaseDisciplinaryWarning && (
                        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          <p className="text-xs text-amber-800 dark:text-amber-300">
                            {disciplinaryWarningText}
                          </p>
                        </div>
                      )}

                      {/* E7 — Arts. 49(8)-(9), 53(2)-(3): statutory notice check.
                          Informational only, never blocks the case. */}
                      {noticeReq && noticeReq.days > 0 && (
                        <div className="space-y-1.5 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                            {selectedCase.noticeDate && noticeGiven !== null ? (
                              <span>
                                {t("hiring.offboarding.notice.required") || "Required notice"}:{" "}
                                {noticeReq.days} {t("hiring.offboarding.notice.days") || "days"} (
                                {noticeReq.basis}) —{" "}
                                {t("hiring.offboarding.notice.given") || "given"}: {noticeGiven}{" "}
                                {t("hiring.offboarding.notice.days") || "days"}
                              </span>
                            ) : (
                              <span>
                                {t("hiring.offboarding.notice.notRecorded")
                                  || "Notice date not recorded"}{" "}
                                — {t("hiring.offboarding.notice.requiredForReason")
                                  || "required notice for this departure reason is"}{" "}
                                {noticeReq.days} {t("hiring.offboarding.notice.days") || "days"} (
                                {noticeReq.basis})
                              </span>
                            )}
                          </div>
                          {noticeShortfall !== null && noticeShortfall > 0 && (
                            <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>
                                {selectedCase.departureReason === "resignation"
                                  ? (t("hiring.offboarding.notice.shortfallWorker")
                                      || "Notice is short: the worker owes the employer the missing")
                                  : (t("hiring.offboarding.notice.shortfallEmployer")
                                      || "Notice is short: the employer owes the worker the missing")}{" "}
                                {noticeShortfall} {t("hiring.offboarding.notice.daysPay") || "days' pay"} (
                                {selectedCase.departureReason === "resignation"
                                  ? "Lei 4/2012 Art. 53(3)"
                                  : "Lei 4/2012 Art. 49(9)"}
                                ).
                              </span>
                            </p>
                          )}
                        </div>
                      )}

                      {/* Art. 55(3) — unlawful-dismissal indemnity REFERENCE.
                          COURT-AWARDED money only (a court must first rule the
                          dismissal unlawful, Arts. 54(3)/55): never a payroll
                          earning, never auto-paid. Employer-initiated causes
                          only. Informational, never blocks the case. */}
                      {art55Applicable && art55Months > 0 && (
                        <div className="space-y-1.5 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
                          <div className="flex items-start gap-2">
                            <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>
                              {t("hiring.offboarding.art55.title")
                                || "Art. 55 reference (court-awarded if dismissal is ruled unlawful)"}
                              {": "}
                              <span className="font-medium text-foreground">
                                {art55Months}{" "}
                                {art55Months === 1
                                  ? (t("hiring.offboarding.art55.month") || "month")
                                  : (t("hiring.offboarding.art55.months") || "months")}
                                {art55Amount > 0 && <> = {formatCurrencyTL(art55Amount)}</>}
                              </span>{" "}
                              (Lei 4/2012 Art. 55(3)).
                            </span>
                          </div>
                          <p className="pl-[22px]">
                            {t("hiring.offboarding.art55.note")
                              || "Not payable through payroll — a court fixes it. The Art. 50(4) written disciplinary process avoids this exposure."}
                          </p>
                        </div>
                      )}

                      {/* Equipment issued at onboarding */}
                      {onboardingCase && onboardingCase.equipment && onboardingCase.equipment.length > 0 && (
                        <div className="space-y-3 rounded-lg border border-border/50 p-4 bg-muted/20">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm flex items-center gap-2">
                              <Building className="h-4 w-4 text-muted-foreground" />
                              Equipment issued at onboarding
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {onboardingCase.equipment.filter((a) => a.returned).length}/
                              {onboardingCase.equipment.length} returned
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {onboardingCase.equipment.map((asset: EquipmentAsset) => (
                              <div
                                key={asset.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                                  asset.returned
                                    ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                                    : "border-border/50"
                                }`}
                              >
                                <Checkbox
                                  checked={!!asset.returned}
                                  onCheckedChange={(v) =>
                                    toggleAssetReturned(asset.id, v === true)
                                  }
                                  className="mt-0.5 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium capitalize">
                                    {asset.type.replace("_", " ")}
                                    {asset.make || asset.model ? (
                                      <span className="text-muted-foreground font-normal">
                                        {" "}— {[asset.make, asset.model].filter(Boolean).join(" ")}
                                      </span>
                                    ) : null}
                                  </div>
                                  {(asset.serialNumber || asset.assetTag) && (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {asset.serialNumber && <>S/N: {asset.serialNumber}</>}
                                      {asset.serialNumber && asset.assetTag && " · "}
                                      {asset.assetTag && <>Tag: {asset.assetTag}</>}
                                    </div>
                                  )}
                                  {asset.notes && (
                                    <div className="text-xs text-muted-foreground mt-0.5 italic">
                                      {asset.notes}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          {onboardingCase.companyEmail && (
                            <div className="text-xs text-muted-foreground pt-1 border-t border-border/30 flex items-center gap-2">
                              <Mail className="h-3 w-3" />
                              Company email to deactivate:{" "}
                              <span className="font-mono">{onboardingCase.companyEmail}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {onboardingCase === null && selectedCase?.employeeId && !onboardingQuery.isLoading && (
                        <div className="rounded-lg border border-dashed border-border/50 p-4 text-xs text-muted-foreground">
                          No onboarding record found for this employee — use the checklist below to
                          track equipment return manually.
                        </div>
                      )}

                      {/* Article 56 calculation is source-derived, never a manual checkbox. */}
                      <div className="space-y-3 rounded-lg border border-border/70 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h4 className="flex items-center gap-2 text-sm font-medium">
                              <DollarSign className="h-4 w-4 text-primary" />
                              {t("hiring.offboarding.finalPay.title") || "Article 56 service compensation"}
                            </h4>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t("hiring.offboarding.finalPay.description")
                                || "One monthly salary for each completed five-year period of service."}
                            </p>
                          </div>
                          {selectedCase.article56FinalPay ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              {t("hiring.offboarding.finalPay.saved") || "Calculated"}
                            </Badge>
                          ) : null}
                        </div>

                        {/* Cause-aware, editable Art. 56 decision. Defaults follow
                            real TL practice (paid on employer-initiated endings,
                            not on resignation); the statute's literal text is
                            cause-independent, hence the confirm-with-accountant
                            note when it is switched off. */}
                        <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
                          <Switch
                            checked={
                              selectedCase.includeArt56Severance ??
                              severanceDefaultForReason(selectedCase.departureReason)
                            }
                            disabled={setSeveranceMutation.isPending || selectedCase.status === "completed"}
                            onCheckedChange={(checked) => {
                              if (!selectedCase.id) return;
                              setSeveranceMutation.mutate(
                                { caseId: selectedCase.id, include: checked },
                                {
                                  onError: () =>
                                    toast({
                                      title: t("common.error"),
                                      description: t("hiring.offboarding.finalPay.severanceToggleFailed")
                                        || "Could not save the severance decision.",
                                      variant: "destructive",
                                    }),
                                },
                              );
                              setSelectedCase({ ...selectedCase, includeArt56Severance: checked });
                            }}
                          />
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              {t("hiring.offboarding.finalPay.includeSeverance")
                                || "Pay Art. 56 severance in the final payroll run"}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              {(selectedCase.includeArt56Severance ??
                                severanceDefaultForReason(selectedCase.departureReason))
                                ? (t("hiring.offboarding.finalPay.severanceOnNote")
                                    || "Default for this departure reason. The next payroll run pays it automatically once the case completes.")
                                : (t("hiring.offboarding.finalPay.severanceOffNote")
                                    || "Not usually paid on this departure reason in TL practice — but the law's text is cause-independent, so the employee may still be entitled. Confirm with your accountant.")}
                            </p>
                            {selectedCase.departureReason === "death" && (
                              <p className="text-xs text-muted-foreground">
                                {t("hiring.offboarding.finalPay.deathHeirsNote")
                                  || "Worker deceased (Art. 47(1)(b)): this payment is payable to the estate/heirs — confirm beneficiaries with your accountant."}
                              </p>
                            )}
                          </div>
                        </div>

                        {selectedCase.article56FinalPay ? (
                          <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">{t("hiring.offboarding.finalPay.salary") || "Monthly salary"}</span>
                              <span className="font-medium">{formatCurrencyTL(selectedCase.article56FinalPay.monthlySalary)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">{t("hiring.offboarding.finalPay.service") || "Completed service"}</span>
                              <span className="font-medium">
                                {selectedCase.article56FinalPay.completedYears} {t("hiring.offboarding.finalPay.years") || "years"}
                                {" · "}{selectedCase.article56FinalPay.completedFiveYearPeriods} × 5
                              </span>
                            </div>
                            <div className="flex justify-between gap-4 border-t border-border/70 pt-2">
                              <span className="font-medium">
                                {t("hiring.offboarding.finalPay.amount") || "Service compensation"}
                                {selectedCase.article56FinalPay.severanceIncluded === false && (
                                  <span className="ml-1 font-normal text-muted-foreground">
                                    {t("hiring.offboarding.finalPay.excludedTag") || "(excluded — reference only)"}
                                  </span>
                                )}
                              </span>
                              <span className="font-semibold">{formatCurrencyTL(selectedCase.article56FinalPay.serviceCompensation)}</span>
                            </div>
                            {typeof selectedCase.article56FinalPay.subsidioAnual === "number" && (
                              <>
                                <div className="flex justify-between gap-4 border-t border-border/70 pt-2">
                                  <span className="font-medium">
                                    {t("hiring.offboarding.finalPay.subsidio") || "13th month (Art. 44)"}
                                    <span className="ml-1 font-normal text-muted-foreground">
                                      {selectedCase.article56FinalPay.subsidioAnualMonths}/12
                                    </span>
                                  </span>
                                  <span className="font-semibold">{formatCurrencyTL(selectedCase.article56FinalPay.subsidioAnual)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {t("hiring.offboarding.finalPay.subsidioNote")
                                    || "Reference only — the leaver's next payroll run pays severance + this prorated 13th month automatically (net of anything already paid). Don't settle these manually too."}
                                </p>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p>{t("hiring.offboarding.finalPay.sourceHint") || "Uses the saved employee monthly salary and hire date, plus this case's last working day."}</p>
                            <p>
                              {t("hiring.offboarding.finalPay.lastDay") || "Last working day"}: {selectedCase.lastWorkingDay || (t("hiring.offboarding.progress.tbd") || "Not set")}
                            </p>
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                          {t("hiring.offboarding.finalPay.taxNote")
                            || "WIT-taxable under Tax Law Art. 1. This universal Art. 56 payment is not included in the INSS base. Saving it does not run or pay payroll."}
                        </p>
                        <Button
                          variant={selectedCase.article56FinalPay ? "outline" : "default"}
                          className="min-h-11 w-full sm:w-auto"
                          onClick={saveArticle56FinalPay}
                          disabled={saveArticle56Mutation.isPending}
                        >
                          {saveArticle56Mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {selectedCase.article56FinalPay
                            ? (t("hiring.offboarding.finalPay.recalculate") || "Recalculate from saved employee data")
                            : (t("hiring.offboarding.finalPay.calculate") || "Calculate and save")}
                        </Button>
                      </div>

                      {/* Checklist Items */}
                      <div className="space-y-4">
                        {(
                          [
                            { id: "accessRevoked", label: t("hiring.offboarding.checklist.items.access"), icon: <Key className="h-4 w-4" /> },
                            { id: "equipmentReturned", label: t("hiring.offboarding.checklist.items.equipment"), icon: <Building className="h-4 w-4" /> },
                            { id: "documentsSigned", label: t("hiring.offboarding.checklist.items.documents"), icon: <FileText className="h-4 w-4" /> },
                            { id: "knowledgeTransfer", label: t("hiring.offboarding.checklist.items.knowledge"), icon: <Archive className="h-4 w-4" /> },
                            { id: "benefitsCancelled", label: t("hiring.offboarding.checklist.items.benefits"), icon: <CreditCard className="h-4 w-4" /> },
                            {
                              // F12 — DL 20/2017 Art. 5(2)-(3): cessation must be
                              // declared to INSS by day 10 of the following month.
                              id: "inssCessationDeclared",
                              label: t("hiring.offboarding.checklist.items.inssCessation")
                                || "INSS cessation declared",
                              icon: <Landmark className="h-4 w-4" />,
                              hint:
                                (t("hiring.offboarding.checklist.items.inssCessationHint")
                                  || "Declare at the INSS portal by day 10 of the month after the last working day — until declared, INSS presumes the employment continues and contributions keep accruing.")
                                + (inssDeadline
                                  ? ` ${t("hiring.offboarding.checklist.items.inssCessationDeadline") || "Deadline"}: ${formatDateTL(inssDeadline)}.`
                                  : ""),
                            },
                            { id: "exitInterviewCompleted", label: t("hiring.offboarding.checklist.items.exitInterview"), icon: <Mail className="h-4 w-4" /> },
                            { id: "referenceLetter", label: t("hiring.offboarding.checklist.items.reference"), icon: <Download className="h-4 w-4" /> },
                          ] as {
                            id: keyof OffboardingChecklist;
                            label: string;
                            icon: React.ReactNode;
                            hint?: string;
                          }[]
                        ).map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                              selectedCase.checklist[item.id]
                                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                                : "border-border/50 hover:bg-muted/30"
                            }`}
                          >
                            <Checkbox
                              checked={selectedCase.checklist[item.id]}
                              onCheckedChange={(checked) =>
                                updateChecklist(selectedCase.id!, item.id, checked as boolean)
                              }
                              className="mt-0.5 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                {item.icon}
                                <label className="text-sm font-medium text-foreground cursor-pointer">
                                  {item.label}
                                </label>
                              </div>
                              {item.hint && (
                                <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
                              )}
                              {item.id === "referenceLetter" && (
                                <div className="mt-2 space-y-1.5">
                                  {/* F11 — Art. 57: the work certificate is MANDATORY
                                      on every cessation, unlike the optional reference. */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={generateWorkCertificate}
                                    disabled={certGenerating || selectedEmployeeQuery.isLoading}
                                  >
                                    {certGenerating ? (
                                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <FileText className="mr-2 h-3.5 w-3.5" />
                                    )}
                                    {t("hiring.offboarding.certificate.generate")
                                      || "Generate certificate (Art. 57)"}
                                  </Button>
                                  <p className="text-xs text-muted-foreground">
                                    {t("hiring.offboarding.certificate.mandatoryNote")
                                      || "The Certificado de Trabalho (name, contract dates, functions performed) is mandatory on every cessation — Art. 57."}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Exit Interview Section */}
                      <Separator />
                      <div className="space-y-4">
                        <h4 className="font-medium">{t("hiring.offboarding.exit.title")}</h4>

                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-2">
                            <Label>{t("hiring.offboarding.exit.overall")}</Label>
                            <Select
                              value={selectedCase.exitInterview.overallSatisfaction}
                              onValueChange={(value) =>
                                updateExitInterview(selectedCase.id!, "overallSatisfaction", value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t("hiring.offboarding.exit.overallPlaceholder")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="very-satisfied">
                                  {t("hiring.offboarding.exit.overallOptions.verySatisfied")}
                                </SelectItem>
                                <SelectItem value="satisfied">
                                  {t("hiring.offboarding.exit.overallOptions.satisfied")}
                                </SelectItem>
                                <SelectItem value="neutral">
                                  {t("hiring.offboarding.exit.overallOptions.neutral")}
                                </SelectItem>
                                <SelectItem value="dissatisfied">
                                  {t("hiring.offboarding.exit.overallOptions.dissatisfied")}
                                </SelectItem>
                                <SelectItem value="very-dissatisfied">
                                  {t("hiring.offboarding.exit.overallOptions.veryDissatisfied")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>{t("hiring.offboarding.exit.manager")}</Label>
                            <Select
                              value={selectedCase.exitInterview.managerRelationship}
                              onValueChange={(value) =>
                                updateExitInterview(selectedCase.id!, "managerRelationship", value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t("hiring.offboarding.exit.managerPlaceholder")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="excellent">
                                  {t("hiring.offboarding.exit.managerOptions.excellent")}
                                </SelectItem>
                                <SelectItem value="good">
                                  {t("hiring.offboarding.exit.managerOptions.good")}
                                </SelectItem>
                                <SelectItem value="average">
                                  {t("hiring.offboarding.exit.managerOptions.average")}
                                </SelectItem>
                                <SelectItem value="poor">
                                  {t("hiring.offboarding.exit.managerOptions.poor")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>{t("hiring.offboarding.exit.reason")}</Label>
                            <Textarea
                              placeholder={t("hiring.offboarding.exit.reasonPlaceholder")}
                              value={selectedCase.exitInterview.primaryReason}
                              onChange={(e) =>
                                updateExitInterview(selectedCase.id!, "primaryReason", e.target.value)
                              }
                              rows={2}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>{t("hiring.offboarding.exit.recommend")}</Label>
                            <Select
                              value={selectedCase.exitInterview.wouldRecommend}
                              onValueChange={(value) =>
                                updateExitInterview(selectedCase.id!, "wouldRecommend", value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t("hiring.offboarding.exit.recommendPlaceholder")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">
                                  {t("hiring.offboarding.exit.recommendOptions.yes")}
                                </SelectItem>
                                <SelectItem value="maybe">
                                  {t("hiring.offboarding.exit.recommendOptions.maybe")}
                                </SelectItem>
                                <SelectItem value="no">
                                  {t("hiring.offboarding.exit.recommendOptions.no")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>{t("hiring.offboarding.exit.comments")}</Label>
                            <Textarea
                              placeholder={t("hiring.offboarding.exit.commentsPlaceholder")}
                              value={selectedCase.exitInterview.additionalComments}
                              onChange={(e) =>
                                updateExitInterview(selectedCase.id!, "additionalComments", e.target.value)
                              }
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Every field above persists as it is edited (checklist,
                          exit interview, equipment, Art. 56 each have their own
                          mutation) — there is no draft state to save. */}
                      <div className="flex gap-3">
                        <Button
                          onClick={() =>
                            updateChecklist(selectedCase.id!, "exitInterviewCompleted", true)
                          }
                          className="flex-1 disabled:opacity-50"
                          disabled={getChecklistProgress(selectedCase.checklist) === 100}
                        >
                          {t("hiring.offboarding.actions.completeExit")}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Exit interviews — read-only surfacing of answers recorded on
                completed cases, plus CSV export. Hidden until at least one
                completed case has answers (nothing to surface = no card). */}
            {completedWithInterviews.length > 0 && (
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        {t("hiring.offboarding.exitInterviews.title") || "Exit interviews"}
                      </CardTitle>
                      <CardDescription className="mt-1.5">
                        {t("hiring.offboarding.exitInterviews.description") ||
                          "Answers recorded during offboarding for completed departures."}
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportExitInterviews}>
                      <Download className="mr-2 h-4 w-4" />
                      {t("hiring.offboarding.exitInterviews.export") || "Export CSV"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {completedWithInterviews.map((case_) => (
                      <div
                        key={case_.id}
                        className="rounded-lg border border-border/50 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-sm font-medium">{case_.employeeName}</span>
                            <span className="text-xs text-muted-foreground">
                              {" "}
                              — {getDepartureReasonLabel(case_.departureReason)}
                              {case_.lastWorkingDay
                                ? ` · ${formatDateTL(case_.lastWorkingDay)}`
                                : ""}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {case_.exitInterview.overallSatisfaction && (
                              <Badge variant="outline" className="text-xs font-normal">
                                {getSatisfactionLabel(case_.exitInterview.overallSatisfaction)}
                              </Badge>
                            )}
                            {case_.exitInterview.wouldRecommend && (
                              <Badge variant="outline" className="text-xs font-normal">
                                {t("hiring.offboarding.exitInterviews.recommendShort") ||
                                  "Would recommend"}
                                {": "}
                                {getRecommendLabel(case_.exitInterview.wouldRecommend)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {(case_.exitInterview.primaryReason ||
                          case_.exitInterview.additionalComments) && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {[
                              case_.exitInterview.primaryReason,
                              case_.exitInterview.additionalComments,
                            ]
                              .filter(Boolean)
                              .join(" — ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
