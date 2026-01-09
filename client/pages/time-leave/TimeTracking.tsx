import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import {
  Calendar,
  Filter,
  Plus,
  Download,
  Clock,
  MapPin,
  Shield,
  User,
  Building,
  AlertTriangle,
  CheckCircle,
  Timer,
  Users,
  FileText,
  Camera,
  Phone,
} from "lucide-react";

// Types for security company operations
interface SecuritySite {
  id: string;
  name: string;
  address: string;
  clientId: string;
  type: "office" | "retail" | "industrial" | "residential" | "event";
  riskLevel: "low" | "medium" | "high";
}

interface Client {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  billingCode: string;
}

interface SecurityGuard {
  id: string;
  name: string;
  badgeNumber: string;
  shift: "day" | "night" | "swing";
  supervisor: string;
  certifications: string[];
}

interface TimeEntry {
  id: number;
  employeeId: string;
  employeeName: string;
  badgeNumber: string;
  date: string;
  shiftType: "day" | "night" | "swing" | "overtime";
  siteId: string;
  siteName: string;
  clientId: string;
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
  totalHours: number;
  activities: string[];
  incidents: string;
  equipmentChecked: string[];
  notes: string;
  status: "pending" | "approved" | "rejected";
  supervisorId?: string;
  approvedAt?: string;
}

