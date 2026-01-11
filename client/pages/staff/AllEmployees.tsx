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
import { employeeService, type Employee } from "@/services/employeeService";
import EmployeeProfileView from "@/components/EmployeeProfileView";
import ContactInfoPopover from "@/components/ContactInfoPopover";
import IncompleteProfilesDialog from "@/components/IncompleteProfilesDialog";
import { useI18n } from "@/i18n/I18nProvider";
import {
  getProfileCompleteness,
  getIncompleteEmployees,
  getCompletionStatusIcon,
} from "@/lib/employeeUtils";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Search,
  Filter,
  Download,
  Mail,
  Phone,
  Smartphone,
  Cross,
  MapPin,
  Calendar,
  Briefcase,
  DollarSign,
  Building,
  Eye,
  Edit,
  Trash2,
  Plus,
  AlertTriangle,
  Upload,
  FileText,
  CalendarX,
} from "lucide-react";

export default function AllEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Filter states
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [employmentTypeFilter, setEmploymentTypeFilter] =
    useState<string>("all");
  const [workLocationFilter, setWorkLocationFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [minSalary, setMinSalary] = useState<string>("");
  const [maxSalary, setMaxSalary] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [showProfileView, setShowProfileView] = useState(false);
  const [showIncompleteProfiles, setShowIncompleteProfiles] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useI18n();

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionError(null);
      // Try to reload data when coming back online
      if (employees.length === 0) {
        loadEmployees();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionError(
        t("employees.offlineMessage"),
      );
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [employees.length]);

  // Load employees from Firebase
  useEffect(() => {
    loadEmployees();
  }, []);

  // Filter employees when search term or filters change
  useEffect(() => {
    filterEmployees();
  }, [
    employees,
    searchTerm,
    departmentFilter,
    positionFilter,
    employmentTypeFilter,
    workLocationFilter,
    statusFilter,
    minSalary,
    maxSalary,
  ]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setConnectionError(null);
      const employeesData = await employeeService.getAllEmployees();
      setEmployees(employeesData);
    } catch (error) {
      console.error("Error loading employees:", error);

      // Show specific error message from the service
      const errorMessage =
        error instanceof Error ? error.message : t("employees.connectionErrorFallback");
      setConnectionError(errorMessage);

      toast({
        title: t("employees.connectionErrorTitle"),
        description: errorMessage,
        variant: "destructive",
        duration: 8000, // Show longer for network errors
      });

      // Set empty employees array to show empty state instead of loading forever
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const filterEmployees = () => {
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
        Math.round((employee.compensation as any).annualSalary / 12) ||
        0;
      const matchesMinSalary = !minSalary || salary >= parseInt(minSalary);
      const matchesMaxSalary = !maxSalary || salary <= parseInt(maxSalary);

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesPosition &&
        matchesEmploymentType &&
        matchesWorkLocation &&
        matchesStatus &&
        matchesMinSalary &&
        matchesMaxSalary
      );
    });

    setFilteredEmployees(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setDepartmentFilter("all");
    setPositionFilter("all");
    setEmploymentTypeFilter("all");
    setWorkLocationFilter("all");
    setStatusFilter("all");
    setMinSalary("");
    setMaxSalary("");
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
    filterEmployees();
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
            Math.round((emp.compensation as any).annualSalary / 12) ||
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
    navigate(`/staff/add?edit=${employee.id}`);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
        <AutoBreadcrumb className="mb-6" />
          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Skeleton className="h-4 w-28 mb-2" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Controls Skeleton */}
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-64" />
            <div className="flex-1" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
          </div>

          {/* Table Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-500">
        {/* Decorative orb */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-400/20 rounded-full blur-2xl transform -translate-x-1/2 translate-y-1/2" />

        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <AutoBreadcrumb className="mb-6 text-white/70 [&_a]:text-white/70 [&_a:hover]:text-white" />

          <div className="flex items-center gap-4 animate-fade-up">
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{t("employees.title")}</h1>
              <p className="text-blue-100 mt-1">
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
                onClick={loadEmployees}
                disabled={loading}
              >
                {loading ? t("employees.retrying") : t("employees.retry")}
              </Button>
            </div>
          </Alert>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 animate-fade-up">
          <Card className="border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("employees.stats.totalEmployees")}
                  </p>
                  <p className="text-2xl font-bold">{employees.length}</p>
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
                    {t("employees.stats.activeEmployees")}
                  </p>
                  <p className="text-2xl font-bold">
                    {employees.filter((emp) => emp.status === "active").length}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
                  <Building className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("employees.stats.departments")}
                  </p>
                  <p className="text-2xl font-bold">
                    {
                      new Set(employees.map((emp) => emp.jobDetails.department))
                        .size
                    }
                  </p>
                </div>
                <Briefcase className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setShowIncompleteProfiles(true)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("employees.stats.incompleteProfiles")}
                  </p>
                  <p className="text-2xl font-bold text-orange-600">
                    {incompleteEmployees.length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("employees.stats.inactive")}
                  </p>
                  <p className="text-2xl font-bold text-purple-600">
                    {
                      employees.filter((emp) => emp.status === "inactive")
                        .length
                    }
                  </p>
                </div>
                <CalendarX className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row items-center gap-4 mb-6">
          {/* Left side - Add Employee with gap */}
          <div className="flex items-center">
            <Button
              variant="outline"
              onClick={() => navigate("/people/add")}
              className={"bg-white hover:bg-purple-50 border-purple-200"}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("employees.buttons.addEmployee")}
            </Button>
          </div>

          {/* Middle section - Filters and Search */}
          <div className="flex items-center gap-3 flex-1">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={
                showFilters
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "bg-white hover:bg-purple-50 border-purple-200"
              }
            >
              <Filter className="mr-2 h-4 w-4" />
              {t("employees.buttons.filters")}{" "}
              {hasActiveFilters &&
                t("employees.filtersCount", { count: activeFilterCount })}
            </Button>

            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("employees.searchPlaceholder")}
                className="pl-9 pr-20 bg-white border-purple-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button
                size="sm"
                onClick={handleSearch}
                className="absolute right-1 top-1 h-8 bg-purple-600 hover:bg-purple-700"
              >
                {t("employees.buttons.search")}
              </Button>
            </div>
          </div>

          {/* Right side - CSV actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadTemplate}
              className="bg-white hover:bg-purple-50 border-purple-200"
            >
              <FileText className="mr-2 h-4 w-4" />
              {t("employees.buttons.templateCsv")}
            </Button>
            <Button
              variant="outline"
              onClick={() => document.getElementById("csv-upload")?.click()}
              className="bg-white hover:bg-purple-50 border-purple-200"
            >
              <Upload className="mr-2 h-4 w-4" />
              {t("employees.buttons.importCsv")}
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              className="bg-white hover:bg-purple-50 border-purple-200"
            >
              <Download className="mr-2 h-4 w-4" />
              {t("employees.buttons.exportCsv")}
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
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
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

        {/* Employees Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t("employees.directoryTitle")}</CardTitle>
            <CardDescription>
              {t("employees.directoryDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">
                      <div className="flex items-center gap-1">
                        {t("employees.table.employee")}
                        <Filter
                          className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground"
                          onClick={() => setShowFilters(!showFilters)}
                        />
                      </div>
                    </th>
                    <th className="text-left p-3 font-medium">
                      <div className="flex items-center gap-1">
                        {t("employees.table.department")}
                        <Filter
                          className={`h-3 w-3 cursor-pointer hover:text-foreground ${
                            departmentFilter
                              ? "text-blue-600"
                              : "text-muted-foreground"
                          }`}
                          onClick={() => setShowFilters(!showFilters)}
                        />
                      </div>
                    </th>
                    <th className="text-left p-3 font-medium">
                      <div className="flex items-center gap-1">
                        {t("employees.table.position")}
                        <Filter
                          className={`h-3 w-3 cursor-pointer hover:text-foreground ${
                            positionFilter
                              ? "text-blue-600"
                              : "text-muted-foreground"
                          }`}
                          onClick={() => setShowFilters(!showFilters)}
                        />
                      </div>
                    </th>
                    <th className="text-left p-3 font-medium">
                      {t("employees.table.contact")}
                    </th>
                    <th className="text-left p-3 font-medium">
                      <div className="flex items-center gap-1">
                        {t("employees.table.hireDate")}
                        <Filter
                          className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground"
                          onClick={() => setShowFilters(!showFilters)}
                        />
                      </div>
                    </th>
                    <th className="text-left p-3 font-medium">
                      <div className="flex items-center gap-1">
                        {t("employees.table.monthlySalary")}
                        <Filter
                          className={`h-3 w-3 cursor-pointer hover:text-foreground ${
                            minSalary || maxSalary
                              ? "text-blue-600"
                              : "text-muted-foreground"
                          }`}
                          onClick={() => setShowFilters(!showFilters)}
                        />
                      </div>
                    </th>
                    <th className="text-center p-3 font-medium">
                      {t("employees.table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage
                              src="/placeholder.svg"
                              alt={employee.personalInfo.firstName}
                            />
                            <AvatarFallback>
                              {employee.personalInfo.firstName[0]}
                              {employee.personalInfo.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold">
                              {employee.personalInfo.firstName}{" "}
                              {employee.personalInfo.lastName}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {t("employees.idLabel", {
                                id: employee.jobDetails.employeeId,
                              })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 max-w-[100px]">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm leading-tight break-words">
                            {employee.jobDetails.department
                              .split(" ")
                              .map((word, index, array) => (
                                <span key={index}>
                                  {word}
                                  {index < array.length - 1 && <br />}
                                </span>
                              ))}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span>{employee.jobDetails.position}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {employee.jobDetails.workLocation}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="grid grid-cols-2 gap-1 w-fit">
                          {/* Email */}
                          <div className="flex items-center justify-center p-1">
                            <div title={employee.personalInfo.email}>
                              <Mail className="h-4 w-4 text-blue-600 cursor-pointer hover:bg-blue-50 rounded" />
                            </div>
                          </div>

                          {/* Phone */}
                          <div className="flex items-center justify-center p-1">
                            <div
                              title={
                                employee.personalInfo.phone ||
                                t("employees.contactTooltips.noPhone")
                              }
                            >
                              <Phone className="h-4 w-4 text-green-600 cursor-pointer hover:bg-green-50 rounded" />
                            </div>
                          </div>

                          {/* Emergency Contact */}
                          <div className="flex items-center justify-center p-1">
                            <div
                              title={
                                employee.personalInfo.emergencyContactName
                                  ? t("employees.contactTooltips.emergency", {
                                      name: employee.personalInfo.emergencyContactName,
                                    })
                                  : t("employees.contactTooltips.noEmergency")
                              }
                            >
                              <Cross className="h-4 w-4 text-red-600 cursor-pointer hover:bg-red-50 rounded" />
                            </div>
                          </div>

                          {/* Mobile App */}
                          <div className="flex items-center justify-center p-1">
                            <div
                              title={
                                (employee.personalInfo as any).phoneApp
                                  ? t("employees.contactTooltips.app", {
                                      app: (employee.personalInfo as any).phoneApp,
                                    })
                                  : t("employees.contactTooltips.noApp")
                              }
                            >
                              <Smartphone className="h-4 w-4 text-purple-600 cursor-pointer hover:bg-purple-50 rounded" />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{employee.jobDetails.hireDate}</span>
                        </div>
                        <Badge variant="outline" className="mt-1">
                          {employee.jobDetails.employmentType}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div>
                          <span className="font-semibold">
                            {formatSalary(
                              employee.compensation.monthlySalary ||
                                Math.round(
                                  (employee.compensation as any).annualSalary /
                                    12,
                                ) ||
                                0,
                            )}
                          </span>
                          <div className="text-xs text-muted-foreground mt-1">
                            {t("employees.benefitsLabel", {
                              benefits:
                                employee.compensation.benefitsPackage ||
                                t("employees.benefitsNone"),
                            })}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          {(() => {
                            const completeness =
                              getProfileCompleteness(employee);
                            const isComplete = completeness.isComplete;
                            return (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewEmployee(employee)}
                                className={
                                  isComplete
                                    ? "text-green-600 hover:text-green-700"
                                    : "text-red-600 hover:text-red-700"
                                }
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            );
                          })()}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditEmployee(employee)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteEmployee(employee)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Empty State */}
              {paginatedEmployees.length === 0 && !loading && (
                <div className="text-center py-12">
                  {connectionError ? (
                    <>
                      <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-red-400" />
                      <h3 className="text-lg font-semibold mb-2">
                        {t("employees.empty.connectionTitle")}
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {t("employees.empty.connectionDesc")}
                      </p>
                      <Button onClick={loadEmployees} disabled={loading}>
                        <Users className="mr-2 h-4 w-4" />
                        {t("employees.buttons.retryLoading")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
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
