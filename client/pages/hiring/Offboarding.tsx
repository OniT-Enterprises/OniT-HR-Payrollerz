import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { employeeService, type Employee } from "@/services/employeeService";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO, seoConfig } from "@/components/SEO";
import {
  UserMinus,
  Calendar,
  FileText,
  Mail,
  Key,
  CreditCard,
  Building,
  CheckCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  Shield,
  Archive,
  Download,
  Filter,
  Database,
  Users,
  User,
  Search,
  History,
  Plus,
  Eye,
  Edit,
  Save,
} from "lucide-react";

// Define interfaces for offboarding data
interface OffboardingCase {
  id: string;
  employee: Employee;
  departureReason: string;
  lastWorkingDay: string;
  noticeDate: string;
  status: "pending" | "in-progress" | "completed";
  notes: string;
  checklist: OffboardingChecklist;
  exitInterview: ExitInterview;
  createdAt: Date;
  updatedAt: Date;
}

interface OffboardingChecklist {
  accessRevoked: boolean;
  equipmentReturned: boolean;
  documentsSigned: boolean;
  knowledgeTransfer: boolean;
  finalPayCalculated: boolean;
  benefitsCancelled: boolean;
  exitInterviewCompleted: boolean;
  referenceLetter: boolean;
}

interface ExitInterview {
  overallSatisfaction: string;
  managerRelationship: string;
  primaryReason: string;
  suggestions: string;
  wouldRecommend: string;
  additionalComments: string;
  completed: boolean;
}

