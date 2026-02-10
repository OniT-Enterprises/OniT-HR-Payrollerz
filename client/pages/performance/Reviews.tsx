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
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { employeeService } from "@/services/employeeService";
import {
  reviewService,
  PerformanceReview,
  ReviewStats,
  ReviewType,
  ReviewStatus,
  RatingValue,
  CompetencyRating,
  REVIEW_TYPES,
  DEFAULT_COMPETENCIES,
  getRatingLabel,
  getReviewTypeName,
} from "@/services/reviewService";
import { useTenantId } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Employee } from "@/services/employeeService";
import {
  Star,
  Users,
  AlertCircle,
  User,
  Plus,
  FileText,
  CheckCircle,
  Edit,
  Trash2,
  Eye,
  Send,
} from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";

// ============================================
// Rating Stars Component
// ============================================

interface RatingStarsProps {
  value: RatingValue;
  onChange?: (value: RatingValue) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

function RatingStars({ value, onChange, readonly = false, size = "md" }: RatingStarsProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star as RatingValue)}
          className={`${readonly ? "" : "cursor-pointer hover:scale-110"} transition-transform`}
        >
          <Star
            className={`${sizeClasses[size]} ${
              star <= value
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-200 text-gray-300"
            }`}
          />
        </button>
      ))}
      {!readonly && (
        <span className="ml-2 text-sm text-muted-foreground">
          {getRatingLabel(value)}
        </span>
      )}
    </div>
  );
}

// ============================================
// Review Form Component
// ============================================

interface ReviewFormData {
  employeeId: string;
  reviewType: ReviewType;
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  reviewDate: string;
  overallRating: RatingValue;
  competencies: CompetencyRating[];
  strengths: string;
  areasForImprovement: string;
  managerComments: string;
  developmentPlan: string;
}

const defaultFormData: ReviewFormData = {
  employeeId: "",
  reviewType: "annual",
  reviewPeriodStart: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
  reviewPeriodEnd: new Date().toISOString().split("T")[0],
  reviewDate: new Date().toISOString().split("T")[0],
  overallRating: 3,
  competencies: DEFAULT_COMPETENCIES.map((name) => ({ name, rating: 3 as RatingValue })),
  strengths: "",
  areasForImprovement: "",
  managerComments: "",
  developmentPlan: "",
};

// ============================================
// Main Component
// ============================================

