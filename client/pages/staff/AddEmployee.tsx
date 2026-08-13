/**
 * AddEmployee - Step-by-step employee onboarding wizard
 * Reduces cognitive load by breaking the form into 4 digestible steps
 */

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { employeeKeys } from "@/hooks/useEmployees";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/layout/PageHeader";
import { ContextualHelpLink } from "@/components/help/ContextualHelpLink";
import { employeeService, type Employee, type ResidencyStatus } from "@/services/employeeService";
import { fileUploadService } from "@/services/fileUploadService";
import { departmentService, type Department } from "@/services/departmentService";
import { NATIONALITY_FLAGS, NATIONALITY_OPTIONS } from "@/lib/constants";
import MoreDetailsSection from "@/components/MoreDetailsSection";
import { DatePicker } from "@/components/ui/date-picker";
import { useI18n } from "@/i18n/I18nProvider";
import { useTenantId } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { SEO, seoConfig } from "@/components/SEO";
import { createAddEmployeeFormSchema, type AddEmployeeFormData } from "@/lib/validations";
import { toDateStringTL } from "@/lib/dateUtils";
import { divideMoney, roundMoney } from "@/lib/currency";
import {
  ageAt,
  isLightWorkOnlyAge,
  LIGHT_WORK_MAX_HOURS_PER_DAY,
  LIGHT_WORK_MAX_HOURS_PER_WEEK,
} from "@/lib/payroll/minors";
import { FIXED_TERM_MOTIVES, appendContractRenewal } from "@/lib/probation";
import { recordSalaryChange, salaryIncreaseSchedule } from "@/lib/payroll/salary-history";
import type { AttendancePremium } from "@/lib/payroll/attendance-premium";
import {
  UserPlus,
  FileText,
  Info,
  Mail,
  Phone,
  Smartphone,
  Sparkles,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RecoverableDraftAlert } from "@/components/forms/RecoverableDraftAlert";
import {
  useRecoverableFormDraft,
  useUnsavedChangesWarning,
} from "@/hooks/useRecoverableFormDraft";
import { useSlowOperation } from "@/hooks/useSlowOperation";
import { recoverableFormDraftKey } from "@/lib/recoverableFormDraft";

// Optional, heavy and rarely opened: the contract generator pulls the PDF
// stack in with it, so it must not sit in this page's chunk (STYLE_GUIDE:
// "Do not preload optional PDF, spreadsheet, or upload code").
const ContractGeneratorDialog = React.lazy(
  () => import("@/components/staff/ContractGeneratorDialog"),
);