export default function Offboarding() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ongoingCases, setOngoingCases] = useState<OffboardingCase[]>([]);
  const [offboardingHistory, setOffboardingHistory] = useState<
    OffboardingCase[]
  >([]);
  const [selectedCase, setSelectedCase] = useState<OffboardingCase | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  // New offboarding form data
  const [newOffboarding, setNewOffboarding] = useState({
    employeeId: "",
    departureReason: "",
    lastWorkingDay: "",
    noticeDate: "",
    notes: "",
    department: "all",
    search: "",
  });

  useEffect(() => {
    loadData();

    // Add online/offline detection
    const handleOnline = () => {
      setIsOffline(false);
      // Retry loading data when coming back online
      loadData();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check initial connection status
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Try to load employees with retry logic
      let employeesData = [];
      try {
        employeesData = await employeeService.getAllEmployees();
        setEmployees(employeesData);
      } catch (firebaseError) {
        console.warn(
          "Firebase connection failed, using fallback:",
          firebaseError,
        );

        // Check if we have cached employee data
        const cachedEmployees = localStorage.getItem("cachedEmployees");
        if (cachedEmployees) {
          employeesData = JSON.parse(cachedEmployees);
          setEmployees(employeesData);
          toast({
            title: t("hiring.offboarding.toast.cachedTitle"),
            description: t("hiring.offboarding.toast.cachedDesc"),
            variant: "destructive",
          });
        } else {
          // Provide mock data as absolute fallback
          employeesData = [];
          setEmployees([]);
          toast({
            title: t("hiring.offboarding.toast.connectionTitle"),
            description: t("hiring.offboarding.toast.connectionDesc"),
            variant: "destructive",
          });
        }
      }

      // Load offboarding cases from localStorage
      const savedCases = localStorage.getItem("offboardingCases");
      if (savedCases) {
        try {
          const cases = JSON.parse(savedCases);
          setOngoingCases(
            cases.filter((c: OffboardingCase) => c.status !== "completed"),
          );
          setOffboardingHistory(
            cases.filter((c: OffboardingCase) => c.status === "completed"),
          );
        } catch (parseError) {
          console.error("Error parsing saved cases:", parseError);
          localStorage.removeItem("offboardingCases");
        }
      }

      // Cache employees for future use
      if (employeesData.length > 0) {
        localStorage.setItem("cachedEmployees", JSON.stringify(employeesData));
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: t("hiring.offboarding.toast.errorTitle"),
        description: t("hiring.offboarding.toast.loadFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter employees for selection
  const filteredEmployees = employees.filter((employee) => {
    const matchesDepartment =
      newOffboarding.department === "all" ||
      employee.jobDetails.department === newOffboarding.department;

    const matchesSearch =
      !newOffboarding.search ||
      `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
        .toLowerCase()
        .includes(newOffboarding.search.toLowerCase()) ||
      employee.jobDetails.employeeId
        .toLowerCase()
        .includes(newOffboarding.search.toLowerCase());

    return employee.status === "active" && matchesDepartment && matchesSearch;
  });

  const departments = Array.from(
    new Set(employees.map((emp) => emp.jobDetails.department)),
  ).sort();
  const activeEmployees = employees.filter((emp) => emp.status === "active");

  // Calculate departures in last year (mock data for now)
  const departuresLastYear = offboardingHistory.filter(
    (case_) =>
      new Date(case_.createdAt).getFullYear() === new Date().getFullYear(),
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

    const employee = employees.find(
      (emp) => emp.id === newOffboarding.employeeId,
    );
    if (!employee) return;

    const newCase: OffboardingCase = {
      id: Date.now().toString(),
      employee,
      departureReason: newOffboarding.departureReason,
      lastWorkingDay: newOffboarding.lastWorkingDay,
      noticeDate: newOffboarding.noticeDate,
      status: "pending",
      notes: newOffboarding.notes,
      checklist: {
        accessRevoked: false,
        equipmentReturned: false,
        documentsSigned: false,
        knowledgeTransfer: false,
        finalPayCalculated: false,
        benefitsCancelled: false,
        exitInterviewCompleted: false,
        referenceLetter: false,
      },
      exitInterview: {
        overallSatisfaction: "",
        managerRelationship: "",
        primaryReason: "",
        suggestions: "",
        wouldRecommend: "",
        additionalComments: "",
        completed: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedCases = [...ongoingCases, newCase];
    setOngoingCases(updatedCases);

    // Save to localStorage
    const allCases = [...updatedCases, ...offboardingHistory];
    localStorage.setItem("offboardingCases", JSON.stringify(allCases));

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
  };

  const updateChecklist = (caseId: string, item: string, value: boolean) => {
    const updatedCases = ongoingCases.map((case_) => {
      if (case_.id === caseId) {
        const updatedCase = {
          ...case_,
          checklist: { ...case_.checklist, [item]: value },
          updatedAt: new Date(),
        };

        // Update status based on checklist completion
        const checklistItems = Object.values(updatedCase.checklist);
        const completedItems = checklistItems.filter(Boolean).length;

        if (completedItems === checklistItems.length) {
          updatedCase.status = "completed";
        } else if (completedItems > 0) {
          updatedCase.status = "in-progress";
        }

        return updatedCase;
      }
      return case_;
    });

    setOngoingCases(updatedCases.filter((c) => c.status !== "completed"));

    // Move completed cases to history
    const completedCases = updatedCases.filter((c) => c.status === "completed");
    if (completedCases.length > 0) {
      setOffboardingHistory((prev) => [...prev, ...completedCases]);
    }

    // Update selected case if it's the one being modified
    if (selectedCase && selectedCase.id === caseId) {
      setSelectedCase(updatedCases.find((c) => c.id === caseId) || null);
    }

    // Save to localStorage
    const allCases = [
      ...updatedCases.filter((c) => c.status !== "completed"),
      ...offboardingHistory,
      ...completedCases,
    ];
    localStorage.setItem("offboardingCases", JSON.stringify(allCases));
  };

  const updateExitInterview = (
    caseId: string,
    field: string,
    value: string,
  ) => {
    const updatedCases = ongoingCases.map((case_) => {
      if (case_.id === caseId) {
        const updatedCase = {
          ...case_,
          exitInterview: { ...case_.exitInterview, [field]: value },
          updatedAt: new Date(),
        };
        return updatedCase;
      }
      return case_;
    });

    setOngoingCases(updatedCases);

    if (selectedCase && selectedCase.id === caseId) {
      setSelectedCase(updatedCases.find((c) => c.id === caseId) || null);
    }

    // Save to localStorage
    const allCases = [...updatedCases, ...offboardingHistory];
    localStorage.setItem("offboardingCases", JSON.stringify(allCases));
  };

  const saveDraft = () => {
    if (selectedCase) {
      toast({
        title: t("hiring.offboarding.toast.draftTitle"),
        description: t("hiring.offboarding.toast.draftDesc"),
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20";
      case "in-progress":
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
      case "in-progress":
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
      case "contract-end":
        return t("hiring.offboarding.dialog.reasons.contractEnd");
      default:
        return reason;
    }
  };

  const getProgressPercentage = (checklist: OffboardingChecklist) => {
    const items = Object.values(checklist);
    const completed = items.filter(Boolean).length;
    return Math.round((completed / items.length) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
        <AutoBreadcrumb className="mb-6" />
          {/* Header Skeleton */}
          <div className="flex items-center gap-3 mb-8">
            <Skeleton className="h-8 w-8 rounded" />
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-80" />
            </div>
          </div>

          {/* Stats Skeleton */}
          <div className="grid lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Skeleton className="h-4 w-28 mb-2" />
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Content Skeleton */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </div>
                      <Skeleton className="h-2 w-full rounded" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-56" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-5 w-5 rounded" />
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 w-36" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.offboarding} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-emerald-50 dark:bg-emerald-950/30">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25">
                <UserMinus className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("hiring.offboarding.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("hiring.offboarding.subtitle")}
                </p>
              </div>
            </div>

            {activeEmployees.length > 0 && (
              <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-lg">
                    <UserMinus className="mr-2 h-4 w-4" />
                    {t("hiring.offboarding.actions.start")}
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {t("hiring.offboarding.dialog.title")}
                  </DialogTitle>
                  <DialogDescription>
                    {t("hiring.offboarding.dialog.description")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("hiring.offboarding.dialog.department")}</Label>
                      <Select
                        value={newOffboarding.department}
                        onValueChange={(value) =>
                          setNewOffboarding((prev) => ({
                            ...prev,
                            department: value,
                          }))
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
                            setNewOffboarding((prev) => ({
                              ...prev,
                              search: e.target.value,
                            }))
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
                        setNewOffboarding((prev) => ({
                          ...prev,
                          employeeId: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("hiring.offboarding.dialog.selectPlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredEmployees.map((employee) => (
                          <SelectItem
                            key={employee.id}
                            value={employee.id || ""}
                          >
                            {employee.personalInfo.firstName}{" "}
                            {employee.personalInfo.lastName} -{" "}
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
                        setNewOffboarding((prev) => ({
                          ...prev,
                          departureReason: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("hiring.offboarding.dialog.reasonPlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="resignation">
                          {t("hiring.offboarding.dialog.reasons.resignation")}
                        </SelectItem>
                        <SelectItem value="redundancy">
                          {t("hiring.offboarding.dialog.reasons.redundancy")}
                        </SelectItem>
                        <SelectItem value="termination">
                          {t("hiring.offboarding.dialog.reasons.termination")}
                        </SelectItem>
                        <SelectItem value="retirement">
                          {t("hiring.offboarding.dialog.reasons.retirement")}
                        </SelectItem>
                        <SelectItem value="contract-end">
                          {t("hiring.offboarding.dialog.reasons.contractEnd")}
                        </SelectItem>
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
                          setNewOffboarding((prev) => ({
                            ...prev,
                            lastWorkingDay: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("hiring.offboarding.dialog.noticeDate")}</Label>
                      <Input
                        type="date"
                        value={newOffboarding.noticeDate}
                        onChange={(e) =>
                          setNewOffboarding((prev) => ({
                            ...prev,
                            noticeDate: e.target.value,
                          }))
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
                        setNewOffboarding((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowDialog(false)}
                    >
                      {t("hiring.offboarding.dialog.cancel")}
                    </Button>
                    <Button onClick={handleStartOffboarding}>
                      {t("hiring.offboarding.dialog.confirm")}
                    </Button>
                  </div>
                </div>
              </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Connection Status Banner */}
        {isOffline && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">
                {t("hiring.offboarding.offlineBanner")}
              </span>
            </div>
          </div>
        )}

        {employees.length === 0 ? (
          <Card className="border-border/50 animate-fade-up">
            <CardContent className="text-center py-16">
              <div className="p-4 rounded-full bg-muted inline-flex mb-4">
                <UserMinus className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {isOffline
                  ? t("hiring.offboarding.empty.connectionTitle")
                  : t("hiring.offboarding.empty.noEmployeesTitle")}
              </h3>
              <p className="text-muted-foreground mb-6">
                {isOffline
                  ? t("hiring.offboarding.empty.connectionDesc")
                  : t("hiring.offboarding.empty.noEmployeesDesc")}
              </p>
              <div className="flex gap-3 justify-center">
                {isOffline ? (
                  <Button
                    onClick={() => loadData()}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                  >
                    <Database className="mr-2 h-4 w-4" />
                    {t("hiring.offboarding.empty.retry")}
                  </Button>
                ) : (
                  <Button
                    onClick={() => (window.location.href = "/staff/add")}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                  >
                    <User className="mr-2 h-4 w-4" />
                    {t("hiring.offboarding.empty.addEmployees")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Statistics */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up">
              <Card className="border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("hiring.offboarding.stats.totalEmployees")}
                      </p>
                      <p className="text-2xl font-bold">{employees.length}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {t("hiring.offboarding.stats.inDatabase")}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("hiring.offboarding.stats.departures")}
                      </p>
                      <p className="text-2xl font-bold">{departuresLastYear}</p>
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        {t("hiring.offboarding.stats.lastYear")}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg">
                      <History className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("hiring.offboarding.stats.cases")}
                      </p>
                      <p className="text-2xl font-bold">
                        {ongoingCases.length}
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        {t("hiring.offboarding.stats.active")}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("hiring.offboarding.stats.history")}
                      </p>
                      <p className="text-2xl font-bold">
                        {offboardingHistory.length}
                      </p>
                      <p className="text-xs text-violet-600 dark:text-violet-400">
                        {t("hiring.offboarding.stats.completed")}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg">
                      <Archive className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 animate-fade-up stagger-1">
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
                    {t("hiring.offboarding.ongoing.description", {
                      count: ongoingCases.length,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ongoingCases.length === 0 ? (
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
                      {ongoingCases.map((case_) => (
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
                                  <AvatarImage src="/placeholder.svg" />
                                  <AvatarFallback>
                                    {case_.employee.personalInfo.firstName[0]}
                                    {case_.employee.personalInfo.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <h4 className="font-semibold">
                                    {case_.employee.personalInfo.firstName}{" "}
                                    {case_.employee.personalInfo.lastName}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {case_.employee.jobDetails.department} •{" "}
                                    {case_.employee.jobDetails.position}
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
                                    percent: getProgressPercentage(case_.checklist),
                                  })}
                                </span>
                              </div>
                              <Progress
                                value={getProgressPercentage(case_.checklist)}
                                className="h-2"
                              />
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">
                                  {t("hiring.offboarding.progress.reason", {
                                    reason: getDepartureReasonLabel(
                                      case_.departureReason,
                                    ),
                                  })}
                                </span>
                                <span className="text-muted-foreground">
                                  {t("hiring.offboarding.progress.lastDay", {
                                    date:
                                      case_.lastWorkingDay ||
                                      t("hiring.offboarding.progress.tbd"),
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
                      ? t("hiring.offboarding.checklist.titleWithName", {
                          name: `${selectedCase.employee.personalInfo.firstName} ${selectedCase.employee.personalInfo.lastName}`,
                        })
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
                          <span className="font-medium">
                            {t("hiring.offboarding.progress.overall")}
                          </span>
                          <span className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                            {getProgressPercentage(selectedCase.checklist)}%
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                            style={{ width: `${getProgressPercentage(selectedCase.checklist)}%` }}
                          />
                        </div>
                      </div>

                      {/* Checklist Items */}
                      <div className="space-y-4">
                        {[
                          {
                            id: "accessRevoked",
                            label: t("hiring.offboarding.checklist.items.access"),
                            icon: <Key className="h-4 w-4" />,
                          },
                          {
                            id: "equipmentReturned",
                            label: t("hiring.offboarding.checklist.items.equipment"),
                            icon: <Building className="h-4 w-4" />,
                          },
                          {
                            id: "documentsSigned",
                            label: t("hiring.offboarding.checklist.items.documents"),
                            icon: <FileText className="h-4 w-4" />,
                          },
                          {
                            id: "knowledgeTransfer",
                            label: t("hiring.offboarding.checklist.items.knowledge"),
                            icon: <Archive className="h-4 w-4" />,
                          },
                          {
                            id: "finalPayCalculated",
                            label: t("hiring.offboarding.checklist.items.finalPay"),
                            icon: <DollarSign className="h-4 w-4" />,
                          },
                          {
                            id: "benefitsCancelled",
                            label: t("hiring.offboarding.checklist.items.benefits"),
                            icon: <CreditCard className="h-4 w-4" />,
                          },
                          {
                            id: "exitInterviewCompleted",
                            label: t("hiring.offboarding.checklist.items.exitInterview"),
                            icon: <Mail className="h-4 w-4" />,
                          },
                          {
                            id: "referenceLetter",
                            label: t("hiring.offboarding.checklist.items.reference"),
                            icon: <Download className="h-4 w-4" />,
                          },
                        ].map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                              selectedCase.checklist[item.id as keyof OffboardingChecklist]
                                ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
                                : 'border-border/50 hover:bg-muted/30'
                            }`}
                          >
                            <Checkbox
                              checked={
                                selectedCase.checklist[
                                  item.id as keyof OffboardingChecklist
                                ]
                              }
                              onCheckedChange={(checked) =>
                                updateChecklist(
                                  selectedCase.id,
                                  item.id,
                                  checked as boolean,
                                )
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
                        <h4 className="font-medium">
                          {t("hiring.offboarding.exit.title")}
                        </h4>

                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-2">
                            <Label>{t("hiring.offboarding.exit.overall")}</Label>
                            <Select
                              value={
                                selectedCase.exitInterview.overallSatisfaction
                              }
                              onValueChange={(value) =>
                                updateExitInterview(
                                  selectedCase.id,
                                  "overallSatisfaction",
                                  value,
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t("hiring.offboarding.exit.overallPlaceholder")}
                                />
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
                              value={
                                selectedCase.exitInterview.managerRelationship
                              }
                              onValueChange={(value) =>
                                updateExitInterview(
                                  selectedCase.id,
                                  "managerRelationship",
                                  value,
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t("hiring.offboarding.exit.managerPlaceholder")}
                                />
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
                                updateExitInterview(
                                  selectedCase.id,
                                  "primaryReason",
                                  e.target.value,
                                )
                              }
                              rows={2}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>{t("hiring.offboarding.exit.recommend")}</Label>
                            <Select
                              value={selectedCase.exitInterview.wouldRecommend}
                              onValueChange={(value) =>
                                updateExitInterview(
                                  selectedCase.id,
                                  "wouldRecommend",
                                  value,
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t("hiring.offboarding.exit.recommendPlaceholder")}
                                />
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
                              value={
                                selectedCase.exitInterview.additionalComments
                              }
                              onChange={(e) =>
                                updateExitInterview(
                                  selectedCase.id,
                                  "additionalComments",
                                  e.target.value,
                                )
                              }
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={saveDraft}
                          className="flex-1 border-border/50"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {t("hiring.offboarding.actions.saveDraft")}
                        </Button>
                        <Button
                          onClick={() =>
                            updateChecklist(
                              selectedCase.id,
                              "exitInterviewCompleted",
                              true,
                            )
                          }
                          className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                          disabled={
                            getProgressPercentage(selectedCase.checklist) ===
                            100
                          }
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
