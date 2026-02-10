import React, { useState, useEffect, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { useTenantId } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAllEmployees } from "@/hooks/useEmployees";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  Filter,
  Plus,
  Download,
  Eye,
  Edit,
  Award,
  Trash2,
  ExternalLink,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import {
  trainingService,
  type TrainingRecord,
  type TrainingStatus,
  TRAINING_CATEGORIES,
  isExpiringSoon,
} from "@/services/trainingService";

export default function TrainingCertifications() {
  const { toast } = useToast();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { data: employees = [], isLoading: employeesLoading } = useAllEmployees();

  // Data state
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TrainingRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<TrainingRecord | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    employeeId: "",
    courseTitle: "",
    provider: "",
    description: "",
    category: "",
    startDate: "",
    completionDate: "",
    expiryDate: "",
    cost: "",
    notes: "",
  });
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const statusOptions = [
    { id: "all", name: "All Statuses" },
    { id: "pending", name: "Pending" },
    { id: "in_progress", name: "In Progress" },
    { id: "completed", name: "Completed" },
    { id: "expired", name: "Expired" },
  ];

  // Load training records
  const loadRecords = async () => {
    try {
      const data = await trainingService.getTrainingRecords(tenantId);
      setRecords(data);
    } catch (error) {
      console.error("Error loading training records:", error);
      toast({
        title: "Error",
        description: "Failed to load training records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [tenantId]);

  // Refresh statuses (check for expired)
  const handleRefreshStatuses = async () => {
    setRefreshing(true);
    try {
      await trainingService.refreshStatuses(tenantId);
      await loadRecords();
      toast({
        title: "Statuses Updated",
        description: "Training record statuses have been refreshed",
      });
    } catch (error) {
      console.error("Error refreshing statuses:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Get employee name by ID
  const getEmployeeName = (employeeId: string): string => {
    const employee = employees.find((e) => e.id === employeeId);
    return employee ? `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}` : "Unknown";
  };

  // Filter and pagination
  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (selectedEmployee && selectedEmployee !== "all") {
        if (record.employeeId !== selectedEmployee) return false;
      }
      if (selectedStatus && selectedStatus !== "all") {
        if (record.status !== selectedStatus) return false;
      }
      return true;
    });
  }, [records, selectedEmployee, selectedStatus]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedEmployee, selectedStatus]);

  const getStatusBadge = (status: TrainingStatus, expiryDate?: string) => {
    const expiring = isExpiringSoon(expiryDate);

    if (expiring && status === "completed") {
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Expiring Soon
        </Badge>
      );
    }

    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Completed</Badge>;
      case "pending":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Pending</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">In Progress</Badge>;
      case "expired":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Expired</Badge>;
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: "",
      courseTitle: "",
      provider: "",
      description: "",
      category: "",
      startDate: "",
      completionDate: "",
      expiryDate: "",
      cost: "",
      notes: "",
    });
    setCertificateFile(null);
    setEditingRecord(null);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const validation = trainingService.validateCertificateFile(file);
      if (!validation.valid) {
        toast({
          title: "Invalid File",
          description: validation.error,
          variant: "destructive",
        });
        return;
      }
    }
    setCertificateFile(file);
  };

  const handleOpenEditDialog = (record: TrainingRecord) => {
    setEditingRecord(record);
    setFormData({
      employeeId: record.employeeId,
      courseTitle: record.courseTitle,
      provider: record.provider,
      description: record.description || "",
      category: record.category || "",
      startDate: record.startDate,
      completionDate: record.completionDate || "",
      expiryDate: record.expiryDate || "",
      cost: record.cost?.toString() || "",
      notes: record.notes || "",
    });
    setCertificateFile(null);
    setShowAddDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employeeId || !formData.courseTitle || !formData.provider || !formData.startDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const employeeName = getEmployeeName(formData.employeeId);
      const employee = employees.find((e) => e.id === formData.employeeId);

      const recordData = {
        employeeId: formData.employeeId,
        employeeName,
        department: employee?.jobDetails.department || "",
        departmentId: "",  // Not available in Employee type
        courseTitle: formData.courseTitle,
        provider: formData.provider,
        description: formData.description || undefined,
        category: formData.category || undefined,
        startDate: formData.startDate,
        completionDate: formData.completionDate || undefined,
        expiryDate: formData.expiryDate || undefined,
        cost: formData.cost ? parseFloat(formData.cost) : undefined,
        currency: "USD",
        notes: formData.notes || undefined,
      };

      if (editingRecord) {
        // Update existing record
        await trainingService.updateTrainingRecord(
          tenantId,
          editingRecord.id!,
          recordData,
          certificateFile || undefined
        );
        toast({
          title: "Success",
          description: "Training record updated successfully.",
        });
      } else {
        // Create new record
        await trainingService.createTrainingRecord(
          tenantId,
          recordData,
          certificateFile || undefined,
          user?.email || undefined
        );
        toast({
          title: "Success",
          description: "Training record created successfully.",
        });
      }

      resetForm();
      setShowAddDialog(false);
      await loadRecords();
    } catch (error) {
      console.error("Error saving training record:", error);
      toast({
        title: "Error",
        description: "Failed to save training record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRecordId) return;

    setDeleting(true);
    try {
      await trainingService.deleteTrainingRecord(tenantId, deletingRecordId);
      toast({
        title: "Success",
        description: "Training record deleted successfully.",
      });
      setShowDeleteDialog(false);
      setDeletingRecordId(null);
      await loadRecords();
    } catch (error) {
      console.error("Error deleting training record:", error);
      toast({
        title: "Error",
        description: "Failed to delete training record.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = () => {
    const csvContent = [
      ["Employee", "Course", "Provider", "Category", "Start Date", "Completion Date", "Expiry Date", "Status"].join(","),
      ...filteredRecords.map((record) =>
        [
          `"${record.employeeName}"`,
          `"${record.courseTitle}"`,
          `"${record.provider}"`,
          `"${record.category || ""}"`,
          record.startDate,
          record.completionDate || "",
          record.expiryDate || "",
          record.status,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training_records_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Training records exported to CSV.",
    });
  };

  const handleViewRecord = (record: TrainingRecord) => {
    setViewingRecord(record);
    setShowViewDialog(true);
  };

  const handleDownloadCertificate = (certificateUrl: string) => {
    window.open(certificateUrl, "_blank");
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading || employeesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.training} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-orange-50 dark:bg-orange-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25">
              <Award className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Training & Certifications</h1>
              <p className="text-muted-foreground mt-1">
                Manage employee training programs and certifications
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <Card className="mb-6 border-border/50 -mt-8 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label htmlFor="employee-filter">Employee</Label>
                <Select
                  value={selectedEmployee}
                  onValueChange={setSelectedEmployee}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All employees</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id!}>
                        {employee.personalInfo.firstName} {employee.personalInfo.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status-filter">Status</Label>
                <Select
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button
                  variant="outline"
                  onClick={handleRefreshStatuses}
                  disabled={refreshing}
                  className="w-full"
                >
                  {refreshing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh Statuses
                </Button>
              </div>
              <div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedEmployee("");
                    setSelectedStatus("");
                  }}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Training Records Table */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  Training Records
                </CardTitle>
                <CardDescription>
                  Showing {paginatedRecords.length} of {filteredRecords.length} records
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Dialog
                  open={showAddDialog}
                  onOpenChange={(open) => {
                    setShowAddDialog(open);
                    if (!open) resetForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Training
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingRecord ? "Edit Training Record" : "Add Training Record"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingRecord
                          ? "Update the training record details"
                          : "Create a new training record for an employee"}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="employee">Employee *</Label>
                        <Select
                          value={formData.employeeId}
                          onValueChange={(value) => handleInputChange("employeeId", value)}
                          disabled={!!editingRecord}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((employee) => (
                              <SelectItem key={employee.id} value={employee.id!}>
                                {employee.personalInfo.firstName} {employee.personalInfo.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="course-title">Course Title *</Label>
                        <Input
                          id="course-title"
                          value={formData.courseTitle}
                          onChange={(e) => handleInputChange("courseTitle", e.target.value)}
                          placeholder="Enter course title"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="provider">Provider *</Label>
                          <Input
                            id="provider"
                            value={formData.provider}
                            onChange={(e) => handleInputChange("provider", e.target.value)}
                            placeholder="Training provider"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="category">Category</Label>
                          <Select
                            value={formData.category}
                            onValueChange={(value) => handleInputChange("category", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {TRAINING_CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => handleInputChange("description", e.target.value)}
                          placeholder="Course description"
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label htmlFor="start-date">Start Date *</Label>
                          <Input
                            id="start-date"
                            type="date"
                            value={formData.startDate}
                            onChange={(e) => handleInputChange("startDate", e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="completion-date">Completion</Label>
                          <Input
                            id="completion-date"
                            type="date"
                            value={formData.completionDate}
                            onChange={(e) => handleInputChange("completionDate", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="expiry-date">Expiry</Label>
                          <Input
                            id="expiry-date"
                            type="date"
                            value={formData.expiryDate}
                            onChange={(e) => handleInputChange("expiryDate", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="cost">Cost (USD)</Label>
                          <Input
                            id="cost"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.cost}
                            onChange={(e) => handleInputChange("cost", e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="certificate">Certificate</Label>
                          <Input
                            id="certificate"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={handleFileChange}
                            className="cursor-pointer"
                          />
                        </div>
                      </div>
                      {editingRecord?.certificateUrl && !certificateFile && (
                        <p className="text-xs text-muted-foreground">
                          Current certificate: {editingRecord.certificateFileName || "Uploaded"}
                        </p>
                      )}
                      <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => handleInputChange("notes", e.target.value)}
                          placeholder="Additional notes"
                          rows={2}
                        />
                      </div>
                      <DialogFooter className="gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddDialog(false);
                            resetForm();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                          {submitting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>Save Training</>
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {paginatedRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No training records found</p>
                <p className="text-sm mt-1">Add a training record to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Certificate</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.employeeName}</TableCell>
                      <TableCell>
                        <div>
                          <div>{record.courseTitle}</div>
                          {record.category && (
                            <div className="text-xs text-muted-foreground">{record.category}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{record.provider}</TableCell>
                      <TableCell>{formatDate(record.completionDate)}</TableCell>
                      <TableCell>{formatDate(record.expiryDate)}</TableCell>
                      <TableCell>{getStatusBadge(record.status, record.expiryDate)}</TableCell>
                      <TableCell>
                        {record.certificateUrl ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownloadCertificate(record.certificateUrl!)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewRecord(record)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEditDialog(record)}
                            title="Edit record"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              setDeletingRecordId(record.id!);
                              setShowDeleteDialog(true);
                            }}
                            title="Delete record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {[...Array(totalPages)].map((_, i) => (
                      <PaginationItem key={i + 1}>
                        <PaginationLink
                          onClick={() => setCurrentPage(i + 1)}
                          isActive={currentPage === i + 1}
                          className="cursor-pointer"
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Training Details</DialogTitle>
          </DialogHeader>
          {viewingRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Employee</Label>
                  <p className="font-medium">{viewingRecord.employeeName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-1">{getStatusBadge(viewingRecord.status, viewingRecord.expiryDate)}</div>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Course</Label>
                <p className="font-medium">{viewingRecord.courseTitle}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Provider</Label>
                  <p>{viewingRecord.provider}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Category</Label>
                  <p>{viewingRecord.category || "N/A"}</p>
                </div>
              </div>
              {viewingRecord.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">Description</Label>
                  <p className="text-sm">{viewingRecord.description}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Start Date</Label>
                  <p>{formatDate(viewingRecord.startDate)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Completion</Label>
                  <p>{formatDate(viewingRecord.completionDate)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Expiry</Label>
                  <p>{formatDate(viewingRecord.expiryDate)}</p>
                </div>
              </div>
              {viewingRecord.cost && (
                <div>
                  <Label className="text-muted-foreground text-xs">Cost</Label>
                  <p>${viewingRecord.cost.toFixed(2)} {viewingRecord.currency}</p>
                </div>
              )}
              {viewingRecord.notes && (
                <div>
                  <Label className="text-muted-foreground text-xs">Notes</Label>
                  <p className="text-sm">{viewingRecord.notes}</p>
                </div>
              )}
              {viewingRecord.certificateUrl && (
                <Button
                  variant="outline"
                  onClick={() => handleDownloadCertificate(viewingRecord.certificateUrl!)}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Certificate
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Training Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this training record? This action cannot be undone.
              Any uploaded certificates will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
