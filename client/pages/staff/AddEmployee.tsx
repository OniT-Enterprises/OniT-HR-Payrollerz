/**
 * AddEmployee - Step-by-step employee onboarding wizard
 * Reduces cognitive load by breaking the form into 4 digestible steps
 */

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/layout/PageHeader";
import { StepWizard, StepContent, type WizardStep } from "@/components/ui/StepWizard";
import { collection, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { paths } from "@/lib/paths";
import { employeeService, type Employee, type ResidencyStatus } from "@/services/employeeService";
import { candidateService } from "@/services/candidateService";
import { fileUploadService } from "@/services/fileUploadService";
import { departmentService, type Department } from "@/services/departmentService";
import { NATIONALITY_FLAGS, NATIONALITY_OPTIONS } from "@/lib/constants";
import CSVColumnMapper, { type ColumnMapping } from "@/components/CSVColumnMapper";
import ContractGeneratorDialog from "@/components/staff/ContractGeneratorDialog";
import MoreDetailsSection from "@/components/MoreDetailsSection";
import { useI18n } from "@/i18n/I18nProvider";
import { useTenantId } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { SEO, seoConfig } from "@/components/SEO";
import { addEmployeeFormSchema, type AddEmployeeFormData } from "@/lib/validations";
import { toDateStringTL } from "@/lib/dateUtils";
import { buildCSV } from "@/lib/csvExport";
import { buildEmployeesFromCSV } from "@/lib/employees/import";
import { divideMoney, roundMoney } from "@/lib/currency";
import {
  ageAt,
  isLightWorkOnlyAge,
  LIGHT_WORK_MAX_HOURS_PER_DAY,
  LIGHT_WORK_MAX_HOURS_PER_WEEK,
} from "@/lib/payroll/minors";
import { FIXED_TERM_MOTIVES, appendContractRenewal } from "@/lib/probation";
import {
  UserPlus,
  User,
  Briefcase,
  DollarSign,
  FileText,
  FileDown,
  FileUp,
  Info,
  Mail,
  Phone,
  Smartphone,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

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

export default function AddEmployee() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const editEmployeeId = searchParams.get("edit");
  const hiringCandidateId = searchParams.get("candidateId") || "";
  const hiringApplicationId = searchParams.get("applicationId") || "";
  const hiringJobId = searchParams.get("jobId") || "";
  const isHiringHandoff = !editEmployeeId && !!(hiringCandidateId || hiringApplicationId);
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { user } = useAuth();

  const WIZARD_STEPS: WizardStep[] = useMemo(
    () => [
      {
        id: "basic",
        title: t("addEmployee.wizard.basicTitle"),
        description: t("addEmployee.wizard.basicDesc"),
        icon: User,
      },
      {
        id: "job",
        title: t("addEmployee.wizard.jobTitle"),
        description: t("addEmployee.wizard.jobDesc"),
        icon: Briefcase,
      },
      {
        id: "compensation",
        title: t("addEmployee.wizard.compensationTitle"),
        description: t("addEmployee.wizard.compensationDesc"),
        icon: DollarSign,
      },
      {
        id: "documents",
        title: t("addEmployee.wizard.documentsTitle"),
        description: t("addEmployee.wizard.documentsDesc"),
        icon: FileText,
      },
    ],
    [t],
  );

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);

  // Form with react-hook-form + zod validation
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    trigger,
    formState: { errors },
  } = useForm<AddEmployeeFormData>({
    resolver: zodResolver(addEmployeeFormSchema),
    defaultValues: {
      firstName: searchParams.get("firstName") || "",
      lastName: searchParams.get("lastName") || "",
      email: searchParams.get("email") || "",
      phone: searchParams.get("phone") || "",
      phoneApp: "",
      appEligible: false,
      emergencyContactName: "",
      emergencyContactPhone: "",
      department: "",
      jobTitle: searchParams.get("jobTitle") || "",
      manager: "",
      projectCode: "",
      fundingSource: "",
      startDate: "",
      employmentType: "Full-time",
      contractedWeeklyHours: "",
      minimumWageTreatment: undefined,
      minimumWageReviewNote: "",
      contractEndDate: "",
      probationEndDate: "",
      fixedTermMotive: "",
      salary: "",
      leaveDays: "12",
      benefits: "standard",
      payFrequency: "monthly",
      isResident: true,
    },
    mode: "onChange", // Validate on change for better UX
  });

  // Watch form values for canProceed logic
  const formValues = watch();

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
    paymentMethod: "bank_transfer" as "bank_transfer" | "cash",
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
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showContractGenerator, setShowContractGenerator] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [showBulkTools, setShowBulkTools] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // In edit mode, show green border for filled fields and red for empty ones
  const fieldBorder = (value: unknown): string => {
    if (!isEditMode) return "";
    if (value === undefined || value === null || value === "") return "border-red-500";
    return "border-green-500";
  };

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
          leaveDays: employee.compensation.annualLeaveDays?.toString() || "12",
          benefits: ((employee.compensation.benefitsPackage || "standard").toLowerCase()) as "basic" | "standard" | "premium" | "executive",
          payFrequency: employee.compensation.payFrequency || "monthly",
          isResident: employee.compensation.isResident ?? true,
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
    setDocValues(prev => ({ ...prev, [fieldKey]: { ...prev[fieldKey], [field]: value } }));
  };

  const handleAdditionalInfoChange = (field: string, value: string | File | null) => {
    setAdditionalInfo(prev => {
      const next = { ...prev, [field]: value };
      // Auto-set residency status when nationality changes
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

  // Fields to validate per step
  const stepFields: Record<string, (keyof AddEmployeeFormData)[]> = {
    basic: ["firstName", "lastName", "email", "dateOfBirth"],
    job: ["department", "jobTitle", "startDate", "employmentType"],
    compensation: [],
    documents: [],
  };

  // Quick check for enabling/disabling Next button
  const canProceed = () => {
    const step = WIZARD_STEPS[currentStep].id;
    switch (step) {
      case "basic":
        return !!(formValues.firstName && formValues.lastName && formValues.email && !errors.email);
      case "job":
        return !!(formValues.department && formValues.jobTitle && formValues.startDate);
      case "compensation":
        return true;
      case "documents":
        return true;
      default:
        return true;
    }
  };

  // Validate current step fields with Zod via react-hook-form before advancing
  const validateStep = async (): Promise<boolean> => {
    const step = WIZARD_STEPS[currentStep].id;
    const fields = stepFields[step];
    if (!fields || fields.length === 0) return true;
    const valid = await trigger(fields);
    if (!valid) {
      const stepErrors = fields
        .map(f => errors[f]?.message)
        .filter(Boolean);
      toast({
        title: t("addEmployee.toast.requiredFieldsTitle"),
        description: stepErrors[0] || t("addEmployee.toast.requiredFieldsDesc"),
        variant: "destructive",
      });
    }
    return valid;
  };

  const renderBulkTools = () => (
    <>
      <Button variant="outline" onClick={downloadTemplate}>
        <FileDown className="h-4 w-4 mr-2" />
        {t("addEmployee.buttons.template")}
      </Button>
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogTrigger asChild>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <FileUp className="h-4 w-4 mr-2" />
            {t("addEmployee.buttons.import")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addEmployee.import.title")}</DialogTitle>
            <DialogDescription>{t("addEmployee.import.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input type="file" accept=".csv" onChange={handleFileImport} />
            <Button variant="outline" onClick={downloadTemplate} className="w-full">
              <FileDown className="h-4 w-4 mr-2" />
              {t("addEmployee.buttons.downloadTemplateFirst")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  // Form submission handler - called by react-hook-form's handleSubmit
  const onFormSubmit = async (data: AddEmployeeFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      let savedEmployeeId = editingEmployee?.id || "";
      // Use BI number for Timorese, passport for foreigners as employeeId
      const primaryDocNumber = isTimorese
        ? docValues.bilheteIdentidade?.number
        : docValues.passport?.number;
      const employeeId = primaryDocNumber || `TEMP${Date.now()}`;
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

      const newEmployee: Omit<Employee, "id"> = {
        personalInfo: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
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
          department: data.department,
          position: data.jobTitle,
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
          monthlySalary: roundMoney(Number(data.salary || "0") || 0),
          annualLeaveDays: parseInt(data.leaveDays, 10) || 12,
          benefitsPackage: data.benefits || "standard",
          payFrequency: data.payFrequency,
          isResident: data.isResident,
        },
        documents: {
          bilheteIdentidade: { number: docValues.bilheteIdentidade?.number || "", expiryDate: docValues.bilheteIdentidade?.expiryDate || "", required: isTimorese },
          employeeIdCard: { number: docValues.bilheteIdentidade?.number || "", expiryDate: docValues.bilheteIdentidade?.expiryDate || "", required: isTimorese },
          socialSecurityNumber: { number: docValues.socialSecurityNumber?.number || "", expiryDate: docValues.socialSecurityNumber?.expiryDate || "", required: true },
          taxIdentificationNumber: { number: docValues.taxIdentificationNumber?.number || "", expiryDate: "", required: false },
          electoralCard: { number: docValues.electoralCard?.number || "", expiryDate: docValues.electoralCard?.expiryDate || "", required: false },
          idCard: { number: "", expiryDate: "", required: false },
          passport: { number: docValues.passport?.number || "", expiryDate: docValues.passport?.expiryDate || "", required: !isTimorese },
          workContract: { fileUrl: "", uploadDate: new Date().toISOString() },
          nationality: additionalInfo.nationality,
          residencyStatus: additionalInfo.residencyStatus,
          workingVisaResidency: {
            number: additionalInfo.workingVisaNumber,
            expiryDate: additionalInfo.workingVisaExpiry,
            fileUrl: "",
          },
          sefopeWorkPermit: !isTimorese ? {
            number: additionalInfo.sefopePermitNumber,
            expiryDate: additionalInfo.sefopePermitExpiry,
            fileUrl: "",
          } : undefined,
        },
        isForeignWorker: !isTimorese,
        bankName: additionalInfo.paymentMethod === "bank_transfer" ? additionalInfo.bankName : "",
        bankAccountNumber: additionalInfo.paymentMethod === "bank_transfer" ? additionalInfo.bankAccountNumber : "",
        status: "active",
      };

      // Upload files if they exist
      const employeeIdForUpload = isEditMode && editingEmployee ? editingEmployee.id! : doc(collection(db, paths.employees(tenantId))).id;
      const failedUploads: string[] = [];

      if (additionalInfo.workContract) {
        try {
          const url = await fileUploadService.uploadEmployeeDocument(additionalInfo.workContract, tenantId, employeeIdForUpload, "workContract");
          newEmployee.documents.workContract.fileUrl = url;
        } catch (e) {
          console.error("Work contract upload failed:", e);
          failedUploads.push(t("addEmployee.documents.workContract") || "work contract");
        }
      }

      if (additionalInfo.workingVisaFile) {
        try {
          const url = await fileUploadService.uploadEmployeeDocument(additionalInfo.workingVisaFile, tenantId, employeeIdForUpload, "workingVisa");
          newEmployee.documents.workingVisaResidency.fileUrl = url;
        } catch (e) {
          console.error("Visa upload failed:", e);
          failedUploads.push(t("addEmployee.documents.workingVisa") || "working visa");
        }
      }

      if (additionalInfo.sefopePermitFile && newEmployee.documents.sefopeWorkPermit) {
        try {
          const url = await fileUploadService.uploadEmployeeDocument(additionalInfo.sefopePermitFile, tenantId, employeeIdForUpload, "sefopePermit");
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
        );
        if (!id) throw new Error("Failed to save");
        savedEmployeeId = id;
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
              title: "App invite sent",
              description: `${inviteEmail} will receive an email to set their password and sign in.`,
            });
          } catch (inviteError) {
            const code = (inviteError as { code?: string }).code;
            if (code !== "functions/already-exists") {
              console.error("App invite failed:", inviteError);
              toast({
                title: "Employee saved, but the app invite failed",
                description: "You can re-send it from their profile (Send app invite).",
                variant: "destructive",
              });
            }
          }
        }
      }

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

      if (isHiringHandoff && savedEmployeeId) {
        if (hiringCandidateId) {
          try {
            await candidateService.updateCandidate(tenantId, hiringCandidateId, { status: "Hired" });
          } catch (candidateError) {
            console.error("Candidate status update failed:", candidateError);
          }
        }
        const params = new URLSearchParams({ employeeId: savedEmployeeId });
        if (hiringCandidateId) params.set("candidateId", hiringCandidateId);
        if (hiringJobId) params.set("jobId", hiringJobId);
        navigate(`/people/onboarding?${params.toString()}`);
      } else {
        navigate("/people/employees");
      }
    } catch (error) {
      console.error("Error saving employee:", error);
      toast({
        title: t("addEmployee.toast.errorTitle"),
        description: t("addEmployee.toast.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // CSV Import handlers
  const downloadTemplate = () => {
    const headers = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "department",
      "position",
      "hireDate",
      "employmentType",
      "monthlySalary",
      "annualLeaveDays",
      "projectCode",
      "fundingSource",
    ];
    const sample = [
      "John",
      "Doe",
      "john@company.com",
      "+670123456",
      "Operations",
      "Project Officer",
      "2026-02-01",
      "Full-time",
      "1500.00",
      "12",
      "HEALTH-2026",
      "Example Donor",
    ];
    const csv = buildCSV(headers, [sample]);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employee_import_template.csv";
    link.click();
    window.URL.revokeObjectURL(url);
    toast({
      title: t("addEmployee.import.downloadedTitle"),
      description: t("addEmployee.import.downloadedDesc"),
    });
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setShowImportDialog(false);
      setShowColumnMapper(true);
    }
  };

  const handleMappingComplete = async (mappings: ColumnMapping[], csvData: Record<string, string>[]) => {
    if (isSubmitting) return;
    const importResult = buildEmployeesFromCSV(csvData, mappings, {
      today: toDateStringTL(new Date()),
      batchId: Date.now().toString(),
    });

    if (importResult.errors.length) {
      const firstError = importResult.errors[0];
      toast({
        title: t("addEmployee.import.validationFailedTitle"),
        description: t("addEmployee.import.validationFailedDesc", {
          count: importResult.errors.length,
          row: firstError.rowNumber,
          error: firstError.messages.join("; "),
        }),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setShowColumnMapper(false);
    setImportFile(null);
    toast({
      title: t("addEmployee.import.importStartedTitle"),
      description: t("addEmployee.import.importStartedDesc", {
        count: csvData.length,
      }),
    });

    let importedCount = 0;
    const failures: Array<{ rowNumber: number; message: string }> = [];
    for (const item of importResult.employees) {
      try {
        await employeeService.addEmployee(
          tenantId,
          item.employee,
          user
            ? {
                tenantId,
                userId: user.uid,
                userEmail: user.email || "",
                userName: user.displayName || undefined,
              }
            : undefined,
        );
        importedCount += 1;
      } catch (error) {
        failures.push({
          rowNumber: item.rowNumber,
          message: error instanceof Error ? error.message : "Import failed",
        });
      }
    }

    setIsSubmitting(false);
    await loadDepartmentsAndManagers();
    if (failures.length) {
      toast({
        title: t("addEmployee.import.completedWithErrorsTitle"),
        description: t("addEmployee.import.completedWithErrorsDesc", {
          imported: importedCount,
          failed: failures.length,
          row: failures[0].rowNumber,
          error: failures[0].message,
        }),
        variant: importedCount === 0 ? "destructive" : "default",
      });
      return;
    }

    toast({
      title: t("addEmployee.import.completedTitle"),
      description: t("addEmployee.import.completedDesc", {
        count: importedCount,
      }),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
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
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5 sm:hidden">
              <div className="min-w-0 space-y-1">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            </div>

            <div className="relative hidden sm:flex justify-between">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>

            <Card>
              <CardHeader className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 w-40" />
                </div>
                <Skeleton className="h-4 w-56 mt-2" />
              </CardHeader>
              <CardContent className="min-h-[420px] space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>

            <div className="flex items-center justify-between border-t pt-4">
              <Skeleton className="h-10 w-20" />
              <div className="flex items-center gap-2 sm:gap-3">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
        actions={
          <Button variant="outline" onClick={() => setShowBulkTools((prev) => !prev)}>
            <FileText className="h-4 w-4 mr-2" />
            {t("common.moreActions")}
          </Button>
        }
        className="mx-auto max-w-screen-2xl px-4 sm:px-6"
      />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6 -mt-6">
        {showBulkTools && (
          <div className="mb-6 rounded-xl border border-border/50 bg-muted/30 p-4">
            <p className="mb-3 text-sm text-muted-foreground">
              {t("addEmployee.import.description")}
            </p>
            <div className="flex flex-wrap gap-2">
              {renderBulkTools()}
            </div>
          </div>
        )}

        {/* Contract Generator Dialog */}
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

        {/* Column Mapper Dialog */}
        <Dialog open={showColumnMapper} onOpenChange={setShowColumnMapper}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>{t("addEmployee.import.mapTitle")}</DialogTitle>
            </DialogHeader>
            <CSVColumnMapper
              csvFile={importFile}
              onMappingComplete={handleMappingComplete}
              onCancel={() => { setShowColumnMapper(false); setImportFile(null); }}
            />
          </DialogContent>
        </Dialog>

        {/* Step Wizard */}
        <StepWizard
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          onComplete={handleSubmit(onFormSubmit, (validationErrors) => {
            // Navigate to the step with the first error and show toast
            const basicFields = ["firstName", "lastName", "email", "phone", "phoneApp", "dateOfBirth"];
            const jobFields = ["department", "jobTitle", "startDate", "employmentType", "manager", "contractEndDate", "probationEndDate", "fixedTermMotive", "contractedWeeklyHours", "minimumWageTreatment", "minimumWageReviewNote"];
            const errorKeys = Object.keys(validationErrors);
            if (errorKeys.some(k => basicFields.includes(k))) {
              setCurrentStep(0);
            } else if (errorKeys.some(k => jobFields.includes(k))) {
              setCurrentStep(1);
            }
            const firstError = Object.values(validationErrors)[0];
            toast({
              title: t("addEmployee.toast.errorTitle") || "Validation Error",
              description: firstError?.message || t("addEmployee.toast.fillRequiredFields"),
              variant: "destructive",
            });
          })}
          onBeforeNext={validateStep}
          onCancel={() => navigate("/people/employees")}
          isSubmitting={isSubmitting}
          submitLabel={isEditMode ? t("addEmployee.buttons.updateEmployee") : t("addEmployee.buttons.addEmployee")}
          canProceed={canProceed()}
          cannotProceedMessage={!canProceed() ? t("addEmployee.toast.fillRequiredFields") : undefined}
        >
          {/* Step 1: Basic Info */}
          <StepContent stepId="basic" currentStepId={WIZARD_STEPS[currentStep].id}>
            <div className="space-y-6">
              {/* Name Row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("addEmployee.fields.firstName")}</Label>
                  <Input
                    id="firstName"
                    {...register("firstName")}
                    placeholder={t("addEmployee.fields.firstName")}
                    autoFocus
                    className={errors.firstName ? "border-red-500" : ""}
                  />
                  {errors.firstName && <p className="text-sm text-red-500">{errors.firstName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("addEmployee.fields.lastName")}</Label>
                  <Input
                    id="lastName"
                    {...register("lastName")}
                    placeholder={t("addEmployee.fields.lastName")}
                    className={errors.lastName ? "border-red-500" : ""}
                  />
                  {errors.lastName && <p className="text-sm text-red-500">{errors.lastName.message}</p>}
                </div>
              </div>

              {/* Date of Birth + Address Row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">{t("addEmployee.fields.dateOfBirth")}</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    {...register("dateOfBirth")}
                    className={errors.dateOfBirth ? "border-red-500" : fieldBorder(watch("dateOfBirth"))}
                  />
                  {errors.dateOfBirth && (
                    <p className="text-sm text-red-500">{errors.dateOfBirth.message}</p>
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
                    className={fieldBorder(watch("address"))}
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
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
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
            </div>
          </StepContent>

          {/* Step 2: Job Details */}
          <StepContent stepId="job" currentStepId={WIZARD_STEPS[currentStep].id}>
            <div className="space-y-6">
              {/* Department & Title */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="department">{t("addEmployee.fields.department")}</Label>
                  <Controller
                    name="department"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className={errors.department ? "border-red-500" : fieldBorder(field.value)}>
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
                  {errors.department && <p className="text-sm text-red-500">{errors.department.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">{t("addEmployee.fields.jobTitle")}</Label>
                  <Input
                    id="jobTitle"
                    {...register("jobTitle")}
                    placeholder={t("addEmployee.fields.jobTitlePlaceholder")}
                    className={errors.jobTitle ? "border-red-500" : fieldBorder(formValues.jobTitle)}
                  />
                  {errors.jobTitle && <p className="text-sm text-red-500">{errors.jobTitle.message}</p>}
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
                  <Input
                    id="startDate"
                    type="date"
                    {...register("startDate")}
                    className={errors.startDate ? "border-red-500" : ""}
                  />
                  {errors.startDate && <p className="text-sm text-red-500">{errors.startDate.message}</p>}
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
                          <SelectItem value="Shareholder">{t("addEmployee.fields.employmentTypes.shareholder")}</SelectItem>
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
                  <Input
                    id="contractEndDate"
                    type="date"
                    {...register("contractEndDate")}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("addEmployee.fields.contractEndDateHelp") || "Fixed-term contracts only — leave empty for permanent."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="probationEndDate">
                    {t("addEmployee.fields.probationEndDate") || "Probation ends"}
                  </Label>
                  <Input
                    id="probationEndDate"
                    type="date"
                    {...register("probationEndDate")}
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
                  className={isEditMode ? (additionalInfo.workContract || editingEmployee?.documents?.workContract?.fileUrl ? "border-green-500" : "border-red-500") : ""}
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
          </StepContent>

          {/* Step 3: Compensation */}
          <StepContent stepId="compensation" currentStepId={WIZARD_STEPS[currentStep].id}>
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="salary">{t("addEmployee.compensation.salaryLabel")}</Label>
                  <Input
                    id="salary"
                    type="number"
                    {...register("salary")}
                    placeholder={t("addEmployee.compensation.salaryPlaceholder")}
                    className={fieldBorder(formValues.salary)}
                  />
                  <p className="text-xs text-muted-foreground">{t("addEmployee.compensation.minWageHint")}</p>
                </div>
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
                        <SelectTrigger className={fieldBorder(additionalInfo.bankName)}>
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
                        className={fieldBorder(additionalInfo.bankAccountNumber)}
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
                    <div className="flex min-h-11 items-center gap-3">
                      <Checkbox
                        id="isResident"
                        checked={Boolean(field.value)}
                        onCheckedChange={field.onChange}
                      />
                      <Label htmlFor="isResident" className="cursor-pointer text-sm">
                        {t("addEmployee.compensation.taxResidentLabel")}
                      </Label>
                    </div>
                  )}
                />
                <span className="hidden text-xs text-muted-foreground sm:inline">|</span>
                <span className="text-xs text-muted-foreground">{t("addEmployee.compensation.incomeTaxTitle")}: {t("addEmployee.compensation.incomeTaxDesc")}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">|</span>
                <span className="text-xs text-muted-foreground">{t("addEmployee.compensation.socialSecurityTitle")}: {t("addEmployee.compensation.socialSecurityDesc")}</span>
              </div>
            </div>
          </StepContent>

          {/* Step 4: Documents */}
          <StepContent stepId="documents" currentStepId={WIZARD_STEPS[currentStep].id}>
            <div className="space-y-6">
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
                            <Input
                              type="date"
                              value={vals.expiryDate}
                              onChange={e => handleDocumentChange(doc.fieldKey, "expiryDate", e.target.value)}
                              className="max-w-[160px]"
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
                        <Input
                          id="workingVisaExpiry"
                          type="date"
                          value={additionalInfo.workingVisaExpiry}
                          onChange={e => handleAdditionalInfoChange("workingVisaExpiry", e.target.value)}
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
                        <Input
                          id="sefopePermitExpiry"
                          type="date"
                          value={additionalInfo.sefopePermitExpiry}
                          onChange={e => handleAdditionalInfoChange("sefopePermitExpiry", e.target.value)}
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
            </div>
          </StepContent>
        </StepWizard>
        </div>
    </div>
  );
}
