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
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  goalsService,
  OKR,
  Goal,
  OKRStats,
  GoalStats,
  GoalPriority,
  KeyResultStatus,
  MilestoneStatus,
  DEFAULT_DEPARTMENTS,
  QUARTERS,
} from "@/services/goalsService";
import { useTenantId } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAllEmployees } from "@/hooks/useEmployees";
import {
  Target,
  CheckSquare,
  BarChart3,
  TrendingUp,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Plus,
  Clock,
} from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import { getTodayTL } from "@/lib/dateUtils";

// ============================================
// Helper Components
// ============================================

const getStatusBadge = (status: string, type: "okr" | "goal" | "keyresult" | "milestone") => {
  const statusConfig: Record<string, Record<string, string>> = {
    okr: {
      active: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      at_risk: "bg-red-100 text-red-800",
      draft: "bg-gray-100 text-gray-800",
    },
    keyresult: {
      on_track: "bg-green-100 text-green-800",
      at_risk: "bg-yellow-100 text-yellow-800",
      behind: "bg-red-100 text-red-800",
      completed: "bg-green-100 text-green-800",
    },
    goal: {
      active: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      paused: "bg-yellow-100 text-yellow-800",
    },
    milestone: {
      pending: "bg-gray-100 text-gray-800",
      completed: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
    },
  };

  const config = statusConfig[type] || {};
  const className = config[status] || "bg-gray-100 text-gray-800";
  return <Badge className={className}>{status.replace("_", " ")}</Badge>;
};

const getPriorityBadge = (priority: GoalPriority) => {
  const priorityConfig = {
    high: "bg-red-100 text-red-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-green-100 text-green-800",
  };
  return <Badge className={priorityConfig[priority]}>{priority}</Badge>;
};

// ============================================
// Main Component
// ============================================

