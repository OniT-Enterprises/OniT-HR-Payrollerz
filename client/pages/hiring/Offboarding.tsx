import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import MainNavigation from "@/components/layout/MainNavigation";
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
  Save,
  Loader2,
} from "lucide-react";
import {
  useActiveCases,
  useCompletedCases,
  useCreateOffboardingCase,
  useUpdateChecklistItem,
  useUpdateExitInterviewField,
} from "@/hooks/useHiring";
import {
  type OffboardingCase,
  type OffboardingChecklist,
  type DepartureReason,
  DEPARTURE_REASONS,
  getChecklistProgress,
} from "@/services/offboardingService";

export default function Offboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: employees = [], isLoading: employeesLoading } = useEmployeeDirectory({ status: 'active' });

  // Data via React Query
  const { data: activeCases = [], isLoading: activeCasesLoading } = useActiveCases();
  const { data: completedCases = [], isLoading: completedCasesLoading } = useCompletedCases();
  const createOffboardingMutation = useCreateOffboardingCase();
  const updateChecklistMutation = useUpdateChecklistItem();
  const updateExitInterviewMutation = useUpdateExitInterviewField();

  const loading = activeCasesLoading || completedCasesLoading;

  const [selectedCase, setSelectedCase] = useState<OffboardingCase | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  // New offboarding form data
  const [newOffboarding, setNewOffboarding] = useState({
    employeeId: "",
    departureReason: "" as DepartureReason | "",
    lastWorkingDay: "",
    noticeDate: "",
    notes: "",
    department: "all",
    search: "",
  });

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

  // Calculate stats
  const departuresLastYear = completedCases.filter(
    (c) => c.createdAt && new Date(c.createdAt).getFullYear() === new Date().getFullYear()
  ).length;

  const handleStartOffboarding = () => {
    if (!newOffboarding.employeeId || !newOffboarding.departureReason) {
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

  const saveDraft = () => {
    toast({
      title: t("hiring.offboarding.toast.draftTitle"),
      description: t("hiring.offboarding.toast.draftDesc"),
    });
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
    switch (reason) {
      case "resignation":
        return t("hiring.offboarding.dialog.reasons.resignation");
      case "redundancy":
        return t("hiring.offboarding.dialog.reasons.redundancy");
      case "termination":
        return t("hiring.offboarding.dialog.reasons.termination");
      case "retirement":
        return t("hiring.offboarding.dialog.reasons.retirement");
      case "contract_end":
        return t("hiring.offboarding.dialog.reasons.contractEnd");
      default:
        return reason;
    }
  };

  if (loading || employeesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.offboarding} />
      <MainNavigation />

      {/* Main Content */}
      <div className="mx-auto max-w-screen-2xl px-6 py-8">
        <PageHeader
          title={t("hiring.offboarding.title")}
          subtitle={t("hiring.offboarding.subtitle")}
          icon={UserMinus}
          iconColor="text-blue-500"
          actions={
            employees.length > 0 ? (
              <Button
                onClick={() => setShowDialog(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
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
                        {reason.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("hiring.offboarding.dialog.lastDay")}</Label>
                  <Input
                    type="date"
                    value={newOffboarding.lastWorkingDay}
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
                    <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                      <Clock className="h-5 w-5 text-emerald-600" />
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
                              ? "ring-2 ring-emerald-500 shadow-lg"
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
                    <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
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
                      <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-xl border border-emerald-500/20">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{t("hiring.offboarding.progress.overall")}</span>
                          <span className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                            {getChecklistProgress(selectedCase.checklist)}%
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all duration-500"
                            style={{ width: `${getChecklistProgress(selectedCase.checklist)}%` }}
                          />
                        </div>
                      </div>

                      {/* Checklist Items */}
                      <div className="space-y-4">
                        {[
                          { id: "accessRevoked", label: t("hiring.offboarding.checklist.items.access"), icon: <Key className="h-4 w-4" /> },
                          { id: "equipmentReturned", label: t("hiring.offboarding.checklist.items.equipment"), icon: <Building className="h-4 w-4" /> },
                          { id: "documentsSigned", label: t("hiring.offboarding.checklist.items.documents"), icon: <FileText className="h-4 w-4" /> },
                          { id: "knowledgeTransfer", label: t("hiring.offboarding.checklist.items.knowledge"), icon: <Archive className="h-4 w-4" /> },
                          { id: "finalPayCalculated", label: t("hiring.offboarding.checklist.items.finalPay"), icon: <DollarSign className="h-4 w-4" /> },
                          { id: "benefitsCancelled", label: t("hiring.offboarding.checklist.items.benefits"), icon: <CreditCard className="h-4 w-4" /> },
                          { id: "exitInterviewCompleted", label: t("hiring.offboarding.checklist.items.exitInterview"), icon: <Mail className="h-4 w-4" /> },
                          { id: "referenceLetter", label: t("hiring.offboarding.checklist.items.reference"), icon: <Download className="h-4 w-4" /> },
                        ].map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                              selectedCase.checklist[item.id as keyof OffboardingChecklist]
                                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                                : "border-border/50 hover:bg-muted/30"
                            }`}
                          >
                            <Checkbox
                              checked={selectedCase.checklist[item.id as keyof OffboardingChecklist]}
                              onCheckedChange={(checked) =>
                                updateChecklist(selectedCase.id!, item.id as keyof OffboardingChecklist, checked as boolean)
                              }
                              className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                            />
                            <div className="flex items-center gap-2 text-muted-foreground">
                              {item.icon}
                              <label className="text-sm font-medium text-foreground cursor-pointer">
                                {item.label}
                              </label>
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

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        <Button variant="outline" onClick={saveDraft} className="flex-1 border-border/50">
                          <Save className="mr-2 h-4 w-4" />
                          {t("hiring.offboarding.actions.saveDraft")}
                        </Button>
                        <Button
                          onClick={() =>
                            updateChecklist(selectedCase.id!, "exitInterviewCompleted", true)
                          }
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
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
          </div>
        )}
      </div>
    </div>
  );
}