const formatSalaryAmount = (amount: number): string =>
  `$${(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Helper function to get monthly salary with fallback
const getMonthlySalary = (compensation: { monthlySalary?: number; annualSalary?: number }): number => {
  return compensation.monthlySalary || divideMoney(compensation.annualSalary || 0, 12) || 0;
};

// Normalize employment type from Firestore (may be lowercase) to enum values
const normalizeEmploymentType = (value: string): "Full-time" | "Part-time" | "Contractor" | "Shareholder" => {
  const map: Record<string, "Full-time" | "Part-time" | "Contractor" | "Shareholder"> = {
    'full-time': 'Full-time', 'fulltime': 'Full-time',
    'part-time': 'Part-time', 'parttime': 'Part-time',
    'contractor': 'Contractor', 'contract': 'Contractor',
    'shareholder': 'Shareholder',
  };
  return map[value.toLowerCase()] || 'Full-time';
};

function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return toDateStringTL(value);
}

function addCalendarMonths(date: string, months: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setMonth(value.getMonth() + months);
  return toDateStringTL(value);
}

export default function AddEmployee() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editEmployeeId = searchParams.get("edit");
  const hiringCandidateId = searchParams.get("candidateId") || "";
  const hiringApplicationId = searchParams.get("applicationId") || "";
  const hiringJobId = searchParams.get("jobId") || "";
  const isHiringHandoff = !editEmployeeId && !!(hiringCandidateId || hiringApplicationId);
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { user } = useAuth();

  const employeeFormSchema = useMemo(
    () => createAddEmployeeFormSchema({
      firstNameRequired: t("addEmployee.validation.firstNameRequired"),
      lastNameRequired: t("addEmployee.validation.lastNameRequired"),
      invalidEmail: t("addEmployee.validation.invalidEmail"),
      startDateRequired: t("addEmployee.validation.startDateRequired"),
      salaryRequired: t("addEmployee.validation.salaryRequired"),
      salaryNonNegative: t("addEmployee.validation.salaryNonNegative"),
      taxResidenceRequired: t("addEmployee.validation.taxResidenceRequired"),
      minimumWorkingAge: (age) =>
        t("addEmployee.validation.minimumWorkingAge", { age }),
      partTimeHours: t("addEmployee.validation.partTimeHours"),
      minimumWageTreatment: t("addEmployee.validation.minimumWageTreatment"),
      minimumWageReviewNote: t("addEmployee.validation.minimumWageReviewNote"),
    }),
    [t],
  );

  // Form with react-hook-form + zod validation
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    setFocus,
    formState: { errors, isDirty },
  } = useForm<AddEmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      firstName: searchParams.get("firstName") || "",
      lastName: searchParams.get("lastName") || "",
      email: searchParams.get("email") || "",
      phone: searchParams.get("phone") || "",
      phoneApp: "",
      appEligible: false,
      emergencyContactName: "",
      emergencyContactPhone: "",
      department: searchParams.get("department") || "",
      jobTitle: searchParams.get("jobTitle") || "",
      manager: "",
      projectCode: "",
      fundingSource: "",
      startDate: "",
      employmentType: normalizeEmploymentType(
        searchParams.get("employmentType") || "Full-time",
      ),
      contractedWeeklyHours: "",
      minimumWageTreatment: undefined,
      minimumWageReviewNote: "",
      contractEndDate: "",
      probationEndDate: "",
      fixedTermMotive: "",
      salary: searchParams.get("salary") || "",
      salaryEffectiveFrom: "",
      salaryChangeReason: "",
      attendancePremiumAmount: "",
      attendancePremiumMode: "all_or_nothing",
      leaveDays: "12",
      benefits: "standard",
      payFrequency: "monthly",
    },
    mode: "onChange", // Validate on change for better UX
  });

  // Watch form values for canProceed logic
  const formValues = watch();

  useEffect(() => {
    if (!isHiringHandoff || !formValues.startDate) return;
    const probationDays = Number(searchParams.get("probationDays") || 0);
    const durationMonths = Number(
      searchParams.get("contractDurationMonths") || 0,
    );
    if (probationDays > 0 && !formValues.probationEndDate) {
      setValue(
        "probationEndDate",
        addCalendarDays(formValues.startDate, probationDays),
        { shouldValidate: true },
      );
    }
    if (
      searchParams.get("contractType") === "Fixed-Term" &&
      durationMonths > 0 &&
      !formValues.contractEndDate
    ) {
      setValue(
        "contractEndDate",
        addCalendarMonths(formValues.startDate, durationMonths),
        { shouldValidate: true },
      );
    }
  }, [
    formValues.contractEndDate,
    formValues.probationEndDate,
    formValues.startDate,
    isHiringHandoff,
    searchParams,
    setValue,
  ]);

  // Lei 4/2012: light-work minor (15-16 at hire date — Art. 69 warning) and
  // fixed-term detection (drives the Art. 12(2) motive select). The under-15
  // hard block (Art. 68) lives in the zod schema.
  const isLightWorkMinor = isLightWorkOnlyAge(
    formValues.dateOfBirth || "",
    formValues.startDate || new Date(),
  );
  const looksFixedTerm =
    !!formValues.contractEndDate ||
    /fixed|contract|temp/i.test(formValues.employmentType || "");

  // Document entry values stored by fieldKey (persists across nationality switches)
  const [docValues, setDocValues] = useState<Record<string, { number: string; expiryDate: string }>>({
    bilheteIdentidade: { number: "", expiryDate: "" },
    socialSecurityNumber: { number: "", expiryDate: "" },
    taxIdentificationNumber: { number: "", expiryDate: "" },
    electoralCard: { number: "", expiryDate: "" },
    passport: { number: "", expiryDate: "" },
  });

  const documentLabelMap: Record<
    string,
    { labelKey: string; descriptionKey: string }
  > = {
    bilheteIdentidade: {
      labelKey: "addEmployee.documents.types.bilheteIdentidade.label",
      descriptionKey: "addEmployee.documents.types.bilheteIdentidade.description",
    },
    socialSecurityNumber: {
      labelKey: "addEmployee.documents.types.socialSecurityNumber.label",
      descriptionKey: "addEmployee.documents.types.socialSecurityNumber.description",
    },
    taxIdentificationNumber: {
      labelKey: "addEmployee.documents.types.taxIdentificationNumber.label",
      descriptionKey: "addEmployee.documents.types.taxIdentificationNumber.description",
    },
    electoralCard: {
      labelKey: "addEmployee.documents.types.electoralCard.label",
      descriptionKey: "addEmployee.documents.types.electoralCard.description",
    },
    passport: {
      labelKey: "addEmployee.documents.types.passport.label",
      descriptionKey: "addEmployee.documents.types.passport.description",
    },
  };

  const [additionalInfo, setAdditionalInfo] = useState({
    nationality: "Timor-Leste",
    residencyStatus: "timorese" as ResidencyStatus,
    workContract: null as File | null,
    workingVisaNumber: "",
    workingVisaExpiry: "",
    workingVisaFile: null as File | null,
    sefopePermitNumber: "",
    sefopePermitExpiry: "",
    sefopePermitFile: null as File | null,
    // Cash is the Timor-Leste default; most workers have no bank account.
    paymentMethod: "cash" as "bank_transfer" | "cash",
    bankName: "",
    bankAccountNumber: "",
  });

  const isTimorese = additionalInfo.nationality === "Timor-Leste";

  // Contextual document rows based on nationality
  const documents = useMemo(() => {
    if (isTimorese) {
      return [
        { fieldKey: "bilheteIdentidade", required: true, hasExpiry: true },
        { fieldKey: "electoralCard", required: false, hasExpiry: true },
        { fieldKey: "socialSecurityNumber", required: true, hasExpiry: false },
        { fieldKey: "taxIdentificationNumber", required: false, hasExpiry: false },
      ];
    }
    return [
      { fieldKey: "passport", required: true, hasExpiry: true },
      { fieldKey: "socialSecurityNumber", required: true, hasExpiry: false },
      { fieldKey: "taxIdentificationNumber", required: false, hasExpiry: false },
    ];
  }, [isTimorese]);

  // UI state
  const [showContractGenerator, setShowContractGenerator] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const salaryChanges = useMemo(
    () => salaryIncreaseSchedule(editingEmployee?.compensation?.salaryHistory),
    [editingEmployee],
  );

  // True only when editing and the typed salary differs from what is stored, so
  // the effective-date question appears exactly when it has an answer.
  const salaryIsChanging = useMemo(() => {
    if (!isEditMode || !editingEmployee) return false;
    const stored = getMonthlySalary(editingEmployee.compensation);
    const typed = Number(formValues.salary || "0") || 0;
    return Number.isFinite(typed) && roundMoney(typed) !== roundMoney(stored);
  }, [isEditMode, editingEmployee, formValues.salary]);
  const [supplementalDirty, setSupplementalDirty] = useState(false);

  const draftStorageKey = recoverableFormDraftKey({
    userId: user?.uid || "anonymous",
    tenantId,
    form: editEmployeeId
      ? `employee-edit-${editEmployeeId}`
      : hiringApplicationId
        ? `employee-hire-${hiringApplicationId}`
        : "employee-new",
  });
  const employeeDraftData = useMemo(() => ({
    form: formValues,
    documents: docValues,
    additional: {
      nationality: additionalInfo.nationality,
      residencyStatus: additionalInfo.residencyStatus,
      workingVisaNumber: additionalInfo.workingVisaNumber,
      workingVisaExpiry: additionalInfo.workingVisaExpiry,
      sefopePermitNumber: additionalInfo.sefopePermitNumber,
      sefopePermitExpiry: additionalInfo.sefopePermitExpiry,
      paymentMethod: additionalInfo.paymentMethod,
      bankName: additionalInfo.bankName,
      bankAccountNumber: additionalInfo.bankAccountNumber,
    },
  }), [additionalInfo, docValues, formValues]);
  const {
    availableDraft,
    operationId: employeeCreateOperationId,
    restoreDraft,
    discardDraft,
    clearDraft,
  } = useRecoverableFormDraft({
    storageKey: draftStorageKey,
    data: employeeDraftData,
    enabled: Boolean(user?.uid && tenantId && !loading),
    shouldSave: isDirty || supplementalDirty,
    onRestore: (draft) => {
      reset(draft.form, { keepDefaultValues: true });
      setDocValues(draft.documents);
      setAdditionalInfo((current) => ({
        ...current,
        ...draft.additional,
        workContract: null,
        workingVisaFile: null,
        sefopePermitFile: null,
      }));
      setSupplementalDirty(true);
    },
  });
  const savingSlowly = useSlowOperation(isSubmitting);
  const confirmLeave = useUnsavedChangesWarning(
    (isDirty || supplementalDirty) && !isSubmitting,
    t("common.unsavedChangesWarning"),
  );

  // In edit mode, show green border for filled fields and red for empty ones
  const loadEmployeeForEdit = useCallback(async (employeeId: string) => {
    try {
      setLoading(true);
      const employee = await employeeService.getEmployeeById(tenantId, employeeId);
      if (employee) {
        setIsEditMode(true);
        setEditingEmployee(employee);

        // Reset form with employee data
        reset({
          firstName: employee.personalInfo.firstName,
          lastName: employee.personalInfo.lastName,
          email: employee.personalInfo.email,
          phone: employee.personalInfo.phone || "",
          phoneApp: employee.personalInfo.phoneApp || "",
          appEligible: employee.personalInfo.appEligible || false,
          dateOfBirth: employee.personalInfo.dateOfBirth || "",
          address: employee.personalInfo.address || "",
          emergencyContactName: employee.personalInfo.emergencyContactName || "",
          emergencyContactPhone: employee.personalInfo.emergencyContactPhone || "",
          department: employee.jobDetails.department,
          jobTitle: employee.jobDetails.position,
          manager: employee.jobDetails.manager || "",
          projectCode: employee.jobDetails.projectCode || "",
          fundingSource: employee.jobDetails.fundingSource || "",
          startDate: employee.jobDetails.hireDate,
          employmentType: normalizeEmploymentType(employee.jobDetails.employmentType),
          contractedWeeklyHours: employee.jobDetails.contractedWeeklyHours?.toString() || "",
          minimumWageTreatment: employee.jobDetails.minimumWageTreatment,
          minimumWageReviewNote: employee.jobDetails.minimumWageReviewNote || "",
          contractEndDate: employee.jobDetails.contractEndDate || "",
          probationEndDate: employee.jobDetails.probationEndDate || "",
          fixedTermMotive: employee.jobDetails.fixedTermMotive || "",
          salary: getMonthlySalary(employee.compensation).toString(),
          // Left blank on purpose: it is only answered when the salary is being
          // changed, and prefilling a date would silently stamp a history entry
          // with a meaningless effective date on an unrelated edit.
          salaryEffectiveFrom: "",
          salaryChangeReason: "",
          attendancePremiumAmount:
            employee.compensation.attendancePremium?.active
              ? String(employee.compensation.attendancePremium.amount ?? "")
              : "",
          attendancePremiumMode:
            employee.compensation.attendancePremium?.mode || "all_or_nothing",
          leaveDays: employee.compensation.annualLeaveDays?.toString() || "12",
          benefits: ((employee.compensation.benefitsPackage || "standard").toLowerCase()) as "basic" | "standard" | "premium" | "executive",
          payFrequency: employee.compensation.payFrequency || "monthly",
          isResident: employee.compensation.isResident,
        });

        // Populate documents from stored data
        setDocValues({
          bilheteIdentidade: {
            number: employee.documents?.bilheteIdentidade?.number || "",
            expiryDate: employee.documents?.bilheteIdentidade?.expiryDate || "",
          },
          socialSecurityNumber: {
            number: employee.documents?.socialSecurityNumber?.number || "",
            expiryDate: employee.documents?.socialSecurityNumber?.expiryDate || "",
          },
          taxIdentificationNumber: {
            number: employee.documents?.taxIdentificationNumber?.number || "",
            expiryDate: employee.documents?.taxIdentificationNumber?.expiryDate || "",
          },
          electoralCard: {
            number: employee.documents?.electoralCard?.number || "",
            expiryDate: employee.documents?.electoralCard?.expiryDate || "",
          },
          passport: {
            number: employee.documents?.passport?.number || "",
            expiryDate: employee.documents?.passport?.expiryDate || "",
          },
        });

        const nat = employee.documents?.nationality || "Timor-Leste";
        const hasBankAccount = !!(employee.bankName || employee.bankDetails?.bankName);
        setAdditionalInfo(prev => ({
          ...prev,
          nationality: nat,
          residencyStatus: nat === "Timor-Leste" ? "timorese" : "foreign_worker",
          workingVisaNumber: employee.documents?.workingVisaResidency?.number || "",
          workingVisaExpiry: employee.documents?.workingVisaResidency?.expiryDate || "",
          sefopePermitNumber: employee.documents?.sefopeWorkPermit?.number || "",
          sefopePermitExpiry: employee.documents?.sefopeWorkPermit?.expiryDate || "",
          paymentMethod: hasBankAccount ? "bank_transfer" : "cash",
          bankName: employee.bankName || employee.bankDetails?.bankName || "",
          bankAccountNumber: employee.bankAccountNumber || employee.bankDetails?.accountNumber || "",
        }));
      } else {
        toast({
          title: t("addEmployee.toast.errorTitle"),
          description: t("addEmployee.toast.employeeNotFound"),
          variant: "destructive",
        });
        navigate("/people/employees");
      }
    } catch (error) {
      console.error("Error loading employee:", error);
      toast({
        title: t("addEmployee.toast.errorTitle"),
        description: t("addEmployee.toast.loadFailed"),
        variant: "destructive",
      });
      navigate("/people/employees");
    } finally {
      setLoading(false);
    }
  }, [tenantId, reset, toast, t, navigate]);

  const loadDepartmentsAndManagers = useCallback(async () => {
    try {
      const [depts, employees] = await Promise.all([
        departmentService.getAllDepartments(tenantId),
        employeeService.getAllEmployees(tenantId),
      ]);
      setDepartments(depts);
      setManagers(employees.filter(emp => emp.id !== editEmployeeId));
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: t("addEmployee.toast.errorTitle"),
        description: t("addEmployee.toast.loadDepartmentsFailed"),
        variant: "destructive",
      });
    } finally {
      if (!editEmployeeId) setLoading(false);
    }
  }, [tenantId, editEmployeeId, toast, t]);

  useEffect(() => {
    if (!tenantId) return; // Wait for tenantId to be available
    loadDepartmentsAndManagers();
    if (editEmployeeId) {
      loadEmployeeForEdit(editEmployeeId);
    }
  }, [editEmployeeId, tenantId, loadDepartmentsAndManagers, loadEmployeeForEdit]);

  const handleDocumentChange = (fieldKey: string, field: "number" | "expiryDate", value: string) => {
    setSupplementalDirty(true);
    setDocValues(prev => ({ ...prev, [fieldKey]: { ...prev[fieldKey], [field]: value } }));
  };

  const handleAdditionalInfoChange = (field: string, value: string | File | null) => {
    setSupplementalDirty(true);
    setAdditionalInfo(prev => {
      const next = { ...prev, [field]: value };
      // This drives immigration/document requirements only. Tax residence is
      // the separate required `isResident` field and is never inferred here.
      if (field === "nationality") {
        next.residencyStatus = value === "Timor-Leste" ? "timorese" : "foreign_worker";
      }
      return next;
    });
  };

  const getExpiryStatus = (expiryDate: string) => {
    if (!expiryDate) return null;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysDiff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (daysDiff < 0) {
      return { status: "expired", message: t("addEmployee.documents.status.expired"), variant: "destructive" as const };
    }
    if (daysDiff <= 28) {
      return { status: "expiring", message: t("addEmployee.documents.status.days", { count: daysDiff }), variant: "destructive" as const };
    }
    if (daysDiff <= 60) {
      return { status: "warning", message: t("addEmployee.documents.status.days", { count: daysDiff }), variant: "secondary" as const };
    }
    return { status: "valid", message: t("addEmployee.documents.status.valid"), variant: "default" as const };
  };

  // Form submission handler - called by react-hook-form's handleSubmit
  const onFormSubmit = async (data: AddEmployeeFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const uploadedThisSave: string[] = [];
    const supersededAfterSave: string[] = [];
    let employeeRecordSaved = false;
    const employeeIdForUpload = isEditMode && editingEmployee
      ? editingEmployee.id!
      : hiringApplicationId || employeeCreateOperationId;

    try {
      let savedEmployeeId = editingEmployee?.id || "";
      // Use BI number for Timorese, passport for foreigners as employeeId
      const primaryDocNumber = isTimorese
        ? docValues.bilheteIdentidade?.number
        : docValues.passport?.number;
      const employeeId = primaryDocNumber || (
        isEditMode && editingEmployee?.jobDetails.employeeId
          ? editingEmployee.jobDetails.employeeId
          : `TEMP-${employeeCreateOperationId}`
      );
      const currentDate = new Date();

      // Compute from the submitted data (zod-normalized), not watched values.
      const submitLooksFixedTerm =
        !!data.contractEndDate || /fixed|contract|temp/i.test(data.employmentType || "");

      // F20 (Art. 13): when the contract end date moves FORWARD on an edit,
      // record the renewal. appendContractRenewal returns null when the
      // change is not a renewal (first set / cleared / unchanged / backward),
      // in which case the existing history is preserved via the spread below.
      const previousJobDetails = isEditMode ? editingEmployee?.jobDetails : undefined;
      const renewals = appendContractRenewal(
        previousJobDetails?.contractRenewals,
        previousJobDetails?.contractEndDate,
        data.contractEndDate || "",
        new Date().toISOString(),
      );

      // Pay change → salary history. `recordSalaryChange` returns null unless
      // this really is a change with an effective date, so a first-time set or
      // an edit that leaves salary alone writes no entry.
      const previousCompensation = isEditMode ? editingEmployee?.compensation : undefined;
      const newMonthlySalary = roundMoney(Number(data.salary || "0") || 0);
      const salaryHistory = recordSalaryChange(
        previousCompensation?.salaryHistory,
        previousCompensation ? getMonthlySalary(previousCompensation) : undefined,
        newMonthlySalary,
        data.salaryEffectiveFrom || "",
        new Date().toISOString(),
        {
          recordedBy: user?.email || undefined,
          reason: data.salaryChangeReason?.trim() || undefined,
        },
      );

      // Standing attendance premium. A blank or zero amount clears it — stored as
      // an inactive record rather than deleted so the employer's chosen mode
      // survives switching it off and on again.
      const premiumAmount = roundMoney(Number(data.attendancePremiumAmount || "0") || 0);
      const attendancePremium: AttendancePremium | undefined =
        premiumAmount > 0
          ? {
              amount: premiumAmount,
              mode: data.attendancePremiumMode,
              active: true,
            }
          : previousCompensation?.attendancePremium
            ? { ...previousCompensation.attendancePremium, active: false }
            : undefined;

      const newEmployee: Omit<Employee, "id"> = {
        personalInfo: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email || "",
          phone: data.phone || "",
          phoneApp: data.phoneApp || "",
          appEligible: data.appEligible,
          address: data.address || "",
          dateOfBirth: data.dateOfBirth || "",
          socialSecurityNumber: docValues.socialSecurityNumber?.number || "",
          emergencyContactName: data.emergencyContactName || "",
          emergencyContactPhone: data.emergencyContactPhone || "",
        },
        jobDetails: {
          // Preserve lifecycle fields because updateEmployee replaces the
          // whole jobDetails map.
          ...(previousJobDetails ?? {}),
          employeeId,
          department: data.department || "",
          position: data.jobTitle || "",
          hireDate: data.startDate || toDateStringTL(currentDate),
          employmentType: data.employmentType,
          contractedWeeklyHours:
            data.employmentType === "Part-time"
              ? Number(data.contractedWeeklyHours)
              : 44,
          minimumWageTreatment:
            data.employmentType === "Part-time"
              ? data.minimumWageTreatment!
              : "full_floor",
          minimumWageReviewNote:
            data.employmentType === "Part-time"
              ? data.minimumWageReviewNote || ""
              : "",
          contractEndDate: data.contractEndDate || "",
          probationEndDate: data.probationEndDate || "",
          fixedTermMotive: submitLooksFixedTerm ? data.fixedTermMotive || "" : "",
          ...(renewals ? { contractRenewals: renewals } : {}),
          workLocation: previousJobDetails?.workLocation || "Office",
          manager: data.manager || "",
          projectCode: data.projectCode?.trim() || "",
          fundingSource: data.fundingSource?.trim() || "",
        },
        compensation: {
          monthlySalary: newMonthlySalary,
          annualLeaveDays: parseInt(data.leaveDays, 10) || 12,
          benefitsPackage: data.benefits || "standard",
          payFrequency: data.payFrequency,
          isResident: data.isResident,
          // Same contract as contractRenewals above: non-null only when this
          // save is a real pay change with an effective date, so an unrelated
          // edit preserves the existing history via the spread.
          ...(salaryHistory ? { salaryHistory } : previousCompensation?.salaryHistory
            ? { salaryHistory: previousCompensation.salaryHistory }
            : {}),
          ...(attendancePremium ? { attendancePremium } : {}),
        },
        documents: {
          bilheteIdentidade: { number: docValues.bilheteIdentidade?.number || "", expiryDate: docValues.bilheteIdentidade?.expiryDate || "", required: isTimorese },
          employeeIdCard: { number: docValues.bilheteIdentidade?.number || "", expiryDate: docValues.bilheteIdentidade?.expiryDate || "", required: isTimorese },
          socialSecurityNumber: { number: docValues.socialSecurityNumber?.number || "", expiryDate: docValues.socialSecurityNumber?.expiryDate || "", required: true },
          taxIdentificationNumber: { number: docValues.taxIdentificationNumber?.number || "", expiryDate: "", required: false },
          electoralCard: { number: docValues.electoralCard?.number || "", expiryDate: docValues.electoralCard?.expiryDate || "", required: false },
          idCard: { number: "", expiryDate: "", required: false },
          passport: { number: docValues.passport?.number || "", expiryDate: docValues.passport?.expiryDate || "", required: !isTimorese },
          workContract: {
            fileUrl: editingEmployee?.documents.workContract.fileUrl || "",
            uploadDate:
              editingEmployee?.documents.workContract.uploadDate ||
              new Date().toISOString(),
          },
          nationality: additionalInfo.nationality,
          residencyStatus: additionalInfo.residencyStatus,
          workingVisaResidency: {
            number: additionalInfo.workingVisaNumber,
            expiryDate: additionalInfo.workingVisaExpiry,
            fileUrl:
              editingEmployee?.documents.workingVisaResidency.fileUrl || "",
          },
          sefopeWorkPermit: !isTimorese ? {
            number: additionalInfo.sefopePermitNumber,
            expiryDate: additionalInfo.sefopePermitExpiry,
            fileUrl:
              editingEmployee?.documents.sefopeWorkPermit?.fileUrl || "",
          } : undefined,
        },
        isForeignWorker: !isTimorese,
        bankName: additionalInfo.paymentMethod === "bank_transfer" ? additionalInfo.bankName : "",
        bankAccountNumber: additionalInfo.paymentMethod === "bank_transfer" ? additionalInfo.bankAccountNumber : "",
        // NEVER re-author status on an edit — this page is also the edit page
        // (/people/add?edit=<id>). Hardcoding "active" here silently resurrected
        // a terminated worker: saving their profile to attach an exit document
        // put them back on the payroll roster at FULL salary, every month. And
        // because updateEmployee merges fields, terminationDate and
        // severanceOnTermination survived, so the run treated them as a rehire
        // while the INSS DR contract-day proration in statutory-returns.ts (which
        // only fires for status === 'terminated') stopped applying — reopening
        // gap-matrix live bug L4 with a full 30-day Art. 12 declaration.
        // It also un-suspended 'inactive' staff and re-billed their seat.
        // Reactivation must be an explicit, audited action that clears those
        // fields and sets a new hireDate, not a side effect of saving a profile.
        // Same reasoning as the jobDetails lifecycle spread above.
        status: isEditMode ? (editingEmployee?.status ?? "active") : "active",
      };

      // Upload files if they exist
      const failedUploads: string[] = [];

      if (additionalInfo.workContract) {
        try {
          const url = await fileUploadService.uploadEmployeeDocument(
            additionalInfo.workContract,
            tenantId,
            employeeIdForUpload,
            "workContract",
            isEditMode ? undefined : employeeCreateOperationId,
          );
          uploadedThisSave.push(url);
          if (editingEmployee?.documents.workContract.fileUrl) {
            supersededAfterSave.push(editingEmployee.documents.workContract.fileUrl);
          }
          newEmployee.documents.workContract.fileUrl = url;
          newEmployee.documents.workContract.uploadDate = new Date().toISOString();
        } catch (e) {
          console.error("Work contract upload failed:", e);
          failedUploads.push(t("addEmployee.documents.workContract") || "work contract");
        }
      }

      if (additionalInfo.workingVisaFile) {
        try {
          const url = await fileUploadService.uploadEmployeeDocument(
            additionalInfo.workingVisaFile,
            tenantId,
            employeeIdForUpload,
            "workingVisa",
            isEditMode ? undefined : employeeCreateOperationId,
          );
          uploadedThisSave.push(url);
          if (editingEmployee?.documents.workingVisaResidency.fileUrl) {
            supersededAfterSave.push(editingEmployee.documents.workingVisaResidency.fileUrl);
          }
          newEmployee.documents.workingVisaResidency.fileUrl = url;
        } catch (e) {
          console.error("Visa upload failed:", e);
          failedUploads.push(t("addEmployee.documents.workingVisa") || "working visa");
        }
      }

      if (additionalInfo.sefopePermitFile && newEmployee.documents.sefopeWorkPermit) {
        try {
          const url = await fileUploadService.uploadEmployeeDocument(
            additionalInfo.sefopePermitFile,
            tenantId,
            employeeIdForUpload,
            "sefopePermit",
            isEditMode ? undefined : employeeCreateOperationId,
          );
          uploadedThisSave.push(url);
          if (editingEmployee?.documents.sefopeWorkPermit?.fileUrl) {
            supersededAfterSave.push(editingEmployee.documents.sefopeWorkPermit.fileUrl);
          }
          newEmployee.documents.sefopeWorkPermit.fileUrl = url;
        } catch (e) {
          console.error("SEFOPE permit upload failed:", e);
          failedUploads.push(t("addEmployee.documents.sefopePermitTitle") || "SEFOPE work permit");
        }
      }

      // Save to Firebase
      if (isEditMode && editingEmployee) {
        await employeeService.updateEmployee(
          tenantId,
          editingEmployee.id!,
          newEmployee,
          user ? {
            tenantId,
            userId: user.uid,
            userEmail: user.email || "",
            userName: user.displayName || undefined,
            changes: [
              {
                field: "jobDetails.minimumWageTreatment",
                from: editingEmployee.jobDetails.minimumWageTreatment || null,
                to: newEmployee.jobDetails.minimumWageTreatment || null,
              },
              {
                field: "jobDetails.minimumWageReviewNote",
                from: editingEmployee.jobDetails.minimumWageReviewNote || null,
                to: newEmployee.jobDetails.minimumWageReviewNote || null,
              },
              {
                field: "jobDetails.projectCode",
                from: editingEmployee.jobDetails.projectCode || null,
                to: newEmployee.jobDetails.projectCode || null,
              },
              {
                field: "jobDetails.fundingSource",
                from: editingEmployee.jobDetails.fundingSource || null,
                to: newEmployee.jobDetails.fundingSource || null,
              },
            ],
          } : undefined,
        );
        savedEmployeeId = editingEmployee.id!;
        employeeRecordSaved = true;
        toast({
          title: t("addEmployee.toast.updatedTitle"),
          description: t("addEmployee.toast.updatedDesc", {
            name: `${data.firstName} ${data.lastName}`,
          }),
        });
      } else {
        const id = await employeeService.addEmployee(
          tenantId,
          newEmployee,
          user ? {
            tenantId,
            userId: user.uid,
            userEmail: user.email || "",
            userName: user.displayName || undefined,
          } : undefined,
          employeeIdForUpload,
          hiringApplicationId
            ? {
                applicationId: hiringApplicationId,
                candidateId: hiringCandidateId || undefined,
                jobId: hiringJobId || undefined,
              }
            : undefined,
        );
        if (!id) throw new Error("Failed to save");
        savedEmployeeId = id;
        employeeRecordSaved = true;
        toast({
          title: t("addEmployee.toast.addedTitle"),
          description: t("addEmployee.toast.addedDesc", {
            name: `${data.firstName} ${data.lastName}`,
          }),
        });

        // Provision app access + email a password-setup link (non-blocking:
        // the employee record is already saved either way).
        const inviteEmail = newEmployee.personalInfo.email?.trim();
        if (inviteEmail) {
          try {
            await employeeService.sendAppInvite(tenantId, { email: inviteEmail, employeeDocId: id });
            toast({
              title: t("addEmployee.toast.inviteSentTitle"),
              description: t("addEmployee.toast.inviteSentDesc", { email: inviteEmail }),
            });
          } catch (inviteError) {
            const code = (inviteError as { code?: string }).code;
            if (code !== "functions/already-exists") {
              console.error("App invite failed:", inviteError);
              toast({
                title: t("addEmployee.toast.inviteFailedTitle"),
                description: t("addEmployee.toast.inviteFailedDesc"),
                variant: "destructive",
              });
            }
          }
        }
      }

      // Firestore now points at the replacement files, so old objects can be
      // removed without risking a broken employee record if deletion fails.
      await Promise.all(
        supersededAfterSave.map((url) =>
          fileUploadService.deleteFile(url).catch((cleanupError) => {
            console.warn("Could not remove superseded employee document:", cleanupError);
          }),
        ),
      );

      if (failedUploads.length > 0) {
        toast({
          title: t("addEmployee.toast.uploadWarningTitle") || "Document upload failed",
          description: (t("addEmployee.toast.uploadWarningDesc") || "Employee was saved, but failed to upload: {files}").replace("{files}", failedUploads.join(", ")),
          variant: "destructive",
        });
      }

      // Lei 4/2012 soft warnings (never block the save):
      // Art. 69 — a 15-16 year old at the hire date is limited to light work.
      const savedAgeAtHire = ageAt(data.dateOfBirth || "", data.startDate || currentDate);
      if (savedAgeAtHire !== null && savedAgeAtHire >= 15 && savedAgeAtHire < 17) {
        toast({
          title: t("addEmployee.toast.minorWarningTitle") || "Minor employee (Labour Law Art. 69)",
          description:
            t("addEmployee.toast.minorWarningDesc") ||
            `Light work only: max ${LIGHT_WORK_MAX_HOURS_PER_DAY}h/day, ${LIGHT_WORK_MAX_HOURS_PER_WEEK}h/week, no night or overtime work.`,
        });
      }
      // Art. 12(2) — fixed-term without a stated motive is deemed permanent.
      if (submitLooksFixedTerm && !data.fixedTermMotive) {
        toast({
          title: t("addEmployee.toast.fixedTermMotiveTitle") || "No fixed-term motive stated",
          description:
            t("addEmployee.toast.fixedTermMotiveDesc") ||
            "Art. 12(2): a fixed-term contract without a stated motive is deemed permanent.",
        });
      }

      // Drop every cached employee view before leaving. Nothing else did:
      // this page wrote straight through employeeService and navigated, so the
      // directory rendered its stale list and the new hire only appeared after
      // a manual refresh — right under a "added!" toast. employeeKeys.all
      // covers the list, directory, detail, counts, activeSummary and
      // issuePreview branches in one call.
      await queryClient.invalidateQueries({
        queryKey: employeeKeys.all(tenantId),
      });
      clearDraft();

      if (isHiringHandoff && savedEmployeeId) {
        const params = new URLSearchParams({ employeeId: savedEmployeeId });
        if (hiringCandidateId) params.set("candidateId", hiringCandidateId);
        if (hiringJobId) params.set("jobId", hiringJobId);
        navigate(`/people/onboarding?${params.toString()}`);
      } else {
        navigate("/people/employees");
      }
    } catch (error) {
      let confirmedNotSaved = !employeeRecordSaved && isEditMode;
      if (!employeeRecordSaved && !isEditMode) {
        try {
          confirmedNotSaved = !(await employeeService.getEmployeeById(
            tenantId,
            employeeIdForUpload,
          ));
        } catch {
          // An ambiguous offline result may hide a successful write. Keep the
          // deterministic uploads so a retry can safely converge on it.
          confirmedNotSaved = false;
        }
      }
      if (confirmedNotSaved) {
        await Promise.all(
          uploadedThisSave.map((url) =>
            fileUploadService.deleteFile(url).catch((cleanupError) => {
              console.warn("Could not clean up an unlinked employee document:", cleanupError);
            }),
          ),
        );
      }
      console.error("Error saving employee:", error);
      toast({
        title: t("addEmployee.toast.errorTitle"),
        description:
          error instanceof Error ? error.message : t("addEmployee.toast.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-background">
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 min-w-0">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <Skeleton className="h-10 w-32 shrink-0" />
          </div>

          <div className="space-y-6">
            <section className="space-y-4">
              <Skeleton className="h-5 w-40" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Skeleton className="h-11 w-full rounded-md" />
                <Skeleton className="h-11 w-full rounded-md" />
              </div>
              <Skeleton className="h-11 w-full rounded-lg" />
            </section>

            <section className="space-y-4 border-t border-border/60 pt-6">
              <Skeleton className="h-5 w-64 max-w-full" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-11 w-full rounded-md" />
                <Skeleton className="h-11 w-full rounded-md" />
                <Skeleton className="h-11 w-full rounded-md" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Skeleton className="h-11 w-full rounded-md" />
                <Skeleton className="h-11 w-full rounded-md" />
              </div>
            </section>

            <section className="space-y-4 border-t border-border/60 pt-6">
              <Skeleton className="h-5 w-44" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-11 w-full rounded-md" />
                <Skeleton className="h-11 w-full rounded-md" />
                <Skeleton className="h-11 w-full rounded-md" />
              </div>
            </section>

            <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-border bg-background/95 px-4 py-3 sm:static sm:justify-end sm:border-0 sm:bg-transparent sm:px-0">
              <Skeleton className="h-11 flex-1 rounded-md sm:w-20 sm:flex-none" />
              <Skeleton className="h-11 flex-1 rounded-md sm:w-32 sm:flex-none" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <SEO {...seoConfig.addEmployee} />

      <PageHeader
        title={isEditMode
          ? t("addEmployee.header.editTitle")
          : t("addEmployee.header.addTitle")}
        subtitle={isEditMode
          ? t("addEmployee.header.editSubtitle")
          : t("addEmployee.header.addSubtitle")}
        icon={UserPlus}
        iconColor="text-blue-500"
        className="mx-auto max-w-screen-2xl px-4 sm:px-6"
      />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6 -mt-6">
        <div className="mb-2 flex justify-end">
          <ContextualHelpLink slug="getting-started" anchor="add-your-team" />
        </div>
        {/* Contract Generator Dialog — mounted only once opened so its chunk
            (and the PDF code it pulls) never loads for someone just adding a
            person. Bulk CSV import deliberately does NOT live on this page:
            it is one button on Employees. */}
        {showContractGenerator && (
          <React.Suspense fallback={null}>
            <ContractGeneratorDialog
              open={showContractGenerator}
              onOpenChange={setShowContractGenerator}
              input={{
                form: formValues,
                docValues,
                additionalInfo,
              }}
              employeeName={`${formValues.firstName || ""} ${formValues.lastName || ""}`.trim()}
              onAttach={(file) => handleAdditionalInfoChange("workContract", file)}
            />
          </React.Suspense>
        )}

        {/* One scrolling form. No stepper: after the cut this is nine
            controls, and a 4-step frame told a first-time user the job was
            bigger than it is — while stranding them on a step that did not
            hold the field the error was about. */}
        <form
          onSubmit={handleSubmit(onFormSubmit, (validationErrors) => {
            // Everything is on screen now, so focus the offending field
            // instead of navigating anywhere.
            const firstKey = Object.keys(validationErrors)[0];
            if (firstKey) {
              setFocus(firstKey as keyof AddEmployeeFormData);
              document
                .getElementById(firstKey)
                ?.scrollIntoView({ block: "center" });
            }
            const firstError = Object.values(validationErrors)[0];
            toast({
              title: t("addEmployee.toast.errorTitle") || "Validation Error",
              description: firstError?.message || t("addEmployee.toast.fillRequiredFields"),
              variant: "destructive",
            });
          })}
          className="space-y-6 pb-24"
        >
          {availableDraft && (
            <RecoverableDraftAlert
              savedAt={availableDraft.updatedAt}
              filesNeedReattaching
              onRestore={restoreDraft}
              onDiscard={discardDraft}
            />
          )}
          {/* Who they are — the only two fields every employee must have. */}
          <>
            <div className="space-y-6">
              <h2 className="text-base font-semibold">
                {t("addEmployee.section.who") || "Who are you adding?"}
              </h2>
              {/* Name Row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("addEmployee.fields.firstName")}</Label>
                  <Input
                    id="firstName"
                    {...register("firstName")}
                    placeholder={t("addEmployee.fields.firstName")}
                    autoFocus
                    className={errors.firstName ? "border-destructive" : ""}
                  />
                  {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("addEmployee.fields.lastName")}</Label>
                  <Input
                    id="lastName"
                    {...register("lastName")}
                    placeholder={t("addEmployee.fields.lastName")}
                    className={errors.lastName ? "border-destructive" : ""}
                  />
                  {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
                </div>
              </div>

              <MoreDetailsSection contentClassName="space-y-6">
              {/* Date of Birth + Address Row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">{t("addEmployee.fields.dateOfBirth")}</Label>
                  <Controller
                    name="dateOfBirth"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="dateOfBirth"
                        value={field.value || ""}
                        onChange={field.onChange}
                        clearable
                        aria-invalid={!!errors.dateOfBirth}
                      />
                    )}
                  />
                  {errors.dateOfBirth && (
                    <p className="text-sm text-destructive">{errors.dateOfBirth.message}</p>
                  )}
                  {!errors.dateOfBirth && isLightWorkMinor && (
                    <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      {t("addEmployee.fields.minorLightWorkNote") ||
                        `Aged 15-16 at hire: light work only — max ${LIGHT_WORK_MAX_HOURS_PER_DAY}h/day, ${LIGHT_WORK_MAX_HOURS_PER_WEEK}h/week, no night or overtime work (Labour Law Art. 69).`}
                    </p>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">{t("addEmployee.fields.address")}</Label>
                  <Input
                    id="address"
                    {...register("address")}
                    placeholder={t("addEmployee.fields.address")}
                    
                  />
                </div>
              </div>

              {/* Contact Row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    {t("addEmployee.fields.email")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email")}
                    placeholder="employee@company.com"
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-green-600" />
                    {t("addEmployee.fields.phone")}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    {...register("phone")}
                    placeholder="+670 123 4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneApp" className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-purple-600" />
                    {t("addEmployee.fields.appPhone")}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{t("addEmployee.fields.appPhoneTooltip")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="phoneApp"
                    type="tel"
                    {...register("phoneApp")}
                    placeholder="+670 987 6543"
                  />
                  <Controller
                    name="appEligible"
                    control={control}
                    render={({ field }) => (
                      <div className="mt-1 flex min-h-11 items-center gap-3 rounded-md px-1">
                        <Checkbox
                          id="appEligible"
                          checked={Boolean(field.value)}
                          onCheckedChange={field.onChange}
                        />
                        <Label htmlFor="appEligible" className="cursor-pointer text-sm text-muted-foreground">
                          {t("addEmployee.fields.appEligible")}
                        </Label>
                      </div>
                    )}
                  />
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="p-4 border rounded-lg bg-muted/30">
                <h3 className="font-medium mb-3">
                  {t("addEmployee.fields.emergencyTitle")}
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactName">{t("addEmployee.fields.emergencyName")}</Label>
                    <Input
                      id="emergencyContactName"
                      {...register("emergencyContactName")}
                      placeholder={t("addEmployee.fields.emergencyName")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactPhone">{t("addEmployee.fields.emergencyPhone")}</Label>
                    <Input
                      id="emergencyContactPhone"
                      type="tel"
                      {...register("emergencyContactPhone")}
                      placeholder={t("addEmployee.fields.emergencyPhone")}
                    />
                  </div>
                </div>
              </div>
              </MoreDetailsSection>
            </div>
          </>

          {/* What they do and what you get paid to get right. */}
          <>
            <div className="space-y-6">
              <h2 className="text-base font-semibold">
                {t("addEmployee.section.job") || "What they do and what you pay them"}
              </h2>
              {/* Department & Title */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {departments.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="department">{t("addEmployee.fields.department")}</Label>
                    <Controller
                      name="department"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className={errors.department ? "border-destructive" : ""}>
                            <SelectValue placeholder={t("addEmployee.fields.departmentPlaceholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map(d => (
                              <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.department && <p className="text-sm text-destructive">{errors.department.message}</p>}
                  </div>
                )}
                <div className={`space-y-2 ${departments.length === 0 ? "sm:col-span-2" : ""}`}>
                  <Label htmlFor="jobTitle">{t("addEmployee.fields.jobTitle")}</Label>
                  <Input
                    id="jobTitle"
                    {...register("jobTitle")}
                    placeholder={t("addEmployee.fields.jobTitlePlaceholder")}
                    className={errors.jobTitle ? "border-destructive" : ""}
                  />
                  {errors.jobTitle && <p className="text-sm text-destructive">{errors.jobTitle.message}</p>}
                </div>
              </div>

              {/* Manager, Date, Type */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="manager">{t("addEmployee.fields.manager")}</Label>
                  <Controller
                    name="manager"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("addEmployee.fields.managerPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {managers.map(m => (
                            <SelectItem key={m.id} value={`${m.personalInfo.firstName} ${m.personalInfo.lastName}`}>
                              {m.personalInfo.firstName} {m.personalInfo.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">{t("addEmployee.fields.startDate")}</Label>
                  <Controller
                    name="startDate"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="startDate"
                        value={field.value || ""}
                        onChange={field.onChange}
                        aria-invalid={!!errors.startDate}
                      />
                    )}
                  />
                  {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employmentType">{t("addEmployee.fields.employmentType")}</Label>
                  <Controller
                    name="employmentType"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full-time">{t("addEmployee.fields.employmentTypes.fullTime")}</SelectItem>
                          <SelectItem value="Part-time">{t("addEmployee.fields.employmentTypes.partTime")}</SelectItem>
                          <SelectItem value="Contractor">{t("addEmployee.fields.employmentTypes.contractor")}</SelectItem>
                          {field.value === "Shareholder" && (
                            <SelectItem value="Shareholder">
                              {t("addEmployee.fields.employmentTypes.shareholder")}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              {formValues.employmentType === "Part-time" && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="space-y-4">
                    <p>{t("addEmployee.fields.partTimeWageHelp")}</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="contractedWeeklyHours">
                          {t("addEmployee.fields.contractedWeeklyHours")}
                        </Label>
                        <Input
                          id="contractedWeeklyHours"
                          type="number"
                          min="1"
                          max="44"
                          step="0.5"
                          {...register("contractedWeeklyHours")}
                        />
                        {errors.contractedWeeklyHours && (
                          <p className="text-sm text-destructive">
                            {errors.contractedWeeklyHours.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="minimumWageTreatment">
                          {t("addEmployee.fields.minimumWageTreatment")}
                        </Label>
                        <Controller
                          name="minimumWageTreatment"
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                              <SelectTrigger id="minimumWageTreatment">
                                <SelectValue placeholder={t("addEmployee.fields.minimumWageTreatmentPlaceholder")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pro_rata">
                                  {t("addEmployee.fields.minimumWageTreatments.proRata")}
                                </SelectItem>
                                <SelectItem value="full_floor">
                                  {t("addEmployee.fields.minimumWageTreatments.fullFloor")}
                                </SelectItem>
                                <SelectItem value="reviewed_exception">
                                  {t("addEmployee.fields.minimumWageTreatments.reviewedException")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.minimumWageTreatment && (
                          <p className="text-sm text-destructive">
                            {errors.minimumWageTreatment.message}
                          </p>
                        )}
                      </div>
                    </div>
                    {formValues.minimumWageTreatment === "reviewed_exception" && (
                      <div className="space-y-2">
                        <Label htmlFor="minimumWageReviewNote">
                          {t("addEmployee.fields.minimumWageReviewNote")}
                        </Label>
                        <Input
                          id="minimumWageReviewNote"
                          {...register("minimumWageReviewNote")}
                          placeholder={t("addEmployee.fields.minimumWageReviewNotePlaceholder")}
                        />
                        {errors.minimumWageReviewNote && (
                          <p className="text-sm text-destructive">
                            {errors.minimumWageReviewNote.message}
                          </p>
                        )}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Contract dates & fixed-term motive (Lei 4/2012 Arts. 12-14) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="contractEndDate">
                    {t("addEmployee.fields.contractEndDate") || "Contract end date"}
                  </Label>
                  <Controller
                    name="contractEndDate"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="contractEndDate"
                        value={field.value || ""}
                        onChange={field.onChange}
                        clearable
                      />
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("addEmployee.fields.contractEndDateHelp") || "Fixed-term contracts only — leave empty for permanent."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="probationEndDate">
                    {t("addEmployee.fields.probationEndDate") || "Probation ends"}
                  </Label>
                  <Controller
                    name="probationEndDate"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="probationEndDate"
                        value={field.value || ""}
                        onChange={field.onChange}
                        clearable
                      />
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("addEmployee.fields.probationEndDateHelp") || "Art. 14: 8/15 days for fixed-term, 30-90 days for permanent contracts."}
                  </p>
                </div>
                {looksFixedTerm && (
                  <div className="space-y-2">
                    <Label htmlFor="fixedTermMotive">
                      {t("addEmployee.fields.fixedTermMotive") || "Fixed-term motive"}
                    </Label>
                    <Controller
                      name="fixedTermMotive"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger id="fixedTermMotive">
                            <SelectValue placeholder={t("addEmployee.fields.fixedTermMotivePlaceholder") || "Select the statutory motive"} />
                          </SelectTrigger>
                          <SelectContent>
                            {FIXED_TERM_MOTIVES.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {t(`addEmployee.fields.fixedTermMotives.${m.value}`) || `${m.label} (${m.article})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {!formValues.fixedTermMotive && (
                      <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {t("addEmployee.fields.fixedTermMotiveWarning") ||
                          "Art. 12(2): a fixed-term contract without a stated motive is deemed permanent."}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <MoreDetailsSection
                title={t("addEmployee.fields.allocationTitle")}
                defaultOpen={Boolean(
                  editingEmployee?.jobDetails.projectCode ||
                    editingEmployee?.jobDetails.fundingSource,
                )}
              >
                <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                  <p className="mb-4 text-sm text-muted-foreground">
                    {t("addEmployee.fields.allocationHelp")}
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="projectCode">
                        {t("addEmployee.fields.projectCode")}
                      </Label>
                      <Input
                        id="projectCode"
                        {...register("projectCode")}
                        placeholder={t(
                          "addEmployee.fields.projectCodePlaceholder",
                        )}
                      />
                      {errors.projectCode && (
                        <p className="text-sm text-destructive">
                          {errors.projectCode.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fundingSource">
                        {t("addEmployee.fields.fundingSource")}
                      </Label>
                      <Input
                        id="fundingSource"
                        {...register("fundingSource")}
                        placeholder={t(
                          "addEmployee.fields.fundingSourcePlaceholder",
                        )}
                      />
                      {errors.fundingSource && (
                        <p className="text-sm text-destructive">
                          {errors.fundingSource.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </MoreDetailsSection>

              {/* Work Contract Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="workContract">{t("addEmployee.fields.workContract")}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowContractGenerator(true)}
                  >
                    <Sparkles className="h-4 w-4 mr-2 text-purple-600" />
                    {t("addEmployee.contractGen.openButton")}
                  </Button>
                </div>
                <Input
                  id="workContract"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={e => handleAdditionalInfoChange("workContract", e.target.files?.[0] || null)}
                />
                {additionalInfo.workContract ? (
                  <p className="text-xs text-primary flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {t("addEmployee.contractGen.attachedFile", { name: additionalInfo.workContract.name })}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("addEmployee.fields.workContractHelp")}</p>
                )}
              </div>
            </div>
          </>

          {/* Step 3: Compensation */}
          <>
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="salary">{t("addEmployee.compensation.salaryLabel")}</Label>
                  <Input
                    id="salary"
                    type="number"
                    {...register("salary")}
                    placeholder={t("addEmployee.compensation.salaryPlaceholder")}
                    className={errors.salary ? "border-destructive" : ""}
                  />
                  <p className="text-xs text-muted-foreground">{t("addEmployee.compensation.minWageHint")}</p>
                </div>
                {/* Only asked when an existing salary is actually being changed.
                    A raise agreed this month but effective last month is the
                    normal case here, and the effective date is what turns it
                    into arrears on the next run instead of being lost. */}
                {salaryIsChanging && (
                  <div className="space-y-2">
                    <Label htmlFor="salaryEffectiveFrom">
                      {t("addEmployee.compensation.salaryEffectiveFrom")}
                    </Label>
                    <Controller
                      name="salaryEffectiveFrom"
                      control={control}
                      render={({ field }) => (
                        <DatePicker
                          value={field.value || ""}
                          onChange={field.onChange}
                          id="salaryEffectiveFrom"
                        />
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("addEmployee.compensation.salaryEffectiveFromHint")}
                    </p>
                  </div>
                )}
                {salaryIsChanging && (
                  <div className="space-y-2">
                    <Label htmlFor="salaryChangeReason">
                      {t("addEmployee.compensation.salaryChangeReason")}
                    </Label>
                    <Input
                      id="salaryChangeReason"
                      {...register("salaryChangeReason")}
                      placeholder={t("addEmployee.compensation.salaryChangeReasonPlaceholder")}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="leaveDays">{t("addEmployee.compensation.leaveDays")}</Label>
                  <Input
                    id="leaveDays"
                    type="number"
                    {...register("leaveDays")}
                    placeholder={t("addEmployee.compensation.leaveDaysPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="benefits">{t("addEmployee.compensation.benefits")}</Label>
                  <Controller
                    name="benefits"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">{t("addEmployee.compensation.benefitsOptions.basic")}</SelectItem>
                          <SelectItem value="standard">{t("addEmployee.compensation.benefitsOptions.standard")}</SelectItem>
                          <SelectItem value="premium">{t("addEmployee.compensation.benefitsOptions.premium")}</SelectItem>
                          <SelectItem value="executive">{t("addEmployee.compensation.benefitsOptions.executive")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payFrequency">Pay Frequency</Label>
                  <Controller
                    name="payFrequency"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly (Mensal)</SelectItem>
                          <SelectItem value="weekly">Weekly (Semanal)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              {/* Attendance premium — an employer-set monthly amount that a
                  period with unjustified absence forfeits or reduces. Kept out of
                  the main grid because most employees have none; a blank amount
                  means exactly that. */}
              <MoreDetailsSection title={t("addEmployee.compensation.attendancePremiumSection")}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="attendancePremiumAmount">
                      {t("addEmployee.compensation.attendancePremiumAmount")}
                    </Label>
                    <Input
                      id="attendancePremiumAmount"
                      type="number"
                      min={0}
                      step="any"
                      {...register("attendancePremiumAmount")}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("addEmployee.compensation.attendancePremiumHint")}
                    </p>
                  </div>
                  {Number(formValues.attendancePremiumAmount || "0") > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="attendancePremiumMode">
                        {t("addEmployee.compensation.attendancePremiumMode")}
                      </Label>
                      <Controller
                        name="attendancePremiumMode"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="attendancePremiumMode">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all_or_nothing">
                                {t("addEmployee.compensation.attendancePremiumAllOrNothing")}
                              </SelectItem>
                              <SelectItem value="pro_rata">
                                {t("addEmployee.compensation.attendancePremiumProRata")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  )}
                </div>
              </MoreDetailsSection>

              {/* Recorded pay changes. Read-only: history is written by saving a
                  new salary with an effective date, never edited after the fact,
                  because a settled retroactive payment was calculated from it. */}
              {salaryChanges.length > 0 && (
                <MoreDetailsSection
                  title={t("addEmployee.compensation.salaryHistorySection", {
                    count: salaryChanges.length,
                  })}
                >
                  <div className="border rounded-lg divide-y">
                    {salaryChanges.map((row) => (
                      <div
                        key={`${row.effectiveFrom}-${row.recordedAt}`}
                        className="p-3 flex flex-wrap items-baseline justify-between gap-2"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {row.from === null
                              ? formatSalaryAmount(row.to)
                              : `${formatSalaryAmount(row.from)} → ${formatSalaryAmount(row.to)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("addEmployee.compensation.salaryHistoryEffective", {
                              month: row.month,
                            })}
                            {row.reason ? ` · ${row.reason}` : ""}
                          </p>
                        </div>
                        {row.backdated && (
                          <Badge variant="outline" className="text-xs">
                            {t("addEmployee.compensation.salaryHistoryBackdated")}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </MoreDetailsSection>
              )}

              {/* Payment Method & Bank Details */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t("addEmployee.compensation.paymentMethod")}</Label>
                  <Select
                    value={additionalInfo.paymentMethod}
                    onValueChange={v => handleAdditionalInfoChange("paymentMethod", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">{t("addEmployee.compensation.bankTransfer")}</SelectItem>
                      <SelectItem value="cash">{t("addEmployee.compensation.cash")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {additionalInfo.paymentMethod === "bank_transfer" && (
                  <>
                    <div className="space-y-2">
                      <Label>{t("addEmployee.compensation.bankName")}</Label>
                      <Select
                        value={additionalInfo.bankName}
                        onValueChange={v => handleAdditionalInfoChange("bankName", v)}
                      >
                        <SelectTrigger >
                          <SelectValue placeholder={t("addEmployee.compensation.bankNamePlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BNCTL">BNCTL</SelectItem>
                          <SelectItem value="ANZ">ANZ</SelectItem>
                          <SelectItem value="BNU">BNU</SelectItem>
                          <SelectItem value="Mandiri">Mandiri</SelectItem>
                          <SelectItem value="BRI">BRI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("addEmployee.compensation.accountNumber")}</Label>
                      <Input
                        value={additionalInfo.bankAccountNumber}
                        onChange={e => handleAdditionalInfoChange("bankAccountNumber", e.target.value)}
                        placeholder={t("addEmployee.compensation.accountNumberPlaceholder")}
                        
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Tax & Deductions Summary */}
              <div className="flex flex-col items-start gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:gap-4">
                <Controller
                  name="isResident"
                  control={control}
                  render={({ field }) => (
                    <div className="min-w-56 space-y-2">
                      <Label htmlFor="isResident">
                        {t("addEmployee.compensation.taxResidenceLabel")}
                      </Label>
                      <Select
                        value={
                          typeof field.value === "boolean"
                            ? field.value
                              ? "resident"
                              : "non_resident"
                            : undefined
                        }
                        onValueChange={(value) =>
                          field.onChange(value === "resident")
                        }
                      >
                        <SelectTrigger id="isResident" aria-invalid={!!errors.isResident}>
                          <SelectValue
                            placeholder={t("addEmployee.compensation.taxResidencePlaceholder")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="resident">
                            {t("addEmployee.compensation.taxResidentOption")}
                          </SelectItem>
                          <SelectItem value="non_resident">
                            {t("addEmployee.compensation.taxNonResidentOption")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {t("addEmployee.compensation.taxResidenceHelp")}
                      </p>
                      {errors.isResident && (
                        <p className="text-sm text-destructive">
                          {errors.isResident.message}
                        </p>
                      )}
                    </div>
                  )}
                />
                <span className="hidden text-xs text-muted-foreground sm:inline">|</span>
                <span className="text-xs text-muted-foreground">{t("addEmployee.compensation.incomeTaxTitle")}: {t("addEmployee.compensation.incomeTaxDesc")}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">|</span>
                <span className="text-xs text-muted-foreground">{t("addEmployee.compensation.socialSecurityTitle")}: {t("addEmployee.compensation.socialSecurityDesc")}</span>
              </div>
            </div>
          </>

          {/* ID papers and the INSS number. Collected here when the owner has
              them to hand, but never a blocker: the INSS number is chased
              before the first filing, not at hire, and a shop owner adding a
              guard today usually does not have the card in front of them. */}
          <>
            <MoreDetailsSection
              title={t("addEmployee.section.ids") || "ID and INSS number"}
              contentClassName="space-y-6"
            >
              <p className="mb-3 text-xs text-muted-foreground">
                {t("addEmployee.section.idsHelp") ||
                  "Nothing here stops you saving. We will ask again when you need it."}
              </p>
              {/* Nationality — drives document requirements */}
              <div className="space-y-2">
                <Label htmlFor="nationality">{t("addEmployee.documents.nationality")}</Label>
                <Select value={additionalInfo.nationality} onValueChange={v => handleAdditionalInfoChange("nationality", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NATIONALITY_OPTIONS.map(nat => (
                      <SelectItem key={nat} value={nat}>
                        {NATIONALITY_FLAGS[nat] ? `${NATIONALITY_FLAGS[nat]} ` : ""}{nat === "Other" ? t("addEmployee.documents.nationalityOther") : nat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Documents Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("addEmployee.documents.table.document")}</TableHead>
                    <TableHead>{t("addEmployee.documents.table.number")}</TableHead>
                    <TableHead>{t("addEmployee.documents.table.expiry")}</TableHead>
                    <TableHead>{t("addEmployee.documents.table.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map(doc => {
                    const vals = docValues[doc.fieldKey] || { number: "", expiryDate: "" };
                    const status = doc.hasExpiry ? getExpiryStatus(vals.expiryDate) : null;
                    const labelKey = documentLabelMap[doc.fieldKey]?.labelKey;
                    const descriptionKey = documentLabelMap[doc.fieldKey]?.descriptionKey;
                    const label = labelKey ? t(labelKey) : doc.fieldKey;
                    const description = descriptionKey ? t(descriptionKey) : "";
                    const isINSS = doc.fieldKey === "socialSecurityNumber";
                    const isTIN = doc.fieldKey === "taxIdentificationNumber";
                    return (
                      <TableRow key={doc.fieldKey}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{label}</span>
                            {doc.required && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {t("addEmployee.documents.required")}
                              </Badge>
                            )}
                            <p className="text-xs text-muted-foreground">{description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={vals.number}
                            onChange={e => handleDocumentChange(doc.fieldKey, "number", e.target.value)}
                            placeholder={isINSS
                              ? (t("addEmployee.documents.inssPlaceholder") || "100XXXXXX")
                              : isTIN
                                ? t("addEmployee.documents.tinPlaceholder")
                                : t("addEmployee.documents.numberPlaceholder")}
                            className="max-w-[180px]"
                          />
                        </TableCell>
                        <TableCell>
                          {doc.hasExpiry ? (
                            <DatePicker
                              value={vals.expiryDate}
                              onChange={v => handleDocumentChange(doc.fieldKey, "expiryDate", v)}
                              className="max-w-[190px]"
                              clearable
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {status && (
                            <Badge variant={status.variant}>
                              {status.status === "expiring" && <AlertTriangle className="h-3 w-3 mr-1" />}
                              {status.message}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Foreign Worker Documents (for non-TL nationals) */}
              {!isTimorese && (
                <div className="p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/20 space-y-4">
                  <div>
                    <h3 className="font-medium flex items-center gap-2 text-orange-800 dark:text-orange-200">
                      <FileText className="h-4 w-4" />
                      {t("addEmployee.documents.foreignWorkerTitle")}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("addEmployee.documents.foreignWorkerDesc")}
                    </p>
                  </div>

                  {/* Working Visa */}
                  <div>
                    <Label className="text-sm font-medium">{t("addEmployee.documents.visaTitle")}</Label>
                    <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor="workingVisaNumber" className="text-xs text-muted-foreground">{t("addEmployee.documents.visaNumber")}</Label>
                        <Input
                          id="workingVisaNumber"
                          value={additionalInfo.workingVisaNumber}
                          onChange={e => handleAdditionalInfoChange("workingVisaNumber", e.target.value)}
                          placeholder={t("addEmployee.documents.visaNumberPlaceholder")}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="workingVisaExpiry" className="text-xs text-muted-foreground">{t("addEmployee.documents.visaExpiry")}</Label>
                        <DatePicker
                          id="workingVisaExpiry"
                          value={additionalInfo.workingVisaExpiry}
                          onChange={v => handleAdditionalInfoChange("workingVisaExpiry", v)}
                          clearable
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="workingVisaFile" className="text-xs text-muted-foreground">{t("addEmployee.documents.visaUpload")}</Label>
                        <Input
                          id="workingVisaFile"
                          type="file"
                          accept=".pdf,.jpg,.png"
                          onChange={e => handleAdditionalInfoChange("workingVisaFile", e.target.files?.[0] || null)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SEFOPE Work Permit */}
                  <div>
                    <Label className="text-sm font-medium">{t("addEmployee.documents.sefopePermitTitle")}</Label>
                    <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor="sefopePermitNumber" className="text-xs text-muted-foreground">{t("addEmployee.documents.sefopePermitNumber")}</Label>
                        <Input
                          id="sefopePermitNumber"
                          value={additionalInfo.sefopePermitNumber}
                          onChange={e => handleAdditionalInfoChange("sefopePermitNumber", e.target.value)}
                          placeholder={t("addEmployee.documents.sefopePermitNumberPlaceholder")}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="sefopePermitExpiry" className="text-xs text-muted-foreground">{t("addEmployee.documents.sefopePermitExpiry")}</Label>
                        <DatePicker
                          id="sefopePermitExpiry"
                          value={additionalInfo.sefopePermitExpiry}
                          onChange={v => handleAdditionalInfoChange("sefopePermitExpiry", v)}
                          clearable
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="sefopePermitFile" className="text-xs text-muted-foreground">{t("addEmployee.documents.sefopePermitUpload")}</Label>
                        <Input
                          id="sefopePermitFile"
                          type="file"
                          accept=".pdf,.jpg,.png"
                          onChange={e => handleAdditionalInfoChange("sefopePermitFile", e.target.files?.[0] || null)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Expiry Warnings */}
              {documents.some(d => {
                if (!d.hasExpiry) return false;
                const vals = docValues[d.fieldKey];
                const s = vals ? getExpiryStatus(vals.expiryDate) : null;
                return s && (s.status === "expired" || s.status === "expiring");
              }) && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {t("addEmployee.documents.expiryWarning")}
                  </AlertDescription>
                </Alert>
              )}
            </MoreDetailsSection>
          </>

          {/* Sticky save bar: on a phone this sits where the thumb already
              is, and never scrolls away mid-form. */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
            <div className="mx-auto flex max-w-screen-2xl flex-wrap gap-2 sm:justify-end sm:px-0">
              {savingSlowly && (
                <p className="w-full text-center text-xs text-muted-foreground sm:text-right" role="status">
                  {t("common.stillSaving")}
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (confirmLeave()) navigate("/people/employees");
                }}
                disabled={isSubmitting}
                className="min-h-11 flex-1 sm:flex-none"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-h-11 flex-1 sm:flex-none"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting
                  ? t("common.saving")
                  : isEditMode
                    ? t("addEmployee.buttons.updateEmployee")
                    : t("addEmployee.buttons.addEmployee")}
              </Button>
            </div>
          </div>
        </form>
        </div>
    </div>
  );
}
