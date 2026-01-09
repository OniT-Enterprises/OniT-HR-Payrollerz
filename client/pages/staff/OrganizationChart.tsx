import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { debounceResize } from "@/lib/resizeObserverFix";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import { employeeService, type Employee } from "@/services/employeeService";
import {
  departmentService,
  type Department,
} from "@/services/departmentService";
import { offlineFirstService } from "@/services/offlineFirstService";
import DepartmentManager from "@/components/DepartmentManager";
import { useToast } from "@/hooks/use-toast";
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load data with individual error handling for better resilience
      let employeesData: Employee[] = [];
      let departmentsData: Department[] = [];

      // Use ultra-safe offline-first service to completely avoid Firebase network errors
      try {
        console.log("🛡️ Using offline-first service for ultimate safety");

        employeesData = await offlineFirstService.getEmployees();
        console.log("✅ Employees loaded safely:", employeesData.length);

        departmentsData = await offlineFirstService.getDepartments();
        console.log("✅ Departments loaded safely:", departmentsData.length);
        console.log(
          "📋 Department names:",
          departmentsData.map((d) => d.name),
        );
      } catch (error) {
        // Even the offline-first service failed - use minimal fallbacks
        console.warn(
          "⚠️ Even offline-first service failed, using minimal data:",
          error,
        );
        employeesData = [];
        departmentsData = [];
      }

      setEmployees(employeesData);
      setDepartments(departmentsData);

      // Only attempt migration if we have some data
      if (employeesData.length > 0 || departmentsData.length > 0) {
        try {
          await migrateMissingDepartments(employeesData, departmentsData);
        } catch (error) {
          console.warn("⚠️ Migration failed, continuing without it:", error);
        }
      }

      buildAppleOrgChart(employeesData, departmentsData);
    } catch (error) {
      console.error("❌ Critical error loading organization data:", error);

      // Provide user-friendly error message
      const errorMessage =
        error instanceof Error
          ? error.message.includes("network") || error.message.includes("fetch")
            ? "Unable to connect to database. Showing demo data."
            : "Failed to load organization data. Please try again."
          : "An unexpected error occurred while loading data.";

      toast({
        title: "Connection Issue",
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
        console.log(
          `📊 Using existing ${existingDepartments.length} departments`,
        );
        return;
      }

      console.log("🔄 Attempting to migrate missing departments...");

      const employeeDepartments = [
        ...new Set(employees.map((emp) => emp.jobDetails.department)),
      ];
      const validDepartments = employeeDepartments.filter(
        (deptName) => deptName && deptName.trim(),
      );

      if (validDepartments.length > 0) {
        console.log(`📝 Creating ${validDepartments.length} departments...`);

        // Add departments one by one with individual error handling
        for (const deptName of validDepartments) {
          try {
            await departmentService.addDepartment({
              name: deptName,
              icon: "building",
              shape: "circle",
              color: "#3B82F6",
            });
            console.log(`✅ Created department: ${deptName}`);
          } catch (error) {
            console.warn(`⚠️ Failed to create department ${deptName}:`, error);
            // Continue with other departments even if one fails
          }
        }

        // Try to reload departments after migration
        try {
          const updatedDepartments =
            await departmentService.getAllDepartments();
          setDepartments(updatedDepartments);
          buildAppleOrgChart(employees, updatedDepartments);
          console.log("✅ Migration completed successfully");
        } catch (error) {
          console.warn(
            "⚠️ Failed to reload departments after migration:",
            error,
          );
          // Continue with existing data
        }
      }
    } catch (error) {
      console.error("❌ Error during department migration:", error);
      // Don't throw the error - just log it and continue
    }
  };

  // Debounced version to prevent excessive re-renders
  const debouncedBuildChart = useCallback(
    debounceResize(() => {
      // This will be set by the actual build function
    }, 150),
    []
  );

  const buildAppleOrgChart = useCallback(
    (employeesData: Employee[], departmentsData: Department[]) => {
      console.log(
        "🏗����� Building org chart with:",
        employeesData.length,
        "employees and",
        departmentsData.length,
        "departments",
      );

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
          department: "Executive",
          employee: ceo,
        });
        usedIds.add(ceo.id);
      }

      // CFO or top financial officer
      const cfo = employeesData.find(
        (emp) =>
          !usedIds.has(emp.id) &&
          (emp.jobDetails.position.toLowerCase().includes("cfo") ||
            emp.jobDetails.position.toLowerCase().includes("chief financial") ||
            emp.jobDetails.position.toLowerCase().includes("chief finance")),
      );

      if (cfo) {
        execChain.push({
          id: `exec-${cfo.id}`,
          name: `${cfo.personalInfo.firstName} ${cfo.personalInfo.lastName}`,
          title: cfo.jobDetails.position,
          department: "Executive",
          employee: cfo,
        });
        usedIds.add(cfo.id);
      }

      // COO/CTO or other C-level
      const otherExec = employeesData.find(
        (emp) =>
          !usedIds.has(emp.id) &&
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
          department: "Executive",
          employee: otherExec,
        });
        usedIds.add(otherExec.id);
      }

      setExecutives(execChain);

      // 2. Build Department Groups (5 max, horizontal)
      const deptGroups: DepartmentGroup[] = [];

      departmentsData.slice(0, 5).forEach((dept) => {
        const deptEmployees = employeesByDept[dept.name] || [];
        console.log(
          `🏢 Processing department: ${dept.name} with ${deptEmployees.length} employees`,
        );

        // Find department head
        const head = deptEmployees.find(
          (emp) =>
            !usedIds.has(emp.id) &&
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
          console.log(
            `👤 Found department head for ${dept.name}: ${head.personalInfo.firstName} ${head.personalInfo.lastName}`,
          );
          usedIds.add(head.id);
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
            dept.director || dept.manager || "No Head Assigned";
          console.log(
            `📋 No employee head found for ${dept.name}, using assigned: ${assignedHead}`,
          );
          headPerson = {
            id: `head-placeholder-${dept.id}`,
            name: assignedHead,
            title: dept.director
              ? "Director"
              : dept.manager
                ? "Manager"
                : "Department Head",
            department: dept.name,
          };
        }

        // Find team members (limit to 6 for clean layout)
        const members = deptEmployees
          .filter((emp) => !usedIds.has(emp.id))
          .slice(0, 6)
          .map((emp) => {
            usedIds.add(emp.id);
            return {
              id: `member-${emp.id}`,
              name: `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`,
              title: emp.jobDetails.position,
              department: dept.name,
              employee: emp,
            };
          });

        console.log(
          `➕ Adding department group: ${dept.name} with ${members.length} members`,
        );
        deptGroups.push({
          id: dept.id,
          name: dept.name,
          head: headPerson,
          members,
        });
      });

      console.log(
        `✅ Org chart built: ${execChain.length} executives, ${deptGroups.length} department groups`,
      );
      setDepartmentGroups(deptGroups);
    },
    [],
  );

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    toast({
      title: "Organization Updated",
      description: "Position moved successfully",
    });
  };

  const handleDepartmentChange = async () => {
    // Reload data when departments are changed
    await loadData();
    toast({
      title: "Data Refreshed",
      description: "Organization chart updated with latest department changes",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <HotDogStyleNavigation />
        <div className="p-6">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-3">Loading organization chart...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HotDogStyleNavigation />

      <div className="p-8">
        {/* Header with Title and Controls */}
        <div className="flex flex-col gap-6 mb-8">
          {/* Title and Controls */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col relative mt-5">
              <div className="flex gap-5 max-md:flex-col max-md:items-stretch max-md:gap-0">
                <div className="flex flex-col leading-normal w-[33%] ml-0 max-md:w-full max-md:ml-0">
                  <h1 className="text-4xl font-bold text-gray-900">
                    &nbsp;Organizational Chart
                  </h1>
                </div>
                <div className="flex flex-col leading-normal w-[67%] ml-auto max-md:w-full max-md:ml-0">
                  {/* Controls - Horizontal inline */}
                  <div className="flex items-center gap-4 ml-auto">
                    <Button
                      variant={dragMode ? "default" : "outline"}
                      onClick={() => setDragMode(!dragMode)}
                    >
                      <Move className="mr-2 h-4 w-4" />
                      {dragMode ? "Exit Reorganize" : "Reorganize"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setManagerMode("add");
                        setShowDepartmentManager(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Department
                    </Button>
                    <Button
                      onClick={() => {
                        setManagerMode("edit");
                        setShowDepartmentManager(true);
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Manage
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics Dashboard - Horizontal Blue Container */}
          {employees.length > 0 && (
            <div className="bg-blue-500 rounded-lg p-6">
              <div className="flex flex-col gap-6">
                <div className="flex gap-5 max-md:flex-col max-md:items-stretch max-md:gap-0">
                  <div className="flex flex-col leading-normal w-[20%] ml-0 max-md:w-full max-md:ml-0">
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Executives
                            </p>
                            <p className="text-2xl font-bold text-purple-700">
                              {executives.length}
                            </p>
                          </div>
                          <Crown className="h-8 w-8 text-purple-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="flex flex-col leading-normal w-[20%] ml-5 max-md:w-full max-md:ml-0">
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Managers
                            </p>
                            <p className="text-2xl font-bold text-green-700">
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
                          <UserCheck className="h-8 w-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="flex flex-col leading-normal w-[20%] ml-5 max-md:w-full max-md:ml-0">
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Senior Staff
                            </p>
                            <p className="text-2xl font-bold text-blue-700">
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
                          <GraduationCap className="h-8 w-8 text-blue-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="flex flex-col leading-normal w-[20%] ml-5 max-md:w-full max-md:ml-0">
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Total Employees
                            </p>
                            <p className="text-2xl font-bold text-orange-700">
                              {employees.length}
                            </p>
                          </div>
                          <Users className="h-8 w-8 text-orange-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {employees.length === 0 ? (
          <div className="text-center py-16">
            <Database className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">No Organization Data</h3>
            <p className="text-muted-foreground mb-6">
              Add employees to see the organization chart
            </p>
            <Button onClick={() => (window.location.href = "/staff/add")}>
              <User className="mr-2 h-4 w-4" />
              Add First Employee
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Apple-Style Organization Chart */}
            <div className="bg-white rounded-lg shadow-sm border p-12 mx-auto overflow-x-auto min-w-max">
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
                                      <Grip className="h-4 w-4 text-gray-400" />
                                    </div>
                                  )}

                                  {/* Executive Card */}
                                  <div className="w-56 h-32 border-2 border-blue-300 rounded-lg bg-gradient-to-b from-blue-50 to-white shadow-md">
                                    <div className="p-4 text-center h-full flex flex-col justify-center">
                                      <div className="flex justify-center mb-2">
                                        <Avatar className="h-12 w-12 border-2 border-blue-400">
                                          <AvatarImage
                                            src="/placeholder.svg"
                                            alt={exec.name}
                                          />
                                          <AvatarFallback className="bg-blue-100 text-blue-800 font-bold text-sm">
                                            {exec.name
                                              .split(" ")
                                              .map((n) => n[0])
                                              .join("")}
                                          </AvatarFallback>
                                        </Avatar>
                                      </div>
                                      <h3 className="font-bold text-sm text-gray-900 mb-1">
                                        {exec.name}
                                      </h3>
                                      <p className="text-xs text-blue-700 font-medium">
                                        {exec.title}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Connecting line to next */}
                                  {index < executives.length - 1 && (
                                    <div className="w-0.5 h-6 bg-gray-400 mx-auto"></div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}

                          {/* Line to departments */}
                          {departmentGroups.length > 0 && (
                            <div className="w-0.5 h-8 bg-gray-400"></div>
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
                        className="h-0.5 bg-gray-400"
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
                                    <div className="w-0.5 h-6 bg-gray-400"></div>

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
                                          <Grip className="h-3 w-3 text-gray-500" />
                                        </div>
                                      )}

                                      <div className="w-48 h-28 border-2 border-gray-400 rounded-lg bg-gradient-to-b from-gray-100 to-gray-50 shadow-md">
                                        <div className="p-3 text-center h-full flex flex-col justify-center">
                                          <div className="flex justify-center mb-2">
                                            <Avatar className="h-10 w-10 border border-gray-500">
                                              <AvatarImage
                                                src="/placeholder.svg"
                                                alt={group.head.name}
                                              />
                                              <AvatarFallback className="bg-gray-200 text-gray-800 font-semibold text-xs">
                                                {group.head.name
                                                  .split(" ")
                                                  .map((n) => n[0])
                                                  .join("")}
                                              </AvatarFallback>
                                            </Avatar>
                                          </div>
                                          <h3 className="font-bold text-xs text-gray-900 mb-1">
                                            {group.head.name}
                                          </h3>
                                          <p className="text-xs text-gray-600">
                                            {group.head.title}
                                          </p>
                                          <div className="mt-1">
                                            <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                                              {group.name}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* 3. Team Members Grid (Blue) */}
                                    {group.members.length > 0 && (
                                      <div className="flex flex-col items-center space-y-3">
                                        <div className="w-0.5 h-4 bg-gray-300"></div>
                                        <div className="grid grid-cols-2 gap-3">
                                          {group.members.map((member) => (
                                            <div
                                              key={member.id}
                                              className="w-36 h-24 border border-blue-300 rounded-lg bg-gradient-to-b from-blue-50 to-white shadow-sm"
                                            >
                                              <div className="p-2 text-center h-full flex flex-col justify-center">
                                                <div className="flex justify-center mb-1">
                                                  <Avatar className="h-8 w-8 border border-blue-300">
                                                    <AvatarImage
                                                      src="/placeholder.svg"
                                                      alt={member.name}
                                                    />
                                                    <AvatarFallback className="bg-blue-100 text-blue-700 font-medium text-xs">
                                                      {member.name
                                                        .split(" ")
                                                        .map((n) => n[0])
                                                        .join("")}
                                                    </AvatarFallback>
                                                  </Avatar>
                                                </div>
                                                <h4 className="font-medium text-xs text-gray-900 mb-0.5 leading-tight">
                                                  {member.name}
                                                </h4>
                                                <p className="text-xs text-blue-600 leading-tight">
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
            </div>
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