export default function Goals() {
  const { toast } = useToast();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { data: employees = [] } = useAllEmployees();

  // State
  const [loading, setLoading] = useState(true);
  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [okrStats, setOkrStats] = useState<OKRStats | null>(null);
  const [goalStats, setGoalStats] = useState<GoalStats | null>(null);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedQuarter, setSelectedQuarter] = useState(`Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`);
  const [_selectedYear] = useState(new Date().getFullYear());

  // Dialog states
  const [showOKRDialog, setShowOKRDialog] = useState(false);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedOKR, setSelectedOKR] = useState<OKR | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [deleteType, setDeleteType] = useState<"okr" | "goal">("okr");
  const [saving, setSaving] = useState(false);

  // Form states
  const [okrFormData, setOkrFormData] = useState({
    title: "",
    description: "",
    department: "",
    ownerId: "",
    quarter: selectedQuarter,
    keyResults: [{ title: "", targetValue: 0, currentValue: 0, unit: "", dueDate: "" }],
  });

  const [goalFormData, setGoalFormData] = useState({
    title: "",
    description: "",
    department: "",
    priority: "medium" as GoalPriority,
    startDate: getTodayTL(),
    endDate: "",
    milestones: [{ title: "", description: "", dueDate: "", assigneeId: "" }],
  });

  // Quarters list
  const currentYear = new Date().getFullYear();
  const quarters = [
    ...QUARTERS.map((q) => `${q} ${currentYear}`),
    ...QUARTERS.map((q) => `${q} ${currentYear + 1}`),
  ];

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, selectedQuarter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [quarter, yearStr] = selectedQuarter.split(" ");
      const year = parseInt(yearStr, 10);

      const [okrsData, goalsData, okrStatsData, goalStatsData] = await Promise.all([
        goalsService.getOKRs(tenantId, { quarter, year }),
        goalsService.getGoals(tenantId, { year }),
        goalsService.getOKRStats(tenantId, quarter, year),
        goalsService.getGoalStats(tenantId, year),
      ]);

      setOkrs(okrsData);
      setGoals(goalsData);
      setOkrStats(okrStatsData);
      setGoalStats(goalStatsData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------
  // OKR Handlers
  // ----------------------------------------

  const openOKRDialog = (okr?: OKR) => {
    if (okr) {
      setSelectedOKR(okr);
      setOkrFormData({
        title: okr.title,
        description: okr.description,
        department: okr.department,
        ownerId: okr.ownerId,
        quarter: `${okr.quarter} ${okr.year}`,
        keyResults: okr.keyResults.map((kr) => ({
          title: kr.title,
          targetValue: kr.targetValue,
          currentValue: kr.currentValue,
          unit: kr.unit,
          dueDate: kr.dueDate,
        })),
      });
    } else {
      setSelectedOKR(null);
      setOkrFormData({
        title: "",
        description: "",
        department: "",
        ownerId: "",
        quarter: selectedQuarter,
        keyResults: [{ title: "", targetValue: 0, currentValue: 0, unit: "", dueDate: "" }],
      });
    }
    setShowOKRDialog(true);
  };

  const handleSaveOKR = async () => {
    if (!okrFormData.title || !okrFormData.department) {
      toast({
        title: "Error",
        description: "Please fill in required fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const [quarter, yearStr] = okrFormData.quarter.split(" ");
      const year = parseInt(yearStr, 10);
      const owner = employees.find((e) => e.id === okrFormData.ownerId);

      const okrData = {
        title: okrFormData.title,
        description: okrFormData.description,
        department: okrFormData.department,
        ownerId: okrFormData.ownerId || user?.uid || "",
        ownerName: owner
          ? `${owner.personalInfo.firstName} ${owner.personalInfo.lastName}`
          : user?.displayName || "Manager",
        quarter,
        year,
        keyResults: okrFormData.keyResults
          .filter((kr) => kr.title)
          .map((kr, index) => ({
            id: `kr_${Date.now()}_${index}`,
            title: kr.title,
            description: "",
            targetValue: kr.targetValue,
            currentValue: kr.currentValue,
            unit: kr.unit,
            dueDate: kr.dueDate,
            progress: 0,
            status: "on_track" as KeyResultStatus,
          })),
      };

      if (selectedOKR) {
        await goalsService.updateOKR(tenantId, selectedOKR.id!, okrData);
        toast({ title: "Success", description: "OKR updated successfully" });
      } else {
        await goalsService.createOKR(tenantId, okrData);
        toast({ title: "Success", description: "OKR created successfully" });
      }

      setShowOKRDialog(false);
      loadData();
    } catch (error) {
      console.error("Error saving OKR:", error);
      toast({
        title: "Error",
        description: "Failed to save OKR",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------
  // Goal Handlers
  // ----------------------------------------

  const openGoalDialog = (goal?: Goal) => {
    if (goal) {
      setSelectedGoal(goal);
      setGoalFormData({
        title: goal.title,
        description: goal.description,
        department: goal.department,
        priority: goal.priority,
        startDate: goal.startDate,
        endDate: goal.endDate,
        milestones: goal.milestones.map((m) => ({
          title: m.title,
          description: m.description || "",
          dueDate: m.dueDate,
          assigneeId: m.assigneeId || "",
        })),
      });
    } else {
      setSelectedGoal(null);
      setGoalFormData({
        title: "",
        description: "",
        department: "",
        priority: "medium",
        startDate: getTodayTL(),
        endDate: "",
        milestones: [{ title: "", description: "", dueDate: "", assigneeId: "" }],
      });
    }
    setShowGoalDialog(true);
  };

  const handleSaveGoal = async () => {
    if (!goalFormData.title || !goalFormData.department || !goalFormData.endDate) {
      toast({
        title: "Error",
        description: "Please fill in required fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const goalData = {
        title: goalFormData.title,
        description: goalFormData.description,
        department: goalFormData.department,
        priority: goalFormData.priority,
        startDate: goalFormData.startDate,
        endDate: goalFormData.endDate,
        createdById: user?.uid || "",
        createdByName: user?.displayName || user?.email || "Manager",
        assignedTeams: [],
        linkedOKRs: [],
        milestones: goalFormData.milestones
          .filter((m) => m.title)
          .map((m, index) => {
            const assignee = employees.find((e) => e.id === m.assigneeId);
            return {
              id: `m_${Date.now()}_${index}`,
              title: m.title,
              description: m.description,
              dueDate: m.dueDate,
              status: "pending" as MilestoneStatus,
              assigneeId: m.assigneeId,
              assigneeName: assignee
                ? `${assignee.personalInfo.firstName} ${assignee.personalInfo.lastName}`
                : undefined,
            };
          }),
      };

      if (selectedGoal) {
        await goalsService.updateGoal(tenantId, selectedGoal.id!, goalData);
        toast({ title: "Success", description: "Goal updated successfully" });
      } else {
        await goalsService.createGoal(tenantId, goalData);
        toast({ title: "Success", description: "Goal created successfully" });
      }

      setShowGoalDialog(false);
      loadData();
    } catch (error) {
      console.error("Error saving goal:", error);
      toast({
        title: "Error",
        description: "Failed to save goal",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------
  // Delete Handlers
  // ----------------------------------------

  const confirmDelete = (type: "okr" | "goal", item: OKR | Goal) => {
    setDeleteType(type);
    if (type === "okr") {
      setSelectedOKR(item as OKR);
    } else {
      setSelectedGoal(item as Goal);
    }
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    try {
      if (deleteType === "okr" && selectedOKR) {
        await goalsService.deleteOKR(tenantId, selectedOKR.id!);
        toast({ title: "Success", description: "OKR deleted successfully" });
      } else if (deleteType === "goal" && selectedGoal) {
        await goalsService.deleteGoal(tenantId, selectedGoal.id!);
        toast({ title: "Success", description: "Goal deleted successfully" });
      }
      setShowDeleteDialog(false);
      loadData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast({
        title: "Error",
        description: "Failed to delete",
        variant: "destructive",
      });
    }
  };

  // ----------------------------------------
  // Render
  // ----------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
          <AutoBreadcrumb className="mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-28 mb-2" />
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.goals} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-orange-50 dark:bg-orange-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25">
                <Target className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Performance & Goals Management
                </h1>
                <p className="text-muted-foreground mt-1">
                  Strategic planning with OKRs and performance tracking
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quarters.map((quarter) => (
                    <SelectItem key={quarter} value={quarter}>
                      {quarter}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => openOKRDialog()}
                className="bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600"
              >
                <Plus className="h-4 w-4 mr-2" />
                New OKR
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="okrs">OKRs ({okrs.length})</TabsTrigger>
            <TabsTrigger value="goals">Goals ({goals.length})</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6">
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border/50 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active OKRs</CardTitle>
                    <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg">
                      <Target className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {okrStats?.active || 0}/{okrStats?.totalOKRs || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {okrStats?.atRisk ? `${okrStats.atRisk} at risk` : "All on track"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border/50 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
                    <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                      <CheckSquare className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {goalStats?.active || 0}/{goalStats?.totalGoals || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Strategic objectives</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg. OKR Progress</CardTitle>
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{okrStats?.avgProgress || 0}%</div>
                    <Progress value={okrStats?.avgProgress || 0} className="mt-2" />
                  </CardContent>
                </Card>
                <Card className="border-border/50 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg. Goal Progress</CardTitle>
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-violet-500 rounded-lg">
                      <BarChart3 className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{goalStats?.avgProgress || 0}%</div>
                    <Progress value={goalStats?.avgProgress || 0} className="mt-2" />
                  </CardContent>
                </Card>
              </div>

              {/* Quick Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      Recent OKRs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {okrs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No OKRs yet for {selectedQuarter}</p>
                        <Button className="mt-4" onClick={() => openOKRDialog()}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create First OKR
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {okrs.slice(0, 3).map((okr) => (
                          <div key={okr.id} className="flex items-center justify-between">
                            <div className="space-y-1 flex-1">
                              <p className="font-medium">{okr.title}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-muted-foreground">{okr.department}</p>
                                {getStatusBadge(okr.status, "okr")}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">{okr.progress}%</p>
                              <Progress value={okr.progress} className="w-20" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      Recent Goals
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {goals.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No goals yet</p>
                        <Button className="mt-4" onClick={() => openGoalDialog()}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create First Goal
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {goals.slice(0, 3).map((goal) => (
                          <div key={goal.id} className="flex items-center justify-between">
                            <div className="space-y-1 flex-1">
                              <p className="font-medium">{goal.title}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-muted-foreground">{goal.department}</p>
                                {getStatusBadge(goal.status, "goal")}
                                {getPriorityBadge(goal.priority)}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">{goal.progress}%</p>
                              <Progress value={goal.progress} className="w-20" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* OKRs Tab */}
          <TabsContent value="okrs" className="mt-6">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      Objectives & Key Results ({selectedQuarter})
                    </CardTitle>
                    <CardDescription>
                      Quarterly objectives with measurable key results
                    </CardDescription>
                  </div>
                  <Button onClick={() => openOKRDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create OKR
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {okrs.length === 0 ? (
                  <div className="text-center py-12">
                    <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No OKRs Found</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first OKR for {selectedQuarter}
                    </p>
                    <Button onClick={() => openOKRDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create OKR
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {okrs.map((okr) => (
                      <Card key={okr.id} className="border-l-4 border-l-orange-500 border-border/50">
                        <CardContent className="pt-6">
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-lg">{okr.title}</h3>
                                  {getStatusBadge(okr.status, "okr")}
                                  <Badge variant="outline">{okr.department}</Badge>
                                </div>
                                <p className="text-muted-foreground">{okr.description}</p>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span>Owner: {okr.ownerName}</span>
                                  <span>Quarter: {okr.quarter} {okr.year}</span>
                                  <span>Progress: {okr.progress}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Progress value={okr.progress} className="flex-1" />
                                  <span className="text-sm font-medium">{okr.progress}%</span>
                                </div>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openOKRDialog(okr)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => confirmDelete("okr", okr)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Key Results */}
                            {okr.keyResults.length > 0 && (
                              <div className="ml-4 space-y-3">
                                <h4 className="font-medium">Key Results:</h4>
                                {okr.keyResults.map((kr) => (
                                  <div
                                    key={kr.id}
                                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                                  >
                                    <div className="space-y-1">
                                      <p className="font-medium text-sm">{kr.title}</p>
                                      <div className="flex items-center gap-2">
                                        {getStatusBadge(kr.status, "keyresult")}
                                        <span className="text-xs text-muted-foreground">
                                          Due: {new Date(kr.dueDate).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-medium">
                                        {kr.currentValue.toLocaleString()}
                                        {kr.unit} / {kr.targetValue.toLocaleString()}
                                        {kr.unit}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Progress value={kr.progress} className="w-16 h-2" />
                                        <span className="text-xs font-medium">{kr.progress}%</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Goals Tab */}
          <TabsContent value="goals" className="mt-6">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      Strategic Goals
                    </CardTitle>
                    <CardDescription>
                      Long-term objectives with milestones
                    </CardDescription>
                  </div>
                  <Button onClick={() => openGoalDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Goal
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {goals.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No Goals Found</h3>
                    <p className="text-muted-foreground mb-4">Create your first strategic goal</p>
                    <Button onClick={() => openGoalDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Goal
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {goals.map((goal) => (
                      <Card key={goal.id} className="border-border/50">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{goal.title}</h3>
                                {getStatusBadge(goal.status, "goal")}
                                {getPriorityBadge(goal.priority)}
                              </div>
                              <p className="text-sm text-muted-foreground">{goal.description}</p>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>Department: {goal.department}</span>
                                <span>
                                  Timeline: {new Date(goal.startDate).toLocaleDateString()} -{" "}
                                  {new Date(goal.endDate).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress value={goal.progress} className="flex-1" />
                                <span className="text-sm font-medium">{goal.progress}%</span>
                              </div>

                              {/* Milestones */}
                              {goal.milestones.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-sm font-medium mb-2">Milestones:</p>
                                  <div className="space-y-1">
                                    {goal.milestones.map((milestone) => (
                                      <div key={milestone.id} className="flex items-center gap-2 text-sm">
                                        {milestone.status === "completed" ? (
                                          <CheckCircle className="h-4 w-4 text-green-600" />
                                        ) : milestone.status === "overdue" ? (
                                          <XCircle className="h-4 w-4 text-red-600" />
                                        ) : (
                                          <Clock className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <span
                                          className={
                                            milestone.status === "completed"
                                              ? "line-through text-muted-foreground"
                                              : ""
                                          }
                                        >
                                          {milestone.title}
                                        </span>
                                        <span className="text-muted-foreground">
                                          (Due: {new Date(milestone.dueDate).toLocaleDateString()})
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openGoalDialog(goal)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => confirmDelete("goal", goal)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* OKR Dialog */}
        <Dialog open={showOKRDialog} onOpenChange={setShowOKRDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedOKR ? "Edit OKR" : "Create OKR"}</DialogTitle>
              <DialogDescription>
                Define quarterly objectives with measurable key results
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Objective Title *</Label>
                <Input
                  value={okrFormData.title}
                  onChange={(e) => setOkrFormData({ ...okrFormData, title: e.target.value })}
                  placeholder="e.g., Improve Customer Experience"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={okrFormData.description}
                  onChange={(e) =>
                    setOkrFormData({ ...okrFormData, description: e.target.value })
                  }
                  placeholder="Describe the objective"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Department *</Label>
                  <Select
                    value={okrFormData.department}
                    onValueChange={(v) => setOkrFormData({ ...okrFormData, department: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quarter *</Label>
                  <Select
                    value={okrFormData.quarter}
                    onValueChange={(v) => setOkrFormData({ ...okrFormData, quarter: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {quarters.map((quarter) => (
                        <SelectItem key={quarter} value={quarter}>
                          {quarter}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Owner</Label>
                <Select
                  value={okrFormData.ownerId}
                  onValueChange={(v) => setOkrFormData({ ...okrFormData, ownerId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter((e) => e.status === "active")
                      .map((emp) => (
                        <SelectItem key={emp.id} value={emp.id || ""}>
                          {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Key Results</Label>
                {okrFormData.keyResults.map((kr, index) => (
                  <div key={index} className="grid grid-cols-4 gap-2 mt-2">
                    <Input
                      placeholder="Key result title"
                      value={kr.title}
                      onChange={(e) => {
                        const newKRs = [...okrFormData.keyResults];
                        newKRs[index] = { ...newKRs[index], title: e.target.value };
                        setOkrFormData({ ...okrFormData, keyResults: newKRs });
                      }}
                      className="col-span-2"
                    />
                    <Input
                      type="number"
                      placeholder="Target"
                      value={kr.targetValue || ""}
                      onChange={(e) => {
                        const newKRs = [...okrFormData.keyResults];
                        newKRs[index] = { ...newKRs[index], targetValue: Number(e.target.value) };
                        setOkrFormData({ ...okrFormData, keyResults: newKRs });
                      }}
                    />
                    <Input
                      placeholder="Unit"
                      value={kr.unit}
                      onChange={(e) => {
                        const newKRs = [...okrFormData.keyResults];
                        newKRs[index] = { ...newKRs[index], unit: e.target.value };
                        setOkrFormData({ ...okrFormData, keyResults: newKRs });
                      }}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    setOkrFormData({
                      ...okrFormData,
                      keyResults: [
                        ...okrFormData.keyResults,
                        { title: "", targetValue: 0, currentValue: 0, unit: "", dueDate: "" },
                      ],
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Key Result
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOKRDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveOKR} disabled={saving}>
                {saving ? "Saving..." : selectedOKR ? "Update OKR" : "Create OKR"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Goal Dialog */}
        <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedGoal ? "Edit Goal" : "Create Goal"}</DialogTitle>
              <DialogDescription>Set strategic goals with milestones</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Goal Title *</Label>
                <Input
                  value={goalFormData.title}
                  onChange={(e) => setGoalFormData({ ...goalFormData, title: e.target.value })}
                  placeholder="e.g., Q4 Product Launch"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={goalFormData.description}
                  onChange={(e) =>
                    setGoalFormData({ ...goalFormData, description: e.target.value })
                  }
                  placeholder="Describe the goal"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Department *</Label>
                  <Select
                    value={goalFormData.department}
                    onValueChange={(v) => setGoalFormData({ ...goalFormData, department: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority *</Label>
                  <Select
                    value={goalFormData.priority}
                    onValueChange={(v) =>
                      setGoalFormData({ ...goalFormData, priority: v as GoalPriority })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={goalFormData.startDate}
                    onChange={(e) =>
                      setGoalFormData({ ...goalFormData, startDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={goalFormData.endDate}
                    onChange={(e) => setGoalFormData({ ...goalFormData, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Milestones</Label>
                {goalFormData.milestones.map((m, index) => (
                  <div key={index} className="grid grid-cols-3 gap-2 mt-2">
                    <Input
                      placeholder="Milestone title"
                      value={m.title}
                      onChange={(e) => {
                        const newMs = [...goalFormData.milestones];
                        newMs[index] = { ...newMs[index], title: e.target.value };
                        setGoalFormData({ ...goalFormData, milestones: newMs });
                      }}
                    />
                    <Input
                      type="date"
                      placeholder="Due date"
                      value={m.dueDate}
                      onChange={(e) => {
                        const newMs = [...goalFormData.milestones];
                        newMs[index] = { ...newMs[index], dueDate: e.target.value };
                        setGoalFormData({ ...goalFormData, milestones: newMs });
                      }}
                    />
                    <Select
                      value={m.assigneeId}
                      onValueChange={(v) => {
                        const newMs = [...goalFormData.milestones];
                        newMs[index] = { ...newMs[index], assigneeId: v };
                        setGoalFormData({ ...goalFormData, milestones: newMs });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees
                          .filter((e) => e.status === "active")
                          .map((emp) => (
                            <SelectItem key={emp.id} value={emp.id || ""}>
                              {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    setGoalFormData({
                      ...goalFormData,
                      milestones: [
                        ...goalFormData.milestones,
                        { title: "", description: "", dueDate: "", assigneeId: "" },
                      ],
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Milestone
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGoalDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveGoal} disabled={saving}>
                {saving ? "Saving..." : selectedGoal ? "Update Goal" : "Create Goal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deleteType === "okr" ? "OKR" : "Goal"}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete{" "}
                <strong>
                  {deleteType === "okr" ? selectedOKR?.title : selectedGoal?.title}
                </strong>
                . This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
