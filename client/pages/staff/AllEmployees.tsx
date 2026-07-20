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
import PageHeader from "@/components/layout/PageHeader";
import { employeeService, type Employee } from "@/services/employeeService";
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
import { cn } from "@/lib/utils";
import { useTableSort, type SortState } from "@/hooks/useTableSort";
import { SortableColumnHeader } from "@/components/ui/SortableColumnHeader";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getFunctionsLazy } from "@/lib/firebase";
import { useTenantId, useTenant } from "@/contexts/TenantContext";

// Compliance filter types for URL params
type ComplianceFilter = "all" | "missing-contract" | "missing-inss" | "missing-bank" | "blocking-issues" | "issues";

// Sortable columns in the employee directory (Actions is not sortable)
type EmployeeSortKey = "name" | "department" | "position" | "status" | "salary";

/** Duplicate key: same non-TEMP employee ID or same normalized full name */
function duplicateKeysFor(emp: Pick<Employee, "personalInfo" | "jobDetails">): string[] {
  const keys: string[] = [];
  const name = `${emp.personalInfo?.firstName ?? ""} ${emp.personalInfo?.lastName ?? ""}`.trim().toLowerCase();
  if (name) keys.push(`name:${name}`);
  const empId = emp.jobDetails?.employeeId;
  if (empId && !empId.startsWith("TEMP")) keys.push(`id:${empId.toLowerCase()}`);
  return keys;
}

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
  duplicateIds,
  canManageTenant,
  sort,
  onToggleSort,
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
  duplicateIds: Set<string>;
  canManageTenant: boolean;
  sort: SortState<EmployeeSortKey> | null;
  onToggleSort: (key: EmployeeSortKey) => void;
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

  // Header and every row share ONE grid template, so columns stay aligned
  // in both branches — including virtualized rows, which are absolutely
  // positioned and therefore can't participate in <table> column sizing
  // (that was the "columns broke" bug on large directories).
  const gridTemplate = showSalary
    ? 'minmax(240px,2fr) minmax(130px,1.1fr) minmax(160px,1.4fr) 110px 140px 72px'
    : 'minmax(240px,2fr) minmax(130px,1.1fr) minmax(160px,1.4fr) 110px 72px';

  const headerCell = 'px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider';
  const sortableHeader = (key: EmployeeSortKey, label: string, align: 'left' | 'right' = 'left') => {
    const active = sort?.key === key;
    return (
      <div
        role="columnheader"
        aria-sort={active ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn('px-4 py-3', align === 'right' && 'flex justify-end')}
      >
        <SortableColumnHeader
          label={label}
          active={active}
          direction={active ? sort!.direction : 'asc'}
          onSort={() => onToggleSort(key)}
          align={align}
        />
      </div>
    );
  };
  const headerRow = (
    <div
      role="row"
      className="sticky top-0 z-10 grid items-center border-b bg-background"
      style={{ gridTemplateColumns: gridTemplate, minWidth: 860 }}
    >
      {sortableHeader('name', t("employees.table.employee"))}
      {sortableHeader('department', t("employees.table.department"))}
      {sortableHeader('position', t("employees.table.position"))}
      {sortableHeader('status', t("employees.table.status"))}
      {showSalary && sortableHeader('salary', t("employees.table.salary"), 'right')}
      <div role="columnheader" className={`${headerCell} text-right`}>{t("employees.table.actions")}</div>
    </div>
  );

  const renderRow = (employee: Employee, style?: React.CSSProperties) => (
    <div
      role="row"
      key={employee.id}
      className="grid items-center border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer group"
      style={{ ...style, gridTemplateColumns: gridTemplate, minWidth: 860 }}
      onClick={() => onViewEmployee(employee)}
    >
      <div role="cell" className="min-w-0 px-4 py-2">
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
              {duplicateIds.has(employee.id ?? "") && (
                <Badge className="ml-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-medium align-middle">
                  {t("employees.possibleDuplicate")}
                </Badge>
              )}
            </p>
            {employee.jobDetails.employeeId?.startsWith("TEMP") ? (
              <Badge variant="outline" className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                {t("employees.noIdYet")}
              </Badge>
            ) : (
              <p className="text-xs text-muted-foreground">
                {employee.jobDetails.employeeId}
              </p>
            )}
          </div>
        </div>
      </div>
      <div role="cell" className="min-w-0 truncate px-4 py-2">
        <span className="text-sm">{employee.jobDetails.department}</span>
      </div>
      <div role="cell" className="min-w-0 truncate px-4 py-2">
        <span className="text-sm">{employee.jobDetails.position}</span>
      </div>
      <div role="cell" className="px-4 py-2">
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
      </div>
      {showSalary && (
        <div role="cell" className="px-4 py-2 text-right whitespace-nowrap">
          <span className="font-medium tabular-nums">
            {formatSalary(
              employee.compensation.monthlySalary ||
                Math.round((employee.compensation.annualSalary ?? 0) / 12) || 0
            )}
          </span>
          <span className="text-xs text-muted-foreground">{t("employees.perMonth")}</span>
        </div>
      )}
      <div role="cell" className="px-4 py-2">
        <div className="flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                aria-label={t("common.moreActions")}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewEmployee(employee)}>
                <Eye className="h-4 w-4 mr-2" />
                {t("employees.tooltips.viewProfile")}
              </DropdownMenuItem>
              {canManageTenant && <DropdownMenuItem onClick={() => onEditEmployee(employee)}>
                <Edit className="h-4 w-4 mr-2" />
                {t("employees.tooltips.editEmployee")}
              </DropdownMenuItem>}
              {canManageTenant && employee.personalInfo?.email && employee.status === 'active' && (
                <DropdownMenuItem onClick={() => onCreateEkipaAccount(employee)}>
                  <Smartphone className="h-4 w-4 mr-2" />
                  {t("employees.tooltips.createEkipaAccount")}
                </DropdownMenuItem>
              )}
              {canManageTenant && <DropdownMenuSeparator />}
              {canManageTenant && <DropdownMenuItem onClick={() => onDeleteEmployee(employee)} className="text-red-600 focus:text-red-600">
                <UserMinus className="h-4 w-4 mr-2" />
                {t("employees.tooltips.offboardEmployee")}
              </DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );

  if (!useVirtual) {
    // Small dataset: render directly (no virtualization overhead)
    return (
      <div role="table" className="hidden md:block overflow-x-auto">
        {headerRow}
        <div role="rowgroup">{employees.map((employee) => renderRow(employee))}</div>
      </div>
    );
  }

  // Large dataset: virtualized rendering — the shared grid template keeps
  // absolutely positioned rows aligned with the header columns.
  return (
    <div role="table" className="hidden md:block overflow-x-auto">
      {headerRow}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight: '70vh' }}
      >
        <div role="rowgroup" style={{ height: virtualizer.getTotalSize(), position: 'relative', minWidth: 860 }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const employee = employees[virtualRow.index];
            return renderRow(employee, {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            });
          })}
        </div>
      </div>
    </div>
  );
}

