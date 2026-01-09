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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import { employeeService, type Employee } from "@/services/employeeService";
import { useToast } from "@/hooks/use-toast";
import {
  UserMinus,
  Calendar,
  FileText,
  Mail,
  Key,
  CreditCard,
  Building,
  CheckCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  Shield,
  Archive,
  Download,
  Filter,
  Database,
  Users,
  User,
  Search,
  History,
  Plus,
  Eye,
  Edit,
  Save,
} from "lucide-react";

// Define interfaces for offboarding data
interface OffboardingCase {
  id: string;
  employee: Employee;
  departureReason: string;
  lastWorkingDay: string;
  noticeDate: string;
  status: "pending" | "in-progress" | "completed";
  notes: string;
  checklist: OffboardingChecklist;
  exitInterview: ExitInterview;
  createdAt: Date;
  updatedAt: Date;
}

interface OffboardingChecklist {
  accessRevoked: boolean;
  equipmentReturned: boolean;
  documentsSigned: boolean;
  knowledgeTransfer: boolean;
  finalPayCalculated: boolean;
  benefitsCancelled: boolean;
  exitInterviewCompleted: boolean;
  referenceLetter: boolean;
}

interface ExitInterview {
  overallSatisfaction: string;
  managerRelationship: string;
  primaryReason: string;
  suggestions: string;
  wouldRecommend: string;
  additionalComments: string;
  completed: boolean;
}

