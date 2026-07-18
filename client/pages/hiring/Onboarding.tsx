import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Monitor,
  Mail,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import PageHeader from "@/components/layout/PageHeader";
import { SEO, seoConfig } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { useAllEmployees, employeeKeys } from "@/hooks/useEmployees";
import { candidateService } from "@/services/candidateService";
import { employeeService, type Employee } from "@/services/employeeService";
import {
  onboardingService,
  type EquipmentAsset,
  type EquipmentAssetType,
  type OnboardingChecklist,
} from "@/services/onboardingService";
import { getTodayTL } from "@/lib/dateUtils";

const EQUIPMENT_TYPES: { value: EquipmentAssetType; label: string }[] = [
  { value: "laptop", label: "Laptop" },
  { value: "phone", label: "Company phone" },
  { value: "access_card", label: "Access card" },
  { value: "office_keys", label: "Office keys" },
  { value: "sim_card", label: "SIM card" },
  { value: "uniform", label: "Uniform / PPE" },
  { value: "other", label: "Other" },
];

const EMPTY_CHECKLIST: OnboardingChecklist = {
  employeeRecordConfirmed: false,
  contractReady: false,
  policiesExplained: false,
  firstDayReady: false,
};

function employeeName(employee: Employee) {
  return `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`.trim();
}

