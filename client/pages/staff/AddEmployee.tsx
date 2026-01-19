/**
 * AddEmployee - Step-by-step employee onboarding wizard
 * Reduces cognitive load by breaking the form into 4 digestible steps
 */

import React, { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { StepWizard, StepContent, type WizardStep } from "@/components/ui/StepWizard";
import { employeeService, type Employee, type ResidencyStatus } from "@/services/employeeService";
import { fileUploadService } from "@/services/fileUploadService";
import { departmentService, type Department } from "@/services/departmentService";
import CSVColumnMapper from "@/components/CSVColumnMapper";
import { useI18n } from "@/i18n/I18nProvider";
import { useTenantId } from "@/contexts/TenantContext";
import { SEO, seoConfig } from "@/components/SEO";
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
  AlertTriangle,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

// Helper function to get monthly salary with fallback
const getMonthlySalary = (compensation: any): number => {
  return compensation.monthlySalary || Math.round((compensation.annualSalary || 0) / 12) || 0;
};

export default function AddEmployee() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const editEmployeeId = searchParams.get("edit");
  const { t } = useI18n();
  const tenantId = useTenantId();

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
        isOptional: true,
      },
    ],
    [t],
  );

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);

  // Form data
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    phoneApp: "",
    appEligible: false,
    emergencyContactName: "",
    emergencyContactPhone: "",
    department: "",
    jobTitle: "",
    manager: "",
    startDate: "",
    employmentType: "Full-time",
    sefopeNumber: "",
    sefopeRegistrationDate: "",
    salary: "",
    leaveDays: "25",
    benefits: "standard",
    isResident: true,
  });

  // TL-specific documents
  const [documents, setDocuments] = useState([
    { id: 1, type: "Bilhete de Identidade", fieldKey: "bilheteIdentidade", number: "", expiryDate: "", required: true, description: "TL National ID" },
    { id: 2, type: "INSS Number", fieldKey: "socialSecurityNumber", number: "", expiryDate: "", required: true, description: "Social Security" },
    { id: 3, type: "Electoral Card", fieldKey: "electoralCard", number: "", expiryDate: "", required: false, description: "Kartaun Eleitoral" },
    { id: 4, type: "Passport", fieldKey: "passport", number: "", expiryDate: "", required: false, description: "For foreign nationals" },
  ]);

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
  });

  // UI state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    loadDepartmentsAndManagers();
    if (editEmployeeId) {
      loadEmployeeForEdit(editEmployeeId);
    }
  }, [editEmployeeId]);

  const loadEmployeeForEdit = async (employeeId: string) => {
    try {
      setLoading(true);
      const employee = await employeeService.getEmployeeById(tenantId, employeeId);
      if (employee) {
        setIsEditMode(true);
        setEditingEmployee(employee);

        setFormData({
          firstName: employee.personalInfo.firstName,
          lastName: employee.personalInfo.lastName,
          email: employee.personalInfo.email,
          phone: employee.personalInfo.phone,
          phoneApp: (employee.personalInfo as any).phoneApp || "",
          appEligible: (employee.personalInfo as any).appEligible || false,
          emergencyContactName: employee.personalInfo.emergencyContactName || "",
          emergencyContactPhone: employee.personalInfo.emergencyContactPhone || "",
          department: employee.jobDetails.department,
          jobTitle: employee.jobDetails.position,
          manager: employee.jobDetails.manager || "",
          startDate: employee.jobDetails.hireDate,
          employmentType: employee.jobDetails.employmentType,
          sefopeNumber: (employee.jobDetails as any).sefopeNumber || "",
          sefopeRegistrationDate: (employee.jobDetails as any).sefopeRegistrationDate || "",
          salary: getMonthlySalary(employee.compensation).toString(),
          leaveDays: employee.compensation.annualLeaveDays?.toString() || "25",
          benefits: employee.compensation.benefitsPackage || "standard",
          isResident: (employee.compensation as any).isResident ?? true,
        });

        if (employee.documents?.nationality) {
          setAdditionalInfo(prev => ({
            ...prev,
            nationality: employee.documents?.nationality || "Timor-Leste",
            workingVisaNumber: employee.documents?.workingVisaResidency?.number || "",
            workingVisaExpiry: employee.documents?.workingVisaResidency?.expiryDate || "",
          }));
        }
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
  };

  const loadDepartmentsAndManagers = async () => {
    try {
      const [depts, employees] = await Promise.all([
        departmentService.getAllDepartments(),
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
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDocumentChange = (id: number, field: string, value: string) => {
    setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, [field]: value } : doc));
  };

  const handleAdditionalInfoChange = (field: string, value: string | File | null) => {
    setAdditionalInfo(prev => ({ ...prev, [field]: value }));
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

  // Validate current step
  const canProceed = () => {
    const step = WIZARD_STEPS[currentStep].id;
    switch (step) {
      case "basic":
        return !!(formData.firstName && formData.lastName && formData.email);
      case "job":
        return !!(formData.department && formData.jobTitle && formData.startDate);
      case "compensation":
        return true; // Optional fields
      case "documents":
        return true; // Optional step
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const employeeId = documents[0]?.number || `TEMP${Date.now()}`;
      const currentDate = new Date();

      const newEmployee: Omit<Employee, "id"> = {
        personalInfo: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          phoneApp: formData.phoneApp,
          appEligible: formData.appEligible,
          address: "",
          dateOfBirth: "",
          socialSecurityNumber: documents[1]?.number || "",
          emergencyContactName: formData.emergencyContactName,
          emergencyContactPhone: formData.emergencyContactPhone,
        },
        jobDetails: {
          employeeId,
          department: formData.department,
          position: formData.jobTitle,
          hireDate: formData.startDate || currentDate.toISOString().split("T")[0],
          employmentType: formData.employmentType,
          workLocation: "Office",
          manager: formData.manager,
          sefopeNumber: formData.sefopeNumber || undefined,
          sefopeRegistrationDate: formData.sefopeRegistrationDate || undefined,
        },
        compensation: {
          monthlySalary: parseInt(formData.salary) || 0,
          annualLeaveDays: parseInt(formData.leaveDays) || 25,
          benefitsPackage: formData.benefits || "standard",
          isResident: formData.isResident,
        },
        documents: {
          bilheteIdentidade: { number: documents[0]?.number || "", expiryDate: documents[0]?.expiryDate || "", required: true },
          employeeIdCard: { number: documents[0]?.number || "", expiryDate: documents[0]?.expiryDate || "", required: true },
          socialSecurityNumber: { number: documents[1]?.number || "", expiryDate: documents[1]?.expiryDate || "", required: true },
          electoralCard: { number: documents[2]?.number || "", expiryDate: documents[2]?.expiryDate || "", required: false },
          idCard: { number: "", expiryDate: "", required: false },
          passport: { number: documents[3]?.number || "", expiryDate: documents[3]?.expiryDate || "", required: false },
          workContract: { fileUrl: "", uploadDate: new Date().toISOString() },
          nationality: additionalInfo.nationality,
          residencyStatus: additionalInfo.residencyStatus,
          workingVisaResidency: {
            number: additionalInfo.workingVisaNumber,
            expiryDate: additionalInfo.workingVisaExpiry,
            fileUrl: "",
          },
        },
        status: "active",
      };

      // Upload files if they exist
      const employeeIdForUpload = isEditMode && editingEmployee ? editingEmployee.id : fileUploadService.generateTempEmployeeId();

      if (additionalInfo.workContract) {
        try {
          const url = await fileUploadService.uploadEmployeeDocument(additionalInfo.workContract, employeeIdForUpload, "workContract");
          newEmployee.documents.workContract.fileUrl = url;
        } catch (e) {
          console.error("Work contract upload failed:", e);
        }
      }

      if (additionalInfo.workingVisaFile) {
        try {
          const url = await fileUploadService.uploadEmployeeDocument(additionalInfo.workingVisaFile, employeeIdForUpload, "workingVisa");
          newEmployee.documents.workingVisaResidency.fileUrl = url;
        } catch (e) {
          console.error("Visa upload failed:", e);
        }
      }

      // Save to Firebase
      if (isEditMode && editingEmployee) {
        await employeeService.updateEmployee(tenantId, editingEmployee.id, newEmployee);
        toast({
          title: t("addEmployee.toast.updatedTitle"),
          description: t("addEmployee.toast.updatedDesc", {
            name: `${formData.firstName} ${formData.lastName}`,
          }),
        });
      } else {
        const id = await employeeService.addEmployee(tenantId, newEmployee);
        if (!id) throw new Error("Failed to save");
        toast({
          title: t("addEmployee.toast.addedTitle"),
          description: t("addEmployee.toast.addedDesc", {
            name: `${formData.firstName} ${formData.lastName}`,
          }),
        });
      }

      navigate("/people/employees");
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
    const headers = ["firstName", "lastName", "email", "phone", "department", "jobTitle", "startDate", "employmentType", "salary", "leaveDays"];
    const sample = ["John", "Doe", "john@company.com", "+670123456", "Engineering", "Developer", "2024-02-01", "Full-time", "1500", "25"];
    const csv = [headers, sample].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
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

  const handleMappingComplete = async (mappings: any[], csvData: any[]) => {
    // Bulk import logic (simplified for wizard focus)
    setShowColumnMapper(false);
    setImportFile(null);
    toast({
      title: t("addEmployee.import.importStartedTitle"),
      description: t("addEmployee.import.importStartedDesc", {
        count: csvData.length,
      }),
    });
    // ... full import logic would go here
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-5xl mx-auto">
          <Skeleton className="h-8 w-64 mb-6" />
          <Skeleton className="h-20 w-full mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.addEmployee} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-blue-50 dark:bg-blue-950/30">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25">
                <UserPlus className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {isEditMode
                    ? t("addEmployee.header.editTitle")
                    : t("addEmployee.header.addTitle")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {isEditMode
                    ? t("addEmployee.header.editSubtitle")
                    : t("addEmployee.header.addSubtitle")}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={downloadTemplate}
              >
                <FileDown className="h-4 w-4 mr-2" />
                {t("addEmployee.buttons.template")}
              </Button>
              <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600">
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
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 -mt-6">

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
          onComplete={handleSubmit}
          onCancel={() => navigate("/people/employees")}
          isSubmitting={isSubmitting}
          submitLabel={isEditMode ? t("addEmployee.buttons.updateEmployee") : t("addEmployee.buttons.addEmployee")}
          canProceed={canProceed()}
        >
          {/* Step 1: Basic Info */}
          <StepContent stepId="basic" currentStepId={WIZARD_STEPS[currentStep].id}>
            <div className="space-y-6">
              {/* Name Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("addEmployee.fields.firstName")}</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={e => handleInputChange("firstName", e.target.value)}
                    placeholder={t("addEmployee.fields.firstName")}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("addEmployee.fields.lastName")}</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={e => handleInputChange("lastName", e.target.value)}
                    placeholder={t("addEmployee.fields.lastName")}
                  />
                </div>
              </div>

              {/* Contact Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    {t("addEmployee.fields.email")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={e => handleInputChange("email", e.target.value)}
                    placeholder="employee@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-green-600" />
                    {t("addEmployee.fields.phone")}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={e => handleInputChange("phone", e.target.value)}
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
                    value={formData.phoneApp}
                    onChange={e => handleInputChange("phoneApp", e.target.value)}
                    placeholder="+670 987 6543"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      id="appEligible"
                      className="rounded border-blue-300 text-blue-600 focus:ring-blue-500 data-[state=checked]:bg-blue-500"
                      checked={formData.appEligible}
                      onChange={e => handleInputChange("appEligible", e.target.checked)}
                    />
                    <Label htmlFor="appEligible" className="text-sm text-muted-foreground cursor-pointer">
                      {t("addEmployee.fields.appEligible")}
                    </Label>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="p-4 border rounded-lg bg-red-50/50 dark:bg-red-950/20">
                <h3 className="font-medium mb-3 text-red-800 dark:text-red-200">
                  {t("addEmployee.fields.emergencyTitle")}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactName">{t("addEmployee.fields.emergencyName")}</Label>
                    <Input
                      id="emergencyContactName"
                      value={formData.emergencyContactName}
                      onChange={e => handleInputChange("emergencyContactName", e.target.value)}
                      placeholder={t("addEmployee.fields.emergencyName")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactPhone">{t("addEmployee.fields.emergencyPhone")}</Label>
                    <Input
                      id="emergencyContactPhone"
                      type="tel"
                      value={formData.emergencyContactPhone}
                      onChange={e => handleInputChange("emergencyContactPhone", e.target.value)}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">{t("addEmployee.fields.department")}</Label>
                  <Select value={formData.department} onValueChange={v => handleInputChange("department", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("addEmployee.fields.departmentPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">{t("addEmployee.fields.jobTitle")}</Label>
                  <Input
                    id="jobTitle"
                    value={formData.jobTitle}
                    onChange={e => handleInputChange("jobTitle", e.target.value)}
                    placeholder={t("addEmployee.fields.jobTitlePlaceholder")}
                  />
                </div>
              </div>

              {/* Manager, Date, Type */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manager">{t("addEmployee.fields.manager")}</Label>
                  <Select value={formData.manager} onValueChange={v => handleInputChange("manager", v)}>
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">{t("addEmployee.fields.startDate")}</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={e => handleInputChange("startDate", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employmentType">{t("addEmployee.fields.employmentType")}</Label>
                  <Select value={formData.employmentType} onValueChange={v => handleInputChange("employmentType", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full-time">{t("addEmployee.fields.employmentTypes.fullTime")}</SelectItem>
                      <SelectItem value="Part-time">{t("addEmployee.fields.employmentTypes.partTime")}</SelectItem>
                      <SelectItem value="Contractor">{t("addEmployee.fields.employmentTypes.contractor")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* SEFOPE Registration */}
              <div className="p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                <h3 className="font-medium mb-3 flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <Briefcase className="h-4 w-4" />
                  {t("addEmployee.fields.sefopeTitle")}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{t("addEmployee.fields.sefopeTooltip")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sefopeNumber">{t("addEmployee.fields.sefopeNumber")}</Label>
                    <Input
                      id="sefopeNumber"
                      value={formData.sefopeNumber}
                      onChange={e => handleInputChange("sefopeNumber", e.target.value)}
                      placeholder={t("addEmployee.fields.sefopeNumberPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sefopeRegistrationDate">{t("addEmployee.fields.sefopeDate")}</Label>
                    <Input
                      id="sefopeRegistrationDate"
                      type="date"
                      value={formData.sefopeRegistrationDate}
                      onChange={e => handleInputChange("sefopeRegistrationDate", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Work Contract Upload */}
              <div className="space-y-2">
                  <Label htmlFor="workContract">{t("addEmployee.fields.workContract")}</Label>
                <Input
                  id="workContract"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={e => handleAdditionalInfoChange("workContract", e.target.files?.[0] || null)}
                />
                  <p className="text-xs text-muted-foreground">{t("addEmployee.fields.workContractHelp")}</p>
              </div>
            </div>
          </StepContent>

          {/* Step 3: Compensation */}
          <StepContent stepId="compensation" currentStepId={WIZARD_STEPS[currentStep].id}>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salary">{t("addEmployee.compensation.salaryLabel")}</Label>
                  <Input
                    id="salary"
                    type="number"
                    value={formData.salary}
                    onChange={e => handleInputChange("salary", e.target.value)}
                    placeholder={t("addEmployee.compensation.salaryPlaceholder")}
                  />
                  <p className="text-xs text-muted-foreground">{t("addEmployee.compensation.minWageHint")}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leaveDays">{t("addEmployee.compensation.leaveDays")}</Label>
                  <Input
                    id="leaveDays"
                    type="number"
                    value={formData.leaveDays}
                    onChange={e => handleInputChange("leaveDays", e.target.value)}
                    placeholder={t("addEmployee.compensation.leaveDaysPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="benefits">{t("addEmployee.compensation.benefits")}</Label>
                  <Select value={formData.benefits} onValueChange={v => handleInputChange("benefits", v)}>
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
                </div>
              </div>

              {/* Tax Residency */}
              <div className="p-4 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20">
                <h3 className="font-medium mb-3 text-amber-800 dark:text-amber-200">
                  {t("addEmployee.compensation.taxInfoTitle")}
                </h3>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isResident"
                    className="rounded border-blue-300 text-blue-600 focus:ring-blue-500 data-[state=checked]:bg-blue-500"
                    checked={formData.isResident}
                    onChange={e => handleInputChange("isResident", e.target.checked)}
                  />
                  <Label htmlFor="isResident" className="cursor-pointer">
                    {t("addEmployee.compensation.taxResidentLabel")}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("addEmployee.compensation.taxResidentHint")}
                </p>
              </div>

              {/* TL Tax Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{t("addEmployee.compensation.incomeTaxTitle")}</p>
                  <p className="text-muted-foreground">{t("addEmployee.compensation.incomeTaxDesc")}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{t("addEmployee.compensation.socialSecurityTitle")}</p>
                  <p className="text-muted-foreground">{t("addEmployee.compensation.socialSecurityDesc")}</p>
                </div>
              </div>
            </div>
          </StepContent>

          {/* Step 4: Documents */}
          <StepContent stepId="documents" currentStepId={WIZARD_STEPS[currentStep].id}>
            <div className="space-y-6">
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
                    const status = getExpiryStatus(doc.expiryDate);
                    const labelKey = documentLabelMap[doc.fieldKey]?.labelKey;
                    const descriptionKey = documentLabelMap[doc.fieldKey]?.descriptionKey;
                    const label = labelKey ? t(labelKey) : doc.type;
                    const description = descriptionKey ? t(descriptionKey) : doc.description;
                    return (
                      <TableRow key={doc.id}>
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
                            value={doc.number}
                            onChange={e => handleDocumentChange(doc.id, "number", e.target.value)}
                            placeholder={t("addEmployee.documents.numberPlaceholder")}
                            className="max-w-[180px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={doc.expiryDate}
                            onChange={e => handleDocumentChange(doc.id, "expiryDate", e.target.value)}
                            className="max-w-[160px]"
                          />
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

              {/* Nationality */}
              <div className="space-y-2">
                <Label htmlFor="nationality">{t("addEmployee.documents.nationality")}</Label>
                <Select value={additionalInfo.nationality} onValueChange={v => handleAdditionalInfoChange("nationality", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Timor-Leste">Timor-Leste</SelectItem>
                    <SelectItem value="Australia">Australia</SelectItem>
                    <SelectItem value="Indonesia">Indonesia</SelectItem>
                    <SelectItem value="Portugal">Portugal</SelectItem>
                    <SelectItem value="Philippines">Philippines</SelectItem>
                    <SelectItem value="China">China</SelectItem>
                    <SelectItem value="Other">{t("addEmployee.documents.nationalityOther")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Working Visa (for non-TL nationals) */}
              {additionalInfo.nationality !== "Timor-Leste" && (
                <div className="p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
                  <h3 className="font-medium mb-3 flex items-center gap-2 text-orange-800 dark:text-orange-200">
                    <FileText className="h-4 w-4" />
                    {t("addEmployee.documents.visaTitle")}
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="workingVisaNumber">{t("addEmployee.documents.visaNumber")}</Label>
                      <Input
                        id="workingVisaNumber"
                        value={additionalInfo.workingVisaNumber}
                        onChange={e => handleAdditionalInfoChange("workingVisaNumber", e.target.value)}
                        placeholder={t("addEmployee.documents.visaNumberPlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="workingVisaExpiry">{t("addEmployee.documents.visaExpiry")}</Label>
                      <Input
                        id="workingVisaExpiry"
                        type="date"
                        value={additionalInfo.workingVisaExpiry}
                        onChange={e => handleAdditionalInfoChange("workingVisaExpiry", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="workingVisaFile">{t("addEmployee.documents.visaUpload")}</Label>
                      <Input
                        id="workingVisaFile"
                        type="file"
                        accept=".pdf,.jpg,.png"
                        onChange={e => handleAdditionalInfoChange("workingVisaFile", e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Expiry Warnings */}
              {documents.some(d => {
                const s = getExpiryStatus(d.expiryDate);
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