export default function Offboarding() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ongoingCases, setOngoingCases] = useState<OffboardingCase[]>([]);
  const [offboardingHistory, setOffboardingHistory] = useState<
    OffboardingCase[]
  >([]);
  const [selectedCase, setSelectedCase] = useState<OffboardingCase | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const { toast } = useToast();

  // New offboarding form data
  const [newOffboarding, setNewOffboarding] = useState({
    employeeId: "",
    departureReason: "",
    lastWorkingDay: "",
    noticeDate: "",
    notes: "",
    department: "all",
    search: "",
  });

  useEffect(() => {
    loadData();

    // Add online/offline detection
    const handleOnline = () => {
      setIsOffline(false);
      // Retry loading data when coming back online
      loadData();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check initial connection status
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Try to load employees with retry logic
      let employeesData = [];
      try {
        employeesData = await employeeService.getAllEmployees();
        setEmployees(employeesData);
      } catch (firebaseError) {
        console.warn(
          "Firebase connection failed, using fallback:",
          firebaseError,
        );

        // Check if we have cached employee data
        const cachedEmployees = localStorage.getItem("cachedEmployees");
        if (cachedEmployees) {
          employeesData = JSON.parse(cachedEmployees);
          setEmployees(employeesData);
          toast({
            title: "Using Cached Data",
            description: "Firebase connection failed. Using local data.",
            variant: "destructive",
          });
        } else {
          // Provide mock data as absolute fallback
          employeesData = [];
          setEmployees([]);
          toast({
            title: "Connection Error",
            description:
              "Unable to connect to database. Please check your internet connection.",
            variant: "destructive",
          });
        }
      }

      // Load offboarding cases from localStorage
      const savedCases = localStorage.getItem("offboardingCases");
      if (savedCases) {
        try {
          const cases = JSON.parse(savedCases);
          setOngoingCases(
            cases.filter((c: OffboardingCase) => c.status !== "completed"),
          );
          setOffboardingHistory(
            cases.filter((c: OffboardingCase) => c.status === "completed"),
          );
        } catch (parseError) {
          console.error("Error parsing saved cases:", parseError);
          localStorage.removeItem("offboardingCases");
        }
      }

      // Cache employees for future use
      if (employeesData.length > 0) {
        localStorage.setItem("cachedEmployees", JSON.stringify(employeesData));
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load application data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter employees for selection
  const filteredEmployees = employees.filter((employee) => {
    const matchesDepartment =
      newOffboarding.department === "all" ||
      employee.jobDetails.department === newOffboarding.department;

    const matchesSearch =
      !newOffboarding.search ||
      `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
        .toLowerCase()
        .includes(newOffboarding.search.toLowerCase()) ||
      employee.jobDetails.employeeId
        .toLowerCase()
        .includes(newOffboarding.search.toLowerCase());

    return employee.status === "active" && matchesDepartment && matchesSearch;
  });

  const departments = Array.from(
    new Set(employees.map((emp) => emp.jobDetails.department)),
  ).sort();
  const activeEmployees = employees.filter((emp) => emp.status === "active");

  // Calculate departures in last year (mock data for now)
  const departuresLastYear = offboardingHistory.filter(
    (case_) =>
      new Date(case_.createdAt).getFullYear() === new Date().getFullYear(),
  ).length;

  const handleStartOffboarding = () => {
    if (!newOffboarding.employeeId || !newOffboarding.departureReason) {
      toast({
        title: "Validation Error",
        description: "Please select an employee and departure reason",
        variant: "destructive",
      });
      return;
    }

    const employee = employees.find(
      (emp) => emp.id === newOffboarding.employeeId,
    );
    if (!employee) return;

    const newCase: OffboardingCase = {
      id: Date.now().toString(),
      employee,
      departureReason: newOffboarding.departureReason,
      lastWorkingDay: newOffboarding.lastWorkingDay,
      noticeDate: newOffboarding.noticeDate,
      status: "pending",
      notes: newOffboarding.notes,
      checklist: {
        accessRevoked: false,
        equipmentReturned: false,
        documentsSigned: false,
        knowledgeTransfer: false,
        finalPayCalculated: false,
        benefitsCancelled: false,
        exitInterviewCompleted: false,
        referenceLetter: false,
      },
      exitInterview: {
        overallSatisfaction: "",
        managerRelationship: "",
        primaryReason: "",
        suggestions: "",
        wouldRecommend: "",
        additionalComments: "",
        completed: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedCases = [...ongoingCases, newCase];
    setOngoingCases(updatedCases);

    // Save to localStorage
    const allCases = [...updatedCases, ...offboardingHistory];
    localStorage.setItem("offboardingCases", JSON.stringify(allCases));

    toast({
      title: "Offboarding Started",
      description: `Offboarding process initiated for ${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
    });

    setShowDialog(false);
    setNewOffboarding({
      employeeId: "",
      departureReason: "",
      lastWorkingDay: "",
      noticeDate: "",
      notes: "",
      department: "all",
      search: "",
    });
  };

  const updateChecklist = (caseId: string, item: string, value: boolean) => {
    const updatedCases = ongoingCases.map((case_) => {
      if (case_.id === caseId) {
        const updatedCase = {
          ...case_,
          checklist: { ...case_.checklist, [item]: value },
          updatedAt: new Date(),
        };

        // Update status based on checklist completion
        const checklistItems = Object.values(updatedCase.checklist);
        const completedItems = checklistItems.filter(Boolean).length;

        if (completedItems === checklistItems.length) {
          updatedCase.status = "completed";
        } else if (completedItems > 0) {
          updatedCase.status = "in-progress";
        }

        return updatedCase;
      }
      return case_;
    });

    setOngoingCases(updatedCases.filter((c) => c.status !== "completed"));

    // Move completed cases to history
    const completedCases = updatedCases.filter((c) => c.status === "completed");
    if (completedCases.length > 0) {
      setOffboardingHistory((prev) => [...prev, ...completedCases]);
    }

    // Update selected case if it's the one being modified
    if (selectedCase && selectedCase.id === caseId) {
      setSelectedCase(updatedCases.find((c) => c.id === caseId) || null);
    }

    // Save to localStorage
    const allCases = [
      ...updatedCases.filter((c) => c.status !== "completed"),
      ...offboardingHistory,
      ...completedCases,
    ];
    localStorage.setItem("offboardingCases", JSON.stringify(allCases));
  };

  const updateExitInterview = (
    caseId: string,
    field: string,
    value: string,
  ) => {
    const updatedCases = ongoingCases.map((case_) => {
      if (case_.id === caseId) {
        const updatedCase = {
          ...case_,
          exitInterview: { ...case_.exitInterview, [field]: value },
          updatedAt: new Date(),
        };
        return updatedCase;
      }
      return case_;
    });

    setOngoingCases(updatedCases);

    if (selectedCase && selectedCase.id === caseId) {
      setSelectedCase(updatedCases.find((c) => c.id === caseId) || null);
    }

    // Save to localStorage
    const allCases = [...updatedCases, ...offboardingHistory];
    localStorage.setItem("offboardingCases", JSON.stringify(allCases));
  };

  const saveDraft = () => {
    if (selectedCase) {
      toast({
        title: "Draft Saved",
        description: "Offboarding progress has been saved",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in-progress":
        return "bg-yellow-100 text-yellow-800";
      case "pending":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getProgressPercentage = (checklist: OffboardingChecklist) => {
    const items = Object.values(checklist);
    const completed = items.filter(Boolean).length;
    return Math.round((completed / items.length) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <HotDogStyleNavigation />
        <div className="p-6">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <span className="ml-3">
              {isOffline
                ? "Loading offline data..."
                : "Connecting to database..."}
            </span>
          </div>
          {isOffline && (
            <div className="text-center mt-4">
              <p className="text-sm text-gray-500">
                You appear to be offline. We'll load any cached data available.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <HotDogStyleNavigation />

      <div className="p-6">
        {/* Connection Status Banner */}
        {isOffline && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-700">
                You're currently offline. Some features may not work properly.
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <UserMinus className="h-8 w-8 text-green-400" />
            <div>
              <h1 className="text-3xl font-bold">Employee Offboarding</h1>
              <p className="text-muted-foreground">
                Manage employee departures and exit processes
              </p>
            </div>
          </div>

          {activeEmployees.length > 0 && (
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button>
                  <UserMinus className="mr-2 h-4 w-4" />
                  Start Offboarding Process
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Initiate Employee Offboarding</DialogTitle>
                  <DialogDescription>
                    Start the offboarding process for a departing employee
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Filter by Department</Label>
                      <Select
                        value={newOffboarding.department}
                        onValueChange={(value) =>
                          setNewOffboarding((prev) => ({
                            ...prev,
                            department: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Departments</SelectItem>
                          {departments.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Search Employee</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Name or ID..."
                          value={newOffboarding.search}
                          onChange={(e) =>
                            setNewOffboarding((prev) => ({
                              ...prev,
                              search: e.target.value,
                            }))
                          }
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Select Employee ({filteredEmployees.length} available)
                    </Label>
                    <Select
                      value={newOffboarding.employeeId}
                      onValueChange={(value) =>
                        setNewOffboarding((prev) => ({
                          ...prev,
                          employeeId: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an employee..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredEmployees.map((employee) => (
                          <SelectItem
                            key={employee.id}
                            value={employee.id || ""}
                          >
                            {employee.personalInfo.firstName}{" "}
                            {employee.personalInfo.lastName} -{" "}
                            {employee.jobDetails.department}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Departure Reason</Label>
                    <Select
                      value={newOffboarding.departureReason}
                      onValueChange={(value) =>
                        setNewOffboarding((prev) => ({
                          ...prev,
                          departureReason: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="resignation">Resignation</SelectItem>
                        <SelectItem value="redundancy">Redundancy</SelectItem>
                        <SelectItem value="termination">Termination</SelectItem>
                        <SelectItem value="retirement">Retirement</SelectItem>
                        <SelectItem value="contract-end">
                          Contract End
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Last Working Day</Label>
                      <Input
                        type="date"
                        value={newOffboarding.lastWorkingDay}
                        onChange={(e) =>
                          setNewOffboarding((prev) => ({
                            ...prev,
                            lastWorkingDay: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notice Date</Label>
                      <Input
                        type="date"
                        value={newOffboarding.noticeDate}
                        onChange={(e) =>
                          setNewOffboarding((prev) => ({
                            ...prev,
                            noticeDate: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Additional Notes</Label>
                    <Textarea
                      placeholder="Any special instructions or notes..."
                      value={newOffboarding.notes}
                      onChange={(e) =>
                        setNewOffboarding((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleStartOffboarding}>
                      Start Offboarding
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {employees.length === 0 ? (
          <div className="text-center py-16">
            <UserMinus className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">
              {isOffline ? "Connection Error" : "No Employee Data"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {isOffline
                ? "Unable to connect to the database. Please check your internet connection and try again."
                : "Add employees to your database to manage offboarding processes"}
            </p>
            <div className="flex gap-3 justify-center">
              {isOffline ? (
                <Button onClick={() => loadData()}>
                  <Database className="mr-2 h-4 w-4" />
                  Retry Connection
                </Button>
              ) : (
                <Button onClick={() => (window.location.href = "/staff/add")}>
                  <User className="mr-2 h-4 w-4" />
                  Add Employees First
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Statistics */}
            <div className="grid lg:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Employees
                      </p>
                      <p className="text-2xl font-bold">{employees.length}</p>
                      <p className="text-xs text-blue-600">In database</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Employee Departures
                      </p>
                      <p className="text-2xl font-bold">{departuresLastYear}</p>
                      <p className="text-xs text-orange-600">Last year</p>
                    </div>
                    <History className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Offboarding Cases
                      </p>
                      <p className="text-2xl font-bold">
                        {ongoingCases.length}
                      </p>
                      <p className="text-xs text-green-600">Currently active</p>
                    </div>
                    <Clock className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Offboarding History
                      </p>
                      <p className="text-2xl font-bold">
                        {offboardingHistory.length}
                      </p>
                      <p className="text-xs text-purple-600">Completed cases</p>
                    </div>
                    <Archive className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Ongoing Departures */}
              <Card>
                <CardHeader>
                  <CardTitle>Ongoing Departures</CardTitle>
                  <CardDescription>
                    {ongoingCases.length} employees currently in offboarding
                    process
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ongoingCases.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-sm text-gray-600">
                        No ongoing offboarding cases
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {ongoingCases.map((case_) => (
                        <Card
                          key={case_.id}
                          className={`cursor-pointer transition-colors ${
                            selectedCase?.id === case_.id
                              ? "ring-2 ring-blue-500"
                              : "hover:bg-gray-50"
                          }`}
                          onClick={() => setSelectedCase(case_)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarImage src="/placeholder.svg" />
                                  <AvatarFallback>
                                    {case_.employee.personalInfo.firstName[0]}
                                    {case_.employee.personalInfo.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <h4 className="font-semibold">
                                    {case_.employee.personalInfo.firstName}{" "}
                                    {case_.employee.personalInfo.lastName}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {case_.employee.jobDetails.department} •{" "}
                                    {case_.employee.jobDetails.position}
                                  </p>
                                </div>
                              </div>
                              <Badge className={getStatusColor(case_.status)}>
                                {case_.status.replace("-", " ")}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Progress:</span>
                                <span>
                                  {getProgressPercentage(case_.checklist)}%
                                  completed
                                </span>
                              </div>
                              <Progress
                                value={getProgressPercentage(case_.checklist)}
                                className="h-2"
                              />
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">
                                  Reason: {case_.departureReason}
                                </span>
                                <span className="text-muted-foreground">
                                  Last day: {case_.lastWorkingDay || "TBD"}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Offboarding Checklist */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedCase
                      ? `Offboarding Checklist - ${selectedCase.employee.personalInfo.firstName} ${selectedCase.employee.personalInfo.lastName}`
                      : "Offboarding Checklist"}
                  </CardTitle>
                  <CardDescription>
                    {selectedCase
                      ? "Complete the offboarding process"
                      : "Select an employee to view their checklist"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedCase ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-sm text-gray-600">
                        Select an ongoing departure to view checklist
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Progress Summary */}
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">Overall Progress</span>
                          <span className="text-sm">
                            {getProgressPercentage(selectedCase.checklist)}%
                          </span>
                        </div>
                        <Progress
                          value={getProgressPercentage(selectedCase.checklist)}
                          className="h-3"
                        />
                      </div>

                      {/* Checklist Items */}
                      <div className="space-y-4">
                        {[
                          {
                            id: "accessRevoked",
                            label: "Revoke System Access",
                            icon: <Key className="h-4 w-4" />,
                          },
                          {
                            id: "equipmentReturned",
                            label: "Equipment Return",
                            icon: <Building className="h-4 w-4" />,
                          },
                          {
                            id: "documentsSigned",
                            label: "Exit Documents Signed",
                            icon: <FileText className="h-4 w-4" />,
                          },
                          {
                            id: "knowledgeTransfer",
                            label: "Knowledge Transfer",
                            icon: <Archive className="h-4 w-4" />,
                          },
                          {
                            id: "finalPayCalculated",
                            label: "Final Pay Calculated",
                            icon: <DollarSign className="h-4 w-4" />,
                          },
                          {
                            id: "benefitsCancelled",
                            label: "Benefits Cancelled",
                            icon: <CreditCard className="h-4 w-4" />,
                          },
                          {
                            id: "exitInterviewCompleted",
                            label: "Exit Interview Completed",
                            icon: <Mail className="h-4 w-4" />,
                          },
                          {
                            id: "referenceLetter",
                            label: "Reference Letter Prepared",
                            icon: <Download className="h-4 w-4" />,
                          },
                        ].map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center space-x-3"
                          >
                            <Checkbox
                              checked={
                                selectedCase.checklist[
                                  item.id as keyof OffboardingChecklist
                                ]
                              }
                              onCheckedChange={(checked) =>
                                updateChecklist(
                                  selectedCase.id,
                                  item.id,
                                  checked as boolean,
                                )
                              }
                            />
                            <div className="flex items-center gap-2">
                              {item.icon}
                              <label className="text-sm font-medium">
                                {item.label}
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Exit Interview Section */}
                      <Separator />
                      <div className="space-y-4">
                        <h4 className="font-medium">
                          Exit Interview Questions
                        </h4>

                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-2">
                            <Label>Overall Job Satisfaction</Label>
                            <Select
                              value={
                                selectedCase.exitInterview.overallSatisfaction
                              }
                              onValueChange={(value) =>
                                updateExitInterview(
                                  selectedCase.id,
                                  "overallSatisfaction",
                                  value,
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Rate satisfaction..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="very-satisfied">
                                  Very Satisfied
                                </SelectItem>
                                <SelectItem value="satisfied">
                                  Satisfied
                                </SelectItem>
                                <SelectItem value="neutral">Neutral</SelectItem>
                                <SelectItem value="dissatisfied">
                                  Dissatisfied
                                </SelectItem>
                                <SelectItem value="very-dissatisfied">
                                  Very Dissatisfied
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Manager Relationship</Label>
                            <Select
                              value={
                                selectedCase.exitInterview.managerRelationship
                              }
                              onValueChange={(value) =>
                                updateExitInterview(
                                  selectedCase.id,
                                  "managerRelationship",
                                  value,
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Rate manager relationship..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="excellent">
                                  Excellent
                                </SelectItem>
                                <SelectItem value="good">Good</SelectItem>
                                <SelectItem value="average">Average</SelectItem>
                                <SelectItem value="poor">Poor</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Primary Reason for Leaving</Label>
                            <Textarea
                              placeholder="Please explain..."
                              value={selectedCase.exitInterview.primaryReason}
                              onChange={(e) =>
                                updateExitInterview(
                                  selectedCase.id,
                                  "primaryReason",
                                  e.target.value,
                                )
                              }
                              rows={2}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Would Recommend Company</Label>
                            <Select
                              value={selectedCase.exitInterview.wouldRecommend}
                              onValueChange={(value) =>
                                updateExitInterview(
                                  selectedCase.id,
                                  "wouldRecommend",
                                  value,
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Would you recommend us?" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">
                                  Yes, definitely
                                </SelectItem>
                                <SelectItem value="maybe">Maybe</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Additional Comments</Label>
                            <Textarea
                              placeholder="Any other feedback..."
                              value={
                                selectedCase.exitInterview.additionalComments
                              }
                              onChange={(e) =>
                                updateExitInterview(
                                  selectedCase.id,
                                  "additionalComments",
                                  e.target.value,
                                )
                              }
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={saveDraft}
                          className="flex-1"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save Draft
                        </Button>
                        <Button
                          onClick={() =>
                            updateChecklist(
                              selectedCase.id,
                              "exitInterviewCompleted",
                              true,
                            )
                          }
                          className="flex-1"
                          disabled={
                            getProgressPercentage(selectedCase.checklist) ===
                            100
                          }
                        >
                          Complete Exit Interview
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
