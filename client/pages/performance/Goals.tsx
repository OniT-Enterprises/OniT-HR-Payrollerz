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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import {
  Target,
  Users,
  CheckSquare,
  BarChart3,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Edit,
  Trash2,
  UserPlus,
  PlayCircle,
  PauseCircle,
  CheckCircle,
  XCircle,
  Bell,
  MessageSquare,
  FileText,
  Award,
  Calendar as CalendarIcon,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Plus,
  Clock,
  Building,
  Zap,
  TrendingDown,
  Star,
  Layers,
  GitBranch,
  Activity,
} from "lucide-react";

// Types for Performance & Goals Management
interface OKR {
  id: string;
  title: string;
  description: string;
  department: string;
  owner: string;
  quarter: string;
  year: number;
  progress: number;
  status: "draft" | "active" | "completed" | "at_risk";
  keyResults: KeyResult[];
  createdAt: string;
  updatedAt: string;
}

interface KeyResult {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  progress: number;
  status: "on_track" | "at_risk" | "behind" | "completed";
  dueDate: string;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  department: string;
  priority: "high" | "medium" | "low";
  status: "active" | "completed" | "paused";
  progress: number;
  startDate: string;
  endDate: string;
  createdBy: string;
  assignedTeams: string[];
  linkedOKRs: string[];
  milestones: Milestone[];
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: "pending" | "completed" | "overdue";
  assignee: string;
}

interface Team {
  id: string;
  name: string;
  department: string;
  leader: string;
  members: string[];
  invitedMembers: {
    id: string;
    name: string;
    department: string;
    status: "pending" | "accepted" | "declined";
  }[];
  goals: string[];
  okrs: string[];
  activeProjects: number;
  performanceScore: number;
}

interface Project {
  id: string;
  title: string;
  description: string;
  teamId: string;
  goalId?: string;
  okrId?: string;
  priority: "high" | "medium" | "low";
  status: "planning" | "active" | "completed" | "paused";
  progress: number;
  startDate: string;
  endDate: string;
  budget?: number;
  tasks: string[];
  risks: Risk[];
}

interface Risk {
  id: string;
  description: string;
  probability: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  mitigation: string;
  status: "open" | "mitigated" | "closed";
}

interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  projectId?: string;
  priority: "high" | "medium" | "low";
  status: "todo" | "inprogress" | "review" | "completed";
  startDate: string;
  dueDate: string;
  estimatedHours: number;
  actualHours?: number;
  tags: string[];
  dependencies: string[];
}

