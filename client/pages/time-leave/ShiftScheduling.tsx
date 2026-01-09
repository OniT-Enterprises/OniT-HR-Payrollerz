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
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import {
  Calendar,
  Plus,
  Filter,
  Download,
  Clock,
  User,
  Building,
  CheckCircle,
  Edit,
  Trash2,
  Copy,
  RefreshCw,
  AlertTriangle,
  Users,
  MapPin,
  Phone,
  Mail,
  FileText,
  Settings,
  Save,
  Send,
  BarChart3,
  TrendingUp,
  UserCheck,
  Calendar as CalendarIcon,
} from "lucide-react";

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
  const [activeTab, setActiveTab] = useState("schedule");
  const [selectedWeek, setSelectedWeek] = useState(getWeekString(new Date()));
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "day">("week");

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

  const [templateData, setTemplateData] = useState({
    name: "",
    department: "",
  });

  // Helper function to get week string
  function getWeekString(date: Date) {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay()); // Start on Sunday
    return startOfWeek.toISOString().split("T")[0];
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
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const employee = employees.find((e) => e.id === formData.employee);
    const hours = calculateHours(formData.startTime, formData.endTime);

    try {
      console.log("Creating shift:", {
        ...formData,
        employeeName: employee?.name,
        hours,
      });

      toast({
        title: "Success",
        description: "Shift created successfully.",
      });

      resetForm();
      setShowCreateDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create shift. Please try again.",
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
      const hours = calculateHours(formData.startTime, formData.endTime);
      console.log("Updating shift:", {
        id: selectedShift?.id,
        ...formData,
        hours,
      });

      toast({
        title: "Success",
        description: "Shift updated successfully.",
      });

      resetForm();
      setShowEditDialog(false);
      setSelectedShift(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update shift. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      console.log("Deleting shift:", shiftId);

      toast({
        title: "Success",
        description: "Shift deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete shift. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLoad = () => {
    console.log(
      "Loading shifts for week:",
      selectedWeek,
      "department:",
      selectedDepartment,
      "location:",
      selectedLocation,
    );
    toast({
      title: "Schedule Loaded",
      description: `Loaded shifts for week of ${selectedWeek}`,
    });
  };

  const handlePublishSchedule = () => {
    const weekShifts = getWeekShifts();
    const draftShifts = weekShifts.filter((shift) => shift.status === "draft");

    console.log(
      "Publishing schedule for week:",
      selectedWeek,
      "shifts:",
      draftShifts.length,
    );

    toast({
      title: "Schedule Published",
      description: `Published ${draftShifts.length} shifts for the week.`,
    });
  };

  const handleExportPDF = () => {
    const weekShifts = getWeekShifts();
    console.log("Exporting PDF for week:", selectedWeek);

    toast({
      title: "Export Started",
      description: "PDF roster will be downloaded shortly.",
    });
  };

  const handleCopyWeek = () => {
    const weekShifts = getWeekShifts();
    console.log("Copying week shifts:", weekShifts.length);

    toast({
      title: "Week Copied",
      description: `${weekShifts.length} shifts copied to clipboard. Select a target week to paste.`,
    });
  };

  const handleApplyTemplate = (template: ShiftTemplate) => {
    console.log("Applying template:", template.name);
    toast({
      title: "Template Applied",
      description: `Applied "${template.name}" template to current week.`,
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
    const dateString = targetDate.toISOString().split("T")[0];

    return getWeekShifts().filter((shift) => shift.date === dateString);
  };

  const getDayName = (dayOffset: number) => {
    const weekStart = new Date(selectedWeek);
    const targetDate = new Date(weekStart);
    targetDate.setDate(weekStart.getDate() + dayOffset);
    return targetDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: Shift["status"]) => {
    switch (status) {
      case "draft":
        return <Badge className="bg-gray-100 text-gray-800">Draft</Badge>;
      case "published":
        return <Badge className="bg-blue-100 text-blue-800">Published</Badge>;
      case "confirmed":
        return <Badge className="bg-green-100 text-green-800">Confirmed</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Shifts
                </p>
                <p className="text-2xl font-bold">{stats.totalShifts}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Hours</p>
                <p className="text-2xl font-bold">{stats.totalHours}h</p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Staff Scheduled
                </p>
                <p className="text-2xl font-bold">{stats.staffCount}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Published</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.publishedCount}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
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
          Publish Schedule ({stats.draftCount} drafts)
        </Button>
        <Button variant="outline" onClick={handleExportPDF}>
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
        <Button variant="outline" onClick={handleCopyWeek}>
          <Copy className="h-4 w-4 mr-2" />
          Copy Week
        </Button>
        <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Apply Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply Shift Template</DialogTitle>
              <DialogDescription>
                Choose a template to apply to the current week
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
                        <h4 className="font-medium">{template.name}</h4>
                        <p className="text-sm text-gray-600">
                          {template.department}
                        </p>
                        <p className="text-xs text-gray-500">
                          {template.shifts.length} shifts
                        </p>
                      </div>
                      <Button size="sm">Apply</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Weekly Schedule
              </CardTitle>
              <CardDescription>
                Week of {getDayName(0)} - {getDayName(6)}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("week")}
              >
                Week
              </Button>
              <Button
                variant={viewMode === "day" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("day")}
              >
                Day
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
                      {dayShifts.length} shifts • {dayHours}h
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
                          {shift.position}
                        </div>
                        <div className="text-gray-500">
                          {shift.startTime} - {shift.endTime}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <Badge variant="outline" className="text-xs">
                            {shift.location.split(" - ")[0]}
                          </Badge>
                          {getStatusBadge(shift.status)}
                        </div>
                        {shift.notes && (
                          <div className="text-xs text-gray-600 mt-1 truncate">
                            📝 {shift.notes}
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employee Availability & Hours
          </CardTitle>
          <CardDescription>
            View employee schedules and weekly hour tracking
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
                                {employee.position}
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
                              {employee.department}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Email:</span>
                              <p className="font-medium">{employee.email}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Phone:</span>
                              <p className="font-medium">{employee.phone}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">
                                Hourly Rate:
                              </span>
                              <p className="font-medium">
                                ${employee.hourlyRate}/hr
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Skills:</span>
                              <p className="font-medium">
                                {employee.skills.slice(0, 2).join(", ")}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <div>
                            <p className="text-sm text-gray-500">This Week</p>
                            <p className="text-2xl font-bold">{weeklyHours}h</p>
                            <p className="text-xs text-gray-500">
                              of {employee.maxHoursPerWeek}h max
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Department Coverage</CardTitle>
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
                      <span className="font-medium">{dept.name}</span>
                    </div>
                    <Badge variant="outline">{coverage} shifts</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Labor Costs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Weekly Total:</span>
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
                <span className="text-gray-600">Avg per Hour:</span>
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
                <span className="text-gray-600">Total Hours:</span>
                <span className="font-medium">{stats.totalHours}h</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Schedule Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Published Rate:</span>
                <span className="font-medium text-green-600">
                  {Math.round((stats.publishedCount / stats.totalShifts) * 100)}
                  %
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Confirmed Rate:</span>
                <span className="font-medium text-blue-600">
                  {Math.round((stats.confirmedCount / stats.totalShifts) * 100)}
                  %
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Coverage Score:</span>
                <span className="font-medium">
                  {departments.every(
                    (dept) =>
                      getWeekShifts().filter((s) => s.department === dept.name)
                        .length >= dept.minStaffing,
                  )
                    ? "✅ Good"
                    : "⚠️ Needs Attention"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staffing Recommendations</CardTitle>
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
                          {dept.name} Under-Staffed
                        </p>
                        <p className="text-sm text-yellow-600">
                          Consider adding{" "}
                          {dept.minStaffing * 5 - deptShifts.length} more shifts
                          this week to meet minimum staffing requirements.
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
                          {employee.name} Over Maximum Hours
                        </p>
                        <p className="text-sm text-red-600">
                          Scheduled for {weeklyHours}h, exceeds maximum of{" "}
                          {employee.maxHoursPerWeek}h by{" "}
                          {weeklyHours - employee.maxHoursPerWeek}h.
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

  return (
    <div className="min-h-screen bg-gray-50">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Shift Scheduling
            </h1>
            <p className="text-gray-600">
              Manage employee shifts, schedules, and workforce planning
            </p>
          </div>

          {/* Controls */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Schedule Controls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                <div>
                  <Label htmlFor="week">Week Starting</Label>
                  <Input
                    id="week"
                    type="date"
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={selectedDepartment}
                    onValueChange={setSelectedDepartment}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Select
                    value={selectedLocation}
                    onValueChange={setSelectedLocation}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All locations</SelectItem>
                      {locations.map((location) => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Button onClick={handleLoad} className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Load
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
                        Create Shift
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Create Shift</DialogTitle>
                        <DialogDescription>
                          Add a new shift to the schedule
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="employee">Employee *</Label>
                          <Select
                            value={formData.employee}
                            onValueChange={(value) =>
                              handleInputChange("employee", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                            <SelectContent>
                              {employees.map((employee) => (
                                <SelectItem
                                  key={employee.id}
                                  value={employee.id}
                                >
                                  {employee.name} - {employee.position}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="department">Department *</Label>
                          <Select
                            value={formData.department}
                            onValueChange={(value) =>
                              handleInputChange("department", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.name}>
                                  {dept.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="position">Position *</Label>
                          <Select
                            value={formData.position}
                            onValueChange={(value) =>
                              handleInputChange("position", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select position" />
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
                                      {position.title}
                                    </SelectItem>
                                  ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="shift-date">Date *</Label>
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
                            <Label htmlFor="shift-start">Start Time *</Label>
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
                            <Label htmlFor="shift-end">End Time *</Label>
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
                            Total Hours:{" "}
                            {calculateHours(
                              formData.startTime,
                              formData.endTime,
                            )}
                            h
                          </div>
                        )}
                        <div>
                          <Label htmlFor="location">Location *</Label>
                          <Select
                            value={formData.location}
                            onValueChange={(value) =>
                              handleInputChange("location", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map((location) => (
                                <SelectItem key={location} value={location}>
                                  {location}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="notes">Notes</Label>
                          <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) =>
                              handleInputChange("notes", e.target.value)
                            }
                            placeholder="Optional notes for this shift..."
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
                            Cancel
                          </Button>
                          <Button type="submit" className="flex-1">
                            Create Shift
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <div>
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="employees">Employees</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
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
                <DialogTitle>Edit Shift</DialogTitle>
                <DialogDescription>
                  Modify shift details or delete the shift
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateShift} className="space-y-4">
                <div>
                  <Label htmlFor="edit-employee">Employee *</Label>
                  <Select
                    value={formData.employee}
                    onValueChange={(value) =>
                      handleInputChange("employee", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name} - {employee.position}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-position">Position *</Label>
                  <Input
                    id="edit-position"
                    value={formData.position}
                    onChange={(e) =>
                      handleInputChange("position", e.target.value)
                    }
                    placeholder="Enter position"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-date">Date *</Label>
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
                    <Label htmlFor="edit-start">Start Time *</Label>
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
                    <Label htmlFor="edit-end">End Time *</Label>
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
                  <Label htmlFor="edit-location">Location *</Label>
                  <Select
                    value={formData.location}
                    onValueChange={(value) =>
                      handleInputChange("location", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea
                    id="edit-notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder="Optional notes..."
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
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Shift</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this shift? This
                          action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
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
                          Delete
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
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    Update
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
