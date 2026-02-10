import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { employeeService, type Employee } from "@/services/employeeService";
import {
  departmentService,
  type Department,
} from "@/services/departmentService";
import DepartmentManager from "@/components/DepartmentManager";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { useTenantId } from "@/contexts/TenantContext";
import { SEO, seoConfig } from "@/components/SEO";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  Building,
  Users,
  Crown,
  User,
  Grip,
  Database,
  Plus,
  Edit,
  Move,
  Building2,
  UserCheck,
  GraduationCap,
} from "lucide-react";

interface OrgPerson {
  id: string;
  name: string;
  title: string;
  department: string;
  employee?: Employee;
}

interface DepartmentGroup {
  id: string;
  name: string;
  head: OrgPerson;
  members: OrgPerson[];
}

export default function OrganizationChart() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [executives, setExecutives] = useState<OrgPerson[]>([]);
  const [departmentGroups, setDepartmentGroups] = useState<DepartmentGroup[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [showDepartmentManager, setShowDepartmentManager] = useState(false);
  const [managerMode, setManagerMode] = useState<"add" | "edit">("edit");
  const [dragMode, setDragMode] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load data with individual error handling for better resilience
      let employeesData: Employee[] = [];
      let departmentsData: Department[] = [];

      // Load from Firebase services
      try {
        employeesData = await employeeService.getAllEmployees(tenantId);
        departmentsData = await departmentService.getAllDepartments(tenantId);
      } catch {
        employeesData = [];
        departmentsData = [];
      }

      setEmployees(employeesData);
      setDepartments(departmentsData);

      // Only attempt migration if we have some data
      if (employeesData.length > 0 || departmentsData.length > 0) {
        try {
          await migrateMissingDepartments(employeesData, departmentsData);
        } catch {
          // Migration failed, continue without it
        }
      }

      buildAppleOrgChart(employeesData, departmentsData);
    } catch (error) {

      // Provide user-friendly error message
      const errorMessage =
        error instanceof Error
          ? error.message.includes("network") || error.message.includes("fetch")
            ? t("orgChart.toast.connectionOffline")
            : t("orgChart.toast.loadFailed")
          : t("orgChart.toast.unexpected");

      toast({
        title: t("orgChart.toast.connectionTitle"),
        description: errorMessage,
        variant: "destructive",
        duration: 6000,
      });

      // Set empty data so the component can still render
      setEmployees([]);
      setDepartments([]);
      buildAppleOrgChart([], []);
    } finally {
      setLoading(false);
    }
  };

  const migrateMissingDepartments = async (
    employees: Employee[],
    existingDepartments: Department[],
  ) => {
    try {
      // Only run migration if NO departments exist but we have employees with department assignments
      if (existingDepartments.length > 0 || employees.length === 0) {
        return;
      }

      const employeeDepartments = [
        ...new Set(employees.map((emp) => emp.jobDetails.department)),
      ];
      const validDepartments = employeeDepartments.filter(
        (deptName) => deptName && deptName.trim(),
      );

      if (validDepartments.length > 0) {
        // Add departments one by one with individual error handling
        for (const deptName of validDepartments) {
          try {
            await departmentService.addDepartment(tenantId, {
              name: deptName,
              icon: "building",
              shape: "circle",
              color: "#3B82F6",
            });
          } catch {
            // Continue with other departments even if one fails
          }
        }

        // Try to reload departments after migration
        try {
          const updatedDepartments =
            await departmentService.getAllDepartments(tenantId);
          setDepartments(updatedDepartments);
          buildAppleOrgChart(employees, updatedDepartments);
        } catch {
          // Continue with existing data
        }
      }
    } catch {
      // Don't throw the error - just continue
    }
  };


  const buildAppleOrgChart = useCallback(
    (employeesData: Employee[], departmentsData: Department[]) => {
      const employeesByDept = employeesData.reduce(
        (acc, emp) => {
          const deptName = emp.jobDetails.department;
          if (!acc[deptName]) acc[deptName] = [];
          acc[deptName].push(emp);
          return acc;
        },
        {} as Record<string, Employee[]>,
      );

      // 1. Build Executive Chain (3 levels max, vertical)
      const execChain: OrgPerson[] = [];
      const usedIds = new Set<string>();

      // CEO/President
      const ceo = employeesData.find(
        (emp) =>
          emp.jobDetails.position.toLowerCase().includes("ceo") ||
          emp.jobDetails.position.toLowerCase().includes("president") ||
          emp.jobDetails.position.toLowerCase().includes("chief executive"),
      );

      if (ceo) {
        execChain.push({
          id: `exec-${ceo.id}`,
          name: `${ceo.personalInfo.firstName} ${ceo.personalInfo.lastName}`,
          title: ceo.jobDetails.position,
          department: t("orgChart.labels.executive"),
          employee: ceo,
        });
        usedIds.add(ceo.id!);
      }

      // CFO or top financial officer
      const cfo = employeesData.find(
        (emp) =>
          !usedIds.has(emp.id!) &&
          (emp.jobDetails.position.toLowerCase().includes("cfo") ||
            emp.jobDetails.position.toLowerCase().includes("chief financial") ||
            emp.jobDetails.position.toLowerCase().includes("chief finance")),
      );

      if (cfo) {
        execChain.push({
          id: `exec-${cfo.id}`,
          name: `${cfo.personalInfo.firstName} ${cfo.personalInfo.lastName}`,
          title: cfo.jobDetails.position,
          department: t("orgChart.labels.executive"),
          employee: cfo,
        });
        usedIds.add(cfo.id!);
      }

      // COO/CTO or other C-level
      const otherExec = employeesData.find(
        (emp) =>
          !usedIds.has(emp.id!) &&
          (emp.jobDetails.position.toLowerCase().includes("coo") ||
            emp.jobDetails.position.toLowerCase().includes("cto") ||
            emp.jobDetails.position.toLowerCase().includes("chief operating") ||
            emp.jobDetails.position
              .toLowerCase()
              .includes("chief technology") ||
            emp.jobDetails.position.toLowerCase().includes("chief")),
      );

      if (otherExec) {
        execChain.push({
          id: `exec-${otherExec.id}`,
          name: `${otherExec.personalInfo.firstName} ${otherExec.personalInfo.lastName}`,
          title: otherExec.jobDetails.position,
          department: t("orgChart.labels.executive"),
          employee: otherExec,
        });
        usedIds.add(otherExec.id!);
      }

      setExecutives(execChain);

      // 2. Build Department Groups (5 max, horizontal)
      const deptGroups: DepartmentGroup[] = [];

      departmentsData.slice(0, 5).forEach((dept) => {
        const deptEmployees = employeesByDept[dept.name] || [];

        // Find department head
        const head = deptEmployees.find(
          (emp) =>
            !usedIds.has(emp.id!) &&
            (emp.jobDetails.position.toLowerCase().includes("director") ||
              emp.jobDetails.position.toLowerCase().includes("vp") ||
              emp.jobDetails.position
                .toLowerCase()
                .includes("vice president") ||
              emp.jobDetails.position.toLowerCase().includes("head") ||
              emp.jobDetails.position.toLowerCase().includes("manager")),
        );

        // Use assigned director/manager from department data if no head found in employees
        let headPerson: OrgPerson;

        if (head) {
          usedIds.add(head.id!);
          headPerson = {
            id: `head-${head.id}`,
            name: `${head.personalInfo.firstName} ${head.personalInfo.lastName}`,
            title: head.jobDetails.position,
            department: dept.name,
            employee: head,
          };
        } else {
          // Create a placeholder head using department's assigned director/manager or a generic placeholder
          const assignedHead =
            dept.director || dept.manager || t("orgChart.labels.noHeadAssigned");
          headPerson = {
            id: `head-placeholder-${dept.id}`,
            name: assignedHead,
            title: dept.director
              ? t("orgChart.labels.director")
              : dept.manager
                ? t("orgChart.labels.manager")
                : t("orgChart.labels.departmentHead"),
            department: dept.name,
          };
        }

        // Find team members (limit to 6 for clean layout)
        const members = deptEmployees
          .filter((emp) => !usedIds.has(emp.id!))
          .slice(0, 6)
          .map((emp) => {
            usedIds.add(emp.id!);
            return {
              id: `member-${emp.id}`,
              name: `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`,
              title: emp.jobDetails.position,
              department: dept.name,
              employee: emp,
            };
          });

        deptGroups.push({
          id: dept.id,
          name: dept.name,
          head: headPerson,
          members,
        });
      });

      setDepartmentGroups(deptGroups);
    },
    [t],
  );

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    toast({
      title: t("orgChart.toast.updatedTitle"),
      description: t("orgChart.toast.updatedDesc"),
    });
  };

  const handleDepartmentChange = async () => {
    // Reload data when departments are changed
    await loadData();
    toast({
      title: t("orgChart.toast.refreshedTitle"),
      description: t("orgChart.toast.refreshedDesc"),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-8">
          {/* Header skeleton */}
          <div className="flex items-center justify-between mb-8">
            <Skeleton className="h-10 w-64" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>

          {/* Statistics skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-8 w-12" />
                      </div>
                      <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Org chart skeleton */}
          <div className="bg-card rounded-lg shadow-sm border border-border p-12">
            <div className="flex flex-col items-center space-y-8">
              {/* Executive chain skeleton */}
              <div className="flex flex-col items-center space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col items-center">
                    <Skeleton className="w-56 h-32 rounded-lg" />
                    {i < 3 && <Skeleton className="w-0.5 h-6 mt-2" />}
                  </div>
                ))}
              </div>

              {/* Connector line */}
              <Skeleton className="w-0.5 h-8" />

              {/* Department heads skeleton */}
              <div className="flex space-x-12">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex flex-col items-center space-y-4">
                    <Skeleton className="w-0.5 h-6" />
                    <Skeleton className="w-48 h-28 rounded-lg" />
                    <Skeleton className="w-0.5 h-4" />
                    <div className="grid grid-cols-2 gap-3">
                      {[1, 2, 3, 4].map((j) => (
                        <Skeleton key={j} className="w-36 h-24 rounded-lg" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.orgChart} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-blue-50 dark:bg-blue-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("orgChart.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("orgChart.subtitle") || "Visualize your company structure"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant={dragMode ? "secondary" : "outline"}
                onClick={() => setDragMode(!dragMode)}
              >
                <Move className="mr-2 h-4 w-4" />
                {dragMode
                  ? t("orgChart.exitReorganize")
                  : t("orgChart.reorganize")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setManagerMode("add");
                  setShowDepartmentManager(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("departments.addDepartment")}
              </Button>
              <Button
                onClick={() => {
                  setManagerMode("edit");
                  setShowDepartmentManager(true);
                }}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600"
              >
                <Edit className="mr-2 h-4 w-4" />
                {t("orgChart.manage")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Statistics Dashboard */}
        {employees.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 -mt-8">
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-1">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("orgChart.stats.executives")}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {executives.length}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl">
                    <Crown className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-2">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("orgChart.stats.managers")}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {
                        employees.filter(
                          (emp) =>
                            emp.jobDetails.position
                              .toLowerCase()
                              .includes("manager") ||
                            emp.jobDetails.position
                              .toLowerCase()
                              .includes("director") ||
                            emp.jobDetails.position
                              .toLowerCase()
                              .includes("head"),
                        ).length
                      }
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                    <UserCheck className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-3">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("orgChart.stats.seniorStaff")}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {
                        employees.filter(
                          (emp) =>
                            emp.jobDetails.position
                              .toLowerCase()
                              .includes("senior") ||
                            emp.jobDetails.position
                              .toLowerCase()
                              .includes("lead") ||
                            emp.jobDetails.position
                              .toLowerCase()
                              .includes("principal"),
                        ).length
                      }
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl">
                    <GraduationCap className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-4">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("orgChart.stats.totalEmployees")}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {employees.length}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {employees.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="text-center py-16">
              <div className="p-4 bg-blue-500/10 rounded-full w-fit mx-auto mb-4">
                <Database className="h-12 w-12 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                {t("orgChart.emptyTitle")}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {t("orgChart.emptyDesc")}
              </p>
              <Button
                onClick={() => (window.location.href = "/staff/add")}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
              >
                <User className="mr-2 h-4 w-4" />
                {t("orgChart.addFirstEmployee")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Apple-Style Organization Chart */}
            <Card className="border-border/50 shadow-lg overflow-x-auto">
              <CardContent className="p-12 min-w-max">
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex flex-col items-center space-y-8">
                  {/* 1. Executive Chain (Vertical) */}
                  {executives.length > 0 && (
                    <Droppable droppableId="executives" type="executive">
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="flex flex-col items-center space-y-4"
                        >
                          {executives.map((exec, index) => (
                            <Draggable
                              key={exec.id}
                              draggableId={exec.id}
                              index={index}
                              isDragDisabled={!dragMode}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`relative ${
                                    snapshot.isDragging
                                      ? "rotate-1 shadow-2xl scale-105"
                                      : ""
                                  } transition-all duration-200`}
                                >
                                  {dragMode && (
                                    <div
                                      {...provided.dragHandleProps}
                                      className="absolute top-2 right-2 z-10"
                                    >
                                      <Grip className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}

                                  {/* Executive Card */}
                                  <div className="w-56 h-32 border-2 border-primary/50 rounded-lg bg-gradient-to-b from-primary/10 to-card shadow-md">
                                    <div className="p-4 text-center h-full flex flex-col justify-center">
                                      <div className="flex justify-center mb-2">
                                        <Avatar className="h-12 w-12 border-2 border-primary/60">
                                          <AvatarImage
                                            src="/placeholder.svg"
                                            alt={exec.name}
                                          />
                                          <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                                            {exec.name
                                              .split(" ")
                                              .map((n) => n[0])
                                              .join("")}
                                          </AvatarFallback>
                                        </Avatar>
                                      </div>
                                      <h3 className="font-bold text-sm text-foreground mb-1">
                                        {exec.name}
                                      </h3>
                                      <p className="text-xs text-primary font-medium">
                                        {exec.title}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Connecting line to next */}
                                  {index < executives.length - 1 && (
                                    <div className="w-0.5 h-6 bg-border mx-auto"></div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}

                          {/* Line to departments */}
                          {departmentGroups.length > 0 && (
                            <div className="w-0.5 h-8 bg-border"></div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  )}

                  {/* 2. Department Heads Row (Horizontal) */}
                  {departmentGroups.length > 0 && (
                    <div className="flex flex-col items-center space-y-6">
                      {/* Horizontal connector line */}
                      <div
                        className="h-0.5 bg-border"
                        style={{
                          width: `${Math.max(0, (departmentGroups.length - 1) * 240)}px`,
                        }}
                      ></div>

                      {/* Department Heads */}
                      <Droppable
                        droppableId="department-heads"
                        type="department"
                        direction="horizontal"
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="flex space-x-12"
                          >
                            {departmentGroups.map((group, index) => (
                              <Draggable
                                key={group.head.id}
                                draggableId={group.head.id}
                                index={index}
                                isDragDisabled={!dragMode}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className="flex flex-col items-center space-y-4"
                                  >
                                    {/* Line up to horizontal connector */}
                                    <div className="w-0.5 h-6 bg-border"></div>

                                    {/* Department Head Card (Gray) */}
                                    <div
                                      className={`relative ${
                                        snapshot.isDragging
                                          ? "rotate-1 shadow-2xl scale-105"
                                          : ""
                                      } transition-all duration-200`}
                                    >
                                      {dragMode && (
                                        <div
                                          {...provided.dragHandleProps}
                                          className="absolute top-1 right-1 z-10"
                                        >
                                          <Grip className="h-3 w-3 text-muted-foreground" />
                                        </div>
                                      )}

                                      <div className="w-48 h-28 border-2 border-border rounded-lg bg-gradient-to-b from-muted to-card shadow-md">
                                        <div className="p-3 text-center h-full flex flex-col justify-center">
                                          <div className="flex justify-center mb-2">
                                            <Avatar className="h-10 w-10 border border-border">
                                              <AvatarImage
                                                src="/placeholder.svg"
                                                alt={group.head.name}
                                              />
                                              <AvatarFallback className="bg-muted text-foreground font-semibold text-xs">
                                                {group.head.name
                                                  .split(" ")
                                                  .map((n) => n[0])
                                                  .join("")}
                                              </AvatarFallback>
                                            </Avatar>
                                          </div>
                                          <h3 className="font-bold text-xs text-foreground mb-1">
                                            {group.head.name}
                                          </h3>
                                          <p className="text-xs text-muted-foreground">
                                            {group.head.title}
                                          </p>
                                          <div className="mt-1">
                                            <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                                              {group.name}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* 3. Team Members Grid (Blue) */}
                                    {group.members.length > 0 && (
                                      <div className="flex flex-col items-center space-y-3">
                                        <div className="w-0.5 h-4 bg-border"></div>
                                        <div className="grid grid-cols-2 gap-3">
                                          {group.members.map((member) => (
                                            <div
                                              key={member.id}
                                              className="w-36 h-24 border border-primary/30 rounded-lg bg-gradient-to-b from-primary/10 to-card shadow-sm"
                                            >
                                              <div className="p-2 text-center h-full flex flex-col justify-center">
                                                <div className="flex justify-center mb-1">
                                                  <Avatar className="h-8 w-8 border border-primary/40">
                                                    <AvatarImage
                                                      src="/placeholder.svg"
                                                      alt={member.name}
                                                    />
                                                    <AvatarFallback className="bg-primary/20 text-primary font-medium text-xs">
                                                      {member.name
                                                        .split(" ")
                                                        .map((n) => n[0])
                                                        .join("")}
                                                    </AvatarFallback>
                                                  </Avatar>
                                                </div>
                                                <h4 className="font-medium text-xs text-foreground mb-0.5 leading-tight">
                                                  {member.name}
                                                </h4>
                                                <p className="text-xs text-primary leading-tight">
                                                  {member.title.length > 20
                                                    ? `${member.title.substring(0, 17)}...`
                                                    : member.title}
                                                </p>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )}
                </div>
              </DragDropContext>
              </CardContent>
            </Card>
          </div>
        )}

        <DepartmentManager
          open={showDepartmentManager}
          onOpenChange={setShowDepartmentManager}
          mode={managerMode}
          onDepartmentChange={handleDepartmentChange}
        />
      </div>
    </div>
  );
}
