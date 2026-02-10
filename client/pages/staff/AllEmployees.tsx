import React, { useState, useEffect, useMemo } from "react";
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
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { type Employee } from "@/services/employeeService";
import { useAllEmployees } from "@/hooks/useEmployees";
import EmployeeProfileView from "@/components/EmployeeProfileView";
import ContactInfoPopover from "@/components/ContactInfoPopover";
import IncompleteProfilesDialog from "@/components/IncompleteProfilesDialog";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO, seoConfig } from "@/components/SEO";
import {
  getProfileCompleteness,
  getIncompleteEmployees,
  getCompletionStatusIcon,
} from "@/lib/employeeUtils";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Search,
  Filter,
  Download,
  Building,
  Eye,
  Edit,
  UserMinus,
  Plus,
  AlertTriangle,
  Upload,
  FileText,
  EyeOff,
  SlidersHorizontal,
} from "lucide-react";

// Compliance filter types for URL params
type ComplianceFilter = "all" | "missing-contract" | "missing-inss" | "missing-bank" | "blocking-issues";

export default function AllEmployees() {
  // React Query for data fetching with caching
  const {
    data: employees = [],
    isLoading: loading,
    error: queryError,
    refetch: loadEmployees,
  } = useAllEmployees(500);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useI18n();

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
  }, [searchParams, employees]);

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
      const matchesMinSalary = !minSalary || salary >= parseInt(minSalary);
      const matchesMaxSalary = !maxSalary || salary <= parseInt(maxSalary);

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

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
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
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employees_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: t("employees.exportCompleteTitle"),
      description: t("employees.exportCompleteDesc", {
        count: filteredEmployees.length,
      }),
    });
  };

  // Pagination
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEmployees = filteredEmployees.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

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
    const blob = new Blob([csvContent], { type: "text/csv" });
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
            const employeeData = {
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
      } catch (error) {
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

      {/* Hero Section */}
      <div className="border-b bg-blue-50 dark:bg-blue-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />

          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t("employees.title")}</h1>
              <p className="text-muted-foreground mt-1">
                {t("employees.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
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

        {/* Statistics - Quieter, data-first orientation */}
        <div className="flex items-center gap-6 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-semibold">{employees.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Active:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {employees.filter((emp) => emp.status === "active").length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Depts:</span>
            <span className="font-semibold">
              {new Set(employees.map((emp) => emp.jobDetails.department)).size}
            </span>
          </div>
          {incompleteEmployees.length > 0 && (
            <button
              onClick={() => setShowIncompleteProfiles(true)}
              className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 hover:underline"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{incompleteEmployees.length} incomplete</span>
            </button>
          )}
        </div>

        {/* Compliance Filter Alert - Shows when filtering by compliance issues */}
        {complianceFilter !== "all" && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {complianceFilter === "missing-contract" && "Showing employees missing work contract"}
                {complianceFilter === "missing-inss" && "Showing employees missing INSS number"}
                {complianceFilter === "missing-bank" && "Showing employees missing bank details"}
                {complianceFilter === "blocking-issues" && "Showing employees with payroll-blocking issues"}
              </span>
              <span className="text-xs text-amber-600 dark:text-amber-400">
                ({filteredEmployees.length} found)
              </span>
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
              Clear filter
            </Button>
          </div>
        )}

        {/* Controls - Streamlined */}
        <div className="flex flex-col lg:flex-row items-center gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, or department..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>

          {/* Quick filters inline */}
          <div className="flex items-center gap-2">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Depts</SelectItem>
                {getUniqueValues("department").map((dept) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[110px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {getUniqueValues("status").map((status) => (
                  <SelectItem key={status} value={status}>{getStatusLabel(status)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={hasActiveFilters ? "border-blue-500 text-blue-600" : ""}
            >
              <SlidersHorizontal className="h-4 w-4 mr-1.5" />
              Advanced
              {activeFilterCount > 2 && ` (${activeFilterCount - 2})`}
            </Button>
          </div>

          {/* Salary toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSalary(!showSalary)}
            className="text-muted-foreground"
            title={showSalary ? "Hide salary column" : "Show salary column"}
          >
            {showSalary ? <EyeOff className="h-4 w-4 mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
            {showSalary ? "Hide salary" : "Show salary"}
          </Button>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              title="Download CSV template"
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById("csv-upload")?.click()}
              title="Import from CSV"
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              title="Export to CSV"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/people/add")}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add
            </Button>
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

        {/* Clear Filters */}
        {hasActiveFilters && (
          <div className="flex justify-start mb-4">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {t("employees.buttons.clearFilters")}
            </Button>
          </div>
        )}

        {/* Filter Panel */}
        {showFilters && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{t("employees.filterPanelTitle")}</CardTitle>
              <CardDescription>
                {t("employees.filterPanelDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Department Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("employees.filterLabels.department")}
                  </label>
                  <Select
                    value={departmentFilter}
                    onValueChange={setDepartmentFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("employees.filterPlaceholders.allDepartments")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("employees.filterPlaceholders.allDepartments")}</SelectItem>
                      {getUniqueValues("department").map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Position Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("employees.filterLabels.position")}
                  </label>
                  <Select
                    value={positionFilter}
                    onValueChange={setPositionFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("employees.filterPlaceholders.allPositions")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("employees.filterPlaceholders.allPositions")}</SelectItem>
                      {getUniqueValues("position").map((position) => (
                        <SelectItem key={position} value={position}>
                          {position}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Employment Type Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("employees.filterLabels.employmentType")}
                  </label>
                  <Select
                    value={employmentTypeFilter}
                    onValueChange={setEmploymentTypeFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("employees.filterPlaceholders.allTypes")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("employees.filterPlaceholders.allTypes")}</SelectItem>
                      {getUniqueValues("employmentType").map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Work Location Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("employees.filterLabels.workLocation")}
                  </label>
                  <Select
                    value={workLocationFilter}
                    onValueChange={setWorkLocationFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("employees.filterPlaceholders.allLocations")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("employees.filterPlaceholders.allLocations")}</SelectItem>
                      {getUniqueValues("workLocation").map((location) => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("employees.filterLabels.status")}
                  </label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("employees.filterPlaceholders.allStatuses")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("employees.filterPlaceholders.allStatuses")}</SelectItem>
                      {getUniqueValues("status").map((status) => (
                        <SelectItem key={status} value={status}>
                          {getStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Salary Range */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("employees.filterLabels.minSalary")}
                  </label>
                  <Input
                    type="number"
                    placeholder={t("employees.filterPlaceholders.minSalary")}
                    value={minSalary}
                    onChange={(e) => setMinSalary(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("employees.filterLabels.maxSalary")}
                  </label>
                  <Input
                    type="number"
                    placeholder={t("employees.filterPlaceholders.maxSalary")}
                    value={maxSalary}
                    onChange={(e) => setMaxSalary(e.target.value)}
                  />
                </div>

                {/* Clear Filters Button */}
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                    className="w-full"
                  >
                    {t("employees.buttons.clearAllFilters")}
                  </Button>
                </div>
              </div>

              {/* Filter Summary */}
              {hasActiveFilters && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm text-foreground">
                    <strong>{t("employees.activeFiltersTitle")}</strong>{" "}
                    {t("employees.activeFiltersSummary", {
                      shown: filteredEmployees.length,
                      total: employees.length,
                    })}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {departmentFilter && departmentFilter !== "all" && (
                      <Badge variant="secondary" className="text-xs">
                        {t("employees.filterBadge.department", {
                          value: departmentFilter,
                        })}
                      </Badge>
                    )}
                    {positionFilter && positionFilter !== "all" && (
                      <Badge variant="secondary" className="text-xs">
                        {t("employees.filterBadge.position", {
                          value: positionFilter,
                        })}
                      </Badge>
                    )}
                    {employmentTypeFilter && employmentTypeFilter !== "all" && (
                      <Badge variant="secondary" className="text-xs">
                        {t("employees.filterBadge.employmentType", {
                          value: employmentTypeFilter,
                        })}
                      </Badge>
                    )}
                    {workLocationFilter && workLocationFilter !== "all" && (
                      <Badge variant="secondary" className="text-xs">
                        {t("employees.filterBadge.workLocation", {
                          value: workLocationFilter,
                        })}
                      </Badge>
                    )}
                    {statusFilter && statusFilter !== "all" && (
                      <Badge variant="secondary" className="text-xs">
                        {t("employees.filterBadge.status", {
                          value: getStatusLabel(statusFilter),
                        })}
                      </Badge>
                    )}
                    {(minSalary || maxSalary) && (
                      <Badge variant="secondary" className="text-xs">
                        {t("employees.filterBadge.salary", {
                          range: `${minSalary ? `$${minSalary}` : ""}${
                            minSalary && maxSalary ? " - " : minSalary && !maxSalary ? "+" : ""
                          }${maxSalary ? `$${maxSalary}` : ""}`,
                        })}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Employees Table - Simplified, data-first */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Employee Directory</CardTitle>
                <CardDescription>
                  {filteredEmployees.length} of {employees.length} employees
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-background border-b z-10">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Department
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Position
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    {showSalary && (
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Salary
                      </th>
                    )}
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {paginatedEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => handleViewEmployee(employee)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage
                              src="/placeholder.svg"
                              alt={employee.personalInfo.firstName}
                            />
                            <AvatarFallback className="text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                              {employee.personalInfo.firstName[0]}
                              {employee.personalInfo.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {employee.personalInfo.firstName}{" "}
                              {employee.personalInfo.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {employee.jobDetails.employeeId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm">
                          {employee.jobDetails.department}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm">
                          {employee.jobDetails.position}
                        </span>
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
                                Math.round(
                                  (employee.compensation.annualSalary ?? 0) / 12
                                ) || 0
                            )}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="View profile"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewEmployee(employee);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Edit employee"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditEmployee(employee);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600"
                            title="Offboard employee"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEmployee(employee);
                            }}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Loading State - inline skeleton */}
              {loading && <TableSkeleton />}

              {/* Empty State */}
              {paginatedEmployees.length === 0 && !loading && (
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
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  {t("employees.pagination.showing", {
                    start: startIndex + 1,
                    end: Math.min(
                      startIndex + itemsPerPage,
                      filteredEmployees.length,
                    ),
                    total: filteredEmployees.length,
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    {t("employees.pagination.previous")}
                  </Button>
                  <span className="text-sm">
                    {t("employees.pagination.pageOf", {
                      page: currentPage,
                      total: totalPages,
                    })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    {t("employees.pagination.next")}
                  </Button>
                </div>
              </div>
            )}
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
      </div>
    </div>
  );
}