export default function AllEmployees() {
  // Seed the search box from a ?search= param (e.g. the People hub search bar)
  const [searchTerm, setSearchTerm] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("search") ?? "",
  );
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
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [ekipaTarget, setEkipaTarget] = useState<Employee | null>(null);
  const [ekipaCreating, setEkipaCreating] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { session, canManage } = useTenant();
  const canManageTenant = canManage();
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
    if (filterParam && ["missing-contract", "missing-inss", "missing-bank", "blocking-issues", "issues"].includes(filterParam)) {
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
        const hasDepartment = !!employee.jobDetails?.department;

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
          case "issues":
            matchesCompliance = !hasContract || !hasINSS || !hasDepartment;
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

  // Column sorting (asc → desc → off). Empty/missing values sort last.
  const { sorted: sortedEmployees, sort, toggleSort } = useTableSort<Employee, EmployeeSortKey>(
    filteredEmployees,
    {
      name: (e) => `${e.personalInfo.firstName ?? ""} ${e.personalInfo.lastName ?? ""}`.trim(),
      department: (e) => e.jobDetails.department,
      position: (e) => e.jobDetails.position,
      status: (e) => e.status,
      salary: (e) =>
        e.compensation.monthlySalary ||
        Math.round((e.compensation.annualSalary ?? 0) / 12) ||
        0,
    },
  );

  // Records sharing a non-TEMP employee ID or a full name with another record
  const duplicateIds = useMemo(() => {
    const byKey = new Map<string, Set<string>>();
    employees.forEach((emp) => {
      if (!emp.id) return;
      duplicateKeysFor(emp).forEach((key) => {
        const set = byKey.get(key) ?? new Set<string>();
        set.add(emp.id!);
        byKey.set(key, set);
      });
    });
    const ids = new Set<string>();
    byKey.forEach((docIds) => {
      if (docIds.size > 1) docIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [employees]);

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
    if (!canManageTenant) return;
    // Navigate to edit employee page with employee ID
    // Use /people/add directly (not /staff/add) to preserve query params
    navigate(`/people/add?edit=${employee.id}`);
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!canManageTenant) return;
    // Navigate to offboarding page
    navigate(`/people/offboarding?employeeId=${employee.id}`);
  };

  const handleCreateEkipaAccount = (employee: Employee) => {
    if (!canManageTenant) return;
    if (!employee.personalInfo?.email) {
      toast({ title: t("employees.ekipaAccount.noEmail"), variant: "destructive" });
      return;
    }
    setEkipaTarget(employee);
  };

  const confirmCreateEkipaAccount = async () => {
    if (!ekipaTarget || !canManageTenant) return;
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

  /** Build an Employee from a template-ordered CSV row (see handleDownloadTemplate) */
  const employeeFromCsvRow = (values: string[]): Omit<Employee, "id"> => {
    const v = (i: number) => values[i]?.trim() ?? "";
    const address = [v(12), v(13), v(14), v(15)].filter(Boolean).join(", ");
    const emptyDoc = { number: "", expiryDate: "", required: false };
    return {
      personalInfo: {
        firstName: v(1),
        lastName: v(2),
        email: v(3),
        phone: v(4),
        phoneApp: "",
        appEligible: false,
        address,
        dateOfBirth: v(18),
        socialSecurityNumber: "",
        emergencyContactName: v(16),
        emergencyContactPhone: v(17),
      },
      jobDetails: {
        employeeId: v(0) || `TEMP${Date.now()}${Math.floor(Math.random() * 1000)}`,
        department: v(5),
        position: v(6),
        hireDate: v(7) || getTodayTL(),
        employmentType: v(8) || "Full-time",
        workLocation: v(9) || "Office",
        manager: "",
      },
      compensation: {
        monthlySalary: parseInt(v(10), 10) || 0,
        annualLeaveDays: 25,
        benefitsPackage: v(11) || "standard",
        payFrequency: "monthly",
        isResident: true,
      },
      documents: {
        bilheteIdentidade: { ...emptyDoc, required: true },
        employeeIdCard: { ...emptyDoc, required: true },
        socialSecurityNumber: { ...emptyDoc, required: true },
        electoralCard: { ...emptyDoc },
        idCard: { ...emptyDoc },
        passport: { ...emptyDoc },
        workContract: { fileUrl: "", uploadDate: new Date().toISOString() },
        nationality: "",
        workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
      },
      isForeignWorker: false,
      bankName: "",
      bankAccountNumber: "",
      status: (v(19) || "active") as Employee["status"],
    };
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canManageTenant) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      setImporting(true);
      try {
        const csvText = e.target?.result as string;
        const lines = csvText.split(/\r?\n/);
        const headers = lines[0].split(",").map((h) => h.trim());
        const dataLines = lines.slice(1).filter((line) => line.trim());

        // Keys of everyone already in the directory + rows already accepted from this file
        const seenKeys = new Set<string>(employees.flatMap((emp) => duplicateKeysFor(emp)));

        let successCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;

        for (const [index, line] of dataLines.entries()) {
          try {
            const values = line.split(",").map((val) => val.trim().replace(/^"|"$/g, ""));
            if (values.length < Math.min(headers.length, 3) || !values[1] || !values[2]) {
              errorCount++;
              continue;
            }
            const newEmployee = employeeFromCsvRow(values);
            const keys = duplicateKeysFor(newEmployee);
            if (keys.some((key) => seenKeys.has(key))) {
              duplicateCount++;
              continue;
            }
            await employeeService.addEmployee(tenantId, newEmployee);
            keys.forEach((key) => seenKeys.add(key));
            successCount++;
          } catch (error) {
            errorCount++;
            console.error(`Error importing row ${index + 2}:`, error);
          }
        }

        toast({
          title: t("employees.csvImportCompleteTitle"),
          description: t("employees.csvImportCompleteDesc", {
            success: successCount,
            duplicates: duplicateCount,
            errors: errorCount,
          }),
          variant: errorCount > 0 ? "destructive" : "default",
        });
        if (successCount > 0) loadEmployees();
        setShowImportDialog(false);
      } catch {
        toast({
          title: t("employees.importErrorTitle"),
          description: t("employees.importErrorDesc"),
          variant: "destructive",
        });
      } finally {
        setImporting(false);
      }
    };

    reader.readAsText(file);

    // Reset the input value so the same file can be selected again
    event.target.value = "";
  };

  const incompleteEmployees = getIncompleteEmployees(employees);

  // Skeleton for data rows while loading — mirrors the mobile card list and
  // desktop table rows shape so nothing jumps when data arrives.
  const TableSkeleton = () => (
    <>
      <div className="md:hidden divide-y divide-border/50">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16 rounded-full shrink-0" />
              </div>
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <tbody className="divide-y divide-border/50">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-24" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-5 w-20 rounded-full" />
                </td>
                {showSalary && (
                  <td className="px-4 py-3 text-right">
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end">
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.employees} />

      {/* Main Content */}
      <div className="mx-auto max-w-screen-2xl px-6 py-5">
        <PageHeader
          title={t("employees.title")}
          subtitle={t("employees.subtitle")}
          icon={Users}
          iconColor="text-blue-500"
          actions={canManageTenant ? (
            <>
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                {t("employees.tooltips.importCsv")}
              </Button>
              <Button
                onClick={() => navigate("/people/add")}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("dashboard.addEmployee")}
              </Button>
            </>
          ) : undefined}
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
                {complianceFilter === "issues" && t("employees.compliance.issues")}
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
                {canManageTenant && incompleteEmployees.length > 0 && (
                  <DropdownMenuItem onClick={() => setShowIncompleteProfiles(true)} className="text-amber-600">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {t("employees.stats.incomplete", { count: incompleteEmployees.length })}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>

        {/* CSV import dialog: template download + file upload in one place */}
        <Dialog open={canManageTenant && showImportDialog} onOpenChange={(open) => !importing && setShowImportDialog(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("employees.importDialog.title")}</DialogTitle>
              <DialogDescription>{t("employees.importDialog.description")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("employees.importDialog.step1")}</p>
                <Button variant="outline" onClick={handleDownloadTemplate} className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  {t("employees.importDialog.downloadTemplate")}
                </Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("employees.importDialog.step2")}</p>
                {importing ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("employees.importDialog.importing")}
                  </div>
                ) : (
                  <Input
                    type="file"
                    accept=".csv"
                    aria-label={t("employees.importDialog.chooseFile")}
                    onChange={handleImportCSV}
                  />
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
                  {duplicateIds.size > 0 && (
                    <span className="block mt-1 text-amber-600 dark:text-amber-400 font-medium">
                      {t("employees.directory.duplicatesFound", { count: duplicateIds.size })}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-border/50">
              {sortedEmployees.map((employee) => (
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
                          {duplicateIds.has(employee.id ?? "") && (
                            <Badge className="ml-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-medium align-middle">
                              {t("employees.possibleDuplicate")}
                            </Badge>
                          )}
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
                      {employee.jobDetails.employeeId?.startsWith("TEMP") ? (
                        <Badge variant="outline" className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                          {t("employees.noIdYet")}
                        </Badge>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {employee.jobDetails.employeeId}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View - Virtualized for large datasets */}
            <DesktopEmployeeTable
              employees={sortedEmployees}
              showSalary={showSalary}
              getStatusLabel={getStatusLabel}
              formatSalary={formatSalary}
              onViewEmployee={handleViewEmployee}
              onEditEmployee={handleEditEmployee}
              onCreateEkipaAccount={handleCreateEkipaAccount}
              onDeleteEmployee={handleDeleteEmployee}
              duplicateIds={duplicateIds}
              canManageTenant={canManageTenant}
              sort={sort}
              onToggleSort={toggleSort}
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
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                        <Users className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        {t("employees.empty.noEmployeesTitle")}
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {searchTerm
                          ? t("employees.empty.noEmployeesSearch")
                          : t("employees.empty.noEmployeesStart")}
                      </p>
                      {canManageTenant && <Button onClick={() => navigate("/people/add")}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t("employees.buttons.addFirstEmployee")}
                      </Button>}
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
          open={canManageTenant && showIncompleteProfiles}
          onOpenChange={setShowIncompleteProfiles}
          onEditEmployee={handleEditEmployee}
        />

        {/* Create Ekipa Account Confirmation */}
        <AlertDialog open={canManageTenant && !!ekipaTarget} onOpenChange={(open) => !open && setEkipaTarget(null)}>
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