export default function Goals() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState("Q4 2024");
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState<
    "okr" | "goal" | "team" | "project" | "task"
  >("okr");

  // Form states
  const [okrFormData, setOkrFormData] = useState({
    title: "",
    description: "",
    department: "",
    quarter: "Q4 2024",
    keyResults: [{ title: "", targetValue: 0, unit: "", dueDate: "" }],
  });

  const [goalFormData, setGoalFormData] = useState({
    title: "",
    description: "",
    department: "",
    priority: "medium" as const,
    startDate: "",
    endDate: "",
    milestones: [{ title: "", description: "", dueDate: "", assignee: "" }],
  });

  const [teamFormData, setTeamFormData] = useState({
    name: "",
    department: "",
    leader: "",
    members: [] as string[],
  });

  // Mock data
  const departments = [
    "Engineering",
    "Marketing",
    "Sales",
    "HR",
    "Finance",
    "Operations",
  ];
  const quarters = ["Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024", "Q1 2025"];

  const employees = [
    {
      id: "1",
      name: "John Smith",
      department: "Engineering",
      role: "Director",
    },
    {
      id: "2",
      name: "Sarah Johnson",
      department: "Marketing",
      role: "Manager",
    },
    {
      id: "3",
      name: "Mike Davis",
      department: "Engineering",
      role: "Senior Developer",
    },
    { id: "4", name: "Emily Brown", department: "Sales", role: "Manager" },
    {
      id: "5",
      name: "Alex Wilson",
      department: "Engineering",
      role: "Developer",
    },
    { id: "6", name: "Lisa Chen", department: "Marketing", role: "Specialist" },
    {
      id: "7",
      name: "David Rodriguez",
      department: "Sales",
      role: "Representative",
    },
    { id: "8", name: "Anna Garcia", department: "HR", role: "Manager" },
  ];

  const okrs: OKR[] = [
    {
      id: "1",
      title: "Increase Customer Satisfaction",
      description:
        "Improve overall customer satisfaction and reduce churn rate",
      department: "Engineering",
      owner: "1",
      quarter: "Q4 2024",
      year: 2024,
      progress: 75,
      status: "active",
      createdAt: "2024-10-01",
      updatedAt: "2024-11-15",
      keyResults: [
        {
          id: "kr1",
          title: "Achieve 95% customer satisfaction score",
          description: "Measured through monthly surveys",
          targetValue: 95,
          currentValue: 92,
          unit: "%",
          progress: 97,
          status: "on_track",
          dueDate: "2024-12-31",
        },
        {
          id: "kr2",
          title: "Reduce support ticket resolution time",
          description: "Average time to resolve customer issues",
          targetValue: 24,
          currentValue: 36,
          unit: "hours",
          progress: 67,
          status: "at_risk",
          dueDate: "2024-12-31",
        },
        {
          id: "kr3",
          title: "Decrease churn rate",
          description: "Monthly customer churn percentage",
          targetValue: 2,
          currentValue: 3.2,
          unit: "%",
          progress: 62,
          status: "behind",
          dueDate: "2024-12-31",
        },
      ],
    },
    {
      id: "2",
      title: "Scale Revenue Growth",
      description: "Accelerate revenue growth through new customer acquisition",
      department: "Sales",
      owner: "4",
      quarter: "Q4 2024",
      year: 2024,
      progress: 85,
      status: "active",
      createdAt: "2024-10-01",
      updatedAt: "2024-11-14",
      keyResults: [
        {
          id: "kr4",
          title: "Achieve $2M in new revenue",
          description: "Revenue from new customer acquisitions",
          targetValue: 2000000,
          currentValue: 1700000,
          unit: "$",
          progress: 85,
          status: "on_track",
          dueDate: "2024-12-31",
        },
        {
          id: "kr5",
          title: "Close 50 new enterprise deals",
          description: "Enterprise contracts worth $25K+",
          targetValue: 50,
          currentValue: 43,
          unit: "deals",
          progress: 86,
          status: "on_track",
          dueDate: "2024-12-31",
        },
      ],
    },
  ];

  const goals: Goal[] = [
    {
      id: "1",
      title: "Q4 Product Launch",
      description: "Launch new mobile application with core features",
      department: "Engineering",
      priority: "high",
      status: "active",
      progress: 65,
      startDate: "2024-10-01",
      endDate: "2024-12-31",
      createdBy: "1",
      assignedTeams: ["1", "2"],
      linkedOKRs: ["1"],
      milestones: [
        {
          id: "m1",
          title: "Complete MVP Development",
          description: "Finish core features for minimum viable product",
          dueDate: "2024-11-30",
          status: "completed",
          assignee: "3",
        },
        {
          id: "m2",
          title: "User Testing Phase",
          description: "Conduct comprehensive user testing",
          dueDate: "2024-12-15",
          status: "pending",
          assignee: "5",
        },
      ],
    },
    {
      id: "2",
      title: "Customer Acquisition Campaign",
      description: "Increase customer base by 30% through targeted marketing",
      department: "Marketing",
      priority: "high",
      status: "active",
      progress: 40,
      startDate: "2024-11-01",
      endDate: "2024-12-15",
      createdBy: "2",
      assignedTeams: ["3"],
      linkedOKRs: ["2"],
      milestones: [
        {
          id: "m3",
          title: "Campaign Strategy Development",
          description: "Define target audience and messaging",
          dueDate: "2024-11-15",
          status: "completed",
          assignee: "6",
        },
        {
          id: "m4",
          title: "Content Creation",
          description: "Develop marketing materials and content",
          dueDate: "2024-11-30",
          status: "pending",
          assignee: "2",
        },
      ],
    },
  ];

  const teams: Team[] = [
    {
      id: "1",
      name: "Mobile Development Team",
      department: "Engineering",
      leader: "1",
      members: ["1", "3", "5"],
      invitedMembers: [
        {
          id: "6",
          name: "Lisa Chen",
          department: "Marketing",
          status: "pending",
        },
      ],
      goals: ["1"],
      okrs: ["1"],
      activeProjects: 3,
      performanceScore: 87,
    },
    {
      id: "2",
      name: "Backend Infrastructure Team",
      department: "Engineering",
      leader: "3",
      members: ["3", "5"],
      invitedMembers: [],
      goals: ["1"],
      okrs: ["1"],
      activeProjects: 2,
      performanceScore: 92,
    },
    {
      id: "3",
      name: "Growth Marketing Team",
      department: "Marketing",
      leader: "2",
      members: ["2", "6"],
      invitedMembers: [],
      goals: ["2"],
      okrs: ["2"],
      activeProjects: 4,
      performanceScore: 78,
    },
  ];

  const projects: Project[] = [
    {
      id: "1",
      title: "Mobile App UI Development",
      description: "Develop user interface for mobile application",
      teamId: "1",
      goalId: "1",
      okrId: "1",
      priority: "high",
      status: "active",
      progress: 70,
      startDate: "2024-10-15",
      endDate: "2024-11-30",
      budget: 50000,
      tasks: ["1", "2"],
      risks: [
        {
          id: "r1",
          description: "Potential delay in design approval",
          probability: "medium",
          impact: "medium",
          mitigation: "Schedule early stakeholder reviews",
          status: "open",
        },
      ],
    },
    {
      id: "2",
      title: "API Integration",
      description: "Integrate backend APIs with mobile app",
      teamId: "2",
      goalId: "1",
      okrId: "1",
      priority: "high",
      status: "active",
      progress: 45,
      startDate: "2024-10-20",
      endDate: "2024-12-01",
      budget: 30000,
      tasks: ["3", "4"],
      risks: [],
    },
  ];

  const tasks: Task[] = [
    {
      id: "1",
      title: "Design login screen",
      description: "Create responsive login screen with validation",
      assigneeId: "5",
      projectId: "1",
      priority: "high",
      status: "completed",
      startDate: "2024-10-15",
      dueDate: "2024-10-20",
      estimatedHours: 16,
      actualHours: 14,
      tags: ["UI", "Authentication"],
      dependencies: [],
    },
    {
      id: "2",
      title: "Implement navigation",
      description: "Set up app navigation structure",
      assigneeId: "3",
      projectId: "1",
      priority: "medium",
      status: "inprogress",
      startDate: "2024-10-18",
      dueDate: "2024-10-25",
      estimatedHours: 12,
      tags: ["Navigation", "UI"],
      dependencies: ["1"],
    },
    {
      id: "3",
      title: "Setup authentication API",
      description: "Implement user authentication endpoints",
      assigneeId: "3",
      projectId: "2",
      priority: "high",
      status: "review",
      startDate: "2024-10-20",
      dueDate: "2024-10-27",
      estimatedHours: 20,
      tags: ["API", "Authentication"],
      dependencies: [],
    },
  ];

  // Helper functions
  const getStatusBadge = (
    status: string,
    type: "okr" | "goal" | "project" | "task" | "keyresult" = "okr",
  ) => {
    const statusConfig = {
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
      project: {
        planning: "bg-gray-100 text-gray-800",
        active: "bg-blue-100 text-blue-800",
        completed: "bg-green-100 text-green-800",
        paused: "bg-yellow-100 text-yellow-800",
      },
      task: {
        todo: "bg-gray-100 text-gray-800",
        inprogress: "bg-blue-100 text-blue-800",
        review: "bg-purple-100 text-purple-800",
        completed: "bg-green-100 text-green-800",
      },
    };

    const config = statusConfig[type];
    const className = config[status as keyof typeof config];
    return (
      <Badge className={className || "bg-gray-100 text-gray-800"}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: "high" | "medium" | "low") => {
    const priorityConfig = {
      high: "bg-red-100 text-red-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-green-100 text-green-800",
    };
    return <Badge className={priorityConfig[priority]}>{priority}</Badge>;
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getDashboardStats = () => {
    return {
      totalOKRs: okrs.length,
      activeOKRs: okrs.filter((o) => o.status === "active").length,
      totalGoals: goals.length,
      activeGoals: goals.filter((g) => g.status === "active").length,
      totalTeams: teams.length,
      avgTeamPerformance: Math.round(
        teams.reduce((sum, t) => sum + t.performanceScore, 0) / teams.length,
      ),
      totalProjects: projects.length,
      activeProjects: projects.filter((p) => p.status === "active").length,
      completedTasks: tasks.filter((t) => t.status === "completed").length,
      totalTasks: tasks.length,
      atRiskOKRs: okrs.filter((o) => o.status === "at_risk").length,
    };
  };

  const stats = getDashboardStats();

  const openDialog = (type: typeof dialogType) => {
    setDialogType(type);
    setShowDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Implementation would save to Firebase
    toast({
      title: "Success",
      description: `${dialogType} created successfully.`,
    });
    setShowDialog(false);
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active OKRs</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.activeOKRs}/{stats.totalOKRs}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.atRiskOKRs > 0 && `${stats.atRiskOKRs} at risk`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.activeGoals}/{stats.totalGoals}
            </div>
            <p className="text-xs text-muted-foreground">
              Strategic objectives
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Team Performance
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgTeamPerformance}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalTeams} active teams
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Project Progress
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.completedTasks}/{stats.totalTasks}
            </div>
            <p className="text-xs text-muted-foreground">Tasks completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent OKRs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {okrs.slice(0, 3).map((okr) => (
                <div key={okr.id} className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <p className="font-medium">{okr.title}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">
                        {okr.department}
                      </p>
                      {getStatusBadge(okr.status, "okr")}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {okr.progress}%
                    </p>
                    <Progress value={okr.progress} className="w-20" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teams.slice(0, 3).map((team) => {
                const leader = employees.find((e) => e.id === team.leader);
                return (
                  <div
                    key={team.id}
                    className="flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{team.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">
                          Lead: {leader?.name}
                        </p>
                        <Badge variant="outline">
                          {team.members.length} members
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-medium ${getPerformanceColor(team.performanceScore)}`}
                      >
                        {team.performanceScore}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {team.activeProjects} projects
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications & Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Performance Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">OKR At Risk</p>
                <p className="text-sm text-red-600">
                  "Increase Customer Satisfaction" is behind schedule. Support
                  ticket resolution time needs attention.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Upcoming Deadline</p>
                <p className="text-sm text-yellow-600">
                  "User Testing Phase" milestone due in 5 days for Q4 Product
                  Launch.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">Goal Achievement</p>
                <p className="text-sm text-green-600">
                  Sales team exceeded monthly target by 15% - Q4 revenue goal on
                  track.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Performance & Goals Management
              </h1>
              <p className="text-gray-600">
                Strategic planning with OKRs, team collaboration, and
                performance tracking
              </p>
            </div>
            <div className="flex gap-2">
              <Select
                value={selectedQuarter}
                onValueChange={setSelectedQuarter}
              >
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
                onClick={() => openDialog("okr")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                New OKR
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="okrs">OKRs</TabsTrigger>
              <TabsTrigger value="goals">Goals</TabsTrigger>
              <TabsTrigger value="teams">Teams</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-6">
              {renderDashboard()}
            </TabsContent>

            <TabsContent value="okrs" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Objectives & Key Results ({selectedQuarter})
                      </CardTitle>
                      <CardDescription>
                        Quarterly objectives with measurable key results
                      </CardDescription>
                    </div>
                    <Button onClick={() => openDialog("okr")}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create OKR
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {okrs.map((okr) => (
                      <Card
                        key={okr.id}
                        className="border-l-4 border-l-blue-500"
                      >
                        <CardContent className="pt-6">
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-lg">
                                    {okr.title}
                                  </h3>
                                  {getStatusBadge(okr.status, "okr")}
                                  <Badge variant="outline">
                                    {okr.department}
                                  </Badge>
                                </div>
                                <p className="text-gray-600">
                                  {okr.description}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                  <span>
                                    Owner:{" "}
                                    {
                                      employees.find((e) => e.id === okr.owner)
                                        ?.name
                                    }
                                  </span>
                                  <span>Quarter: {okr.quarter}</span>
                                  <span>Progress: {okr.progress}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Progress
                                    value={okr.progress}
                                    className="flex-1"
                                  />
                                  <span className="text-sm font-medium">
                                    {okr.progress}%
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <Button variant="outline" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm">
                                  <MessageSquare className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Key Results */}
                            <div className="ml-4 space-y-3">
                              <h4 className="font-medium text-gray-800">
                                Key Results:
                              </h4>
                              {okr.keyResults.map((kr) => (
                                <div
                                  key={kr.id}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                  <div className="space-y-1">
                                    <p className="font-medium text-sm">
                                      {kr.title}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      {kr.description}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      {getStatusBadge(kr.status, "keyresult")}
                                      <span className="text-xs text-gray-500">
                                        Due:{" "}
                                        {new Date(
                                          kr.dueDate,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-medium">
                                      {kr.currentValue.toLocaleString()}
                                      {kr.unit} /{" "}
                                      {kr.targetValue.toLocaleString()}
                                      {kr.unit}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Progress
                                        value={kr.progress}
                                        className="w-16 h-2"
                                      />
                                      <span className="text-xs font-medium">
                                        {kr.progress}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="goals" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CheckSquare className="h-5 w-5" />
                        Strategic Goals
                      </CardTitle>
                      <CardDescription>
                        Long-term objectives with milestones and team
                        assignments
                      </CardDescription>
                    </div>
                    <Button onClick={() => openDialog("goal")}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Goal
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {goals.map((goal) => (
                      <Card key={goal.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{goal.title}</h3>
                                {getStatusBadge(goal.status, "goal")}
                                {getPriorityBadge(goal.priority)}
                              </div>
                              <p className="text-sm text-gray-600">
                                {goal.description}
                              </p>
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span>Department: {goal.department}</span>
                                <span>
                                  Timeline: {goal.startDate} to {goal.endDate}
                                </span>
                                <span>Teams: {goal.assignedTeams.length}</span>
                                <span>
                                  Linked OKRs: {goal.linkedOKRs.length}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={goal.progress}
                                  className="flex-1"
                                />
                                <span className="text-sm font-medium">
                                  {goal.progress}%
                                </span>
                              </div>

                              {/* Milestones */}
                              {goal.milestones.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-sm font-medium text-gray-700 mb-2">
                                    Milestones:
                                  </p>
                                  <div className="space-y-1">
                                    {goal.milestones.map((milestone) => (
                                      <div
                                        key={milestone.id}
                                        className="flex items-center gap-2 text-sm"
                                      >
                                        {milestone.status === "completed" ? (
                                          <CheckCircle className="h-4 w-4 text-green-600" />
                                        ) : milestone.status === "overdue" ? (
                                          <XCircle className="h-4 w-4 text-red-600" />
                                        ) : (
                                          <Clock className="h-4 w-4 text-gray-400" />
                                        )}
                                        <span
                                          className={
                                            milestone.status === "completed"
                                              ? "line-through text-gray-500"
                                              : ""
                                          }
                                        >
                                          {milestone.title}
                                        </span>
                                        <span className="text-gray-400">
                                          (Due:{" "}
                                          {new Date(
                                            milestone.dueDate,
                                          ).toLocaleDateString()}
                                          )
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="teams" className="mt-6">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          Performance Teams
                        </CardTitle>
                        <CardDescription>
                          Cross-functional teams working on strategic
                          initiatives
                        </CardDescription>
                      </div>
                      <Button onClick={() => openDialog("team")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Team
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {teams.map((team) => {
                        const leader = employees.find(
                          (e) => e.id === team.leader,
                        );
                        return (
                          <Card key={team.id}>
                            <CardContent className="pt-6">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h3 className="font-semibold">{team.name}</h3>
                                  <div className="flex items-center gap-2">
                                    <Star className="h-4 w-4 text-yellow-500" />
                                    <span
                                      className={`font-medium ${getPerformanceColor(team.performanceScore)}`}
                                    >
                                      {team.performanceScore}%
                                    </span>
                                  </div>
                                </div>
                                <Badge variant="outline">
                                  {team.department}
                                </Badge>
                                <div className="text-sm text-gray-600">
                                  <p>
                                    Leader: {leader?.name} ({leader?.role})
                                  </p>
                                  <p>Members: {team.members.length}</p>
                                  <p>Active Projects: {team.activeProjects}</p>
                                  <p>
                                    Goals: {team.goals.length} | OKRs:{" "}
                                    {team.okrs.length}
                                  </p>
                                </div>
                                {team.invitedMembers.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium">
                                      Pending Invitations:
                                    </p>
                                    {team.invitedMembers.map((invite) => (
                                      <div
                                        key={invite.id}
                                        className="flex items-center justify-between text-sm"
                                      >
                                        <span>
                                          {invite.name} ({invite.department})
                                        </span>
                                        <Badge className="bg-yellow-100 text-yellow-800">
                                          {invite.status}
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm">
                                    <UserPlus className="h-4 w-4 mr-1" />
                                    Invite
                                  </Button>
                                  <Button variant="outline" size="sm">
                                    <Edit className="h-4 w-4" />
                                  </Button>
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
            </TabsContent>

            <TabsContent value="projects" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5" />
                        Strategic Projects
                      </CardTitle>
                      <CardDescription>
                        Projects linked to goals and OKRs with risk management
                      </CardDescription>
                    </div>
                    <Button onClick={() => openDialog("project")}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Project
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projects.map((project) => {
                      const team = teams.find((t) => t.id === project.teamId);
                      const goal = goals.find((g) => g.id === project.goalId);
                      const okr = okrs.find((o) => o.id === project.okrId);
                      return (
                        <Card key={project.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">
                                    {project.title}
                                  </h3>
                                  {getStatusBadge(project.status, "project")}
                                  {getPriorityBadge(project.priority)}
                                </div>
                                <p className="text-sm text-gray-600">
                                  {project.description}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                  <span>Team: {team?.name}</span>
                                  {goal && <span>Goal: {goal.title}</span>}
                                  {okr && <span>OKR: {okr.title}</span>}
                                  <span>
                                    Timeline: {project.startDate} to{" "}
                                    {project.endDate}
                                  </span>
                                  {project.budget && (
                                    <span>
                                      Budget: ${project.budget.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Progress
                                    value={project.progress}
                                    className="flex-1"
                                  />
                                  <span className="text-sm font-medium">
                                    {project.progress}%
                                  </span>
                                </div>

                                {/* Risk Indicators */}
                                {project.risks.length > 0 && (
                                  <div className="mt-2">
                                    <div className="flex items-center gap-2">
                                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                      <span className="text-sm font-medium">
                                        Risks:
                                      </span>
                                      <Badge className="bg-yellow-100 text-yellow-800">
                                        {project.risks.length} identified
                                      </Badge>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2 ml-4">
                                <Button variant="outline" size="sm">
                                  {project.status === "active" ? (
                                    <PauseCircle className="h-4 w-4" />
                                  ) : (
                                    <PlayCircle className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button variant="outline" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Performance Trends
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div>
                          <p className="font-medium text-green-800">
                            OKR Completion Rate
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            87%
                          </p>
                        </div>
                        <ArrowUpRight className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div>
                          <p className="font-medium text-blue-800">
                            Goal Achievement
                          </p>
                          <p className="text-2xl font-bold text-blue-600">
                            72%
                          </p>
                        </div>
                        <TrendingUp className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                        <div>
                          <p className="font-medium text-yellow-800">
                            Team Collaboration
                          </p>
                          <p className="text-2xl font-bold text-yellow-600">
                            94%
                          </p>
                        </div>
                        <Users className="h-6 w-6 text-yellow-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Department Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {departments.map((dept) => {
                        const deptTeams = teams.filter(
                          (t) => t.department === dept,
                        );
                        const avgScore =
                          deptTeams.length > 0
                            ? Math.round(
                                deptTeams.reduce(
                                  (sum, t) => sum + t.performanceScore,
                                  0,
                                ) / deptTeams.length,
                              )
                            : 0;
                        return (
                          <div
                            key={dept}
                            className="flex items-center justify-between"
                          >
                            <div>
                              <p className="font-medium">{dept}</p>
                              <p className="text-sm text-gray-500">
                                {deptTeams.length} teams
                              </p>
                            </div>
                            <div className="text-right">
                              <p
                                className={`font-medium ${getPerformanceColor(avgScore)}`}
                              >
                                {avgScore}%
                              </p>
                              <Progress value={avgScore} className="w-20" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Key Insights & Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <h4 className="font-medium text-green-800">
                          🎯 Strengths
                        </h4>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                            <span>
                              Sales team exceeding quarterly targets
                              consistently
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                            <span>
                              Strong cross-departmental collaboration (94%)
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                            <span>
                              Engineering teams maintaining high velocity
                            </span>
                          </li>
                        </ul>
                      </div>
                      <div className="space-y-3">
                        <h4 className="font-medium text-red-800">
                          ⚠️ Areas for Improvement
                        </h4>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                            <span>
                              Customer support response times need attention
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                            <span>Marketing team capacity constraints</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                            <span>Some OKRs at risk of missing Q4 targets</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Universal Dialog */}
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {dialogType === "okr" && "Create OKR"}
                  {dialogType === "goal" && "Create Strategic Goal"}
                  {dialogType === "team" && "Create Performance Team"}
                  {dialogType === "project" && "Create Project"}
                  {dialogType === "task" && "Create Task"}
                </DialogTitle>
                <DialogDescription>
                  {dialogType === "okr" &&
                    "Define quarterly objectives with measurable key results"}
                  {dialogType === "goal" &&
                    "Set strategic goals with milestones and team assignments"}
                  {dialogType === "team" &&
                    "Build cross-functional teams for strategic initiatives"}
                  {dialogType === "project" &&
                    "Create projects linked to goals and OKRs"}
                  {dialogType === "task" &&
                    "Assign specific tasks to team members"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {dialogType === "okr" && (
                  <>
                    <div>
                      <Label>Objective Title *</Label>
                      <Input
                        value={okrFormData.title}
                        onChange={(e) =>
                          setOkrFormData((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        placeholder="e.g., Improve Customer Experience"
                        required
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={okrFormData.description}
                        onChange={(e) =>
                          setOkrFormData((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Describe the objective and its importance"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Department *</Label>
                        <Select
                          value={okrFormData.department}
                          onValueChange={(value) =>
                            setOkrFormData((prev) => ({
                              ...prev,
                              department: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
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
                          onValueChange={(value) =>
                            setOkrFormData((prev) => ({
                              ...prev,
                              quarter: value,
                            }))
                          }
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
                      <Label>Key Results</Label>
                      {okrFormData.keyResults.map((kr, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-3 gap-2 mt-2"
                        >
                          <Input
                            placeholder="Key result title"
                            value={kr.title}
                            onChange={(e) => {
                              const newKRs = [...okrFormData.keyResults];
                              newKRs[index].title = e.target.value;
                              setOkrFormData((prev) => ({
                                ...prev,
                                keyResults: newKRs,
                              }));
                            }}
                          />
                          <Input
                            type="number"
                            placeholder="Target value"
                            value={kr.targetValue}
                            onChange={(e) => {
                              const newKRs = [...okrFormData.keyResults];
                              newKRs[index].targetValue = Number(
                                e.target.value,
                              );
                              setOkrFormData((prev) => ({
                                ...prev,
                                keyResults: newKRs,
                              }));
                            }}
                          />
                          <Input
                            placeholder="Unit (%, $, etc.)"
                            value={kr.unit}
                            onChange={(e) => {
                              const newKRs = [...okrFormData.keyResults];
                              newKRs[index].unit = e.target.value;
                              setOkrFormData((prev) => ({
                                ...prev,
                                keyResults: newKRs,
                              }));
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
                          setOkrFormData((prev) => ({
                            ...prev,
                            keyResults: [
                              ...prev.keyResults,
                              {
                                title: "",
                                targetValue: 0,
                                unit: "",
                                dueDate: "",
                              },
                            ],
                          }))
                        }
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Key Result
                      </Button>
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDialog(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1">
                    Create {dialogType.toUpperCase()}
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