export default function Reviews() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("employees");

  // Dialog states
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedReview, setSelectedReview] = useState<PerformanceReview | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<ReviewFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ReviewType | "all">("all");

  const { toast } = useToast();
  const tenantId = useTenantId();
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeesData, reviewsData, statsData] = await Promise.all([
        employeeService.getAllEmployees(tenantId),
        reviewService.getReviews(tenantId),
        reviewService.getStats(tenantId),
      ]);
      setEmployees(employeesData);
      setReviews(reviewsData);
      setStats(statsData);
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

  const activeEmployees = employees.filter((emp) => emp.status === "active");

  const filteredReviews = reviews.filter((review) => {
    if (statusFilter !== "all" && review.status !== statusFilter) return false;
    if (typeFilter !== "all" && review.reviewType !== typeFilter) return false;
    return true;
  });

  const openNewReview = (employee?: Employee) => {
    setSelectedEmployee(employee || null);
    setFormData({
      ...defaultFormData,
      employeeId: employee?.id || "",
    });
    setSelectedReview(null);
    setShowNewDialog(true);
  };

  const openEditReview = (review: PerformanceReview) => {
    const employee = employees.find((e) => e.id === review.employeeId);
    setSelectedEmployee(employee || null);
    setSelectedReview(review);
    setFormData({
      employeeId: review.employeeId,
      reviewType: review.reviewType,
      reviewPeriodStart: review.reviewPeriodStart,
      reviewPeriodEnd: review.reviewPeriodEnd,
      reviewDate: review.reviewDate,
      overallRating: review.overallRating,
      competencies: review.competencies.length > 0
        ? review.competencies
        : DEFAULT_COMPETENCIES.map((name) => ({ name, rating: 3 as RatingValue })),
      strengths: review.strengths,
      areasForImprovement: review.areasForImprovement,
      managerComments: review.managerComments,
      developmentPlan: review.developmentPlan,
    });
    setShowNewDialog(true);
  };

  const openViewReview = (review: PerformanceReview) => {
    setSelectedReview(review);
    setShowViewDialog(true);
  };

  const handleSave = async () => {
    if (!formData.employeeId) {
      toast({
        title: "Error",
        description: "Please select an employee",
        variant: "destructive",
      });
      return;
    }

    const employee = employees.find((e) => e.id === formData.employeeId);
    if (!employee) return;

    setSaving(true);
    try {
      const reviewData = {
        employeeId: formData.employeeId,
        employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        department: employee.jobDetails.department,
        position: employee.jobDetails.position,
        reviewType: formData.reviewType,
        reviewPeriodStart: formData.reviewPeriodStart,
        reviewPeriodEnd: formData.reviewPeriodEnd,
        reviewDate: formData.reviewDate,
        reviewerId: user?.uid || "",
        reviewerName: user?.displayName || user?.email || "Manager",
        overallRating: formData.overallRating,
        competencies: formData.competencies,
        goalAssessments: [],
        strengths: formData.strengths,
        areasForImprovement: formData.areasForImprovement,
        managerComments: formData.managerComments,
        developmentPlan: formData.developmentPlan,
      };

      if (selectedReview) {
        await reviewService.updateReview(tenantId, selectedReview.id!, reviewData);
        toast({
          title: "Success",
          description: "Review updated successfully",
        });
      } else {
        await reviewService.createReview(tenantId, reviewData);
        toast({
          title: "Success",
          description: "Review created successfully",
        });
      }

      setShowNewDialog(false);
      loadData();
    } catch (error) {
      console.error("Error saving review:", error);
      toast({
        title: "Error",
        description: "Failed to save review",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReview = async (review: PerformanceReview) => {
    try {
      await reviewService.submitReview(tenantId, review.id!);
      toast({
        title: "Success",
        description: "Review submitted for acknowledgement",
      });
      loadData();
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        title: "Error",
        description: "Failed to submit review",
        variant: "destructive",
      });
    }
  };

  const handleDeleteReview = async () => {
    if (!selectedReview) return;

    try {
      await reviewService.deleteReview(tenantId, selectedReview.id!);
      toast({
        title: "Success",
        description: "Review deleted successfully",
      });
      setShowDeleteDialog(false);
      setSelectedReview(null);
      loadData();
    } catch (error) {
      console.error("Error deleting review:", error);
      toast({
        title: "Error",
        description: "Failed to delete review",
        variant: "destructive",
      });
    }
  };

  const handleCompleteReview = async (review: PerformanceReview) => {
    try {
      if (review.status === "submitted") {
        await reviewService.acknowledgeReview(tenantId, review.id!);
        toast({
          title: "Success",
          description: "Review acknowledged",
        });
      } else if (review.status === "acknowledged") {
        await reviewService.completeReview(tenantId, review.id!);
        toast({
          title: "Success",
          description: "Review completed",
        });
      }
      loadData();
    } catch (error) {
      console.error("Error updating review status:", error);
      toast({
        title: "Error",
        description: "Failed to update review status",
        variant: "destructive",
      });
    }
  };

  const updateCompetencyRating = (index: number, rating: RatingValue) => {
    const updated = [...formData.competencies];
    updated[index] = { ...updated[index], rating };
    setFormData({ ...formData, competencies: updated });
  };

  const getStatusBadge = (status: ReviewStatus) => {
    const styles: Record<ReviewStatus, string> = {
      draft: "bg-gray-100 text-gray-700",
      submitted: "bg-blue-100 text-blue-700",
      acknowledged: "bg-yellow-100 text-yellow-700",
      completed: "bg-green-100 text-green-700",
    };
    const labels: Record<ReviewStatus, string> = {
      draft: "Draft",
      submitted: "Submitted",
      acknowledged: "Acknowledged",
      completed: "Completed",
    };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
          <AutoBreadcrumb className="mb-6" />
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-8 w-8 rounded" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
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
      <SEO {...seoConfig.reviews} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-orange-50 dark:bg-orange-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25">
              <Star className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Performance Reviews</h1>
              <p className="text-muted-foreground mt-1">
                Manage and track employee performance evaluations
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {employees.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center">
              <Star className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Performance Data</h3>
            <p className="text-muted-foreground mb-6">
              Add employees to your database to start performance reviews
            </p>
            <Button onClick={() => (window.location.href = "/staff/add")}>
              <User className="mr-2 h-4 w-4" />
              Add Employees First
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card className="border-border/50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Reviews</p>
                      <p className="text-2xl font-bold">{stats?.totalReviews || 0}</p>
                      <p className="text-xs text-blue-600">All time</p>
                    </div>
                    <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Drafts</p>
                      <p className="text-2xl font-bold">{stats?.draft || 0}</p>
                      <p className="text-xs text-gray-600">In progress</p>
                    </div>
                    <div className="p-2.5 bg-gradient-to-br from-gray-500 to-slate-500 rounded-xl">
                      <Edit className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                      <p className="text-2xl font-bold">{stats?.submitted || 0}</p>
                      <p className="text-xs text-blue-600">Awaiting acknowledgement</p>
                    </div>
                    <div className="p-2.5 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
                      <Send className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Completed</p>
                      <p className="text-2xl font-bold">{stats?.completed || 0}</p>
                      <p className="text-xs text-green-600">Finalized</p>
                    </div>
                    <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg. Rating</p>
                      <p className="text-2xl font-bold">{stats?.averageRating || "-"}</p>
                      <div className="flex items-center gap-0.5 mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3 w-3 ${
                              star <= (stats?.averageRating || 0)
                                ? "fill-yellow-400 text-yellow-400"
                                : "fill-gray-200 text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl">
                      <Star className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="employees">Employees</TabsTrigger>
                  <TabsTrigger value="reviews">
                    Reviews ({reviews.length})
                  </TabsTrigger>
                </TabsList>
                <Button onClick={() => openNewReview()}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Review
                </Button>
              </div>

              {/* Employees Tab */}
              <TabsContent value="employees" className="mt-6">
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      Employees Ready for Review
                    </CardTitle>
                    <CardDescription>
                      {activeEmployees.length} active employees available for performance review
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {activeEmployees.length === 0 ? (
                      <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-sm text-gray-600">No active employees to review</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeEmployees.map((employee) => {
                          const employeeReviews = reviews.filter(
                            (r) => r.employeeId === employee.id
                          );
                          const hasActiveReview = employeeReviews.some(
                            (r) => r.status === "draft" || r.status === "submitted"
                          );
                          const lastReview = employeeReviews[0];

                          return (
                            <Card key={employee.id} className="border border-gray-200">
                              <CardContent className="p-4">
                                <div className="space-y-3">
                                  <div>
                                    <h4 className="font-semibold">
                                      {employee.personalInfo.firstName}{" "}
                                      {employee.personalInfo.lastName}
                                    </h4>
                                    <p className="text-sm text-gray-600">
                                      {employee.jobDetails.position}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {employee.jobDetails.department}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {employee.jobDetails.employeeId}
                                    </Badge>
                                    {lastReview && (
                                      <Badge variant="secondary" className="text-xs">
                                        Last: {new Date(lastReview.reviewDate).toLocaleDateString()}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between pt-2 border-t">
                                    <span className="text-xs text-muted-foreground">
                                      {employeeReviews.length} review(s)
                                    </span>
                                    <Button
                                      size="sm"
                                      variant={hasActiveReview ? "outline" : "default"}
                                      onClick={() => openNewReview(employee)}
                                      disabled={hasActiveReview}
                                    >
                                      {hasActiveReview ? "Review in Progress" : "Start Review"}
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent value="reviews" className="mt-6">
                <Card className="border-border/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                          All Reviews
                        </CardTitle>
                        <CardDescription>
                          {filteredReviews.length} of {reviews.length} reviews
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Select
                          value={statusFilter}
                          onValueChange={(v) => setStatusFilter(v as ReviewStatus | "all")}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="All Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="submitted">Submitted</SelectItem>
                            <SelectItem value="acknowledged">Acknowledged</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={typeFilter}
                          onValueChange={(v) => setTypeFilter(v as ReviewType | "all")}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="All Types" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {REVIEW_TYPES.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredReviews.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-sm text-gray-600">No reviews found</p>
                        <Button className="mt-4" onClick={() => openNewReview()}>
                          <Plus className="mr-2 h-4 w-4" />
                          Create First Review
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredReviews.map((review) => (
                          <div
                            key={review.id}
                            className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                <User className="h-5 w-5 text-orange-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{review.employeeName}</h4>
                                  {getStatusBadge(review.status)}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                  <span>{getReviewTypeName(review.reviewType)}</span>
                                  <span>•</span>
                                  <span>{new Date(review.reviewDate).toLocaleDateString()}</span>
                                  <span>•</span>
                                  <div className="flex items-center gap-1">
                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                    <span>{review.overallRating}/5</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {review.status === "draft" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSubmitReview(review)}
                                  >
                                    <Send className="h-4 w-4 mr-1" />
                                    Submit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openEditReview(review)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => {
                                      setSelectedReview(review);
                                      setShowDeleteDialog(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {review.status === "submitted" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCompleteReview(review)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Acknowledge
                                </Button>
                              )}
                              {review.status === "acknowledged" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCompleteReview(review)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Complete
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openViewReview(review)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* New/Edit Review Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedReview ? "Edit Review" : "New Performance Review"}
            </DialogTitle>
            <DialogDescription>
              {selectedEmployee
                ? `Creating review for ${selectedEmployee.personalInfo.firstName} ${selectedEmployee.personalInfo.lastName}`
                : "Select an employee and fill in the review details"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Employee Selection */}
            {!selectedEmployee && (
              <div className="space-y-2">
                <Label>Select Employee</Label>
                <Select
                  value={formData.employeeId}
                  onValueChange={(v) => setFormData({ ...formData, employeeId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id || ""}>
                        {emp.personalInfo.firstName} {emp.personalInfo.lastName} -{" "}
                        {emp.jobDetails.position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Review Type & Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Review Type</Label>
                <Select
                  value={formData.reviewType}
                  onValueChange={(v) => setFormData({ ...formData, reviewType: v as ReviewType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REVIEW_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Review Date</Label>
                <Input
                  type="date"
                  value={formData.reviewDate}
                  onChange={(e) => setFormData({ ...formData, reviewDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Period Start</Label>
                <Input
                  type="date"
                  value={formData.reviewPeriodStart}
                  onChange={(e) => setFormData({ ...formData, reviewPeriodStart: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Period End</Label>
                <Input
                  type="date"
                  value={formData.reviewPeriodEnd}
                  onChange={(e) => setFormData({ ...formData, reviewPeriodEnd: e.target.value })}
                />
              </div>
            </div>

            {/* Overall Rating */}
            <div className="space-y-2">
              <Label>Overall Rating</Label>
              <RatingStars
                value={formData.overallRating}
                onChange={(v) => setFormData({ ...formData, overallRating: v })}
              />
            </div>

            {/* Competency Ratings */}
            <div className="space-y-3">
              <Label>Competency Ratings</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {formData.competencies.map((comp, index) => (
                  <div
                    key={comp.name}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <span className="text-sm font-medium">{comp.name}</span>
                    <RatingStars
                      value={comp.rating}
                      onChange={(v) => updateCompetencyRating(index, v)}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <Label>Strengths</Label>
              <Textarea
                value={formData.strengths}
                onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                placeholder="Key strengths and achievements..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Areas for Improvement</Label>
              <Textarea
                value={formData.areasForImprovement}
                onChange={(e) =>
                  setFormData({ ...formData, areasForImprovement: e.target.value })
                }
                placeholder="Areas that need development..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Manager Comments</Label>
              <Textarea
                value={formData.managerComments}
                onChange={(e) => setFormData({ ...formData, managerComments: e.target.value })}
                placeholder="Additional feedback and observations..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Development Plan</Label>
              <Textarea
                value={formData.developmentPlan}
                onChange={(e) => setFormData({ ...formData, developmentPlan: e.target.value })}
                placeholder="Goals and action items for the next period..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : selectedReview ? "Update Review" : "Create Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Review Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Performance Review</DialogTitle>
            <DialogDescription>
              {selectedReview?.employeeName} - {getReviewTypeName(selectedReview?.reviewType || "annual")}
            </DialogDescription>
          </DialogHeader>

          {selectedReview && (
            <div className="space-y-6 py-4">
              {/* Review Info */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm text-muted-foreground">Employee</p>
                  <p className="font-medium">{selectedReview.employeeName}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedReview.position} - {selectedReview.department}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Review Date</p>
                  <p className="font-medium">
                    {new Date(selectedReview.reviewDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Period: {new Date(selectedReview.reviewPeriodStart).toLocaleDateString()} -{" "}
                    {new Date(selectedReview.reviewPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Status & Rating */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Status:</span>
                  {getStatusBadge(selectedReview.status)}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Overall Rating:</span>
                  <RatingStars value={selectedReview.overallRating} readonly size="md" />
                </div>
              </div>

              {/* Competencies */}
              {selectedReview.competencies.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold">Competency Ratings</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedReview.competencies.map((comp) => (
                      <div
                        key={comp.name}
                        className="flex items-center justify-between p-2 rounded border"
                      >
                        <span className="text-sm">{comp.name}</span>
                        <RatingStars value={comp.rating} readonly size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              {selectedReview.strengths && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Strengths</h4>
                  <p className="text-sm whitespace-pre-wrap bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
                    {selectedReview.strengths}
                  </p>
                </div>
              )}

              {selectedReview.areasForImprovement && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Areas for Improvement</h4>
                  <p className="text-sm whitespace-pre-wrap bg-yellow-50 dark:bg-yellow-950/30 p-3 rounded-lg">
                    {selectedReview.areasForImprovement}
                  </p>
                </div>
              )}

              {selectedReview.managerComments && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Manager Comments</h4>
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
                    {selectedReview.managerComments}
                  </p>
                </div>
              )}

              {selectedReview.developmentPlan && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Development Plan</h4>
                  <p className="text-sm whitespace-pre-wrap bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
                    {selectedReview.developmentPlan}
                  </p>
                </div>
              )}

              {/* Employee Comments (if acknowledged) */}
              {selectedReview.employeeComments && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Employee Comments</h4>
                  <p className="text-sm whitespace-pre-wrap bg-purple-50 dark:bg-purple-950/30 p-3 rounded-lg">
                    {selectedReview.employeeComments}
                  </p>
                </div>
              )}

              {/* Reviewer */}
              <div className="text-sm text-muted-foreground border-t pt-4">
                <p>Reviewed by: {selectedReview.reviewerName}</p>
                {selectedReview.acknowledgedAt && (
                  <p>
                    Acknowledged:{" "}
                    {new Date(selectedReview.acknowledgedAt).toLocaleDateString()}
                  </p>
                )}
                {selectedReview.completedAt && (
                  <p>
                    Completed: {new Date(selectedReview.completedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
            {selectedReview?.status === "draft" && (
              <Button onClick={() => {
                setShowViewDialog(false);
                openEditReview(selectedReview);
              }}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Review
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Review?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the draft review for{" "}
              <strong>{selectedReview?.employeeName}</strong>. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteReview}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