export default function TimeTracking() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedSite, setSelectedSite] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [entryType, setEntryType] = useState<"daily" | "hourly">("daily");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [formData, setFormData] = useState({
    employee: "",
    date: "",
    shiftType: "day" as const,
    site: "",
    clockIn: "",
    clockOut: "",
    breakMinutes: 30,
    activities: [] as string[],
    incidents: "",
    equipmentChecked: [] as string[],
    notes: "",
  });

  // Mock data for security company
  const securityGuards: SecurityGuard[] = [
    {
      id: "1",
      name: "John Martinez",
      badgeNumber: "SEC001",
      shift: "day",
      supervisor: "SUP001",
      certifications: ["CPR", "First Aid", "Security License"],
    },
    {
      id: "2",
      name: "Sarah Williams",
      badgeNumber: "SEC002",
      shift: "night",
      supervisor: "SUP001",
      certifications: ["CPR", "Security License"],
    },
    {
      id: "3",
      name: "Mike Rodriguez",
      badgeNumber: "SEC003",
      shift: "swing",
      supervisor: "SUP002",
      certifications: ["CPR", "First Aid", "Security License", "Armed Guard"],
    },
    {
      id: "4",
      name: "Lisa Chen",
      badgeNumber: "SEC004",
      shift: "day",
      supervisor: "SUP001",
      certifications: ["CPR", "Security License"],
    },
    {
      id: "5",
      name: "David Johnson",
      badgeNumber: "SEC005",
      shift: "night",
      supervisor: "SUP002",
      certifications: ["CPR", "First Aid", "Security License", "Armed Guard"],
    },
  ];

  const clients: Client[] = [
    {
      id: "CLI001",
      name: "Metro Shopping Center",
      contactPerson: "Tom Wilson",
      phone: "(555) 123-4567",
      billingCode: "MSC-2024",
    },
    {
      id: "CLI002",
      name: "Downtown Office Complex",
      contactPerson: "Jennifer Davis",
      phone: "(555) 234-5678",
      billingCode: "DOC-2024",
    },
    {
      id: "CLI003",
      name: "Riverside Industrial Park",
      contactPerson: "Mark Thompson",
      phone: "(555) 345-6789",
      billingCode: "RIP-2024",
    },
    {
      id: "CLI004",
      name: "Sunset Residential Community",
      contactPerson: "Anna Garcia",
      phone: "(555) 456-7890",
      billingCode: "SRC-2024",
    },
  ];

  const securitySites: SecuritySite[] = [
    {
      id: "SITE001",
      name: "Metro Mall - Main Entrance",
      address: "123 Commerce St",
      clientId: "CLI001",
      type: "retail",
      riskLevel: "medium",
    },
    {
      id: "SITE002",
      name: "Metro Mall - Parking Garage",
      address: "123 Commerce St",
      clientId: "CLI001",
      type: "retail",
      riskLevel: "high",
    },
    {
      id: "SITE003",
      name: "Downtown Tower A - Lobby",
      address: "456 Business Ave",
      clientId: "CLI002",
      type: "office",
      riskLevel: "low",
    },
    {
      id: "SITE004",
      name: "Downtown Tower B - Security Desk",
      address: "458 Business Ave",
      clientId: "CLI002",
      type: "office",
      riskLevel: "low",
    },
    {
      id: "SITE005",
      name: "Industrial Gate - North",
      address: "789 Industrial Blvd",
      clientId: "CLI003",
      type: "industrial",
      riskLevel: "high",
    },
    {
      id: "SITE006",
      name: "Residential Patrol Route 1",
      address: "321 Sunset Dr",
      clientId: "CLI004",
      type: "residential",
      riskLevel: "medium",
    },
  ];

  const commonActivities = [
    "Perimeter patrol",
    "Access control",
    "Visitor screening",
    "Incident response",
    "Equipment check",
    "Report writing",
    "Camera monitoring",
    "Alarm response",
    "Emergency evacuation",
    "Traffic control",
    "Lost & found",
    "Building maintenance coordination",
  ];

  const equipmentList = [
    "Radio",
    "Flashlight",
    "Keys",
    "Access cards",
    "First aid kit",
    "Fire extinguisher",
    "AED",
    "Security camera system",
    "Metal detector",
    "Patrol vehicle",
  ];

  const timeEntries: TimeEntry[] = [
    {
      id: 1,
      employeeId: "1",
      employeeName: "John Martinez",
      badgeNumber: "SEC001",
      date: "2024-11-15",
      shiftType: "day",
      siteId: "SITE001",
      siteName: "Metro Mall - Main Entrance",
      clientId: "CLI001",
      clockIn: "08:00",
      clockOut: "16:00",
      breakMinutes: 30,
      totalHours: 7.5,
      activities: ["Perimeter patrol", "Access control", "Visitor screening"],
      incidents:
        "Minor altercation between customers at 14:30, resolved peacefully",
      equipmentChecked: ["Radio", "Flashlight", "Keys", "First aid kit"],
      notes:
        "Busy day with high foot traffic. All equipment functioning normally.",
      status: "approved",
      supervisorId: "SUP001",
      approvedAt: "2024-11-15T17:00:00Z",
    },
    {
      id: 2,
      employeeId: "2",
      employeeName: "Sarah Williams",
      badgeNumber: "SEC002",
      date: "2024-11-15",
      shiftType: "night",
      siteId: "SITE003",
      siteName: "Downtown Tower A - Lobby",
      clientId: "CLI002",
      clockIn: "22:00",
      clockOut: "06:00",
      breakMinutes: 30,
      totalHours: 7.5,
      activities: ["Building monitoring", "Access control", "Report writing"],
      incidents:
        "False alarm at 02:15 - building maintenance issue triggered sensor",
      equipmentChecked: [
        "Radio",
        "Flashlight",
        "Access cards",
        "Security camera system",
      ],
      notes: "Quiet night shift. Completed hourly building checks.",
      status: "pending",
    },
    {
      id: 3,
      employeeId: "3",
      employeeName: "Mike Rodriguez",
      badgeNumber: "SEC003",
      date: "2024-11-14",
      shiftType: "swing",
      siteId: "SITE005",
      siteName: "Industrial Gate - North",
      clientId: "CLI003",
      clockIn: "16:00",
      clockOut: "00:00",
      breakMinutes: 60,
      totalHours: 7,
      activities: [
        "Gate security",
        "Vehicle inspection",
        "Patrol",
        "Incident response",
      ],
      incidents:
        "Attempted unauthorized entry at 19:45. Individual detained and released to local authorities.",
      equipmentChecked: [
        "Radio",
        "Flashlight",
        "Keys",
        "Metal detector",
        "Patrol vehicle",
      ],
      notes:
        "High security alert maintained throughout shift. Additional patrols conducted.",
      status: "approved",
      supervisorId: "SUP002",
      approvedAt: "2024-11-14T08:00:00Z",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRiskLevelBadge = (level: string) => {
    switch (level) {
      case "high":
        return <Badge className="bg-red-100 text-red-800">High Risk</Badge>;
      case "medium":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">Medium Risk</Badge>
        );
      case "low":
        return <Badge className="bg-green-100 text-green-800">Low Risk</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  };

  const calculateTotalHours = (
    clockIn: string,
    clockOut: string,
    breakMinutes: number,
  ) => {
    if (!clockIn || !clockOut) return 0;

    let start = new Date(`2000-01-01 ${clockIn}`);
    let end = new Date(`2000-01-01 ${clockOut}`);

    // Handle overnight shifts
    if (end <= start) {
      end = new Date(`2000-01-02 ${clockOut}`);
    }

    const diff = end.getTime() - start.getTime();
    const hours = diff / (1000 * 60 * 60);
    const totalHours = hours - breakMinutes / 60;

    return Math.round(totalHours * 100) / 100;
  };

  const handleInputChange = (
    field: string,
    value: string | string[] | number,
  ) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto-calculate total hours when times change
      if (
        field === "clockIn" ||
        field === "clockOut" ||
        field === "breakMinutes"
      ) {
        const totalHours = calculateTotalHours(
          field === "clockIn" ? (value as string) : updated.clockIn,
          field === "clockOut" ? (value as string) : updated.clockOut,
          field === "breakMinutes" ? (value as number) : updated.breakMinutes,
        );
        // Store total hours if needed for display
      }

      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.employee ||
      !formData.date ||
      !formData.site ||
      !formData.clockIn ||
      !formData.clockOut
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      const totalHours = calculateTotalHours(
        formData.clockIn,
        formData.clockOut,
        formData.breakMinutes,
      );

      console.log("Creating security time entry:", {
        ...formData,
        totalHours,
        entryType,
      });

      toast({
        title: "Success",
        description:
          "Time entry logged successfully. Awaiting supervisor approval.",
      });

      setFormData({
        employee: "",
        date: "",
        shiftType: "day",
        site: "",
        clockIn: "",
        clockOut: "",
        breakMinutes: 30,
        activities: [],
        incidents: "",
        equipmentChecked: [],
        notes: "",
      });
      setShowAddDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log time entry. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFilter = () => {
    console.log("Filtering time entries:", {
      startDate,
      endDate,
      selectedEmployee: selectedEmployee === "all" ? "" : selectedEmployee,
      selectedSite: selectedSite === "all" ? "" : selectedSite,
      selectedClient: selectedClient === "all" ? "" : selectedClient,
    });
    toast({
      title: "Filter Applied",
      description: `Filtering entries from ${startDate} to ${endDate}`,
    });
  };

  const handleExportCSV = () => {
    const csvData = timeEntries.map((entry) => ({
      "Badge Number": entry.badgeNumber,
      "Employee Name": entry.employeeName,
      Date: entry.date,
      "Shift Type": entry.shiftType,
      Site: entry.siteName,
      Client: clients.find((c) => c.id === entry.clientId)?.name || "",
      "Clock In": entry.clockIn,
      "Clock Out": entry.clockOut,
      "Total Hours": entry.totalHours,
      Activities: entry.activities.join(", "),
      Incidents: entry.incidents,
      Status: entry.status,
    }));

    console.log("Exporting CSV data:", csvData);
    toast({
      title: "Export Started",
      description: "Security timesheet CSV will be downloaded shortly.",
    });
  };

  // Pagination
  const totalPages = Math.ceil(timeEntries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEntries = timeEntries.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  // Removed renderDailyView function - content moved inline
  const renderDailyView_unused = () => (
    <div className="flex flex-col space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Guards on Duty
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">127</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sites Covered</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground">Active locations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Approvals
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">956</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity Logs</CardTitle>
          <CardDescription>
            Latest security guard time entries and daily activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {timeEntries.slice(0, 3).map((entry) => {
              const site = securitySites.find((s) => s.id === entry.siteId);
              const client = clients.find((c) => c.id === entry.clientId);
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{entry.employeeName}</p>
                      <Badge variant="outline">{entry.badgeNumber}</Badge>
                      <Badge className="bg-blue-100 text-blue-800">
                        {entry.shiftType}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {site?.name} • {client?.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {entry.clockIn} - {entry.clockOut} ({entry.totalHours}h)
                    </p>
                    {entry.incidents && (
                      <div className="flex items-center gap-1 text-sm text-orange-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Incident reported</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm text-gray-500">{entry.date}</p>
                    {getStatusBadge(entry.status)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div />

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="daily" className="mt-6">
              <div className="flex flex-col space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Guards on Duty
                      </CardTitle>
                      <Shield className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">127</div>
                      <p className="text-xs text-muted-foreground">
                        Currently active
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Sites Covered
                      </CardTitle>
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">45</div>
                      <p className="text-xs text-muted-foreground">
                        Active locations
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Pending Approvals
                      </CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">23</div>
                      <p className="text-xs text-muted-foreground">
                        Awaiting review
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Hours
                      </CardTitle>
                      <Timer className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">956</div>
                      <p className="text-xs text-muted-foreground">This week</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabs positioned after stats */}
                <TabsList className="flex flex-row flex-wrap gap-[361px] mt-4 mx-auto p-1 bg-muted rounded-lg w-full">
                  <TabsTrigger
                    value="daily"
                    className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    Daily Overview
                  </TabsTrigger>
                  <TabsTrigger value="entries" className="ml-auto">
                    Time Entries
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="ml-auto">
                    Reports & Export
                  </TabsTrigger>
                </TabsList>

                {/* Recent Entries Card */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Recent Activity Logs</CardTitle>
                    <CardDescription>
                      Latest security guard time entries and daily activities
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {timeEntries.slice(0, 3).map((entry) => {
                        const site = securitySites.find(
                          (s) => s.id === entry.siteId,
                        );
                        const client = clients.find(
                          (c) => c.id === entry.clientId,
                        );
                        return (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">
                                  {entry.employeeName}
                                </p>
                                <Badge variant="outline">
                                  {entry.badgeNumber}
                                </Badge>
                                <Badge className="bg-blue-100 text-blue-800">
                                  {entry.shiftType}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600">
                                {site?.name} • {client?.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {entry.clockIn} - {entry.clockOut} (
                                {entry.totalHours}h)
                              </p>
                              {entry.incidents && (
                                <div className="flex items-center gap-1 text-sm text-orange-600">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span>Incident reported</span>
                                </div>
                              )}
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-sm text-gray-500">
                                {entry.date}
                              </p>
                              {getStatusBadge(entry.status)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="entries" className="mt-6">
              {/* Filters */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                    <div>
                      <Label htmlFor="start-date">Start Date</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date">End Date</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="employee-filter">Security Guard</Label>
                      <Select
                        value={selectedEmployee}
                        onValueChange={setSelectedEmployee}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All guards" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All guards</SelectItem>
                          {securityGuards.map((guard) => (
                            <SelectItem key={guard.id} value={guard.id}>
                              {guard.name} ({guard.badgeNumber})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="site-filter">Site</Label>
                      <Select
                        value={selectedSite}
                        onValueChange={setSelectedSite}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All sites" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All sites</SelectItem>
                          {securitySites.map((site) => (
                            <SelectItem key={site.id} value={site.id}>
                              {site.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="client-filter">Client</Label>
                      <Select
                        value={selectedClient}
                        onValueChange={setSelectedClient}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All clients" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All clients</SelectItem>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Button onClick={handleFilter} className="w-full">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Time Entries Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Time Entries
                      </CardTitle>
                      <CardDescription>
                        Showing {paginatedEntries.length} of{" "}
                        {timeEntries.length} entries
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleExportCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                      <Dialog
                        open={showAddDialog}
                        onOpenChange={setShowAddDialog}
                      >
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Log Activity
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Log Security Activity</DialogTitle>
                            <DialogDescription>
                              Record daily activities, incidents, and equipment
                              checks
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="employee">
                                  Security Guard *
                                </Label>
                                <Select
                                  value={formData.employee}
                                  onValueChange={(value) =>
                                    handleInputChange("employee", value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select guard" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {securityGuards.map((guard) => (
                                      <SelectItem
                                        key={guard.id}
                                        value={guard.id}
                                      >
                                        {guard.name} ({guard.badgeNumber})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="entry-date">Date *</Label>
                                <Input
                                  id="entry-date"
                                  type="date"
                                  value={formData.date}
                                  onChange={(e) =>
                                    handleInputChange("date", e.target.value)
                                  }
                                  required
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="shift-type">Shift Type *</Label>
                                <Select
                                  value={formData.shiftType}
                                  onValueChange={(value) =>
                                    handleInputChange("shiftType", value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="day">
                                      Day Shift (8:00-16:00)
                                    </SelectItem>
                                    <SelectItem value="swing">
                                      Swing Shift (16:00-00:00)
                                    </SelectItem>
                                    <SelectItem value="night">
                                      Night Shift (22:00-06:00)
                                    </SelectItem>
                                    <SelectItem value="overtime">
                                      Overtime
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="site">Site Assignment *</Label>
                                <Select
                                  value={formData.site}
                                  onValueChange={(value) =>
                                    handleInputChange("site", value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select site" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {securitySites.map((site) => (
                                      <SelectItem key={site.id} value={site.id}>
                                        {site.name} -{" "}
                                        {getRiskLevelBadge(site.riskLevel)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <Label htmlFor="clock-in">Clock In *</Label>
                                <Input
                                  id="clock-in"
                                  type="time"
                                  value={formData.clockIn}
                                  onChange={(e) =>
                                    handleInputChange("clockIn", e.target.value)
                                  }
                                  required
                                />
                              </div>
                              <div>
                                <Label htmlFor="clock-out">Clock Out *</Label>
                                <Input
                                  id="clock-out"
                                  type="time"
                                  value={formData.clockOut}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "clockOut",
                                      e.target.value,
                                    )
                                  }
                                  required
                                />
                              </div>
                              <div>
                                <Label htmlFor="break-minutes">
                                  Break (minutes)
                                </Label>
                                <Input
                                  id="break-minutes"
                                  type="number"
                                  value={formData.breakMinutes}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "breakMinutes",
                                      Number(e.target.value),
                                    )
                                  }
                                  min="0"
                                  max="120"
                                />
                              </div>
                            </div>

                            {formData.clockIn && formData.clockOut && (
                              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                                Total Hours:{" "}
                                {calculateTotalHours(
                                  formData.clockIn,
                                  formData.clockOut,
                                  formData.breakMinutes,
                                )}
                              </div>
                            )}

                            <div>
                              <Label htmlFor="activities">
                                Activities Performed *
                              </Label>
                              <div className="grid grid-cols-3 gap-2 mt-2">
                                {commonActivities.map((activity) => (
                                  <label
                                    key={activity}
                                    className="flex items-center space-x-2 text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={formData.activities.includes(
                                        activity,
                                      )}
                                      onChange={(e) => {
                                        const activities = e.target.checked
                                          ? [...formData.activities, activity]
                                          : formData.activities.filter(
                                              (a) => a !== activity,
                                            );
                                        handleInputChange(
                                          "activities",
                                          activities,
                                        );
                                      }}
                                      className="rounded"
                                    />
                                    <span>{activity}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div>
                              <Label htmlFor="equipment">
                                Equipment Checked
                              </Label>
                              <div className="grid grid-cols-3 gap-2 mt-2">
                                {equipmentList.map((equipment) => (
                                  <label
                                    key={equipment}
                                    className="flex items-center space-x-2 text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={formData.equipmentChecked.includes(
                                        equipment,
                                      )}
                                      onChange={(e) => {
                                        const equipmentChecked = e.target
                                          .checked
                                          ? [
                                              ...formData.equipmentChecked,
                                              equipment,
                                            ]
                                          : formData.equipmentChecked.filter(
                                              (eq) => eq !== equipment,
                                            );
                                        handleInputChange(
                                          "equipmentChecked",
                                          equipmentChecked,
                                        );
                                      }}
                                      className="rounded"
                                    />
                                    <span>{equipment}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div>
                              <Label htmlFor="incidents">
                                Incidents/Observations
                              </Label>
                              <Textarea
                                id="incidents"
                                value={formData.incidents}
                                onChange={(e) =>
                                  handleInputChange("incidents", e.target.value)
                                }
                                placeholder="Describe any incidents, unusual observations, or security concerns..."
                                rows={3}
                              />
                            </div>

                            <div>
                              <Label htmlFor="notes">Additional Notes</Label>
                              <Textarea
                                id="notes"
                                value={formData.notes}
                                onChange={(e) =>
                                  handleInputChange("notes", e.target.value)
                                }
                                placeholder="Any additional notes about the shift..."
                                rows={2}
                              />
                            </div>

                            <div className="flex gap-2 pt-4">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowAddDialog(false)}
                                className="flex-1"
                              >
                                Cancel
                              </Button>
                              <Button type="submit" className="flex-1">
                                Submit Entry
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Guard</TableHead>
                        <TableHead>Date/Shift</TableHead>
                        <TableHead>Site</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Activities</TableHead>
                        <TableHead>Incidents</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEntries.map((entry) => {
                        const site = securitySites.find(
                          (s) => s.id === entry.siteId,
                        );
                        const client = clients.find(
                          (c) => c.id === entry.clientId,
                        );
                        return (
                          <TableRow key={entry.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {entry.employeeName}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {entry.badgeNumber}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{entry.date}</p>
                                <Badge className="bg-blue-100 text-blue-800 text-xs">
                                  {entry.shiftType}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">
                                  {site?.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {client?.name}
                                </p>
                                {site && getRiskLevelBadge(site.riskLevel)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {entry.totalHours}h
                                </p>
                                <p className="text-sm text-gray-500">
                                  {entry.clockIn} - {entry.clockOut}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-32">
                                <p className="text-sm truncate">
                                  {entry.activities.slice(0, 2).join(", ")}
                                  {entry.activities.length > 2 && "..."}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {entry.incidents ? (
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                                  <span className="text-sm">Yes</span>
                                </div>
                              ) : (
                                <span className="text-gray-400">None</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(entry.status)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() =>
                                setCurrentPage(Math.max(1, currentPage - 1))
                              }
                              className={
                                currentPage === 1
                                  ? "pointer-events-none opacity-50"
                                  : ""
                              }
                            />
                          </PaginationItem>
                          {[...Array(totalPages)].map((_, i) => (
                            <PaginationItem key={i + 1}>
                              <PaginationLink
                                onClick={() => setCurrentPage(i + 1)}
                                isActive={currentPage === i + 1}
                              >
                                {i + 1}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <PaginationNext
                              onClick={() =>
                                setCurrentPage(
                                  Math.min(totalPages, currentPage + 1),
                                )
                              }
                              className={
                                currentPage === totalPages
                                  ? "pointer-events-none opacity-50"
                                  : ""
                              }
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Export Options
                    </CardTitle>
                    <CardDescription>
                      Generate reports for payroll, billing, and compliance
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      onClick={handleExportCSV}
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Timesheet CSV
                    </Button>
                    <Button
                      onClick={() =>
                        toast({
                          title: "Report Generated",
                          description:
                            "Client billing report created successfully.",
                        })
                      }
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <Building className="h-4 w-4 mr-2" />
                      Generate Client Billing Report
                    </Button>
                    <Button
                      onClick={() =>
                        toast({
                          title: "Report Generated",
                          description:
                            "Incident summary report created successfully.",
                        })
                      }
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Export Incident Summary
                    </Button>
                    <Button
                      onClick={() =>
                        toast({
                          title: "Report Generated",
                          description:
                            "Guard performance report created successfully.",
                        })
                      }
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <User className="h-4 w-4 mr-2" />
                      Guard Performance Report
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Site Coverage Summary</CardTitle>
                    <CardDescription>
                      Current security coverage across all locations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {clients.map((client) => {
                        const clientSites = securitySites.filter(
                          (s) => s.clientId === client.id,
                        );
                        const activeGuards = Math.floor(Math.random() * 8) + 1; // Mock data
                        return (
                          <div
                            key={client.id}
                            className="flex items-center justify-between p-3 border rounded"
                          >
                            <div>
                              <p className="font-medium">{client.name}</p>
                              <p className="text-sm text-gray-500">
                                {clientSites.length} sites •{" "}
                                {client.billingCode}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">
                                {activeGuards} guards
                              </p>
                              <Badge className="bg-green-100 text-green-800">
                                Active
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
