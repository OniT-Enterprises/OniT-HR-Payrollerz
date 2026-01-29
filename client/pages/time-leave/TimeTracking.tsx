import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { useI18n } from "@/i18n/I18nProvider";
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
import { SEO, seoConfig } from "@/components/SEO";

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
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedSite, setSelectedSite] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [entryType, setEntryType] = useState<"daily" | "hourly">("daily");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 20;

  // Simulate initial data loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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

  const activityOptions = [
    { key: "perimeterPatrol", label: t("timeLeave.timeTracking.activities.perimeterPatrol") },
    { key: "accessControl", label: t("timeLeave.timeTracking.activities.accessControl") },
    { key: "visitorScreening", label: t("timeLeave.timeTracking.activities.visitorScreening") },
    { key: "incidentResponse", label: t("timeLeave.timeTracking.activities.incidentResponse") },
    { key: "equipmentCheck", label: t("timeLeave.timeTracking.activities.equipmentCheck") },
    { key: "reportWriting", label: t("timeLeave.timeTracking.activities.reportWriting") },
    { key: "cameraMonitoring", label: t("timeLeave.timeTracking.activities.cameraMonitoring") },
    { key: "alarmResponse", label: t("timeLeave.timeTracking.activities.alarmResponse") },
    { key: "emergencyEvacuation", label: t("timeLeave.timeTracking.activities.emergencyEvacuation") },
    { key: "trafficControl", label: t("timeLeave.timeTracking.activities.trafficControl") },
    { key: "lostFound", label: t("timeLeave.timeTracking.activities.lostFound") },
    { key: "maintenanceCoordination", label: t("timeLeave.timeTracking.activities.maintenanceCoordination") },
  ];

  const equipmentOptions = [
    { key: "radio", label: t("timeLeave.timeTracking.equipment.radio") },
    { key: "flashlight", label: t("timeLeave.timeTracking.equipment.flashlight") },
    { key: "keys", label: t("timeLeave.timeTracking.equipment.keys") },
    { key: "accessCards", label: t("timeLeave.timeTracking.equipment.accessCards") },
    { key: "firstAid", label: t("timeLeave.timeTracking.equipment.firstAid") },
    { key: "fireExtinguisher", label: t("timeLeave.timeTracking.equipment.fireExtinguisher") },
    { key: "aed", label: t("timeLeave.timeTracking.equipment.aed") },
    { key: "cameraSystem", label: t("timeLeave.timeTracking.equipment.cameraSystem") },
    { key: "metalDetector", label: t("timeLeave.timeTracking.equipment.metalDetector") },
    { key: "patrolVehicle", label: t("timeLeave.timeTracking.equipment.patrolVehicle") },
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

  const shiftLabels = {
    day: t("timeLeave.timeTracking.shiftTypes.day"),
    night: t("timeLeave.timeTracking.shiftTypes.night"),
    swing: t("timeLeave.timeTracking.shiftTypes.swing"),
    overtime: t("timeLeave.timeTracking.shiftTypes.overtime"),
  };

  const shiftOptionLabels = {
    day: t("timeLeave.timeTracking.shiftTypes.dayWithTime"),
    swing: t("timeLeave.timeTracking.shiftTypes.swingWithTime"),
    night: t("timeLeave.timeTracking.shiftTypes.nightWithTime"),
    overtime: t("timeLeave.timeTracking.shiftTypes.overtime"),
  };

  const activityLabelMap: Record<string, string> = {
    "Perimeter patrol": t("timeLeave.timeTracking.activities.perimeterPatrol"),
    "Access control": t("timeLeave.timeTracking.activities.accessControl"),
    "Visitor screening": t("timeLeave.timeTracking.activities.visitorScreening"),
    "Incident response": t("timeLeave.timeTracking.activities.incidentResponse"),
    "Equipment check": t("timeLeave.timeTracking.activities.equipmentCheck"),
    "Report writing": t("timeLeave.timeTracking.activities.reportWriting"),
    "Camera monitoring": t("timeLeave.timeTracking.activities.cameraMonitoring"),
    "Alarm response": t("timeLeave.timeTracking.activities.alarmResponse"),
    "Emergency evacuation": t("timeLeave.timeTracking.activities.emergencyEvacuation"),
    "Traffic control": t("timeLeave.timeTracking.activities.trafficControl"),
    "Lost & found": t("timeLeave.timeTracking.activities.lostFound"),
    "Building maintenance coordination": t("timeLeave.timeTracking.activities.maintenanceCoordination"),
    "Building monitoring": t("timeLeave.timeTracking.activities.buildingMonitoring"),
    "Gate security": t("timeLeave.timeTracking.activities.gateSecurity"),
    "Vehicle inspection": t("timeLeave.timeTracking.activities.vehicleInspection"),
    Patrol: t("timeLeave.timeTracking.activities.patrol"),
  };

  const getActivityLabel = (activity: string) =>
    activityLabelMap[activity] || activity;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800">
            {t("timeLeave.timeTracking.status.approved")}
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            {t("timeLeave.timeTracking.status.pending")}
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800">
            {t("timeLeave.timeTracking.status.rejected")}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRiskLevelBadge = (level: string) => {
    switch (level) {
      case "high":
        return (
          <Badge className="bg-red-100 text-red-800">
            {t("timeLeave.timeTracking.risk.high")}
          </Badge>
        );
      case "medium":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            {t("timeLeave.timeTracking.risk.medium")}
          </Badge>
        );
      case "low":
        return (
          <Badge className="bg-green-100 text-green-800">
            {t("timeLeave.timeTracking.risk.low")}
          </Badge>
        );
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
        title: t("timeLeave.timeTracking.toast.validationTitle"),
        description: t("timeLeave.timeTracking.toast.validationDesc"),
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

      toast({
        title: t("timeLeave.timeTracking.toast.successTitle"),
        description: t("timeLeave.timeTracking.toast.successDesc"),
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
        title: t("timeLeave.timeTracking.toast.errorTitle"),
        description: t("timeLeave.timeTracking.toast.errorDesc"),
        variant: "destructive",
      });
    }
  };

  const handleFilter = () => {
    toast({
      title: t("timeLeave.timeTracking.toast.filterTitle"),
      description: t("timeLeave.timeTracking.toast.filterDesc", {
        startDate,
        endDate,
      }),
    });
  };

  const handleExportCSV = () => {
    const csvData = timeEntries.map((entry) => ({
      [t("timeLeave.timeTracking.csv.badgeNumber")]: entry.badgeNumber,
      [t("timeLeave.timeTracking.csv.employeeName")]: entry.employeeName,
      [t("timeLeave.timeTracking.csv.date")]: entry.date,
      [t("timeLeave.timeTracking.csv.shiftType")]:
        shiftLabels[entry.shiftType] || entry.shiftType,
      [t("timeLeave.timeTracking.csv.site")]: entry.siteName,
      [t("timeLeave.timeTracking.csv.client")]:
        clients.find((c) => c.id === entry.clientId)?.name || "",
      [t("timeLeave.timeTracking.csv.clockIn")]: entry.clockIn,
      [t("timeLeave.timeTracking.csv.clockOut")]: entry.clockOut,
      [t("timeLeave.timeTracking.csv.totalHours")]: entry.totalHours,
      [t("timeLeave.timeTracking.csv.activities")]: entry.activities
        .map(getActivityLabel)
        .join(", "),
      [t("timeLeave.timeTracking.csv.incidents")]: entry.incidents,
      [t("timeLeave.timeTracking.csv.status")]:
        entry.status === "approved"
          ? t("timeLeave.timeTracking.status.approved")
          : entry.status === "pending"
            ? t("timeLeave.timeTracking.status.pending")
            : entry.status === "rejected"
              ? t("timeLeave.timeTracking.status.rejected")
              : entry.status,
    }));

    toast({
      title: t("timeLeave.timeTracking.toast.exportTitle"),
      description: t("timeLeave.timeTracking.toast.exportDesc"),
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
              {t("timeLeave.timeTracking.stats.guardsOnDuty")}
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">127</div>
            <p className="text-xs text-muted-foreground">
              {t("timeLeave.timeTracking.stats.currentlyActive")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("timeLeave.timeTracking.stats.sitesCovered")}
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground">
              {t("timeLeave.timeTracking.stats.activeLocations")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("timeLeave.timeTracking.stats.pendingApprovals")}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground">
              {t("timeLeave.timeTracking.stats.awaitingReview")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("timeLeave.timeTracking.stats.totalHours")}
            </CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">956</div>
            <p className="text-xs text-muted-foreground">
              {t("timeLeave.timeTracking.stats.thisWeek")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle>{t("timeLeave.timeTracking.recent.title")}</CardTitle>
          <CardDescription>
            {t("timeLeave.timeTracking.recent.description")}
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
                        {shiftLabels[entry.shiftType] || entry.shiftType}
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
                        <span>{t("timeLeave.timeTracking.recent.incident")}</span>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
        <AutoBreadcrumb className="mb-6" />
          <div className="max-w-7xl mx-auto">
            {/* Stats skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <Skeleton className="h-4 w-28 mb-2" />
                    <Skeleton className="h-8 w-20 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* Tabs skeleton */}
            <Skeleton className="h-10 w-full max-w-md mb-6" />
            {/* Content skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-72" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                          <Skeleton className="h-5 w-12 rounded-full" />
                        </div>
                        <Skeleton className="h-3 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <div className="text-right space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.timeTracking} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-cyan-50 dark:bg-cyan-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />

          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/25">
              <Clock className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("timeLeave.timeTracking.title")}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t("timeLeave.timeTracking.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="daily" className="mt-6">
              <div className="flex flex-col space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 -mt-14">
                  <Card className="border-border/50 shadow-lg animate-fade-up stagger-1">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {t("timeLeave.timeTracking.stats.guardsOnDuty")}
                          </p>
                          <p className="text-2xl font-bold">127</p>
                          <p className="text-xs text-muted-foreground">
                            {t("timeLeave.timeTracking.stats.currentlyActive")}
                          </p>
                        </div>
                        <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl">
                          <Shield className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50 shadow-lg animate-fade-up stagger-2">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {t("timeLeave.timeTracking.stats.sitesCovered")}
                          </p>
                          <p className="text-2xl font-bold">45</p>
                          <p className="text-xs text-muted-foreground">
                            {t("timeLeave.timeTracking.stats.activeLocations")}
                          </p>
                        </div>
                        <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl">
                          <MapPin className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50 shadow-lg animate-fade-up stagger-3">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {t("timeLeave.timeTracking.stats.pendingApprovals")}
                          </p>
                          <p className="text-2xl font-bold">23</p>
                          <p className="text-xs text-muted-foreground">
                            {t("timeLeave.timeTracking.stats.awaitingReview")}
                          </p>
                        </div>
                        <div className="p-2.5 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl">
                          <Clock className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50 shadow-lg animate-fade-up stagger-4">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {t("timeLeave.timeTracking.stats.totalHours")}
                          </p>
                          <p className="text-2xl font-bold">956</p>
                          <p className="text-xs text-muted-foreground">
                            {t("timeLeave.timeTracking.stats.thisWeek")}
                          </p>
                        </div>
                        <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                          <Timer className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabs positioned after stats */}
                <TabsList className="flex flex-row flex-wrap gap-[361px] mt-4 mx-auto p-1 bg-muted rounded-lg w-full">
                  <TabsTrigger
                    value="daily"
                    className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    {t("timeLeave.timeTracking.tabs.daily")}
                  </TabsTrigger>
                  <TabsTrigger value="entries" className="ml-auto">
                    {t("timeLeave.timeTracking.tabs.entries")}
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="ml-auto">
                    {t("timeLeave.timeTracking.tabs.reports")}
                  </TabsTrigger>
                </TabsList>

                {/* Recent Entries Card */}
                <Card className="mt-6 border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                      {t("timeLeave.timeTracking.recent.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("timeLeave.timeTracking.recent.description")}
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
                                  {shiftLabels[entry.shiftType] ||
                                    entry.shiftType}
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
                                  <span>
                                    {t("timeLeave.timeTracking.recent.incident")}
                                  </span>
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
              <Card className="mb-6 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    {t("timeLeave.timeTracking.filters.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                    <div>
                      <Label htmlFor="start-date">
                        {t("timeLeave.timeTracking.filters.startDate")}
                      </Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date">
                        {t("timeLeave.timeTracking.filters.endDate")}
                      </Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="employee-filter">
                        {t("timeLeave.timeTracking.filters.guard")}
                      </Label>
                      <Select
                        value={selectedEmployee}
                        onValueChange={setSelectedEmployee}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("timeLeave.timeTracking.filters.allGuards")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t("timeLeave.timeTracking.filters.allGuards")}
                          </SelectItem>
                          {securityGuards.map((guard) => (
                            <SelectItem key={guard.id} value={guard.id}>
                              {guard.name} ({guard.badgeNumber})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="site-filter">
                        {t("timeLeave.timeTracking.filters.site")}
                      </Label>
                      <Select
                        value={selectedSite}
                        onValueChange={setSelectedSite}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("timeLeave.timeTracking.filters.allSites")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t("timeLeave.timeTracking.filters.allSites")}
                          </SelectItem>
                          {securitySites.map((site) => (
                            <SelectItem key={site.id} value={site.id}>
                              {site.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="client-filter">
                        {t("timeLeave.timeTracking.filters.client")}
                      </Label>
                      <Select
                        value={selectedClient}
                        onValueChange={setSelectedClient}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("timeLeave.timeTracking.filters.allClients")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t("timeLeave.timeTracking.filters.allClients")}
                          </SelectItem>
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
                        {t("timeLeave.timeTracking.filters.apply")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Time Entries Table */}
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                        {t("timeLeave.timeTracking.entries.title")}
                      </CardTitle>
                      <CardDescription>
                        {t("timeLeave.timeTracking.entries.showing", {
                          shown: paginatedEntries.length,
                          total: timeEntries.length,
                        })}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleExportCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        {t("timeLeave.timeTracking.entries.export")}
                      </Button>
                      <Dialog
                        open={showAddDialog}
                        onOpenChange={setShowAddDialog}
                      >
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            {t("timeLeave.timeTracking.entries.logActivity")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>
                              {t("timeLeave.timeTracking.dialog.title")}
                            </DialogTitle>
                            <DialogDescription>
                              {t("timeLeave.timeTracking.dialog.description")}
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="employee">
                                  {t("timeLeave.timeTracking.dialog.guard")}
                                </Label>
                                <Select
                                  value={formData.employee}
                                  onValueChange={(value) =>
                                    handleInputChange("employee", value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={t("timeLeave.timeTracking.dialog.guardPlaceholder")}
                                    />
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
                                <Label htmlFor="entry-date">
                                  {t("timeLeave.timeTracking.dialog.date")}
                                </Label>
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
                                <Label htmlFor="shift-type">
                                  {t("timeLeave.timeTracking.dialog.shiftType")}
                                </Label>
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
                                      {shiftOptionLabels.day}
                                    </SelectItem>
                                    <SelectItem value="swing">
                                      {shiftOptionLabels.swing}
                                    </SelectItem>
                                    <SelectItem value="night">
                                      {shiftOptionLabels.night}
                                    </SelectItem>
                                    <SelectItem value="overtime">
                                      {shiftOptionLabels.overtime}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="site">
                                  {t("timeLeave.timeTracking.dialog.site")}
                                </Label>
                                <Select
                                  value={formData.site}
                                  onValueChange={(value) =>
                                    handleInputChange("site", value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={t("timeLeave.timeTracking.dialog.sitePlaceholder")}
                                    />
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
                                <Label htmlFor="clock-in">
                                  {t("timeLeave.timeTracking.dialog.clockIn")}
                                </Label>
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
                                <Label htmlFor="clock-out">
                                  {t("timeLeave.timeTracking.dialog.clockOut")}
                                </Label>
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
                                  {t("timeLeave.timeTracking.dialog.break")}
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
                                {t("timeLeave.timeTracking.dialog.totalHours")}:{" "}
                                {calculateTotalHours(
                                  formData.clockIn,
                                  formData.clockOut,
                                  formData.breakMinutes,
                                )}
                              </div>
                            )}

                            <div>
                              <Label htmlFor="activities">
                                {t("timeLeave.timeTracking.dialog.activities")}
                              </Label>
                              <div className="grid grid-cols-3 gap-2 mt-2">
                                {activityOptions.map((activity) => (
                                  <label
                                    key={activity.key}
                                    className="flex items-center space-x-2 text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={formData.activities.includes(activity.label)}
                                      onChange={(e) => {
                                        const activities = e.target.checked
                                          ? [...formData.activities, activity.label]
                                          : formData.activities.filter(
                                              (a) => a !== activity.label,
                                            );
                                        handleInputChange(
                                          "activities",
                                          activities,
                                        );
                                      }}
                                      className="rounded"
                                    />
                                    <span>{activity.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div>
                              <Label htmlFor="equipment">
                                {t("timeLeave.timeTracking.dialog.equipment")}
                              </Label>
                              <div className="grid grid-cols-3 gap-2 mt-2">
                                {equipmentOptions.map((equipment) => (
                                  <label
                                    key={equipment.key}
                                    className="flex items-center space-x-2 text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={formData.equipmentChecked.includes(
                                        equipment.label,
                                      )}
                                      onChange={(e) => {
                                        const equipmentChecked = e.target
                                          .checked
                                          ? [
                                              ...formData.equipmentChecked,
                                              equipment.label,
                                            ]
                                          : formData.equipmentChecked.filter(
                                              (eq) => eq !== equipment.label,
                                            );
                                        handleInputChange(
                                          "equipmentChecked",
                                          equipmentChecked,
                                        );
                                      }}
                                      className="rounded"
                                    />
                                    <span>{equipment.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div>
                              <Label htmlFor="incidents">
                                {t("timeLeave.timeTracking.dialog.incidents")}
                              </Label>
                              <Textarea
                                id="incidents"
                                value={formData.incidents}
                                onChange={(e) =>
                                  handleInputChange("incidents", e.target.value)
                                }
                                placeholder={t("timeLeave.timeTracking.dialog.incidentsPlaceholder")}
                                rows={3}
                              />
                            </div>

                            <div>
                              <Label htmlFor="notes">
                                {t("timeLeave.timeTracking.dialog.notes")}
                              </Label>
                              <Textarea
                                id="notes"
                                value={formData.notes}
                                onChange={(e) =>
                                  handleInputChange("notes", e.target.value)
                                }
                                placeholder={t("timeLeave.timeTracking.dialog.notesPlaceholder")}
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
                                {t("timeLeave.timeTracking.dialog.cancel")}
                              </Button>
                              <Button type="submit" className="flex-1">
                                {t("timeLeave.timeTracking.dialog.submit")}
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
                        <TableHead>
                          {t("timeLeave.timeTracking.table.guard")}
                        </TableHead>
                        <TableHead>
                          {t("timeLeave.timeTracking.table.dateShift")}
                        </TableHead>
                        <TableHead>
                          {t("timeLeave.timeTracking.table.site")}
                        </TableHead>
                        <TableHead>
                          {t("timeLeave.timeTracking.table.hours")}
                        </TableHead>
                        <TableHead>
                          {t("timeLeave.timeTracking.table.activities")}
                        </TableHead>
                        <TableHead>
                          {t("timeLeave.timeTracking.table.incidents")}
                        </TableHead>
                        <TableHead>
                          {t("timeLeave.timeTracking.table.status")}
                        </TableHead>
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
                                  {shiftLabels[entry.shiftType] ||
                                    entry.shiftType}
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
                                  {entry.activities
                                    .slice(0, 2)
                                    .map(getActivityLabel)
                                    .join(", ")}
                                  {entry.activities.length > 2 && "..."}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {entry.incidents ? (
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                                  <span className="text-sm">
                                    {t("timeLeave.timeTracking.table.incidentYes")}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400">
                                  {t("timeLeave.timeTracking.table.incidentNone")}
                                </span>
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
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                      {t("timeLeave.timeTracking.reports.exportTitle")}
                    </CardTitle>
                    <CardDescription>
                      {t("timeLeave.timeTracking.reports.exportDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      onClick={handleExportCSV}
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {t("timeLeave.timeTracking.reports.exportTimesheet")}
                    </Button>
                    <Button
                      onClick={() =>
                        toast({
                          title: t("timeLeave.timeTracking.toast.reportTitle"),
                          description: t("timeLeave.timeTracking.toast.reportClientBilling"),
                        })
                      }
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <Building className="h-4 w-4 mr-2" />
                      {t("timeLeave.timeTracking.reports.clientBilling")}
                    </Button>
                    <Button
                      onClick={() =>
                        toast({
                          title: t("timeLeave.timeTracking.toast.reportTitle"),
                          description: t("timeLeave.timeTracking.toast.reportIncident"),
                        })
                      }
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      {t("timeLeave.timeTracking.reports.incidentSummary")}
                    </Button>
                    <Button
                      onClick={() =>
                        toast({
                          title: t("timeLeave.timeTracking.toast.reportTitle"),
                          description: t("timeLeave.timeTracking.toast.reportPerformance"),
                        })
                      }
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <User className="h-4 w-4 mr-2" />
                      {t("timeLeave.timeTracking.reports.guardPerformance")}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>
                      {t("timeLeave.timeTracking.reports.coverageTitle")}
                    </CardTitle>
                    <CardDescription>
                      {t("timeLeave.timeTracking.reports.coverageDescription")}
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
                                {t("timeLeave.timeTracking.reports.coverageSites", {
                                  count: clientSites.length,
                                })}{" "}
                                •{" "}
                                {client.billingCode}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">
                                {t("timeLeave.timeTracking.reports.coverageGuards", {
                                  count: activeGuards,
                                })}
                              </p>
                              <Badge className="bg-green-100 text-green-800">
                                {t("timeLeave.timeTracking.reports.coverageStatus")}
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
