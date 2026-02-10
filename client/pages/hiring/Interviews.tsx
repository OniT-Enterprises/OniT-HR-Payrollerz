import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
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
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO, seoConfig } from "@/components/SEO";
import { useTenantId } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAllEmployees } from "@/hooks/useEmployees";
import {
  interviewService,
  Interview,
  InterviewStatus,
  InterviewType,
  InterviewDecision,
  InterviewFeedback,
  INTERVIEW_TYPES,
  INTERVIEW_DURATIONS,
  DECISION_OPTIONS,
  DEFAULT_PRE_CHECKS,
  getInterviewTypeName,
  getDecisionDisplay,
  getPreCheckProgress,
  formatInterviewDateTime,
} from "@/services/interviewService";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Users,
  Mail,
  Phone,
  Search,
  Plus,
  CheckCircle,
  X,
  Star,
  AlertTriangle,
  CalendarDays,
  Video,
  MapPin,
  Loader2,
  Trash2,
  Edit,
  Eye,
  MessageSquare,
} from "lucide-react";

export default function Interviews() {
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { data: employees = [], isLoading: employeesLoading } = useAllEmployees();

  // State
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog states
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);

  // Form state for scheduling
  const [formData, setFormData] = useState({
    candidateName: "",
    candidateEmail: "",
    candidatePhone: "",
    position: "",
    interviewDate: "",
    interviewTime: "",
    duration: 60,
    interviewType: "video" as InterviewType,
    location: "",
    meetingLink: "",
    interviewerIds: [] as string[],
  });

  // Feedback form state
  const [feedbackData, setFeedbackData] = useState<Omit<InterviewFeedback, 'submittedAt'>>({
    interviewerId: "",
    interviewerName: "",
    overallRating: 3,
    technicalSkills: 3,
    communicationSkills: 3,
    cultureFit: 3,
    strengths: "",
    weaknesses: "",
    recommendation: "pending" as InterviewDecision,
    notes: "",
  });

  // Load interviews
  useEffect(() => {
    if (tenantId) {
      loadInterviews();
    }
  }, [tenantId]);

  const loadInterviews = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await interviewService.getInterviews(tenantId);
      setInterviews(data);
    } catch (error) {
      console.error("Error loading interviews:", error);
      toast.error("Failed to load interviews");
    } finally {
      setLoading(false);
    }
  };

  // Get filtered interviews
  const getFilteredInterviews = () => {
    let filtered = [...interviews];

    // Tab filter
    const today = new Date().toISOString().split("T")[0];
    if (activeTab === "upcoming") {
      filtered = filtered.filter(
        (i) => i.interviewDate >= today && i.status === "scheduled"
      );
    } else if (activeTab === "past") {
      filtered = filtered.filter(
        (i) => i.interviewDate < today || i.status !== "scheduled"
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.candidateName.toLowerCase().includes(query) ||
          i.candidateEmail.toLowerCase().includes(query) ||
          i.position.toLowerCase().includes(query)
      );
    }

    // Sort by date
    filtered.sort((a, b) => {
      const dateA = `${a.interviewDate}T${a.interviewTime}`;
      const dateB = `${b.interviewDate}T${b.interviewTime}`;
      return activeTab === "upcoming"
        ? dateA.localeCompare(dateB)
        : dateB.localeCompare(dateA);
    });

    return filtered;
  };

  // Handle schedule interview
  const handleScheduleInterview = async () => {
    if (!tenantId || !user) return;

    if (!formData.candidateName || !formData.candidateEmail || !formData.interviewDate || !formData.interviewTime) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const interviewerNames = formData.interviewerIds
        .map((id) => {
          const emp = employees.find((e) => e.id === id);
          return emp
            ? `${emp.personalInfo?.firstName || ""} ${emp.personalInfo?.lastName || ""}`.trim()
            : "";
        })
        .filter(Boolean);

      if (selectedInterview?.id) {
        // Update existing
        await interviewService.updateInterview(tenantId, selectedInterview.id, {
          candidateName: formData.candidateName,
          candidateEmail: formData.candidateEmail,
          candidatePhone: formData.candidatePhone,
          position: formData.position,
          interviewDate: formData.interviewDate,
          interviewTime: formData.interviewTime,
          duration: formData.duration,
          interviewType: formData.interviewType,
          location: formData.location,
          meetingLink: formData.meetingLink,
          interviewerIds: formData.interviewerIds,
          interviewerNames,
        });
        toast.success("Interview updated");
      } else {
        // Create new
        await interviewService.createInterview(tenantId, {
          candidateName: formData.candidateName,
          candidateEmail: formData.candidateEmail,
          candidatePhone: formData.candidatePhone,
          position: formData.position,
          interviewDate: formData.interviewDate,
          interviewTime: formData.interviewTime,
          duration: formData.duration,
          interviewType: formData.interviewType,
          location: formData.location,
          meetingLink: formData.meetingLink,
          interviewerIds: formData.interviewerIds,
          interviewerNames,
          preChecks: DEFAULT_PRE_CHECKS,
          invitationSent: false,
          reminderSent: false,
          candidateConfirmed: false,
          followUpCall: false,
          createdBy: user.uid,
        });
        toast.success("Interview scheduled");
      }

      setShowScheduleDialog(false);
      resetForm();
      loadInterviews();
    } catch (error) {
      console.error("Error saving interview:", error);
      toast.error("Failed to save interview");
    } finally {
      setSaving(false);
    }
  };

  // Handle submit feedback
  const handleSubmitFeedback = async () => {
    if (!tenantId || !selectedInterview?.id || !user) return;

    if (!feedbackData.interviewerId) {
      toast.error("Please select your name");
      return;
    }

    setSaving(true);
    try {
      const interviewer = employees.find((e) => e.id === feedbackData.interviewerId);
      const interviewerName = interviewer
        ? `${interviewer.personalInfo?.firstName || ""} ${interviewer.personalInfo?.lastName || ""}`.trim()
        : "Unknown";

      await interviewService.addFeedback(tenantId, selectedInterview.id, {
        ...feedbackData,
        interviewerName,
      });

      toast.success("Feedback submitted");
      setShowFeedbackDialog(false);
      setSelectedInterview(null);
      loadInterviews();
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback");
    } finally {
      setSaving(false);
    }
  };

  // Handle pre-check update
  const handlePreCheckUpdate = async (
    interview: Interview,
    check: keyof Interview["preChecks"],
    value: boolean
  ) => {
    if (!tenantId || !interview.id) return;

    try {
      await interviewService.updatePreCheck(tenantId, interview.id, check, value);
      loadInterviews();
    } catch (error) {
      console.error("Error updating pre-check:", error);
      toast.error("Failed to update check");
    }
  };

  // Handle communication actions
  const handleSendInvitation = async (interview: Interview) => {
    if (!tenantId || !interview.id) return;

    try {
      await interviewService.markInvitationSent(tenantId, interview.id);
      toast.success("Invitation marked as sent");
      loadInterviews();
    } catch (error) {
      toast.error("Failed to update");
    }
  };

  const handleFollowUpCall = async (interview: Interview) => {
    if (!tenantId || !interview.id) return;

    try {
      await interviewService.markFollowUpCall(tenantId, interview.id);
      toast.success("Follow-up call recorded");
      loadInterviews();
    } catch (error) {
      toast.error("Failed to update");
    }
  };

  // Handle status changes
  const handleCompleteInterview = async (interview: Interview) => {
    if (!tenantId || !interview.id) return;

    try {
      await interviewService.completeInterview(tenantId, interview.id);
      toast.success("Interview marked as completed");
      loadInterviews();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleCancelInterview = async (interview: Interview) => {
    if (!tenantId || !interview.id) return;

    try {
      await interviewService.cancelInterview(tenantId, interview.id);
      toast.success("Interview cancelled");
      loadInterviews();
    } catch (error) {
      toast.error("Failed to cancel interview");
    }
  };

  const handleNoShow = async (interview: Interview) => {
    if (!tenantId || !interview.id) return;

    try {
      await interviewService.markNoShow(tenantId, interview.id);
      toast.success("Marked as no-show");
      loadInterviews();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!tenantId || !selectedInterview?.id) return;

    setSaving(true);
    try {
      await interviewService.deleteInterview(tenantId, selectedInterview.id);
      toast.success("Interview deleted");
      setDeleteDialogOpen(false);
      setSelectedInterview(null);
      loadInterviews();
    } catch (error) {
      toast.error("Failed to delete interview");
    } finally {
      setSaving(false);
    }
  };

  // Handle make decision
  const handleMakeDecision = async (interview: Interview, decision: InterviewDecision) => {
    if (!tenantId || !interview.id) return;

    try {
      await interviewService.makeDecision(tenantId, interview.id, decision);
      toast.success(`Decision recorded: ${getDecisionDisplay(decision).name}`);
      loadInterviews();
    } catch (error) {
      toast.error("Failed to record decision");
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      candidateName: "",
      candidateEmail: "",
      candidatePhone: "",
      position: "",
      interviewDate: "",
      interviewTime: "",
      duration: 60,
      interviewType: "video",
      location: "",
      meetingLink: "",
      interviewerIds: [],
    });
    setSelectedInterview(null);
  };

  // Open edit dialog
  const openEditDialog = (interview: Interview) => {
    setSelectedInterview(interview);
    setFormData({
      candidateName: interview.candidateName,
      candidateEmail: interview.candidateEmail,
      candidatePhone: interview.candidatePhone || "",
      position: interview.position,
      interviewDate: interview.interviewDate,
      interviewTime: interview.interviewTime,
      duration: interview.duration,
      interviewType: interview.interviewType,
      location: interview.location || "",
      meetingLink: interview.meetingLink || "",
      interviewerIds: interview.interviewerIds,
    });
    setShowScheduleDialog(true);
  };

  // Open feedback dialog
  const openFeedbackDialog = (interview: Interview) => {
    setSelectedInterview(interview);
    setFeedbackData({
      interviewerId: user?.uid || "",
      interviewerName: "",
      overallRating: 3,
      technicalSkills: 3,
      communicationSkills: 3,
      cultureFit: 3,
      strengths: "",
      weaknesses: "",
      recommendation: "pending",
      notes: "",
    });
    setShowFeedbackDialog(true);
  };

  // Get status badge color
  const getStatusColor = (status: InterviewStatus) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20";
      case "completed":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20";
      case "cancelled":
        return "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20";
      case "no_show":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20";
      case "rescheduled":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Calculate stats
  const stats = {
    total: interviews.length,
    upcoming: interviews.filter(
      (i) =>
        i.interviewDate >= new Date().toISOString().split("T")[0] &&
        i.status === "scheduled"
    ).length,
    completed: interviews.filter((i) => i.status === "completed").length,
    pending: interviews.filter(
      (i) => i.status === "completed" && !i.decision
    ).length,
  };

  const filteredInterviews = getFilteredInterviews();

  // Star rating component
  const StarRating = ({
    value,
    onChange,
    readonly = false,
  }: {
    value: number;
    onChange?: (v: number) => void;
    readonly?: boolean;
  }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={`${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
        >
          <Star
            className={`h-5 w-5 ${
              star <= value
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.interviews} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-emerald-50 dark:bg-emerald-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("hiring.interviews.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("hiring.interviews.subtitle")}
                </p>
              </div>
            </div>

            <Button
              onClick={() => {
                resetForm();
                setShowScheduleDialog(true);
              }}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Schedule Interview
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <CalendarDays className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Interviews</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Clock className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.upcoming}</p>
                  <p className="text-sm text-muted-foreground">Upcoming</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <CheckCircle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-sm text-muted-foreground">Pending Decision</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {filteredInterviews.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No interviews found</h3>
                  <p className="text-muted-foreground">
                    {activeTab === "upcoming"
                      ? "No upcoming interviews scheduled"
                      : "No interviews match your filters"}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      resetForm();
                      setShowScheduleDialog(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule Interview
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredInterviews.map((interview) => (
                  <Card key={interview.id} className="border-border/50">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                        {/* Candidate Info */}
                        <div className="flex items-start gap-4 flex-1">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                              {interview.candidateName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-lg">
                                {interview.candidateName}
                              </h3>
                              <Badge className={getStatusColor(interview.status)}>
                                {interview.status.replace("_", " ")}
                              </Badge>
                              {interview.decision && (
                                <Badge
                                  variant="outline"
                                  className={`border-${getDecisionDisplay(interview.decision).color}-500`}
                                >
                                  {getDecisionDisplay(interview.decision).name}
                                </Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground">
                              {interview.position}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {interview.candidateEmail}
                              </span>
                              {interview.candidatePhone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {interview.candidatePhone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Schedule Info */}
                        <div className="flex flex-col items-start gap-2 min-w-[200px]">
                          <div className="flex items-center gap-2 text-sm">
                            <CalendarDays className="h-4 w-4 text-emerald-600" />
                            <span className="font-medium">
                              {formatInterviewDateTime(
                                interview.interviewDate,
                                interview.interviewTime
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{interview.duration} minutes</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {interview.interviewType === "video" ? (
                              <Video className="h-4 w-4" />
                            ) : (
                              <MapPin className="h-4 w-4" />
                            )}
                            <span>
                              {getInterviewTypeName(interview.interviewType)}
                            </span>
                          </div>
                          {interview.interviewerNames.length > 0 && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Users className="h-4 w-4" />
                              <span>
                                {interview.interviewerNames.slice(0, 2).join(", ")}
                                {interview.interviewerNames.length > 2 &&
                                  ` +${interview.interviewerNames.length - 2}`}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Pre-checks */}
                        <div className="min-w-[180px]">
                          <p className="text-sm font-medium mb-2">Pre-Checks</p>
                          <div className="space-y-1">
                            {[
                              { key: "criminalRecord", label: "Background" },
                              { key: "referencesChecked", label: "References" },
                              { key: "idVerified", label: "ID Verified" },
                            ].map((check) => (
                              <div
                                key={check.key}
                                className="flex items-center gap-2"
                              >
                                <Checkbox
                                  checked={
                                    interview.preChecks[
                                      check.key as keyof typeof interview.preChecks
                                    ] as boolean
                                  }
                                  onCheckedChange={(checked) =>
                                    handlePreCheckUpdate(
                                      interview,
                                      check.key as keyof typeof interview.preChecks,
                                      checked as boolean
                                    )
                                  }
                                  disabled={interview.status !== "scheduled"}
                                />
                                <span className="text-sm">{check.label}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {getPreCheckProgress(interview.preChecks)}% complete
                          </div>
                        </div>

                        {/* Communication */}
                        <div className="min-w-[150px]">
                          <p className="text-sm font-medium mb-2">Communication</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={interview.invitationSent}
                                onCheckedChange={() =>
                                  handleSendInvitation(interview)
                                }
                                disabled={interview.invitationSent}
                              />
                              <span className="text-sm">Invite Sent</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={interview.followUpCall}
                                onCheckedChange={() =>
                                  handleFollowUpCall(interview)
                                }
                                disabled={interview.followUpCall}
                              />
                              <span className="text-sm">Follow-up Call</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          {interview.status === "scheduled" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openFeedbackDialog(interview)}
                              >
                                <MessageSquare className="h-3 w-3 mr-1" />
                                Add Feedback
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCompleteInterview(interview)}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Complete
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedInterview(interview);
                              setShowViewDialog(true);
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(interview)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          {interview.status === "scheduled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => handleCancelInterview(interview)}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Feedback Summary */}
                      {interview.feedback.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm font-medium mb-2">
                            Feedback ({interview.feedback.length})
                          </p>
                          <div className="flex flex-wrap gap-4">
                            {interview.feedback.map((fb, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                              >
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs">
                                    {fb.interviewerName
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{fb.interviewerName}</span>
                                <StarRating value={fb.overallRating} readonly />
                                <Badge variant="outline" className="text-xs">
                                  {getDecisionDisplay(fb.recommendation).name}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Decision Buttons */}
                      {interview.status === "completed" && !interview.decision && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm font-medium mb-2">Make Decision</p>
                          <div className="flex flex-wrap gap-2">
                            {DECISION_OPTIONS.filter((d) => d.id !== "pending").map(
                              (option) => (
                                <Button
                                  key={option.id}
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleMakeDecision(interview, option.id)
                                  }
                                  className={
                                    option.id === "hire"
                                      ? "border-green-500 text-green-600 hover:bg-green-50"
                                      : option.id === "reject"
                                        ? "border-red-500 text-red-600 hover:bg-red-50"
                                        : ""
                                  }
                                >
                                  {option.name}
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedInterview ? "Edit Interview" : "Schedule Interview"}
            </DialogTitle>
            <DialogDescription>
              Fill in the details to schedule an interview
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="candidateName">Candidate Name *</Label>
                <Input
                  id="candidateName"
                  value={formData.candidateName}
                  onChange={(e) =>
                    setFormData({ ...formData, candidateName: e.target.value })
                  }
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="candidateEmail">Email *</Label>
                <Input
                  id="candidateEmail"
                  type="email"
                  value={formData.candidateEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, candidateEmail: e.target.value })
                  }
                  placeholder="candidate@email.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="candidatePhone">Phone</Label>
                <Input
                  id="candidatePhone"
                  value={formData.candidatePhone}
                  onChange={(e) =>
                    setFormData({ ...formData, candidatePhone: e.target.value })
                  }
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position *</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) =>
                    setFormData({ ...formData, position: e.target.value })
                  }
                  placeholder="Job title"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="interviewDate">Date *</Label>
                <Input
                  id="interviewDate"
                  type="date"
                  value={formData.interviewDate}
                  onChange={(e) =>
                    setFormData({ ...formData, interviewDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interviewTime">Time *</Label>
                <Input
                  id="interviewTime"
                  type="time"
                  value={formData.interviewTime}
                  onChange={(e) =>
                    setFormData({ ...formData, interviewTime: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <Select
                  value={formData.duration.toString()}
                  onValueChange={(v) =>
                    setFormData({ ...formData, duration: parseInt(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVIEW_DURATIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value.toString()}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="interviewType">Interview Type</Label>
                <Select
                  value={formData.interviewType}
                  onValueChange={(v) =>
                    setFormData({ ...formData, interviewType: v as InterviewType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVIEW_TYPES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">
                  {formData.interviewType === "video" ? "Meeting Link" : "Location"}
                </Label>
                <Input
                  id="location"
                  value={
                    formData.interviewType === "video"
                      ? formData.meetingLink
                      : formData.location
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      [formData.interviewType === "video"
                        ? "meetingLink"
                        : "location"]: e.target.value,
                    })
                  }
                  placeholder={
                    formData.interviewType === "video"
                      ? "https://meet.google.com/..."
                      : "Conference Room A"
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Interviewers</Label>
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
                {employees
                  .filter((e) => e.status === "active")
                  .map((emp) => (
                    <div
                      key={emp.id}
                      className="flex items-center gap-2 py-1"
                    >
                      <Checkbox
                        checked={formData.interviewerIds.includes(emp.id!)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              interviewerIds: [...formData.interviewerIds, emp.id!],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              interviewerIds: formData.interviewerIds.filter(
                                (id) => id !== emp.id
                              ),
                            });
                          }
                        }}
                      />
                      <span className="text-sm">
                        {emp.personalInfo?.firstName} {emp.personalInfo?.lastName}
                        <span className="text-muted-foreground ml-1">
                          ({emp.jobDetails?.position || "Staff"})
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowScheduleDialog(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleScheduleInterview}
              disabled={saving}
              className="bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedInterview ? "Update" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Interview Feedback</DialogTitle>
            <DialogDescription>
              {selectedInterview?.candidateName} - {selectedInterview?.position}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Your Name</Label>
              <Select
                value={feedbackData.interviewerId}
                onValueChange={(v) =>
                  setFeedbackData({ ...feedbackData, interviewerId: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your name" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter((e) => e.status === "active")
                    .map((emp) => (
                      <SelectItem key={emp.id} value={emp.id!}>
                        {emp.personalInfo?.firstName} {emp.personalInfo?.lastName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Overall Rating</Label>
              <StarRating
                value={feedbackData.overallRating}
                onChange={(v) =>
                  setFeedbackData({
                    ...feedbackData,
                    overallRating: v as 1 | 2 | 3 | 4 | 5,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Technical</Label>
                <StarRating
                  value={feedbackData.technicalSkills || 3}
                  onChange={(v) =>
                    setFeedbackData({ ...feedbackData, technicalSkills: v })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Communication</Label>
                <StarRating
                  value={feedbackData.communicationSkills || 3}
                  onChange={(v) =>
                    setFeedbackData({ ...feedbackData, communicationSkills: v })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Culture Fit</Label>
                <StarRating
                  value={feedbackData.cultureFit || 3}
                  onChange={(v) =>
                    setFeedbackData({ ...feedbackData, cultureFit: v })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="strengths">Strengths</Label>
              <Textarea
                id="strengths"
                value={feedbackData.strengths}
                onChange={(e) =>
                  setFeedbackData({ ...feedbackData, strengths: e.target.value })
                }
                placeholder="What did the candidate do well?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weaknesses">Areas for Improvement</Label>
              <Textarea
                id="weaknesses"
                value={feedbackData.weaknesses}
                onChange={(e) =>
                  setFeedbackData({ ...feedbackData, weaknesses: e.target.value })
                }
                placeholder="What could be improved?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Recommendation</Label>
              <Select
                value={feedbackData.recommendation}
                onValueChange={(v) =>
                  setFeedbackData({
                    ...feedbackData,
                    recommendation: v as InterviewDecision,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECISION_OPTIONS.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={feedbackData.notes}
                onChange={(e) =>
                  setFeedbackData({ ...feedbackData, notes: e.target.value })
                }
                placeholder="Any other observations..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFeedbackDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={saving}
              className="bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Interview Details</DialogTitle>
          </DialogHeader>

          {selectedInterview && (
            <div className="space-y-6">
              {/* Candidate */}
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-xl">
                    {selectedInterview.candidateName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">
                    {selectedInterview.candidateName}
                  </h3>
                  <p className="text-muted-foreground">
                    {selectedInterview.position}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {selectedInterview.candidateEmail}
                    </span>
                    {selectedInterview.candidatePhone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {selectedInterview.candidatePhone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Schedule</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Date & Time:</span>
                    <p className="font-medium">
                      {formatInterviewDateTime(
                        selectedInterview.interviewDate,
                        selectedInterview.interviewTime
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <p className="font-medium">
                      {selectedInterview.duration} minutes
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <p className="font-medium">
                      {getInterviewTypeName(selectedInterview.interviewType)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <Badge className={getStatusColor(selectedInterview.status)}>
                      {selectedInterview.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Interviewers */}
              {selectedInterview.interviewerNames.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Interview Panel</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedInterview.interviewerNames.map((name, idx) => (
                      <Badge key={idx} variant="outline">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback */}
              {selectedInterview.feedback.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Feedback</h4>
                  <div className="space-y-3">
                    {selectedInterview.feedback.map((fb, idx) => (
                      <div key={idx} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{fb.interviewerName}</span>
                          <div className="flex items-center gap-2">
                            <StarRating value={fb.overallRating} readonly />
                            <Badge variant="outline">
                              {getDecisionDisplay(fb.recommendation).name}
                            </Badge>
                          </div>
                        </div>
                        {fb.strengths && (
                          <p className="text-sm text-muted-foreground mb-1">
                            <strong>Strengths:</strong> {fb.strengths}
                          </p>
                        )}
                        {fb.weaknesses && (
                          <p className="text-sm text-muted-foreground mb-1">
                            <strong>Areas for Improvement:</strong> {fb.weaknesses}
                          </p>
                        )}
                        {fb.notes && (
                          <p className="text-sm text-muted-foreground">
                            <strong>Notes:</strong> {fb.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decision */}
              {selectedInterview.decision && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Final Decision</h4>
                  <Badge
                    className={`${
                      selectedInterview.decision === "hire"
                        ? "bg-green-500/10 text-green-700 border-green-500/20"
                        : selectedInterview.decision === "reject"
                          ? "bg-red-500/10 text-red-700 border-red-500/20"
                          : "bg-blue-500/10 text-blue-700 border-blue-500/20"
                    }`}
                  >
                    {getDecisionDisplay(selectedInterview.decision).name}
                  </Badge>
                  {selectedInterview.decisionNotes && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {selectedInterview.decisionNotes}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
            {selectedInterview && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowViewDialog(false);
                    openEditDialog(selectedInterview);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600"
                  onClick={() => {
                    setShowViewDialog(false);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Interview?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the interview for{" "}
              <strong>{selectedInterview?.candidateName}</strong>. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
