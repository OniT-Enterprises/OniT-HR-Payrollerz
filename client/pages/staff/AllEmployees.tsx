import React, { useState, useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import { Alert } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { type Employee } from "@/services/employeeService";
import { useSmartEmployees } from "@/hooks/useEmployees";
import { useDebounce } from "@/hooks/useDebounce";
import EmployeeProfileView from "@/components/EmployeeProfileView";
import IncompleteProfilesDialog from "@/components/IncompleteProfilesDialog";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO, seoConfig } from "@/components/SEO";
import { InfiniteScrollTrigger } from "@/components/ui/InfiniteScrollTrigger";
import {
  getIncompleteEmployees,
} from "@/lib/employeeUtils";
import { useToast } from "@/hooks/use-toast";
import { getTodayTL } from "@/lib/dateUtils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Search,
  Download,
  Eye,
  Edit,
  UserMinus,
  Plus,
  AlertTriangle,
  Upload,
  FileText,
  EyeOff,
  SlidersHorizontal,
  Smartphone,
  Loader2,
  MoreHorizontal,
  X,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getFunctionsLazy } from "@/lib/firebase";
import { useTenantId, useTenant } from "@/contexts/TenantContext";

// Compliance filter types for URL params
type ComplianceFilter = "all" | "missing-contract" | "missing-inss" | "missing-bank" | "blocking-issues";

const ROW_HEIGHT = 57; // px per table row
const VIRTUALIZE_THRESHOLD = 100; // only virtualize when > 100 rows

/**
 * Desktop employee table with virtualization for large datasets.
 * Falls back to plain rendering when dataset is small.
 */
