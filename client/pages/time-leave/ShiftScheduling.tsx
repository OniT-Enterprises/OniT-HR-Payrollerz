import React, { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { TimePicker } from "@/components/ui/time-picker";
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
import PageHeader from "@/components/layout/PageHeader";
import MoreDetailsSection from "@/components/MoreDetailsSection";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Calendar,
  Plus,
  Download,
  Trash2,
  Copy,
  AlertTriangle,
  Users,
  FileText,
  Save,
  Send,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  LayoutGrid,
  MapPin,
} from "lucide-react";
import LocationGridView from "@/components/shifts/LocationGridView";
import { SEO, seoConfig } from "@/components/SEO";
import { toDateStringTL, formatDateTL } from "@/lib/dateUtils";
import { useTenantId } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeDirectory } from "@/hooks/useEmployees";
import { useDepartments } from "@/hooks/useDepartments";
import {
  useShiftsByRange,
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
  usePublishDraftShifts,
  useShiftTemplates,
} from "@/hooks/useShifts";
import type { ShiftRecord, ShiftTemplate } from "@/services/shiftService";

// UI-mapped employee type
interface MappedEmployee {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  maxHoursPerWeek: number;
  hourlyRate: number;
  isActive: boolean;
}

// UI-mapped department type
interface MappedDepartment {
  id: string;
  name: string;
  manager: string;
  color: string;
  minStaffing: number;
}