function blankAsset(): EquipmentAsset {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "laptop",
    label: "",
    serialNumber: "",
    assetTag: "",
    returned: false,
  };
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const candidateId = searchParams.get("candidateId") || "";
  const jobId = searchParams.get("jobId") || "";
  const requestedEmployeeId = searchParams.get("employeeId") || "";
  const { data: employees = [], isLoading: employeesLoading } = useAllEmployees();

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status !== "terminated"),
    [employees],
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(requestedEmployeeId);
  const [managerId, setManagerId] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [checklist, setChecklist] = useState<OnboardingChecklist>(EMPTY_CHECKLIST);
  const [equipment, setEquipment] = useState<EquipmentAsset[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedEmployee = activeEmployees.find((employee) => employee.id === selectedEmployeeId);
  const managers = useMemo(
    () => activeEmployees.filter((employee) => employee.id !== selectedEmployeeId),
    [activeEmployees, selectedEmployeeId],
  );

  const existingCaseQuery = useQuery({
    queryKey: ["onboarding", tenantId, "employee", selectedEmployeeId],
    queryFn: () => onboardingService.getCaseByEmployee(tenantId, selectedEmployeeId),
    enabled: !!tenantId && !!selectedEmployeeId,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (!requestedEmployeeId) return;
    setSelectedEmployeeId(requestedEmployeeId);
  }, [requestedEmployeeId]);

  useEffect(() => {
    if (!selectedEmployee) return;
    setChecklist((current) =>
      current.employeeRecordConfirmed
        ? current
        : { ...current, employeeRecordConfirmed: true },
    );
    setCompanyEmail((current) => current || selectedEmployee.personalInfo.email || "");
    if (!managerId && selectedEmployee.jobDetails.manager) {
      const existingManager = managers.find(
        (manager) => employeeName(manager).toLowerCase() === selectedEmployee.jobDetails.manager.toLowerCase(),
      );
      if (existingManager?.id) setManagerId(existingManager.id);
    }
  }, [managerId, managers, selectedEmployee]);

  useEffect(() => {
    const existing = existingCaseQuery.data;
    if (!existing) return;
    setManagerId(existing.managerEmployeeId || "");
    setCompanyEmail(existing.companyEmail || selectedEmployee?.personalInfo.email || "");
    setChecklist({ ...EMPTY_CHECKLIST, ...existing.checklist, employeeRecordConfirmed: true });
    setEquipment(existing.equipment || []);
    setNotes(existing.feedbackNotes || "");
  }, [existingCaseQuery.data, selectedEmployee?.personalInfo.email]);

  const chooseEmployee = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setManagerId("");
    setCompanyEmail("");
    setChecklist({ ...EMPTY_CHECKLIST, employeeRecordConfirmed: true });
    setEquipment([]);
    setNotes("");
    const next = new URLSearchParams(searchParams);
    next.set("employeeId", employeeId);
    setSearchParams(next, { replace: true });
  };

  const setCheck = (key: keyof OnboardingChecklist, checked: boolean) => {
    setChecklist((current) => ({ ...current, [key]: checked }));
  };

  const updateEquipment = (id: string, updates: Partial<EquipmentAsset>) => {
    setEquipment((current) =>
      current.map((asset) => (asset.id === id ? { ...asset, ...updates } : asset)),
    );
  };

  const save = async (status: "in_progress" | "completed") => {
    if (!selectedEmployee?.id) {
      toast({ title: "Choose an employee", variant: "destructive" });
      return;
    }
    if (
      status === "completed" &&
      (!checklist.contractReady || !checklist.policiesExplained || !checklist.firstDayReady)
    ) {
      toast({
        title: "Finish the three required checks",
        description: "You can save this checklist for later if the first day is not ready yet.",
        variant: "destructive",
      });
      return;
    }

    const manager = managers.find((employee) => employee.id === managerId);
    const policyConfirmed = checklist.policiesExplained;
    const existingCase = existingCaseQuery.data;
    const payload = {
      candidateId: candidateId || existingCase?.candidateId,
      employeeId: selectedEmployee.id,
      jobId: jobId || existingCase?.jobId,
      fullName: employeeName(selectedEmployee),
      dateOfBirth: selectedEmployee.personalInfo.dateOfBirth || "",
      address: selectedEmployee.personalInfo.address || "",
      mobilePhone: selectedEmployee.personalInfo.phone || "",
      emergencyContactName: selectedEmployee.personalInfo.emergencyContactName || "",
      emergencyContactPhone: selectedEmployee.personalInfo.emergencyContactPhone || "",
      bankAccountNumber:
        selectedEmployee.bankAccountNumber || selectedEmployee.bankDetails?.accountNumber || "",
      taxId: existingCase?.taxId || "",
      managerEmployeeId: managerId || undefined,
      managerName: manager ? employeeName(manager) : undefined,
      companyEmail: companyEmail.trim() || undefined,
      equipment,
      benefits: existingCase?.benefits || {},
      checklist,
      acknowledgements: {
        dressCode: policyConfirmed,
        codeOfConduct: policyConfirmed,
        leavePolicy: policyConfirmed,
        safetyGuidelines: policyConfirmed,
        dataProtection: policyConfirmed,
        handbookRead: policyConfirmed,
      },
      handbookSignatureDate: policyConfirmed ? getTodayTL() : undefined,
      feedbackNotes: notes.trim() || undefined,
      status,
      completedAt: status === "completed" ? new Date() : undefined,
      createdBy: existingCase?.createdBy || user?.uid || user?.email || "unknown",
    };

    setSaving(true);
    try {
      if (existingCase?.id) {
        await onboardingService.updateCase(tenantId, existingCase.id, payload);
      } else {
        await onboardingService.createCase(tenantId, payload);
      }

      if (manager) {
        await employeeService.updateEmployee(tenantId, selectedEmployee.id, {
          jobDetails: { ...selectedEmployee.jobDetails, manager: employeeName(manager) },
        });
      }
      if (candidateId) {
        await candidateService.updateCandidate(tenantId, candidateId, { status: "Hired" });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["onboarding", tenantId] }),
        queryClient.invalidateQueries({ queryKey: employeeKeys.all(tenantId) }),
      ]);
      toast({
        title: status === "completed" ? "Onboarding complete" : "Checklist saved",
        description:
          status === "completed"
            ? `${employeeName(selectedEmployee)} is ready for their first day.`
            : "You can return and finish it later.",
      });
      if (status === "completed") navigate("/people/employees");
    } catch (error) {
      toast({
        title: "Could not save onboarding",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const readyCount = [
    checklist.employeeRecordConfirmed,
    checklist.contractReady,
    checklist.policiesExplained,
    checklist.firstDayReady,
  ].filter(Boolean).length;

  if (employeesLoading) {
    return (
      <div className="mx-auto max-w-screen-lg space-y-5 px-4 py-5 sm:px-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.onboarding} />
      <div className="mx-auto max-w-screen-lg px-4 py-5 sm:px-6">
        <PageHeader
          title="Onboarding checklist"
          subtitle="Get the employee ready for their first day."
          icon={ClipboardCheck}
          iconColor="text-blue-600"
          actions={
            <Button variant="outline" onClick={() => navigate("/people/employees")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Employees
            </Button>
          }
        />

        {activeEmployees.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center px-6 py-12 text-center">
              <Users className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <h2 className="font-semibold">Add the employee first</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Onboarding attaches tasks and issued equipment to a real employee record.
              </p>
              <Button className="mt-5 gap-2 bg-blue-600 text-white hover:bg-blue-700" onClick={() => navigate("/people/add")}>
                <Plus className="h-4 w-4" />
                Add employee
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Employee</CardTitle>
                <CardDescription>Choose the person this checklist belongs to.</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedEmployeeId} onValueChange={chooseEmployee}>
                  <SelectTrigger className="w-full sm:max-w-md">
                    <SelectValue placeholder="Choose an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeEmployees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id!}>
                        {employeeName(employee)} · {employee.jobDetails.position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedEmployee && (
              <>
                <Card className="border bg-blue-50/50 dark:bg-blue-950/20">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{employeeName(selectedEmployee)}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {selectedEmployee.jobDetails.position} · starts {selectedEmployee.jobDetails.hireDate}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{readyCount}/4</p>
                      <p className="text-xs text-muted-foreground">ready</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Before the first day</CardTitle>
                    <CardDescription>Three checks are required to complete onboarding.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ChecklistRow
                      checked
                      disabled
                      onChange={() => undefined}
                      icon={UserCheck}
                      title="Employee record created"
                      description="Personal, job, and payroll details are linked to this person."
                    />
                    <ChecklistRow
                      checked={checklist.contractReady}
                      onChange={(checked) => setCheck("contractReady", checked)}
                      icon={Briefcase}
                      title="Contract and required documents are ready"
                      description="Confirm the signed contract and identity/payroll documents have been collected."
                    />
                    <ChecklistRow
                      checked={checklist.policiesExplained}
                      onChange={(checked) => setCheck("policiesExplained", checked)}
                      icon={ShieldCheck}
                      title="Workplace policies have been explained"
                      description="Cover conduct, safety, leave, data protection, and the handbook."
                    />
                    <ChecklistRow
                      checked={checklist.firstDayReady}
                      onChange={(checked) => setCheck("firstDayReady", checked)}
                      icon={CheckCircle2}
                      title="First-day plan is ready"
                      description="Confirm where, when, and who will welcome the employee."
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Manager and access</CardTitle>
                    <CardDescription>Optional details that make the handover smoother.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Manager</Label>
                      <Select value={managerId || "none"} onValueChange={(value) => setManagerId(value === "none" ? "" : value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No manager assigned</SelectItem>
                          {managers.map((manager) => (
                            <SelectItem key={manager.id} value={manager.id!}>{employeeName(manager)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-email">Company email</Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="company-email"
                          type="email"
                          className="pl-9"
                          value={companyEmail}
                          onChange={(event) => setCompanyEmail(event.target.value)}
                          placeholder="employee@company.com"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">Issued equipment</CardTitle>
                        <CardDescription>Optional. These items will appear during offboarding.</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => setEquipment((current) => [...current, blankAsset()])}>
                        <Plus className="h-4 w-4" />
                        Add item
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {equipment.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                        <Monitor className="mx-auto mb-2 h-6 w-6 opacity-50" />
                        No equipment issued.
                      </div>
                    ) : (
                      equipment.map((asset) => (
                        <div key={asset.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[10rem_1fr_1fr_auto]">
                          <Select value={asset.type} onValueChange={(value) => updateEquipment(asset.id, { type: value as EquipmentAssetType })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {EQUIPMENT_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={asset.assetTag || ""}
                            onChange={(event) => updateEquipment(asset.id, { assetTag: event.target.value })}
                            placeholder="Asset tag"
                            aria-label="Asset tag"
                          />
                          <Input
                            value={asset.serialNumber || ""}
                            onChange={(event) => updateEquipment(asset.id, { serialNumber: event.target.value })}
                            placeholder="Serial number"
                            aria-label="Serial number"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remove equipment"
                            onClick={() => setEquipment((current) => current.filter((item) => item.id !== asset.id))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notes</CardTitle>
                    <CardDescription>Anything the manager should remember for the first week.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Optional notes" />
                  </CardContent>
                </Card>

                <div className="flex flex-col-reverse gap-2 pb-8 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={() => save("in_progress")} disabled={saving} className="gap-2">
                    <Save className="h-4 w-4" />
                    Save for later
                  </Button>
                  <Button onClick={() => save("completed")} disabled={saving} className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {saving ? "Saving…" : "Complete onboarding"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChecklistRow({
  checked,
  disabled = false,
  onChange,
  icon: Icon,
  title,
  description,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  icon: typeof CheckCircle2;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40">
      <Checkbox
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
