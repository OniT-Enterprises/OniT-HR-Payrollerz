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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Calendar,
  Plus,
  Filter,
  Download,
  Clock,
  CheckCircle,
  Trash2,
  Copy,
  RefreshCw,
  AlertTriangle,
  Users,
  FileText,
  Settings,
  Save,
  Send,
  BarChart3,
} from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import { toDateStringTL, formatDateTL } from "@/lib/dateUtils";

// Types for enhanced shift scheduling
interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  skills: string[];
  availability: {
    [key: string]: { start: string; end: string }[]; // day of week -> time slots
  };
  maxHoursPerWeek: number;
  hourlyRate: number;
  isActive: boolean;
}

interface Department {
  id: string;
  name: string;
  manager: string;
  color: string;
  minStaffing: number;
  positions: Position[];
}

interface Position {
  id: string;
  title: string;
  requiredSkills: string[];
  minExperience: number;
  hourlyRate: { min: number; max: number };
}

interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  status: "draft" | "published" | "confirmed" | "cancelled";
  location: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  lastModified: string;
}

interface ShiftTemplate {
  id: string;
  name: string;
  department: string;
  shifts: Omit<
    Shift,
    | "id"
    | "date"
    | "employeeId"
    | "employeeName"
    | "status"
    | "createdBy"
    | "createdAt"
    | "lastModified"
  >[];
}