function DesktopEmployeeTable({
  employees,
  showSalary,
  getStatusLabel,
  formatSalary,
  onViewEmployee,
  onEditEmployee,
  onCreateEkipaAccount,
  onDeleteEmployee,
  t,
}: {
  employees: Employee[];
  showSalary: boolean;
  getStatusLabel: (status: string) => string;
  formatSalary: (amount: number) => string;
  onViewEmployee: (emp: Employee) => void;
  onEditEmployee: (emp: Employee) => void;
  onCreateEkipaAccount: (emp: Employee) => void;
  onDeleteEmployee: (emp: Employee) => void;
  t: (key: string) => string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const useVirtual = employees.length > VIRTUALIZE_THRESHOLD;

  // TanStack Virtual returns functions that React Compiler can't memoize safely.
  // We don't use React Compiler, so suppress this warning.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: employees.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
    enabled: useVirtual,
  });

  const renderRow = (employee: Employee, style?: React.CSSProperties) => (
    <tr
      key={employee.id}
      className="hover:bg-muted/50 transition-colors cursor-pointer group"
      style={style}
      onClick={() => onViewEmployee(employee)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src="" alt={employee.personalInfo.firstName} />
            <AvatarFallback className="text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600">
              {employee.personalInfo.firstName[0]}
              {employee.personalInfo.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium truncate">
              {employee.personalInfo.firstName} {employee.personalInfo.lastName}
            </p>
            <p className="text-xs text-muted-foreground">
              {employee.jobDetails.employeeId}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm">{employee.jobDetails.department}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm">{employee.jobDetails.position}</span>
      </td>
      <td className="px-4 py-3">
        <Badge
          className={
            employee.status === "active"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : employee.status === "inactive"
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }
        >
          {getStatusLabel(employee.status)}
        </Badge>
      </td>
      {showSalary && (
        <td className="px-4 py-3">
          <span className="font-medium tabular-nums">
            {formatSalary(
              employee.compensation.monthlySalary ||
                Math.round((employee.compensation.annualSalary ?? 0) / 12) || 0
            )}
          </span>
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8" title={t("employees.tooltips.viewProfile")} onClick={(e) => { e.stopPropagation(); onViewEmployee(employee); }}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title={t("employees.tooltips.editEmployee")} onClick={(e) => { e.stopPropagation(); onEditEmployee(employee); }}>
            <Edit className="h-4 w-4" />
          </Button>
          {employee.personalInfo?.email && employee.status === 'active' && (
            <Button variant="ghost" size="icon" className="h-8 w-8" title={t("employees.tooltips.createEkipaAccount")} onClick={(e) => { e.stopPropagation(); onCreateEkipaAccount(employee); }}>
              <Smartphone className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" title={t("employees.tooltips.offboardEmployee")} onClick={(e) => { e.stopPropagation(); onDeleteEmployee(employee); }}>
            <UserMinus className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );

  if (!useVirtual) {
    // Small dataset: render directly (no virtualization overhead)
    return (
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-background border-b z-10">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("employees.table.employee")}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("employees.table.department")}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("employees.table.position")}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("employees.table.status")}</th>
              {showSalary && <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("employees.table.salary")}</th>}
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("employees.table.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {employees.map((employee) => renderRow(employee))}
          </tbody>
        </table>
      </div>
    );
  }

  // Large dataset: virtualized rendering
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-background border-b z-10">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("employees.table.employee")}</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("employees.table.department")}</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("employees.table.position")}</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("employees.table.status")}</th>
            {showSalary && <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("employees.table.salary")}</th>}
            <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("employees.table.actions")}</th>
          </tr>
        </thead>
      </table>
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight: '70vh' }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          <table className="w-full">
            <tbody>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const employee = employees[virtualRow.index];
                return renderRow(employee, {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'table-row',
                });
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AllEmployees() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const isSearching = debouncedSearchTerm.length > 0;

  const { employees, isLoading: loading, error: queryError, refetch: loadEmployees, fetchNextPage, hasNextPage, isFetchingNextPage, searchLimitReached } = useSmartEmployees(isSearching);

  // URL params for deep linking from Dashboard/PayrollHub
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter states
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [employmentTypeFilter, setEmploymentTypeFilter] =
    useState<string>("all");
  const [workLocationFilter, setWorkLocationFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>("all");
  const [minSalary, setMinSalary] = useState<string>("");
  const [maxSalary, setMaxSalary] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSalary, setShowSalary] = useState(true); // Toggle for salary visibility
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [showProfileView, setShowProfileView] = useState(false);
  const [showIncompleteProfiles, setShowIncompleteProfiles] = useState(false);
  const [ekipaTarget, setEkipaTarget] = useState<Employee | null>(null);
  const [ekipaCreating, setEkipaCreating] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { session } = useTenant();
  // Derive connection error from React Query
  const connectionError = queryError
    ? (queryError instanceof Error ? queryError.message : t("employees.connectionErrorFallback"))
    : null;

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // React Query will automatically refetch when network is restored
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Read URL params for compliance filtering (from Dashboard/PayrollHub links)
  useEffect(() => {
    const filterParam = searchParams.get("filter") as ComplianceFilter | null;
    if (filterParam && ["missing-contract", "missing-inss", "missing-bank", "blocking-issues"].includes(filterParam)) {
      setComplianceFilter(filterParam);
      // Show the filter banner when coming from a link
      setShowFilters(true);
    }

    // Handle direct employee link (e.g., ?id=xxx&tab=documents)
    const employeeId = searchParams.get("id");
    if (employeeId && employees.length > 0) {
      const employee = employees.find(e => e.id === employeeId);
      if (employee) {
        setSelectedEmployee(employee);
        setShowProfileView(true);
        // Clear the URL params after opening
        setSearchParams({});
      }
    }
  }, [searchParams, employees, setSearchParams]);

  // Filter employees using useMemo for performance
  const filteredEmployees = useMemo(() => {
    let filtered = employees.filter((employee) => {
      // Search filter
      const matchesSearch =
        !searchTerm ||
        employee.personalInfo.firstName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        employee.personalInfo.lastName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        employee.personalInfo.email
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        employee.jobDetails.employeeId
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        employee.jobDetails.department
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        employee.jobDetails.position
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      // Department filter
      const matchesDepartment =
        !departmentFilter ||
        departmentFilter === "all" ||
        employee.jobDetails.department === departmentFilter;

      // Position filter
      const matchesPosition =
        !positionFilter ||
        positionFilter === "all" ||
        employee.jobDetails.position === positionFilter;

      // Employment type filter
      const matchesEmploymentType =
        !employmentTypeFilter ||
        employmentTypeFilter === "all" ||
        employee.jobDetails.employmentType === employmentTypeFilter;

      // Work location filter
      const matchesWorkLocation =
        !workLocationFilter ||
        workLocationFilter === "all" ||
        employee.jobDetails.workLocation === workLocationFilter;

      // Status filter
      const matchesStatus =
        !statusFilter ||
        statusFilter === "all" ||
        employee.status === statusFilter;

      // Salary range filter
      const salary =
        employee.compensation.monthlySalary ||
        Math.round((employee.compensation.annualSalary ?? 0) / 12) ||
        0;
      const matchesMinSalary = !minSalary || salary >= parseInt(minSalary, 10);
      const matchesMaxSalary = !maxSalary || salary <= parseInt(maxSalary, 10);

      // Compliance filter (for links from Dashboard/PayrollHub)
      let matchesCompliance = true;
      if (complianceFilter !== "all") {
        const hasContract = !!employee.documents?.workContract?.fileUrl;
        const hasINSS = !!employee.documents?.socialSecurityNumber?.number;
        const hasBankAccount = !!employee.bankDetails?.accountNumber;

        switch (complianceFilter) {
          case "missing-contract":
            matchesCompliance = !hasContract;
            break;
          case "missing-inss":
            matchesCompliance = !hasINSS;
            break;
          case "missing-bank":
            matchesCompliance = !hasBankAccount;
            break;
          case "blocking-issues":
            matchesCompliance = !hasContract || !hasINSS;
            break;
        }
      }

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesPosition &&
        matchesEmploymentType &&
        matchesWorkLocation &&
        matchesStatus &&
        matchesMinSalary &&
        matchesMaxSalary &&
        matchesCompliance
      );
    });

    return filtered;
  }, [
    employees,
    searchTerm,
    departmentFilter,
    positionFilter,
    employmentTypeFilter,
    workLocationFilter,
    statusFilter,
    complianceFilter,
    minSalary,
    maxSalary,
  ]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setDepartmentFilter("all");
    setPositionFilter("all");
    setEmploymentTypeFilter("all");
    setWorkLocationFilter("all");
    setStatusFilter("all");
    setComplianceFilter("all");
    setMinSalary("");
    setMaxSalary("");
    // Clear URL params
    setSearchParams({});
  };

  // Get unique values for filter options
  const getUniqueValues = (field: keyof Employee | string) => {
    const values = new Set<string>();
    employees.forEach((employee) => {
      let value: string;
      switch (field) {
        case "department":
          value = employee.jobDetails.department;
          break;
        case "position":
          value = employee.jobDetails.position;
          break;
        case "employmentType":
          value = employee.jobDetails.employmentType;
          break;
        case "workLocation":
          value = employee.jobDetails.workLocation;
          break;
        case "status":
          value = employee.status;
          break;
        default:
          return;
      }
      if (value) values.add(value);
    });
    return Array.from(values).sort();
  };

  // Check if any filters are active
  const hasActiveFilters =
    (departmentFilter && departmentFilter !== "all") ||
    (positionFilter && positionFilter !== "all") ||
    (employmentTypeFilter && employmentTypeFilter !== "all") ||
    (workLocationFilter && workLocationFilter !== "all") ||
    (statusFilter && statusFilter !== "all") ||
    minSalary ||
    maxSalary;

  const activeFilterCount = Object.values({
    departmentFilter: departmentFilter !== "all" ? departmentFilter : null,
    positionFilter: positionFilter !== "all" ? positionFilter : null,
    employmentTypeFilter: employmentTypeFilter !== "all" ? employmentTypeFilter : null,
    workLocationFilter: workLocationFilter !== "all" ? workLocationFilter : null,
    statusFilter: statusFilter !== "all" ? statusFilter : null,
    minSalary,
    maxSalary,
  }).filter(Boolean).length;

  const getStatusLabel = (status: string) => {
    const key = `employees.statusLabels.${status}`;
    const label = t(key);
    if (label !== key) {
      return label;
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleSearch = () => {
    // Filtering is now handled by useMemo automatically
    // This function is kept for the search input's onKeyDown handler
  };

  const handleExport = () => {
    // Create CSV content
    const headers = [
      t("employees.csvHeaders.employeeId"),
      t("employees.csvHeaders.firstName"),
      t("employees.csvHeaders.lastName"),
      t("employees.csvHeaders.email"),
      t("employees.csvHeaders.phone"),
      t("employees.csvHeaders.department"),
      t("employees.csvHeaders.position"),
      t("employees.csvHeaders.hireDate"),
      t("employees.csvHeaders.employmentType"),
      t("employees.csvHeaders.workLocation"),
      t("employees.csvHeaders.monthlySalary"),
    ];

    const csvContent = [
      headers.join(","),
      ...filteredEmployees.map((emp) =>
        [
          emp.jobDetails.employeeId,
          emp.personalInfo.firstName,
          emp.personalInfo.lastName,
          emp.personalInfo.email,
          emp.personalInfo.phone,
          emp.jobDetails.department,
          emp.jobDetails.position,
          emp.jobDetails.hireDate,
          emp.jobDetails.employmentType,
          emp.jobDetails.workLocation,
          emp.compensation.monthlySalary ||
            Math.round((emp.compensation.annualSalary ?? 0) / 12) ||
            0,
        ].join(","),
      ),
    ].join("\n");

    // Download CSV
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employees_${getTodayTL()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: t("employees.exportCompleteTitle"),
      description: t("employees.exportCompleteDesc", {
        count: filteredEmployees.length,
      }),
    });
  };

  const formatSalary = (monthlySalary: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(monthlySalary);
  };

  const handleViewEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowProfileView(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    // Navigate to edit employee page with employee ID
    // Use /people/add directly (not /staff/add) to preserve query params
    navigate(`/people/add?edit=${employee.id}`);
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    // Navigate to offboarding page
    navigate(`/hiring/offboarding?employee=${employee.id}`);
  };

  const handleCreateEkipaAccount = (employee: Employee) => {
    if (!employee.personalInfo?.email) {
      toast({ title: t("employees.ekipaAccount.noEmail"), variant: "destructive" });
      return;
    }
    setEkipaTarget(employee);
  };

  const confirmCreateEkipaAccount = async () => {
    if (!ekipaTarget) return;
    setEkipaCreating(true);
    const name = `${ekipaTarget.personalInfo.firstName} ${ekipaTarget.personalInfo.lastName}`;
    try {
      const { httpsCallable } = await import("firebase/functions");
      const addMember = httpsCallable(await getFunctionsLazy(), "addTenantMember");
      await addMember({
        tenantId,
        userEmail: ekipaTarget.personalInfo.email,
        role: "viewer",
        modules: [],
        employeeId: ekipaTarget.id,
        tenantName: session?.config?.name || tenantId,
      });
      toast({
        title: t("employees.ekipaAccount.success", { name }),
      });
    } catch (error: unknown) {
      const errorCode = error instanceof Error ? (error as { code?: string }).code : undefined;
      if (errorCode === "functions/already-exists") {
        toast({ title: t("employees.ekipaAccount.alreadyExists", { name }) });
      } else {
        toast({
          title: t("employees.ekipaAccount.error"),
          variant: "destructive",
        });
      }
    } finally {
      setEkipaCreating(false);
      setEkipaTarget(null);
    }
  };

  const handleDownloadTemplate = () => {
    // Create CSV template with headers
    const headers = [
      t("employees.csvHeaders.employeeId"),
      t("employees.csvHeaders.firstName"),
      t("employees.csvHeaders.lastName"),
      t("employees.csvHeaders.email"),
      t("employees.csvHeaders.phone"),
      t("employees.csvHeaders.department"),
      t("employees.csvHeaders.position"),
      t("employees.csvHeaders.hireDateTemplate"),
      t("employees.csvHeaders.employmentType"),
      t("employees.csvHeaders.workLocation"),
      t("employees.csvHeaders.monthlySalary"),
      t("employees.csvHeaders.benefitsPackage"),
      t("employees.csvHeaders.streetAddress"),
      t("employees.csvHeaders.city"),
      t("employees.csvHeaders.state"),
      t("employees.csvHeaders.zipCode"),
      t("employees.csvHeaders.emergencyContactName"),
      t("employees.csvHeaders.emergencyContactPhone"),
      t("employees.csvHeaders.dateOfBirth"),
      t("employees.csvHeaders.statusTemplate"),
    ];

    // Add example row
    const exampleRow = [
      "EMP001",
      "John",
      "Doe",
      "john.doe@company.com",
      "555-0123",
      "Engineering",
      "Software Engineer",
      "2024-01-15",
      "Full-time",
      "Office",
      "5000",
      "Basic",
      "123 Main St",
      "New York",
      "NY",
      "10001",
      "Jane Doe",
      "555-0124",
      "1990-05-15",
      "active",
    ];

    const csvContent = [headers.join(","), exampleRow.join(",")].join("\n");

    // Download template
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: t("employees.templateDownloadedTitle"),
      description: t("employees.templateDownloadedDesc"),
    });
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const lines = csvText.split("\n");
        const headers = lines[0].split(",").map((h) => h.trim());
        const dataLines = lines.slice(1).filter((line) => line.trim());

        let successCount = 0;
        let errorCount = 0;

        dataLines.forEach((line, index) => {
          try {
            const values = line.split(",").map((v) => v.trim());
            if (values.length < headers.length) {
              errorCount++;
              return;
            }

            // Basic validation - you would typically process this data
            // and add it to your employee service
            const _employeeData = {
              employeeId: values[0],
              firstName: values[1],
              lastName: values[2],
              email: values[3],
              // ... other fields
            };

            // Here you would call employeeService.addEmployee(employeeData)
            // For now, just count as success
            successCount++;
          } catch (error) {
            errorCount++;
            console.error(`Error processing row ${index + 2}:`, error);
          }
        });

        toast({
          title: t("employees.csvImportCompleteTitle"),
          description: t("employees.csvImportCompleteDesc", {
            success: successCount,
            errors: errorCount,
          }),
          variant: errorCount > 0 ? "destructive" : "default",
        });
      } catch {
        toast({
          title: t("employees.importErrorTitle"),
          description: t("employees.importErrorDesc"),
          variant: "destructive",
        });
      }
    };

    reader.readAsText(file);

    // Reset the input value so the same file can be selected again
    event.target.value = "";
  };

  const incompleteEmployees = getIncompleteEmployees(employees);

  // Skeleton for data rows while loading
  const TableSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-2 ml-auto">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.employees} />
      <MainNavigation />

      {/* Main Content */}
      <div className="mx-auto max-w-screen-2xl px-6 py-8">
        <PageHeader
          title={t("employees.title")}
          subtitle={t("employees.subtitle")}
          icon={Users}
          iconColor="text-blue-500"
          actions={
            <Button
              onClick={() => navigate("/people/add")}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("employees.buttons.add")}
            </Button>
          }
        />
        {/* Connection Status */}
        {(connectionError || !isOnline) && (
          <Alert className="mb-6" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <div className="flex items-center justify-between w-full">
              <div>
                <h4 className="font-medium">{t("employees.connectionIssueTitle")}</h4>
                <p className="text-sm">
                  {!isOnline ? t("employees.offlineMessage") : connectionError}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadEmployees()}
                disabled={loading}
              >
                {loading ? t("employees.retrying") : t("employees.retry")}
              </Button>
            </div>
          </Alert>
        )}

        {/* Compliance Filter Alert - Shows when filtering by compliance issues */}
        {complianceFilter !== "all" && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {complianceFilter === "missing-contract" && t("employees.compliance.missingContract")}
                {complianceFilter === "missing-inss" && t("employees.compliance.missingInss")}
                {complianceFilter === "missing-bank" && t("employees.compliance.missingBank")}
                {complianceFilter === "blocking-issues" && t("employees.compliance.blockingIssues")}
              </span>
              <Badge variant="secondary" className="text-xs">{filteredEmployees.length}</Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setComplianceFilter("all");
                setSearchParams({});
              }}
              className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              {t("employees.compliance.clearFilter")}
            </Button>
          </div>
        )}

        {/* Controls — One clean row: Search | Filters | Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
          {/* Search — full width on mobile, flex-1 on desktop */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("employees.searchPlaceholder")}
              className="pl-9 h-11 border-border/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>

          {/* Quick filters — compact */}
          <div className="flex items-center gap-2">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[140px] h-11">
                <SelectValue placeholder={t("employees.filterLabels.department")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("employees.quickFilters.allDepts")}</SelectItem>
                {getUniqueValues("department").map((dept) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-11">
                <SelectValue placeholder={t("employees.filterLabels.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("employees.quickFilters.allStatus")}</SelectItem>
                {getUniqueValues("status").map((status) => (
                  <SelectItem key={status} value={status}>{getStatusLabel(status)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Advanced filters toggle */}
            <Button
              variant="outline"
              size="icon"
              className={`h-11 w-11 shrink-0 ${showFilters ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950/30" : ""}`}
              onClick={() => { setShowFilters(!showFilters); }}
              title={t("employees.buttons.advanced")}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 2 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {activeFilterCount - 2}
                </span>
              )}
            </Button>

            {/* CSV tools dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-11 w-11 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowSalary(!showSalary)}>
                  {showSalary ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  {showSalary ? t("employees.buttons.hideSalary") : t("employees.buttons.showSalary")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  {t("employees.tooltips.exportCsv")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => document.getElementById("csv-upload")?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("employees.tooltips.importCsv")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadTemplate}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t("employees.tooltips.downloadTemplate")}
                </DropdownMenuItem>
                {incompleteEmployees.length > 0 && (
                  <DropdownMenuItem onClick={() => setShowIncompleteProfiles(true)} className="text-amber-600">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {t("employees.stats.incomplete", { count: incompleteEmployees.length })}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Hidden file input for CSV import */}
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={handleImportCSV}
          />
        </div>

        {/* Active filter chips — show what's active, tap to remove */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs text-muted-foreground">{t("employees.activeFiltersTitle")}:</span>
            {departmentFilter && departmentFilter !== "all" && (
              <button onClick={() => setDepartmentFilter("all")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-200 transition-colors">
                {departmentFilter} <X className="h-3 w-3" />
              </button>
            )}
            {positionFilter && positionFilter !== "all" && (
              <button onClick={() => setPositionFilter("all")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-200 transition-colors">
                {positionFilter} <X className="h-3 w-3" />
              </button>
            )}
            {employmentTypeFilter && employmentTypeFilter !== "all" && (
              <button onClick={() => setEmploymentTypeFilter("all")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-200 transition-colors">
                {employmentTypeFilter} <X className="h-3 w-3" />
              </button>
            )}
            {workLocationFilter && workLocationFilter !== "all" && (
              <button onClick={() => setWorkLocationFilter("all")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-200 transition-colors">
                {workLocationFilter} <X className="h-3 w-3" />
              </button>
            )}
            {statusFilter && statusFilter !== "all" && (
              <button onClick={() => setStatusFilter("all")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-200 transition-colors">
                {getStatusLabel(statusFilter)} <X className="h-3 w-3" />
              </button>
            )}
            {(minSalary || maxSalary) && (
              <button onClick={() => { setMinSalary(""); setMaxSalary(""); }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-200 transition-colors">
                ${minSalary || "0"} - ${maxSalary || "..."} <X className="h-3 w-3" />
              </button>
            )}
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline">
              {t("employees.buttons.clearFilters")}
            </button>
          </div>
        )}

        {/* Advanced Filter Panel — single level, no nesting */}
        {showFilters && (
          <Card className="mb-6 border-blue-200/50 dark:border-blue-800/30">
            <CardContent className="pt-5 pb-5">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("employees.filterLabels.position")}</label>
                  <Select value={positionFilter} onValueChange={setPositionFilter}>
                    <SelectTrigger className="h-10"><SelectValue placeholder={t("employees.filterPlaceholders.allPositions")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("employees.filterPlaceholders.allPositions")}</SelectItem>
                      {getUniqueValues("position").map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("employees.filterLabels.employmentType")}</label>
                  <Select value={employmentTypeFilter} onValueChange={setEmploymentTypeFilter}>
                    <SelectTrigger className="h-10"><SelectValue placeholder={t("employees.filterPlaceholders.allTypes")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("employees.filterPlaceholders.allTypes")}</SelectItem>
                      {getUniqueValues("employmentType").map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("employees.filterLabels.workLocation")}</label>
                  <Select value={workLocationFilter} onValueChange={setWorkLocationFilter}>
                    <SelectTrigger className="h-10"><SelectValue placeholder={t("employees.filterPlaceholders.allLocations")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("employees.filterPlaceholders.allLocations")}</SelectItem>
                      {getUniqueValues("workLocation").map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("employees.filterLabels.minSalary")}</label>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Min" value={minSalary} onChange={(e) => setMinSalary(e.target.value)} className="h-10" />
                    <Input type="number" placeholder="Max" value={maxSalary} onChange={(e) => setMaxSalary(e.target.value)} className="h-10" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Employees Table - Simplified, data-first */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{t("employees.directory.title")}</CardTitle>
                <CardDescription>
                  {t("employees.directory.countSummary", { shown: filteredEmployees.length, total: employees.length })}
                  {searchLimitReached && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                      {t("employees.directory.searchLimitReached")}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-border/50">
              {filteredEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className="p-4 hover:bg-muted/50 transition-colors cursor-pointer active:bg-muted"
                  onClick={() => handleViewEmployee(employee)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="" alt={employee.personalInfo.firstName} />
                      <AvatarFallback className="text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                        {employee.personalInfo.firstName[0]}
                        {employee.personalInfo.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium truncate">
                          {employee.personalInfo.firstName} {employee.personalInfo.lastName}
                        </p>
                        <Badge
                          className={
                            employee.status === "active"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0"
                              : employee.status === "inactive"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 shrink-0"
                          }
                        >
                          {getStatusLabel(employee.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {employee.jobDetails.position}
                        {employee.jobDetails.department && ` · ${employee.jobDetails.department}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {employee.jobDetails.employeeId}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View - Virtualized for large datasets */}
            <DesktopEmployeeTable
              employees={filteredEmployees}
              showSalary={showSalary}
              getStatusLabel={getStatusLabel}
              formatSalary={formatSalary}
              onViewEmployee={handleViewEmployee}
              onEditEmployee={handleEditEmployee}
              onCreateEkipaAccount={handleCreateEkipaAccount}
              onDeleteEmployee={handleDeleteEmployee}
              t={t}
            />

              {/* Loading State - inline skeleton */}
              {loading && <TableSkeleton />}

              {/* Empty State */}
              {filteredEmployees.length === 0 && !loading && (
                <div className="text-center py-12 px-4">
                  {connectionError ? (
                    <>
                      <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-400" />
                      <h3 className="text-lg font-semibold mb-2">
                        {t("employees.empty.connectionTitle")}
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {t("employees.empty.connectionDesc")}
                      </p>
                      <Button onClick={() => loadEmployees()} disabled={loading}>
                        <Users className="mr-2 h-4 w-4" />
                        {t("employees.buttons.retryLoading")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                      <h3 className="text-lg font-semibold mb-2">
                        {t("employees.empty.noEmployeesTitle")}
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {searchTerm
                          ? t("employees.empty.noEmployeesSearch")
                          : t("employees.empty.noEmployeesStart")}
                      </p>
                      <Button onClick={() => navigate("/people/add")}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t("employees.buttons.addFirstEmployee")}
                      </Button>
                    </>
                  )}
                </div>
              )}

            {/* Infinite Scroll Trigger */}
            <InfiniteScrollTrigger
              onLoadMore={() => fetchNextPage()}
              hasMore={hasNextPage ?? false}
              isLoading={isFetchingNextPage}
            />
          </CardContent>
        </Card>

        {/* Employee Profile View Dialog */}
        <EmployeeProfileView
          employee={selectedEmployee}
          open={showProfileView}
          onOpenChange={setShowProfileView}
        />

        {/* Incomplete Profiles Dialog */}
        <IncompleteProfilesDialog
          employees={employees}
          open={showIncompleteProfiles}
          onOpenChange={setShowIncompleteProfiles}
          onEditEmployee={handleEditEmployee}
        />

        {/* Create Ekipa Account Confirmation */}
        <AlertDialog open={!!ekipaTarget} onOpenChange={(open) => !open && setEkipaTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("employees.ekipaAccount.confirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {ekipaTarget && t("employees.ekipaAccount.confirmMessage", {
                  name: `${ekipaTarget.personalInfo.firstName} ${ekipaTarget.personalInfo.lastName}`,
                  email: ekipaTarget.personalInfo.email,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={ekipaCreating}>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmCreateEkipaAccount} disabled={ekipaCreating}>
                {ekipaCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("employees.ekipaAccount.creating")}
                  </>
                ) : (
                  t("employees.ekipaAccount.confirmTitle")
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