export default function ShiftScheduling() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("schedule");
  const [selectedWeek, setSelectedWeek] = useState(getWeekString(new Date()));
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftRecord | null>(null);
  const [_viewMode, _setViewMode] = useState<"week" | "day">("week");
  const [scheduleViewMode, setScheduleViewMode] = useState<"employee" | "location">("location");
  const [draggedShift, setDraggedShift] = useState<ShiftRecord | null>(null);
  const [dropTarget, setDropTarget] = useState<{ employeeId: string; date: string } | null>(null);
  const [showAllEmployees, setShowAllEmployees] = useState(true);

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

  // Real data hooks
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { data: realEmployees = [], isLoading: empLoading } = useEmployeeDirectory({ status: 'active' });
  const { data: realDepartments = [], isLoading: deptLoading } = useDepartments(tenantId);

  const weekEndDate = useMemo(() => {
    const start = new Date(selectedWeek);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return toDateStringTL(end);
  }, [selectedWeek]);

  const { data: shifts = [], isLoading: shiftsLoading } = useShiftsByRange(selectedWeek, weekEndDate);
  const { data: shiftTemplates = [] } = useShiftTemplates();
  const createShiftMutation = useCreateShift();
  const updateShiftMutation = useUpdateShift();
  const deleteShiftMutation = useDeleteShift();
  const publishMutation = usePublishDraftShifts();

  const loading = empLoading || deptLoading || shiftsLoading;

  // Map real employees for UI
  const employees: MappedEmployee[] = useMemo(() => realEmployees
    .map((e) => ({
      id: e.id!,
      name: `${e.personalInfo.firstName} ${e.personalInfo.lastName}`,
      email: e.personalInfo.email,
      phone: e.personalInfo.phone,
      department: e.jobDetails.department,
      position: e.jobDetails.position,
      maxHoursPerWeek: 44, // TL standard
      hourlyRate: e.compensation.monthlySalary > 0 ? Math.round(e.compensation.monthlySalary / 176) : 0,
      isActive: true,
    })), [realEmployees]);

  // Map real departments for UI
  const departments: MappedDepartment[] = useMemo(() => realDepartments.map((d, i) => ({
    id: d.id!,
    name: d.name,
    manager: d.manager || '',
    color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'][i % 6],
    minStaffing: 3,
  })), [realDepartments]);

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

  const templateLabels: Record<string, string> = {
    "Standard Operations Week": t("timeLeave.shiftScheduling.data.templates.standardOperationsWeek"),
  };

  const getDepartmentLabel = (department: string) =>
    departmentLabels[department] || department;
  const getPositionLabel = (position: string) => positionLabels[position] || position;
  const getLocationLabel = (location: string) => locationLabels[location] || location;
  const getTemplateLabel = (name: string) => templateLabels[name] || name;

  // Helper function to get week string
  function getWeekString(date: Date) {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay()); // Start on Sunday
    return toDateStringTL(startOfWeek);
  }

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

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find((emp) => emp.id === employeeId);
    setFormData((prev) => ({
      ...prev,
      employee: employeeId,
      department: employee?.department || prev.department,
      position: employee?.position || prev.position,
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

    const employee = employees.find((emp) => emp.id === formData.employee);
    const hours = calculateHours(formData.startTime, formData.endTime);

    try {
      await createShiftMutation.mutateAsync({
        employeeId: formData.employee,
        employeeName: employee?.name || '',
        department: formData.department,
        position: formData.position,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        hours,
        status: 'draft',
        location: formData.location,
        notes: formData.notes,
        createdBy: user?.email || 'unknown',
      });
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

  const handleEditShift = (shift: ShiftRecord) => {
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
    if (!selectedShift?.id) return;

    const employee = employees.find((emp) => emp.id === formData.employee);
    const hours = calculateHours(formData.startTime, formData.endTime);

    try {
      await updateShiftMutation.mutateAsync({
        shiftId: selectedShift.id,
        data: {
          employeeId: formData.employee,
          employeeName: employee?.name || '',
          department: formData.department,
          position: formData.position,
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
          hours,
          location: formData.location,
          notes: formData.notes,
        },
      });
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

  const handleDeleteShift = async (shiftId: string) => {
    try {
      await deleteShiftMutation.mutateAsync(shiftId);
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

  const handlePublishSchedule = async () => {
    try {
      const count = await publishMutation.mutateAsync({ startDate: selectedWeek, endDate: weekEndDate });
      toast({
        title: t("timeLeave.shiftScheduling.toast.schedulePublishedTitle"),
        description: t("timeLeave.shiftScheduling.toast.schedulePublishedDesc", {
          count,
        }),
      });
    } catch {
      toast({
        title: t("timeLeave.shiftScheduling.toast.errorTitle"),
        description: t("timeLeave.shiftScheduling.toast.createErrorDesc"),
        variant: "destructive",
      });
    }
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
    return shifts.filter((shift) => {
      const matchesDepartment =
        !selectedDepartment ||
        selectedDepartment === "all" ||
        shift.department === selectedDepartment;
      const matchesLocation =
        !selectedLocation ||
        selectedLocation === "all" ||
        shift.location === selectedLocation;
      return matchesDepartment && matchesLocation;
    });
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

  // Date helper for the grid
  const getDateForOffset = (dayOffset: number): string => {
    const weekStart = new Date(selectedWeek);
    const targetDate = new Date(weekStart);
    targetDate.setDate(weekStart.getDate() + dayOffset);
    return toDateStringTL(targetDate);
  };

  const getDayHeaderInfo = (dayOffset: number) => {
    const weekStart = new Date(selectedWeek);
    const targetDate = new Date(weekStart);
    targetDate.setDate(weekStart.getDate() + dayOffset);
    const dateStr = toDateStringTL(targetDate);
    const today = toDateStringTL(new Date());
    return {
      dateStr,
      dayName: formatDateTL(targetDate, { weekday: "short" }),
      dayNum: targetDate.getDate(),
      monthName: formatDateTL(targetDate, { month: "short" }),
      isToday: dateStr === today,
    };
  };

  // Week navigation
  const goToPreviousWeek = () => {
    const start = new Date(selectedWeek);
    start.setDate(start.getDate() - 7);
    setSelectedWeek(toDateStringTL(start));
  };

  const goToNextWeek = () => {
    const start = new Date(selectedWeek);
    start.setDate(start.getDate() + 7);
    setSelectedWeek(toDateStringTL(start));
  };

  const goToCurrentWeek = () => {
    setSelectedWeek(getWeekString(new Date()));
  };

  // Drag and drop handlers
  const handleShiftDrop = useCallback(async (targetEmployeeId: string, targetDate: string) => {
    if (!draggedShift?.id) return;
    // Don't do anything if dropped on same cell
    if (draggedShift.employeeId === targetEmployeeId && draggedShift.date === targetDate) {
      setDraggedShift(null);
      setDropTarget(null);
      return;
    }

    const employee = employees.find(e => e.id === targetEmployeeId);

    try {
      await updateShiftMutation.mutateAsync({
        shiftId: draggedShift.id,
        data: {
          employeeId: targetEmployeeId,
          employeeName: employee?.name || '',
          department: employee?.department || draggedShift.department,
          date: targetDate,
        },
      });
      toast({
        title: t("timeLeave.shiftScheduling.toast.successTitle"),
        description: `Shift moved to ${employee?.name || 'employee'} on ${formatDateTL(new Date(targetDate + 'T12:00:00'), { weekday: 'short', month: 'short', day: 'numeric' })}`,
      });
    } catch {
      toast({
        title: t("timeLeave.shiftScheduling.toast.errorTitle"),
        description: t("timeLeave.shiftScheduling.toast.updateErrorDesc"),
        variant: "destructive",
      });
    }

    setDraggedShift(null);
    setDropTarget(null);
  }, [draggedShift, employees, updateShiftMutation, toast, t]);

  // Quick create shift by clicking an empty cell
  const quickCreateShift = (employeeId: string, department: string, position: string, date: string) => {
    const employee = employees.find(e => e.id === employeeId);
    setFormData({
      employee: employeeId,
      position: position || employee?.position || '',
      date,
      startTime: '09:00',
      endTime: '17:00',
      department: department || employee?.department || '',
      location: '',
      notes: '',
    });
    setShowCreateDialog(true);
  };

  const stats = getScheduleStats();

  const renderScheduleView = () => {
    const weekShifts = getWeekShifts();
    const scheduledEmployeeIds = new Set(weekShifts.map(s => s.employeeId).filter(Boolean));

    const relevantEmployees = employees.filter(emp => {
      const matchesDept = !selectedDepartment || selectedDepartment === 'all' || emp.department === selectedDepartment;
      return matchesDept && (showAllEmployees || scheduledEmployeeIds.has(emp.id));
    });

    return (
      <div className="space-y-3">
        {/* Compact action bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {stats.draftCount > 0 && (
              <Button
                size="sm"
                onClick={handlePublishSchedule}
                className="gap-1.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
                Publish {stats.draftCount} draft{stats.draftCount !== 1 ? 's' : ''}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyWeek} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              Copy Week
            </Button>
            <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Template
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
                    <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="pt-4" onClick={() => handleApplyTemplate(template)}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{getTemplateLabel(template.name)}</h4>
                            <p className="text-sm text-muted-foreground">{getDepartmentLabel(template.department)}</p>
                            <p className="text-xs text-muted-foreground/70">
                              {t("timeLeave.shiftScheduling.template.shiftCount", { count: template.shifts.length })}
                            </p>
                          </div>
                          <Button size="sm">{t("timeLeave.shiftScheduling.actions.apply")}</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline tabular-nums">
              {weekShifts.length} shift{weekShifts.length !== 1 ? 's' : ''} &middot; {stats.totalHours}h
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllEmployees(!showAllEmployees)}
              className={cn("gap-1.5 text-xs h-8", showAllEmployees && "bg-muted")}
            >
              <Users className="h-3.5 w-3.5" />
              {showAllEmployees ? 'Scheduled only' : 'All staff'}
            </Button>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="border border-border/50 rounded-xl overflow-x-auto bg-card shadow-sm">
          <table className="w-full border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-20 bg-muted/50 backdrop-blur-sm text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-r border-border/30 w-[200px] min-w-[200px]">
                  Staff
                </th>
                {[0, 1, 2, 3, 4, 5, 6].map(day => {
                  const info = getDayHeaderInfo(day);
                  return (
                    <th
                      key={day}
                      className={cn(
                        "px-1.5 py-2.5 text-center border-b border-r border-border/30 last:border-r-0 min-w-[100px]",
                        info.isToday && "bg-cyan-50/80 dark:bg-cyan-950/30"
                      )}
                    >
                      <div className={cn(
                        "text-[11px] font-semibold uppercase tracking-wide",
                        info.isToday ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground"
                      )}>
                        {info.dayName}
                      </div>
                      <div className={cn(
                        "text-base font-bold leading-tight",
                        info.isToday ? "text-cyan-600 dark:text-cyan-400" : "text-foreground"
                      )}>
                        {info.dayNum}
                      </div>
                      {(day === 0 || info.dayNum === 1) && (
                        <div className="text-[10px] text-muted-foreground/60 font-medium">{info.monthName}</div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {relevantEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-16 text-center">
                    <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No shifts scheduled this week</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Click &ldquo;All staff&rdquo; to see everyone, or create a shift
                    </p>
                  </td>
                </tr>
              ) : (
                relevantEmployees.map((emp) => {
                  const empHours = getEmployeeWeeklyHours(emp.id);
                  const overMax = empHours > emp.maxHoursPerWeek;

                  return (
                    <tr
                      key={emp.id}
                      className="group/row hover:bg-muted/10 transition-colors border-b border-border/20 last:border-b-0"
                    >
                      {/* Employee cell - sticky left */}
                      <td className="sticky left-0 z-10 bg-card group-hover/row:bg-muted/10 transition-colors px-3 py-2.5 border-r border-border/30 w-[200px] min-w-[200px]">
                        <div className="flex items-start gap-2">
                          <div
                            className="w-1 h-9 rounded-full flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: getDepartmentColor(emp.department) }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-foreground truncate leading-tight">{emp.name}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{getPositionLabel(emp.position)}</div>
                            {empHours > 0 && (
                              <div className={cn(
                                "text-[10px] font-medium mt-0.5",
                                overMax ? "text-red-500" : "text-muted-foreground/60"
                              )}>
                                {empHours}h / {emp.maxHoursPerWeek}h
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Day cells */}
                      {[0, 1, 2, 3, 4, 5, 6].map(dayOffset => {
                        const dateStr = getDateForOffset(dayOffset);
                        const cellShifts = weekShifts.filter(
                          s => s.employeeId === emp.id && s.date === dateStr
                        );
                        const isTarget = dropTarget?.employeeId === emp.id && dropTarget?.date === dateStr;
                        const isTodayCol = getDayHeaderInfo(dayOffset).isToday;

                        return (
                          <td
                            key={dayOffset}
                            className={cn(
                              "px-1 py-1 border-r border-border/30 last:border-r-0 align-top transition-all relative group/cell",
                              isTodayCol && "bg-cyan-50/30 dark:bg-cyan-950/10",
                              isTarget && "!bg-cyan-100/70 dark:!bg-cyan-900/40 ring-2 ring-inset ring-cyan-400/70",
                              !cellShifts.length && "cursor-pointer"
                            )}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              if (dropTarget?.employeeId !== emp.id || dropTarget?.date !== dateStr) {
                                setDropTarget({ employeeId: emp.id, date: dateStr });
                              }
                            }}
                            onDragLeave={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                                setDropTarget(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              handleShiftDrop(emp.id, dateStr);
                            }}
                            onClick={() => {
                              if (!cellShifts.length) quickCreateShift(emp.id, emp.department, emp.position, dateStr);
                            }}
                          >
                            <div className="space-y-1 min-h-[56px]">
                              {cellShifts.map(shift => (
                                <div
                                  key={shift.id}
                                  draggable
                                  onDragStart={(e) => {
                                    setDraggedShift(shift);
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setDragImage(e.currentTarget, e.currentTarget.offsetWidth / 2, e.currentTarget.offsetHeight / 2);
                                  }}
                                  onDragEnd={() => { setDraggedShift(null); setDropTarget(null); }}
                                  onClick={(e) => { e.stopPropagation(); handleEditShift(shift); }}
                                  className={cn(
                                    "group/shift rounded-lg px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing transition-all",
                                    "border hover:shadow-md hover:-translate-y-px",
                                    draggedShift?.id === shift.id && "opacity-25 scale-95"
                                  )}
                                  style={{
                                    backgroundColor: `${getDepartmentColor(shift.department)}10`,
                                    borderColor: `${getDepartmentColor(shift.department)}30`,
                                  }}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <GripVertical className="h-3 w-3 text-muted-foreground/30 group-hover/shift:text-muted-foreground/60 flex-shrink-0 -ml-0.5 transition-colors" />
                                    <div className={cn(
                                      "w-1.5 h-1.5 rounded-full flex-shrink-0",
                                      shift.status === 'published' && "bg-blue-500",
                                      shift.status === 'confirmed' && "bg-emerald-500",
                                      shift.status === 'draft' && "bg-gray-400 dark:bg-gray-500",
                                      shift.status === 'cancelled' && "bg-red-500",
                                    )} />
                                    <span className="font-semibold text-foreground truncate">
                                      {shift.startTime}&ndash;{shift.endTime}
                                    </span>
                                  </div>
                                  {shift.location && (
                                    <div className="text-muted-foreground truncate mt-0.5 pl-[22px] text-[10px]">
                                      {getLocationLabel(shift.location)?.split(' - ')[0] || shift.location}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Plus icon on empty cell hover */}
                            {cellShifts.length === 0 && !isTarget && (
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none">
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shadow-sm">
                                  <Plus className="h-3 w-3 text-muted-foreground" />
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground px-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-400" />
            Draft
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            Published
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            Confirmed
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            Cancelled
          </div>
          <span className="text-muted-foreground/50 ml-auto">
            Drag shifts to reassign &middot; Click empty cell to create
          </span>
        </div>
      </div>
    );
  };

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
                                {t("timeLeave.shiftScheduling.employees.department")}
                              </span>
                              <p className="font-medium">
                                {getDepartmentLabel(employee.department)}
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
                  {getWeekShifts().length > 0 ? Math.round(
                    getWeekShifts().reduce((sum, shift) => {
                      const employee = employees.find(
                        (e) => e.id === shift.employeeId,
                      );
                      return sum + (employee?.hourlyRate || 0);
                    }, 0) / getWeekShifts().length,
                  ) : 0}
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
                  {stats.totalShifts > 0 ? Math.round((stats.publishedCount / stats.totalShifts) * 100) : 0}
                  %
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {t("timeLeave.shiftScheduling.analytics.confirmedRate")}
                </span>
                <span className="font-medium text-blue-600">
                  {stats.totalShifts > 0 ? Math.round((stats.confirmedCount / stats.totalShifts) * 100) : 0}
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
                      className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800"
                    >
                      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">
                          {t(
                            "timeLeave.shiftScheduling.recommendations.underStaffedTitle",
                            {
                              department: getDepartmentLabel(dept.name),
                            },
                          )}
                        </p>
                        <p className="text-sm text-yellow-600 dark:text-yellow-400">
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
          <div className="mx-auto max-w-screen-2xl">
            {/* Header skeleton */}
            <div className="mb-6">
              <Skeleton className="h-9 w-48 mb-2" />
              <Skeleton className="h-4 w-80" />
            </div>
            {/* Toolbar skeleton */}
            <div className="flex items-center gap-3 mb-5">
              <Skeleton className="h-8 w-48 rounded-lg" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-[160px]" />
              <Skeleton className="h-8 w-[160px]" />
              <div className="ml-auto"><Skeleton className="h-8 w-28" /></div>
            </div>
            {/* Schedule grid skeleton */}
            <div className="border rounded-xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[200px_repeat(7,1fr)] bg-muted/50 border-b">
                <div className="px-4 py-3 border-r"><Skeleton className="h-4 w-12" /></div>
                {[0,1,2,3,4,5,6].map(d => (
                  <div key={d} className="px-2 py-3 flex flex-col items-center gap-1 border-r last:border-r-0">
                    <Skeleton className="h-3 w-8" />
                    <Skeleton className="h-5 w-5" />
                  </div>
                ))}
              </div>
              {/* Rows */}
              {[1,2,3,4,5].map(r => (
                <div key={r} className="grid grid-cols-[200px_repeat(7,1fr)] border-b last:border-b-0">
                  <div className="px-3 py-3 border-r flex items-center gap-2">
                    <Skeleton className="w-1 h-9 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  {[0,1,2,3,4,5,6].map(d => (
                    <div key={d} className="px-1 py-1.5 border-r last:border-r-0 min-h-[64px]">
                      {d % 3 !== 0 && <Skeleton className="h-10 w-full rounded-lg" />}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.schedules} />
      <MainNavigation />

      <div className="p-6">
        <div className="mx-auto max-w-screen-2xl">
          <PageHeader
            title={t("timeLeave.shiftScheduling.title")}
            subtitle={t("timeLeave.shiftScheduling.subtitle")}
            icon={Calendar}
            iconColor="text-cyan-500"
          />
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-5">
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

            {/* Toolbar — only shows for schedule tab */}
            {activeTab === "schedule" && (
              <div className="mb-5 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Week navigation */}
                  <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPreviousWeek}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Input
                      type="date"
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value)}
                      className="h-8 w-[140px] text-sm border-0 bg-transparent text-center font-medium"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextWeek}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-8" onClick={goToCurrentWeek}>
                    {t("timeLeave.attendance.actions.today")}
                  </Button>

                  <div className="ml-auto">
                    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-1.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white shadow-sm h-8">
                          <Plus className="h-3.5 w-3.5" />
                          {t("timeLeave.shiftScheduling.controls.createShift")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>{t("timeLeave.shiftScheduling.create.title")}</DialogTitle>
                          <DialogDescription>{t("timeLeave.shiftScheduling.create.description")}</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div>
                            <Label htmlFor="employee">{t("timeLeave.shiftScheduling.create.employee")}</Label>
                            <Select value={formData.employee} onValueChange={handleEmployeeSelect}>
                              <SelectTrigger><SelectValue placeholder={t("timeLeave.shiftScheduling.create.employeePlaceholder")} /></SelectTrigger>
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
                            <Label htmlFor="department">{t("timeLeave.shiftScheduling.create.department")}</Label>
                            <Select value={formData.department} onValueChange={(value) => handleInputChange("department", value)}>
                              <SelectTrigger><SelectValue placeholder={t("timeLeave.shiftScheduling.create.departmentPlaceholder")} /></SelectTrigger>
                              <SelectContent>
                                {departments.map((dept) => (
                                  <SelectItem key={dept.id} value={dept.name}>{getDepartmentLabel(dept.name)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="shift-date">{t("timeLeave.shiftScheduling.create.date")}</Label>
                            <Input id="shift-date" type="date" value={formData.date} onChange={(e) => handleInputChange("date", e.target.value)} required />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor="shift-start">{t("timeLeave.shiftScheduling.create.startTime")}</Label>
                              <TimePicker id="shift-start" value={formData.startTime} onChange={(v) => handleInputChange("startTime", v)} required />
                            </div>
                            <div>
                              <Label htmlFor="shift-end">{t("timeLeave.shiftScheduling.create.endTime")}</Label>
                              <TimePicker id="shift-end" value={formData.endTime} onChange={(v) => handleInputChange("endTime", v)} required />
                            </div>
                          </div>
                          {formData.startTime && formData.endTime && (
                            <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                              {t("timeLeave.shiftScheduling.create.totalHours", { hours: calculateHours(formData.startTime, formData.endTime) })}
                            </div>
                          )}
                          <div>
                            <Label htmlFor="location">{t("timeLeave.shiftScheduling.create.location")}</Label>
                            <Select value={formData.location} onValueChange={(value) => handleInputChange("location", value)}>
                              <SelectTrigger><SelectValue placeholder={t("timeLeave.shiftScheduling.create.locationPlaceholder")} /></SelectTrigger>
                              <SelectContent>
                                {locations.map((location) => (
                                  <SelectItem key={location} value={location}>{getLocationLabel(location)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <MoreDetailsSection>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="position">{t("timeLeave.shiftScheduling.create.position")}</Label>
                                <Input id="position" value={formData.position} onChange={(e) => handleInputChange("position", e.target.value)} placeholder={t("timeLeave.shiftScheduling.create.positionPlaceholder")} />
                              </div>
                              <div>
                                <Label htmlFor="notes">{t("timeLeave.shiftScheduling.create.notes")}</Label>
                                <Textarea id="notes" value={formData.notes} onChange={(e) => handleInputChange("notes", e.target.value)} placeholder={t("timeLeave.shiftScheduling.create.notesPlaceholder")} rows={2} />
                              </div>
                            </div>
                          </MoreDetailsSection>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => { resetForm(); setShowCreateDialog(false); }} className="flex-1">
                              {t("timeLeave.shiftScheduling.actions.cancel")}
                            </Button>
                            <Button type="submit" className="flex-1" disabled={createShiftMutation.isPending}>
                              {createShiftMutation.isPending ? (t("common.saving") || "Saving...") : t("timeLeave.shiftScheduling.actions.createShift")}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <MoreDetailsSection>
                  <div className="flex flex-wrap items-center gap-3">
                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <SelectValue placeholder={t("timeLeave.shiftScheduling.controls.allDepartments")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("timeLeave.shiftScheduling.controls.allDepartments")}</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.name}>{getDepartmentLabel(dept.name)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <SelectValue placeholder={t("timeLeave.shiftScheduling.controls.allLocations")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("timeLeave.shiftScheduling.controls.allLocations")}</SelectItem>
                        {locations.map((location) => (
                          <SelectItem key={location} value={location}>{getLocationLabel(location)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-7 gap-1.5 text-xs rounded-md", scheduleViewMode === "employee" && "bg-card shadow-sm text-foreground")}
                        onClick={() => setScheduleViewMode("employee")}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        {t("timeLeave.shiftScheduling.tabs.employees")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-7 gap-1.5 text-xs rounded-md", scheduleViewMode === "location" && "bg-card shadow-sm text-foreground")}
                        onClick={() => setScheduleViewMode("location")}
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        {t("timeLeave.shiftScheduling.controls.location")}
                      </Button>
                    </div>
                  </div>
                </MoreDetailsSection>
              </div>
            )}

            <TabsContent value="schedule" className="mt-0">
              {scheduleViewMode === "employee" ? (
                renderScheduleView()
              ) : (
                <LocationGridView
                  employees={employees}
                  shifts={shifts}
                  selectedWeek={selectedWeek}
                  locations={locations}
                  getLocationLabel={getLocationLabel}
                  onCreateShift={(data) => createShiftMutation.mutateAsync(data)}
                  onDeleteShift={(id) => deleteShiftMutation.mutateAsync(id)}
                  goToPreviousWeek={goToPreviousWeek}
                  goToNextWeek={goToNextWeek}
                  goToCurrentWeek={goToCurrentWeek}
                />
              )}
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
                    onValueChange={handleEmployeeSelect}
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
                    <TimePicker
                      id="edit-start"
                      value={formData.startTime}
                      onChange={(v) => handleInputChange("startTime", v)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-end">
                      {t("timeLeave.shiftScheduling.edit.endTime")}
                    </Label>
                    <TimePicker
                      id="edit-end"
                      value={formData.endTime}
                      onChange={(v) => handleInputChange("endTime", v)}
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
                <MoreDetailsSection>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-position">
                        {t("timeLeave.shiftScheduling.edit.position")}
                      </Label>
                      <Input
                        id="edit-position"
                        value={formData.position}
                        onChange={(e) =>
                          handleInputChange("position", e.target.value)
                        }
                        placeholder={t(
                          "timeLeave.shiftScheduling.edit.positionPlaceholder",
                        )}
                      />
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
                  </div>
                </MoreDetailsSection>
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
                            if (selectedShift?.id) {
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
                  <Button type="submit" className="flex-1" disabled={updateShiftMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateShiftMutation.isPending
                      ? (t("common.saving") || "Saving...")
                      : t("timeLeave.shiftScheduling.actions.update")}
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