export default function ShiftScheduling() {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState("schedule");
  const [selectedWeek, setSelectedWeek] = useState(getWeekString(new Date()));
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [loading, setLoading] = useState(true);

  // Simulate initial data loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const [formData, setFormData] = useState({
    employee: "",
    position: "",
    date: "",
    startTime: "",
    endTime: "",
    department: "",
    location: "",
    notes: "",
  });

  const [_templateData, _setTemplateData] = useState({
    name: "",
    department: "",
  });

  const _dateLocale = locale === "tet" ? "pt-PT" : "en-US";

  const departmentLabels: Record<string, string> = {
    Operations: t("timeLeave.shiftScheduling.data.departments.operations"),
    "Customer Service": t("timeLeave.shiftScheduling.data.departments.customerService"),
    Sales: t("timeLeave.shiftScheduling.data.departments.sales"),
  };

  const positionLabels: Record<string, string> = {
    "Operations Manager": t("timeLeave.shiftScheduling.data.positions.operationsManager"),
    "Team Lead": t("timeLeave.shiftScheduling.data.positions.teamLead"),
    Specialist: t("timeLeave.shiftScheduling.data.positions.specialist"),
    "Customer Service Manager":
      t("timeLeave.shiftScheduling.data.positions.customerServiceManager"),
    "Senior Representative": t("timeLeave.shiftScheduling.data.positions.seniorRepresentative"),
    Representative: t("timeLeave.shiftScheduling.data.positions.representative"),
    "Sales Manager": t("timeLeave.shiftScheduling.data.positions.salesManager"),
    "Senior Sales Rep": t("timeLeave.shiftScheduling.data.positions.seniorSalesRep"),
    "Sales Associate": t("timeLeave.shiftScheduling.data.positions.salesAssociate"),
  };

  const skillLabels: Record<string, string> = {
    Leadership: t("timeLeave.shiftScheduling.data.skills.leadership"),
    Operations: t("timeLeave.shiftScheduling.data.skills.operations"),
    Communication: t("timeLeave.shiftScheduling.data.skills.communication"),
    "Technical Skills": t("timeLeave.shiftScheduling.data.skills.technicalSkills"),
    "Customer Service": t("timeLeave.shiftScheduling.data.skills.customerService"),
    Sales: t("timeLeave.shiftScheduling.data.skills.sales"),
    "Project Management": t("timeLeave.shiftScheduling.data.skills.projectManagement"),
    Negotiation: t("timeLeave.shiftScheduling.data.skills.negotiation"),
    "Problem Solving": t("timeLeave.shiftScheduling.data.skills.problemSolving"),
    Analysis: t("timeLeave.shiftScheduling.data.skills.analysis"),
    "Customer Relations": t("timeLeave.shiftScheduling.data.skills.customerRelations"),
  };

  const locationLabels: Record<string, string> = {
    "Main Office - Floor 1": t("timeLeave.shiftScheduling.data.locations.mainOfficeFloor1"),
    "Main Office - Floor 2": t("timeLeave.shiftScheduling.data.locations.mainOfficeFloor2"),
    "Customer Service Center": t("timeLeave.shiftScheduling.data.locations.customerServiceCenter"),
    "Warehouse A": t("timeLeave.shiftScheduling.data.locations.warehouseA"),
    "Warehouse B": t("timeLeave.shiftScheduling.data.locations.warehouseB"),
    "Remote Work": t("timeLeave.shiftScheduling.data.locations.remoteWork"),
    "Client Site A": t("timeLeave.shiftScheduling.data.locations.clientSiteA"),
    "Client Site B": t("timeLeave.shiftScheduling.data.locations.clientSiteB"),
  };

  const noteLabels: Record<string, string> = {
    "Team meeting at 10 AM": t("timeLeave.shiftScheduling.data.notes.teamMeeting"),
    "Training new representatives": t("timeLeave.shiftScheduling.data.notes.trainingNewReps"),
    "Client presentation at 2 PM": t("timeLeave.shiftScheduling.data.notes.clientPresentation"),
    "Inventory check": t("timeLeave.shiftScheduling.data.notes.inventoryCheck"),
    "Client meeting": t("timeLeave.shiftScheduling.data.notes.clientMeeting"),
    "Evening shift coverage": t("timeLeave.shiftScheduling.data.notes.eveningShift"),
    "Data analysis project": t("timeLeave.shiftScheduling.data.notes.dataAnalysis"),
  };

  const templateLabels: Record<string, string> = {
    "Standard Operations Week": t("timeLeave.shiftScheduling.data.templates.standardOperationsWeek"),
  };

  const getDepartmentLabel = (department: string) =>
    departmentLabels[department] || department;
  const getPositionLabel = (position: string) => positionLabels[position] || position;
  const getSkillLabel = (skill: string) => skillLabels[skill] || skill;
  const getLocationLabel = (location: string) => locationLabels[location] || location;
  const getNoteLabel = (note: string) => noteLabels[note] || note;
  const getTemplateLabel = (name: string) => templateLabels[name] || name;

  // Helper function to get week string
  function getWeekString(date: Date) {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay()); // Start on Sunday
    return toDateStringTL(startOfWeek);
  }

  // Mock data - in production, these would come from Firebase
  const departments: Department[] = [
    {
      id: "1",
      name: "Operations",
      manager: "John Smith",
      color: "#3B82F6",
      minStaffing: 5,
      positions: [
        {
          id: "p1",
          title: "Operations Manager",
          requiredSkills: ["Leadership", "Operations"],
          minExperience: 3,
          hourlyRate: { min: 25, max: 35 },
        },
        {
          id: "p2",
          title: "Team Lead",
          requiredSkills: ["Leadership", "Communication"],
          minExperience: 2,
          hourlyRate: { min: 20, max: 28 },
        },
        {
          id: "p3",
          title: "Specialist",
          requiredSkills: ["Technical Skills"],
          minExperience: 1,
          hourlyRate: { min: 18, max: 25 },
        },
      ],
    },
    {
      id: "2",
      name: "Customer Service",
      manager: "Sarah Johnson",
      color: "#10B981",
      minStaffing: 8,
      positions: [
        {
          id: "p4",
          title: "Customer Service Manager",
          requiredSkills: ["Customer Service", "Leadership"],
          minExperience: 3,
          hourlyRate: { min: 22, max: 30 },
        },
        {
          id: "p5",
          title: "Senior Representative",
          requiredSkills: ["Customer Service", "Communication"],
          minExperience: 2,
          hourlyRate: { min: 16, max: 22 },
        },
        {
          id: "p6",
          title: "Representative",
          requiredSkills: ["Customer Service"],
          minExperience: 0,
          hourlyRate: { min: 14, max: 18 },
        },
      ],
    },
    {
      id: "3",
      name: "Sales",
      manager: "Mike Davis",
      color: "#F59E0B",
      minStaffing: 6,
      positions: [
        {
          id: "p7",
          title: "Sales Manager",
          requiredSkills: ["Sales", "Leadership"],
          minExperience: 3,
          hourlyRate: { min: 28, max: 40 },
        },
        {
          id: "p8",
          title: "Senior Sales Rep",
          requiredSkills: ["Sales", "Communication"],
          minExperience: 2,
          hourlyRate: { min: 18, max: 25 },
        },
        {
          id: "p9",
          title: "Sales Associate",
          requiredSkills: ["Sales"],
          minExperience: 0,
          hourlyRate: { min: 15, max: 20 },
        },
      ],
    },
  ];

  const locations = [
    "Main Office - Floor 1",
    "Main Office - Floor 2",
    "Customer Service Center",
    "Warehouse A",
    "Warehouse B",
    "Remote Work",
    "Client Site A",
    "Client Site B",
  ];

  const employees: Employee[] = [
    {
      id: "1",
      name: "John Smith",
      email: "john.smith@company.com",
      phone: "(555) 123-4567",
      department: "Operations",
      position: "Operations Manager",
      skills: ["Leadership", "Operations", "Project Management"],
      availability: {
        Monday: [{ start: "08:00", end: "18:00" }],
        Tuesday: [{ start: "08:00", end: "18:00" }],
        Wednesday: [{ start: "08:00", end: "18:00" }],
        Thursday: [{ start: "08:00", end: "18:00" }],
        Friday: [{ start: "08:00", end: "17:00" }],
      },
      maxHoursPerWeek: 45,
      hourlyRate: 32,
      isActive: true,
    },
    {
      id: "2",
      name: "Sarah Johnson",
      email: "sarah.johnson@company.com",
      phone: "(555) 234-5678",
      department: "Customer Service",
      position: "Customer Service Manager",
      skills: ["Customer Service", "Leadership", "Communication"],
      availability: {
        Monday: [{ start: "09:00", end: "17:00" }],
        Tuesday: [{ start: "09:00", end: "17:00" }],
        Wednesday: [{ start: "09:00", end: "17:00" }],
        Thursday: [{ start: "09:00", end: "17:00" }],
        Friday: [{ start: "09:00", end: "16:00" }],
      },
      maxHoursPerWeek: 40,
      hourlyRate: 26,
      isActive: true,
    },
    {
      id: "3",
      name: "Mike Davis",
      email: "mike.davis@company.com",
      phone: "(555) 345-6789",
      department: "Sales",
      position: "Sales Manager",
      skills: ["Sales", "Leadership", "Communication", "Negotiation"],
      availability: {
        Monday: [{ start: "08:00", end: "18:00" }],
        Tuesday: [{ start: "08:00", end: "18:00" }],
        Wednesday: [{ start: "08:00", end: "18:00" }],
        Thursday: [{ start: "08:00", end: "18:00" }],
        Friday: [{ start: "08:00", end: "17:00" }],
        Saturday: [{ start: "10:00", end: "14:00" }],
      },
      maxHoursPerWeek: 50,
      hourlyRate: 35,
      isActive: true,
    },
    {
      id: "4",
      name: "Emily Brown",
      email: "emily.brown@company.com",
      phone: "(555) 456-7890",
      department: "Customer Service",
      position: "Senior Representative",
      skills: ["Customer Service", "Communication", "Problem Solving"],
      availability: {
        Monday: [{ start: "10:00", end: "18:00" }],
        Tuesday: [{ start: "10:00", end: "18:00" }],
        Wednesday: [{ start: "10:00", end: "18:00" }],
        Thursday: [{ start: "10:00", end: "18:00" }],
        Friday: [{ start: "10:00", end: "18:00" }],
      },
      maxHoursPerWeek: 40,
      hourlyRate: 20,
      isActive: true,
    },
    {
      id: "5",
      name: "Alex Wilson",
      email: "alex.wilson@company.com",
      phone: "(555) 567-8901",
      department: "Operations",
      position: "Team Lead",
      skills: ["Leadership", "Technical Skills", "Communication"],
      availability: {
        Monday: [{ start: "07:00", end: "15:00" }],
        Tuesday: [{ start: "07:00", end: "15:00" }],
        Wednesday: [{ start: "07:00", end: "15:00" }],
        Thursday: [{ start: "07:00", end: "15:00" }],
        Friday: [{ start: "07:00", end: "15:00" }],
      },
      maxHoursPerWeek: 40,
      hourlyRate: 24,
      isActive: true,
    },
    {
      id: "6",
      name: "Lisa Chen",
      email: "lisa.chen@company.com",
      phone: "(555) 678-9012",
      department: "Sales",
      position: "Senior Sales Rep",
      skills: ["Sales", "Communication", "Customer Relations"],
      availability: {
        Tuesday: [{ start: "09:00", end: "17:00" }],
        Wednesday: [{ start: "09:00", end: "17:00" }],
        Thursday: [{ start: "09:00", end: "17:00" }],
        Friday: [{ start: "09:00", end: "17:00" }],
        Saturday: [{ start: "09:00", end: "17:00" }],
      },
      maxHoursPerWeek: 40,
      hourlyRate: 22,
      isActive: true,
    },
    {
      id: "7",
      name: "David Rodriguez",
      email: "david.rodriguez@company.com",
      phone: "(555) 789-0123",
      department: "Customer Service",
      position: "Representative",
      skills: ["Customer Service", "Communication"],
      availability: {
        Monday: [{ start: "14:00", end: "22:00" }],
        Tuesday: [{ start: "14:00", end: "22:00" }],
        Wednesday: [{ start: "14:00", end: "22:00" }],
        Thursday: [{ start: "14:00", end: "22:00" }],
        Friday: [{ start: "14:00", end: "22:00" }],
      },
      maxHoursPerWeek: 40,
      hourlyRate: 16,
      isActive: true,
    },
    {
      id: "8",
      name: "Anna Garcia",
      email: "anna.garcia@company.com",
      phone: "(555) 890-1234",
      department: "Operations",
      position: "Specialist",
      skills: ["Technical Skills", "Analysis"],
      availability: {
        Monday: [{ start: "09:00", end: "17:00" }],
        Tuesday: [{ start: "09:00", end: "17:00" }],
        Thursday: [{ start: "09:00", end: "17:00" }],
        Friday: [{ start: "09:00", end: "17:00" }],
        Saturday: [{ start: "08:00", end: "12:00" }],
      },
      maxHoursPerWeek: 36,
      hourlyRate: 21,
      isActive: true,
    },
  ];

  const shifts: Shift[] = [
    {
      id: "1",
      employeeId: "1",
      employeeName: "John Smith",
      department: "Operations",
      position: "Operations Manager",
      date: "2024-11-18",
      startTime: "08:00",
      endTime: "17:00",
      hours: 9,
      status: "published",
      location: "Main Office - Floor 1",
      notes: "Team meeting at 10 AM",
      createdBy: "admin",
      createdAt: "2024-11-15T09:00:00Z",
      lastModified: "2024-11-15T09:00:00Z",
    },
    {
      id: "2",
      employeeId: "2",
      employeeName: "Sarah Johnson",
      department: "Customer Service",
      position: "Customer Service Manager",
      date: "2024-11-18",
      startTime: "09:00",
      endTime: "17:00",
      hours: 8,
      status: "published",
      location: "Customer Service Center",
      notes: "Training new representatives",
      createdBy: "admin",
      createdAt: "2024-11-15T09:00:00Z",
      lastModified: "2024-11-15T09:00:00Z",
    },
    {
      id: "3",
      employeeId: "3",
      employeeName: "Mike Davis",
      department: "Sales",
      position: "Sales Manager",
      date: "2024-11-18",
      startTime: "08:00",
      endTime: "17:00",
      hours: 9,
      status: "confirmed",
      location: "Main Office - Floor 2",
      notes: "Client presentation at 2 PM",
      createdBy: "admin",
      createdAt: "2024-11-15T09:00:00Z",
      lastModified: "2024-11-15T09:00:00Z",
    },
    {
      id: "4",
      employeeId: "4",
      employeeName: "Emily Brown",
      department: "Customer Service",
      position: "Senior Representative",
      date: "2024-11-18",
      startTime: "10:00",
      endTime: "18:00",
      hours: 8,
      status: "published",
      location: "Customer Service Center",
      notes: "",
      createdBy: "admin",
      createdAt: "2024-11-15T09:00:00Z",
      lastModified: "2024-11-15T09:00:00Z",
    },
    {
      id: "5",
      employeeId: "5",
      employeeName: "Alex Wilson",
      department: "Operations",
      position: "Team Lead",
      date: "2024-11-18",
      startTime: "07:00",
      endTime: "15:00",
      hours: 8,
      status: "draft",
      location: "Warehouse A",
      notes: "Inventory check",
      createdBy: "admin",
      createdAt: "2024-11-15T09:00:00Z",
      lastModified: "2024-11-15T09:00:00Z",
    },
    {
      id: "6",
      employeeId: "6",
      employeeName: "Lisa Chen",
      department: "Sales",
      position: "Senior Sales Rep",
      date: "2024-11-19",
      startTime: "09:00",
      endTime: "17:00",
      hours: 8,
      status: "published",
      location: "Client Site A",
      notes: "Client meeting",
      createdBy: "admin",
      createdAt: "2024-11-15T09:00:00Z",
      lastModified: "2024-11-15T09:00:00Z",
    },
    {
      id: "7",
      employeeId: "7",
      employeeName: "David Rodriguez",
      department: "Customer Service",
      position: "Representative",
      date: "2024-11-19",
      startTime: "14:00",
      endTime: "22:00",
      hours: 8,
      status: "published",
      location: "Customer Service Center",
      notes: "Evening shift coverage",
      createdBy: "admin",
      createdAt: "2024-11-15T09:00:00Z",
      lastModified: "2024-11-15T09:00:00Z",
    },
    {
      id: "8",
      employeeId: "8",
      employeeName: "Anna Garcia",
      department: "Operations",
      position: "Specialist",
      date: "2024-11-20",
      startTime: "09:00",
      endTime: "17:00",
      hours: 8,
      status: "draft",
      location: "Main Office - Floor 1",
      notes: "Data analysis project",
      createdBy: "admin",
      createdAt: "2024-11-15T09:00:00Z",
      lastModified: "2024-11-15T09:00:00Z",
    },
  ];

  const shiftTemplates: ShiftTemplate[] = [
    {
      id: "1",
      name: "Standard Operations Week",
      department: "Operations",
      shifts: [
        {
          department: "Operations",
          position: "Operations Manager",
          startTime: "08:00",
          endTime: "17:00",
          hours: 9,
          location: "Main Office - Floor 1",
          notes: "",
        },
        {
          department: "Operations",
          position: "Team Lead",
          startTime: "07:00",
          endTime: "15:00",
          hours: 8,
          location: "Warehouse A",
          notes: "",
        },
      ],
    },
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      employee: "",
      position: "",
      date: "",
      startTime: "",
      endTime: "",
      department: "",
      location: "",
      notes: "",
    });
  };

  const calculateHours = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return 0;
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    const diff = end.getTime() - start.getTime();
    return Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.employee ||
      !formData.position ||
      !formData.date ||
      !formData.startTime ||
      !formData.endTime ||
      !formData.department ||
      !formData.location
    ) {
      toast({
        title: t("timeLeave.shiftScheduling.toast.validationTitle"),
        description: t("timeLeave.shiftScheduling.toast.validationDesc"),
        variant: "destructive",
      });
      return;
    }

    const _employee = employees.find((e) => e.id === formData.employee);
    const _hours = calculateHours(formData.startTime, formData.endTime);

    try {
      toast({
        title: t("timeLeave.shiftScheduling.toast.successTitle"),
        description: t("timeLeave.shiftScheduling.toast.createSuccessDesc"),
      });

      resetForm();
      setShowCreateDialog(false);
    } catch {
      toast({
        title: t("timeLeave.shiftScheduling.toast.errorTitle"),
        description: t("timeLeave.shiftScheduling.toast.createErrorDesc"),
        variant: "destructive",
      });
    }
  };

  const handleEditShift = (shift: Shift) => {
    setSelectedShift(shift);
    setFormData({
      employee: shift.employeeId,
      position: shift.position,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      department: shift.department,
      location: shift.location,
      notes: shift.notes,
    });
    setShowEditDialog(true);
  };

  const handleUpdateShift = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      toast({
        title: t("timeLeave.shiftScheduling.toast.successTitle"),
        description: t("timeLeave.shiftScheduling.toast.updateSuccessDesc"),
      });

      resetForm();
      setShowEditDialog(false);
      setSelectedShift(null);
    } catch {
      toast({
        title: t("timeLeave.shiftScheduling.toast.errorTitle"),
        description: t("timeLeave.shiftScheduling.toast.updateErrorDesc"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteShift = async (_shiftId: string) => {
    try {
      toast({
        title: t("timeLeave.shiftScheduling.toast.successTitle"),
        description: t("timeLeave.shiftScheduling.toast.deleteSuccessDesc"),
      });
    } catch {
      toast({
        title: t("timeLeave.shiftScheduling.toast.errorTitle"),
        description: t("timeLeave.shiftScheduling.toast.deleteErrorDesc"),
        variant: "destructive",
      });
    }
  };

  const handleLoad = () => {
    toast({
      title: t("timeLeave.shiftScheduling.toast.scheduleLoadedTitle"),
      description: t("timeLeave.shiftScheduling.toast.scheduleLoadedDesc", {
        week: selectedWeek,
      }),
    });
  };

  const handlePublishSchedule = () => {
    const weekShifts = getWeekShifts();
    const draftShifts = weekShifts.filter((shift) => shift.status === "draft");

    toast({
      title: t("timeLeave.shiftScheduling.toast.schedulePublishedTitle"),
      description: t("timeLeave.shiftScheduling.toast.schedulePublishedDesc", {
        count: draftShifts.length,
      }),
    });
  };

  const handleExportPDF = () => {
    toast({
      title: t("timeLeave.shiftScheduling.toast.exportTitle"),
      description: t("timeLeave.shiftScheduling.toast.exportDesc"),
    });
  };

  const handleCopyWeek = () => {
    const weekShifts = getWeekShifts();
    toast({
      title: t("timeLeave.shiftScheduling.toast.copyTitle"),
      description: t("timeLeave.shiftScheduling.toast.copyDesc", {
        count: weekShifts.length,
      }),
    });
  };

  const handleApplyTemplate = (template: ShiftTemplate) => {
    toast({
      title: t("timeLeave.shiftScheduling.toast.templateTitle"),
      description: t("timeLeave.shiftScheduling.toast.templateDesc", {
        name: getTemplateLabel(template.name),
      }),
    });
    setShowTemplateDialog(false);
  };

  const getWeekShifts = () => {
    const weekStart = new Date(selectedWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    return shifts.filter((shift) => {
      const shiftDate = new Date(shift.date);
      const matchesWeek = shiftDate >= weekStart && shiftDate <= weekEnd;
      const matchesDepartment =
        !selectedDepartment ||
        selectedDepartment === "all" ||
        shift.department === selectedDepartment;
      const matchesLocation =
        !selectedLocation ||
        selectedLocation === "all" ||
        shift.location === selectedLocation;
      return matchesWeek && matchesDepartment && matchesLocation;
    });
  };

  const getDayShifts = (dayOffset: number) => {
    const weekStart = new Date(selectedWeek);
    const targetDate = new Date(weekStart);
    targetDate.setDate(weekStart.getDate() + dayOffset);
    const dateString = toDateStringTL(targetDate);

    return getWeekShifts().filter((shift) => shift.date === dateString);
  };

  const getDayName = (dayOffset: number) => {
    const weekStart = new Date(selectedWeek);
    const targetDate = new Date(weekStart);
    targetDate.setDate(weekStart.getDate() + dayOffset);
    return formatDateTL(targetDate, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: Shift["status"]) => {
    switch (status) {
      case "draft":
        return (
          <Badge className="bg-gray-100 text-gray-800">
            {t("timeLeave.shiftScheduling.status.draft")}
          </Badge>
        );
      case "published":
        return (
          <Badge className="bg-blue-100 text-blue-800">
            {t("timeLeave.shiftScheduling.status.published")}
          </Badge>
        );
      case "confirmed":
        return (
          <Badge className="bg-green-100 text-green-800">
            {t("timeLeave.shiftScheduling.status.confirmed")}
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-100 text-red-800">
            {t("timeLeave.shiftScheduling.status.cancelled")}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDepartmentColor = (departmentName: string) => {
    const dept = departments.find((d) => d.name === departmentName);
    return dept?.color || "#6B7280";
  };

  const getScheduleStats = () => {
    const weekShifts = getWeekShifts();
    const totalHours = weekShifts.reduce((sum, shift) => sum + shift.hours, 0);
    const staffCount = new Set(weekShifts.map((shift) => shift.employeeId))
      .size;
    const publishedCount = weekShifts.filter(
      (shift) => shift.status === "published",
    ).length;
    const draftCount = weekShifts.filter(
      (shift) => shift.status === "draft",
    ).length;
    const confirmedCount = weekShifts.filter(
      (shift) => shift.status === "confirmed",
    ).length;

    return {
      totalShifts: weekShifts.length,
      totalHours,
      staffCount,
      publishedCount,
      draftCount,
      confirmedCount,
    };
  };

  const getEmployeeWeeklyHours = (employeeId: string) => {
    const weekShifts = getWeekShifts();
    return weekShifts
      .filter((shift) => shift.employeeId === employeeId)
      .reduce((sum, shift) => sum + shift.hours, 0);
  };

  const stats = getScheduleStats();

  const renderScheduleView = () => (
    <div className="space-y-6">
      {/* Schedule Summary & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/50 shadow-lg animate-fade-up stagger-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("timeLeave.shiftScheduling.summary.totalShifts")}
                </p>
                <p className="text-2xl font-bold">{stats.totalShifts}</p>
              </div>
              <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-lg animate-fade-up stagger-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("timeLeave.shiftScheduling.summary.totalHours")}
                </p>
                <p className="text-2xl font-bold">
                  {t("timeLeave.shiftScheduling.summary.totalHoursValue", {
                    hours: stats.totalHours,
                  })}
                </p>
              </div>
              <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-lg animate-fade-up stagger-3">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("timeLeave.shiftScheduling.summary.staffScheduled")}
                </p>
                <p className="text-2xl font-bold">{stats.staffCount}</p>
              </div>
              <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-lg animate-fade-up stagger-4">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("timeLeave.shiftScheduling.summary.published")}
                </p>
                <p className="text-2xl font-bold">{stats.publishedCount}</p>
              </div>
              <div className="p-2.5 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handlePublishSchedule}
          disabled={stats.draftCount === 0}
        >
          <Send className="h-4 w-4 mr-2" />
          {t("timeLeave.shiftScheduling.actions.publishSchedule", {
            count: stats.draftCount,
          })}
        </Button>
        <Button variant="outline" onClick={handleExportPDF}>
          <Download className="h-4 w-4 mr-2" />
          {t("timeLeave.shiftScheduling.actions.exportPdf")}
        </Button>
        <Button variant="outline" onClick={handleCopyWeek}>
          <Copy className="h-4 w-4 mr-2" />
          {t("timeLeave.shiftScheduling.actions.copyWeek")}
        </Button>
        <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              {t("timeLeave.shiftScheduling.actions.applyTemplate")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("timeLeave.shiftScheduling.template.title")}</DialogTitle>
              <DialogDescription>
                {t("timeLeave.shiftScheduling.template.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {shiftTemplates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                >
                  <CardContent
                    className="pt-4"
                    onClick={() => handleApplyTemplate(template)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">
                          {getTemplateLabel(template.name)}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {getDepartmentLabel(template.department)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t("timeLeave.shiftScheduling.template.shiftCount", {
                            count: template.shifts.length,
                          })}
                        </p>
                      </div>
                      <Button size="sm">
                        {t("timeLeave.shiftScheduling.actions.apply")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Calendar Grid */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                {t("timeLeave.shiftScheduling.calendar.title")}
              </CardTitle>
              <CardDescription>
                {t("timeLeave.shiftScheduling.calendar.weekOf", {
                  start: getDayName(0),
                  end: getDayName(6),
                })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("week")}
              >
                {t("timeLeave.shiftScheduling.calendar.weekView")}
              </Button>
              <Button
                variant={viewMode === "day" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("day")}
              >
                {t("timeLeave.shiftScheduling.calendar.dayView")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-4">
            {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
              const dayShifts = getDayShifts(dayOffset);
              const dayHours = dayShifts.reduce(
                (sum, shift) => sum + shift.hours,
                0,
              );
              return (
                <div
                  key={dayOffset}
                  className="border rounded-lg p-3 min-h-[200px]"
                >
                  <div className="font-medium text-sm mb-3 text-center border-b pb-2">
                    <div>{getDayName(dayOffset)}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {t("timeLeave.shiftScheduling.calendar.daySummary", {
                        count: dayShifts.length,
                        hours: dayHours,
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {dayShifts.map((shift) => (
                      <div
                        key={shift.id}
                        className="p-2 rounded text-xs cursor-pointer transition-colors border"
                        style={{
                          backgroundColor: `${getDepartmentColor(shift.department)}15`,
                          borderColor: `${getDepartmentColor(shift.department)}40`,
                        }}
                        onClick={() => handleEditShift(shift)}
                      >
                        <div className="font-medium truncate">
                          {shift.employeeName}
                        </div>
                        <div className="text-gray-600 truncate">
                          {getPositionLabel(shift.position)}
                        </div>
                        <div className="text-gray-500">
                          {shift.startTime} - {shift.endTime}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <Badge variant="outline" className="text-xs">
                            {getLocationLabel(shift.location).split(" - ")[0]}
                          </Badge>
                          {getStatusBadge(shift.status)}
                        </div>
                        {shift.notes && (
                          <div className="text-xs text-gray-600 mt-1 truncate">
                            📝 {getNoteLabel(shift.notes)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderEmployeesView = () => (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            {t("timeLeave.shiftScheduling.employees.title")}
          </CardTitle>
          <CardDescription>
            {t("timeLeave.shiftScheduling.employees.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {employees
              .filter(
                (emp) =>
                  !selectedDepartment ||
                  selectedDepartment === "all" ||
                  emp.department === selectedDepartment,
              )
              .map((employee) => {
                const weeklyHours = getEmployeeWeeklyHours(employee.id);
                const utilizationRate = Math.round(
                  (weeklyHours / employee.maxHoursPerWeek) * 100,
                );

                return (
                  <Card key={employee.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div>
                              <h4 className="font-medium">{employee.name}</h4>
                              <p className="text-sm text-gray-600">
                                {getPositionLabel(employee.position)}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              style={{
                                backgroundColor: `${getDepartmentColor(employee.department)}15`,
                                borderColor: getDepartmentColor(
                                  employee.department,
                                ),
                              }}
                            >
                              {getDepartmentLabel(employee.department)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">
                                {t("timeLeave.shiftScheduling.employees.email")}
                              </span>
                              <p className="font-medium">{employee.email}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">
                                {t("timeLeave.shiftScheduling.employees.phone")}
                              </span>
                              <p className="font-medium">{employee.phone}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">
                                {t("timeLeave.shiftScheduling.employees.hourlyRate")}
                              </span>
                              <p className="font-medium">
                                {t("timeLeave.shiftScheduling.employees.hourlyRateValue", {
                                  rate: employee.hourlyRate,
                                })}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">
                                {t("timeLeave.shiftScheduling.employees.skills")}
                              </span>
                              <p className="font-medium">
                                {employee.skills
                                  .slice(0, 2)
                                  .map((skill) => getSkillLabel(skill))
                                  .join(", ")}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <div>
                            <p className="text-sm text-gray-500">
                              {t("timeLeave.shiftScheduling.employees.thisWeek")}
                            </p>
                            <p className="text-2xl font-bold">
                              {t("timeLeave.shiftScheduling.employees.hoursValue", {
                                hours: weeklyHours,
                              })}
                            </p>
                            <p className="text-xs text-gray-500">
                              {t("timeLeave.shiftScheduling.employees.maxHours", {
                                max: employee.maxHoursPerWeek,
                              })}
                            </p>
                          </div>
                          <div className="w-24">
                            <div className="bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  utilizationRate > 90
                                    ? "bg-red-500"
                                    : utilizationRate > 70
                                      ? "bg-yellow-500"
                                      : "bg-green-500"
                                }`}
                                style={{
                                  width: `${Math.min(utilizationRate, 100)}%`,
                                }}
                              />
                            </div>
                            <p className="text-xs text-center mt-1">
                              {utilizationRate}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAnalyticsView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">
              {t("timeLeave.shiftScheduling.analytics.departmentCoverage")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {departments.map((dept) => {
                const deptShifts = getWeekShifts().filter(
                  (s) => s.department === dept.name,
                );
                const coverage = deptShifts.length;
                return (
                  <div
                    key={dept.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: dept.color }}
                      />
                      <span className="font-medium">
                        {getDepartmentLabel(dept.name)}
                      </span>
                    </div>
                    <Badge variant="outline">
                      {t("timeLeave.shiftScheduling.analytics.shiftCount", {
                        count: coverage,
                      })}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">
              {t("timeLeave.shiftScheduling.analytics.laborCosts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {t("timeLeave.shiftScheduling.analytics.weeklyTotal")}
                </span>
                <span className="font-bold text-lg">
                  $
                  {getWeekShifts()
                    .reduce((sum, shift) => {
                      const employee = employees.find(
                        (e) => e.id === shift.employeeId,
                      );
                      return sum + shift.hours * (employee?.hourlyRate || 0);
                    }, 0)
                    .toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {t("timeLeave.shiftScheduling.analytics.avgPerHour")}
                </span>
                <span className="font-medium">
                  $
                  {Math.round(
                    getWeekShifts().reduce((sum, shift) => {
                      const employee = employees.find(
                        (e) => e.id === shift.employeeId,
                      );
                      return sum + (employee?.hourlyRate || 0);
                    }, 0) / getWeekShifts().length,
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {t("timeLeave.shiftScheduling.analytics.totalHours")}
                </span>
                <span className="font-medium">
                  {t("timeLeave.shiftScheduling.analytics.totalHoursValue", {
                    hours: stats.totalHours,
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">
              {t("timeLeave.shiftScheduling.analytics.scheduleHealth")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {t("timeLeave.shiftScheduling.analytics.publishedRate")}
                </span>
                <span className="font-medium text-green-600">
                  {Math.round((stats.publishedCount / stats.totalShifts) * 100)}
                  %
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {t("timeLeave.shiftScheduling.analytics.confirmedRate")}
                </span>
                <span className="font-medium text-blue-600">
                  {Math.round((stats.confirmedCount / stats.totalShifts) * 100)}
                  %
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {t("timeLeave.shiftScheduling.analytics.coverageScore")}
                </span>
                <span className="font-medium">
                  {departments.every(
                    (dept) =>
                      getWeekShifts().filter((s) => s.department === dept.name)
                        .length >= dept.minStaffing,
                  )
                    ? t("timeLeave.shiftScheduling.analytics.coverageGood")
                    : t("timeLeave.shiftScheduling.analytics.coverageAttention")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>
            {t("timeLeave.shiftScheduling.recommendations.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {departments
              .map((dept) => {
                const deptShifts = getWeekShifts().filter(
                  (s) => s.department === dept.name,
                );
                const isUnderStaffed = deptShifts.length < dept.minStaffing * 5; // 5 days minimum

                if (isUnderStaffed) {
                  return (
                    <div
                      key={dept.id}
                      className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg"
                    >
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-800">
                          {t(
                            "timeLeave.shiftScheduling.recommendations.underStaffedTitle",
                            {
                              department: getDepartmentLabel(dept.name),
                            },
                          )}
                        </p>
                        <p className="text-sm text-yellow-600">
                          {t(
                            "timeLeave.shiftScheduling.recommendations.underStaffedDesc",
                            {
                              count: dept.minStaffing * 5 - deptShifts.length,
                            },
                          )}
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })
              .filter(Boolean)}

            {employees
              .map((employee) => {
                const weeklyHours = getEmployeeWeeklyHours(employee.id);
                const isOverworked = weeklyHours > employee.maxHoursPerWeek;

                if (isOverworked) {
                  return (
                    <div
                      key={employee.id}
                      className="flex items-start gap-3 p-3 bg-red-50 rounded-lg"
                    >
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">
                          {t(
                            "timeLeave.shiftScheduling.recommendations.overworkedTitle",
                            { name: employee.name },
                          )}
                        </p>
                        <p className="text-sm text-red-600">
                          {t(
                            "timeLeave.shiftScheduling.recommendations.overworkedDesc",
                            {
                              hours: weeklyHours,
                              max: employee.maxHoursPerWeek,
                              excess: weeklyHours - employee.maxHoursPerWeek,
                            },
                          )}
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })
              .filter(Boolean)}
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
            {/* Header skeleton */}
            <div className="mb-6">
              <Skeleton className="h-9 w-48 mb-2" />
              <Skeleton className="h-4 w-80" />
            </div>
            {/* Controls skeleton */}
            <Card className="mb-6">
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i}>
                      <Skeleton className="h-4 w-20 mb-2" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {/* Tabs skeleton */}
            <Skeleton className="h-10 w-full max-w-md mb-6" />
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
            {/* Calendar skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-56" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-4">
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <div key={day} className="border rounded-lg p-3 min-h-[200px]">
                      <div className="text-center border-b pb-2 mb-3">
                        <Skeleton className="h-4 w-20 mx-auto mb-1" />
                        <Skeleton className="h-3 w-16 mx-auto" />
                      </div>
                      <div className="space-y-2">
                        {[1, 2].map((shift) => (
                          <div key={shift} className="p-2 rounded border">
                            <Skeleton className="h-3 w-24 mb-1" />
                            <Skeleton className="h-3 w-20 mb-1" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                        ))}
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
      <SEO {...seoConfig.schedules} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-cyan-50 dark:bg-cyan-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />

          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/25">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("timeLeave.shiftScheduling.title")}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t("timeLeave.shiftScheduling.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-7xl mx-auto">

          {/* Demo Banner */}
          <div className="mb-6 -mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {t("timeLeave.shiftScheduling.demoBanner") || "Preview Mode — Sample Data"}
                </p>
                <p className="text-sm text-amber-700/80 dark:text-amber-400/80">
                  {t("timeLeave.shiftScheduling.demoBannerDesc") || "This page shows sample data for demonstration purposes. Shift scheduling with live data is coming soon."}
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <Card className="mb-6 border-border/50 -mt-8 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                {t("timeLeave.shiftScheduling.controls.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                <div>
                  <Label htmlFor="week">
                    {t("timeLeave.shiftScheduling.controls.weekStarting")}
                  </Label>
                  <Input
                    id="week"
                    type="date"
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="department">
                    {t("timeLeave.shiftScheduling.controls.department")}
                  </Label>
                  <Select
                    value={selectedDepartment}
                    onValueChange={setSelectedDepartment}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t(
                          "timeLeave.shiftScheduling.controls.allDepartments",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("timeLeave.shiftScheduling.controls.allDepartments")}
                      </SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>
                          {getDepartmentLabel(dept.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="location">
                    {t("timeLeave.shiftScheduling.controls.location")}
                  </Label>
                  <Select
                    value={selectedLocation}
                    onValueChange={setSelectedLocation}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t(
                          "timeLeave.shiftScheduling.controls.allLocations",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("timeLeave.shiftScheduling.controls.allLocations")}
                      </SelectItem>
                      {locations.map((location) => (
                        <SelectItem key={location} value={location}>
                          {getLocationLabel(location)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Button onClick={handleLoad} className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t("timeLeave.shiftScheduling.controls.load")}
                  </Button>
                </div>
                <div>
                  <Dialog
                    open={showCreateDialog}
                    onOpenChange={setShowCreateDialog}
                  >
                    <DialogTrigger asChild>
                      <Button className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        {t("timeLeave.shiftScheduling.controls.createShift")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>
                          {t("timeLeave.shiftScheduling.create.title")}
                        </DialogTitle>
                        <DialogDescription>
                          {t("timeLeave.shiftScheduling.create.description")}
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="employee">
                            {t("timeLeave.shiftScheduling.create.employee")}
                          </Label>
                          <Select
                            value={formData.employee}
                            onValueChange={(value) =>
                              handleInputChange("employee", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t(
                                  "timeLeave.shiftScheduling.create.employeePlaceholder",
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {employees.map((employee) => (
                                <SelectItem
                                  key={employee.id}
                                  value={employee.id}
                                >
                                  {employee.name} -{" "}
                                  {getPositionLabel(employee.position)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="department">
                            {t("timeLeave.shiftScheduling.create.department")}
                          </Label>
                          <Select
                            value={formData.department}
                            onValueChange={(value) =>
                              handleInputChange("department", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t(
                                  "timeLeave.shiftScheduling.create.departmentPlaceholder",
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.name}>
                                  {getDepartmentLabel(dept.name)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="position">
                            {t("timeLeave.shiftScheduling.create.position")}
                          </Label>
                          <Select
                            value={formData.position}
                            onValueChange={(value) =>
                              handleInputChange("position", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t(
                                  "timeLeave.shiftScheduling.create.positionPlaceholder",
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {formData.department &&
                                departments
                                  .find((d) => d.name === formData.department)
                                  ?.positions.map((position) => (
                                    <SelectItem
                                      key={position.id}
                                      value={position.title}
                                    >
                                      {getPositionLabel(position.title)}
                                    </SelectItem>
                                  ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="shift-date">
                            {t("timeLeave.shiftScheduling.create.date")}
                          </Label>
                          <Input
                            id="shift-date"
                            type="date"
                            value={formData.date}
                            onChange={(e) =>
                              handleInputChange("date", e.target.value)
                            }
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="shift-start">
                              {t("timeLeave.shiftScheduling.create.startTime")}
                            </Label>
                            <Input
                              id="shift-start"
                              type="time"
                              value={formData.startTime}
                              onChange={(e) =>
                                handleInputChange("startTime", e.target.value)
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="shift-end">
                              {t("timeLeave.shiftScheduling.create.endTime")}
                            </Label>
                            <Input
                              id="shift-end"
                              type="time"
                              value={formData.endTime}
                              onChange={(e) =>
                                handleInputChange("endTime", e.target.value)
                              }
                              required
                            />
                          </div>
                        </div>
                        {formData.startTime && formData.endTime && (
                          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {t("timeLeave.shiftScheduling.create.totalHours", {
                              hours: calculateHours(
                                formData.startTime,
                                formData.endTime,
                              ),
                            })}
                          </div>
                        )}
                        <div>
                          <Label htmlFor="location">
                            {t("timeLeave.shiftScheduling.create.location")}
                          </Label>
                          <Select
                            value={formData.location}
                            onValueChange={(value) =>
                              handleInputChange("location", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t(
                                  "timeLeave.shiftScheduling.create.locationPlaceholder",
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map((location) => (
                                <SelectItem key={location} value={location}>
                                  {getLocationLabel(location)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="notes">
                            {t("timeLeave.shiftScheduling.create.notes")}
                          </Label>
                          <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) =>
                              handleInputChange("notes", e.target.value)
                            }
                            placeholder={t(
                              "timeLeave.shiftScheduling.create.notesPlaceholder",
                            )}
                            rows={2}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              resetForm();
                              setShowCreateDialog(false);
                            }}
                            className="flex-1"
                          >
                            {t("timeLeave.shiftScheduling.actions.cancel")}
                          </Button>
                          <Button type="submit" className="flex-1">
                            {t("timeLeave.shiftScheduling.actions.createShift")}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <div>
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    {t("timeLeave.shiftScheduling.controls.settings")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="schedule">
                {t("timeLeave.shiftScheduling.tabs.schedule")}
              </TabsTrigger>
              <TabsTrigger value="employees">
                {t("timeLeave.shiftScheduling.tabs.employees")}
              </TabsTrigger>
              <TabsTrigger value="analytics">
                {t("timeLeave.shiftScheduling.tabs.analytics")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="mt-6">
              {renderScheduleView()}
            </TabsContent>

            <TabsContent value="employees" className="mt-6">
              {renderEmployeesView()}
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              {renderAnalyticsView()}
            </TabsContent>
          </Tabs>

          {/* Edit Shift Dialog */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {t("timeLeave.shiftScheduling.edit.title")}
                </DialogTitle>
                <DialogDescription>
                  {t("timeLeave.shiftScheduling.edit.description")}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateShift} className="space-y-4">
                <div>
                  <Label htmlFor="edit-employee">
                    {t("timeLeave.shiftScheduling.edit.employee")}
                  </Label>
                  <Select
                    value={formData.employee}
                    onValueChange={(value) =>
                      handleInputChange("employee", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t(
                          "timeLeave.shiftScheduling.edit.employeePlaceholder",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name} - {getPositionLabel(employee.position)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-position">
                    {t("timeLeave.shiftScheduling.edit.position")}
                  </Label>
                  <Select
                    value={formData.position}
                    onValueChange={(value) =>
                      handleInputChange("position", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t(
                          "timeLeave.shiftScheduling.edit.positionPlaceholder",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.department &&
                        departments
                          .find((d) => d.name === formData.department)
                          ?.positions.map((position) => (
                            <SelectItem key={position.id} value={position.title}>
                              {getPositionLabel(position.title)}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-date">
                    {t("timeLeave.shiftScheduling.edit.date")}
                  </Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="edit-start">
                      {t("timeLeave.shiftScheduling.edit.startTime")}
                    </Label>
                    <Input
                      id="edit-start"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) =>
                        handleInputChange("startTime", e.target.value)
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-end">
                      {t("timeLeave.shiftScheduling.edit.endTime")}
                    </Label>
                    <Input
                      id="edit-end"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) =>
                        handleInputChange("endTime", e.target.value)
                      }
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-location">
                    {t("timeLeave.shiftScheduling.edit.location")}
                  </Label>
                  <Select
                    value={formData.location}
                    onValueChange={(value) =>
                      handleInputChange("location", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t(
                          "timeLeave.shiftScheduling.edit.locationPlaceholder",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location} value={location}>
                          {getLocationLabel(location)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-notes">
                    {t("timeLeave.shiftScheduling.edit.notes")}
                  </Label>
                  <Textarea
                    id="edit-notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder={t(
                      "timeLeave.shiftScheduling.edit.notesPlaceholder",
                    )}
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        className="flex-1"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t("timeLeave.shiftScheduling.actions.delete")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t("timeLeave.shiftScheduling.delete.title")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("timeLeave.shiftScheduling.delete.description")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {t("timeLeave.shiftScheduling.actions.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            if (selectedShift) {
                              handleDeleteShift(selectedShift.id);
                            }
                            setShowEditDialog(false);
                            setSelectedShift(null);
                            resetForm();
                          }}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {t("timeLeave.shiftScheduling.delete.confirm")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setShowEditDialog(false);
                      setSelectedShift(null);
                    }}
                    className="flex-1"
                  >
                    {t("timeLeave.shiftScheduling.actions.cancel")}
                  </Button>
                  <Button type="submit" className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    {t("timeLeave.shiftScheduling.actions.update")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
