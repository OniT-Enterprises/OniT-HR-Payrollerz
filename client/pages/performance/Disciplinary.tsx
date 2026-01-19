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
  Shield,
  Trash2,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import {
  disciplinaryService,
  type DisciplinaryRecord,
  type DisciplinaryStatus,
  type DisciplinaryType,
  type SeverityLevel,
  DISCIPLINARY_TYPES,
  SEVERITY_LEVELS,
  getTypeName,
  getSeverityName,
  getStatusName,
} from "@/services/disciplinaryService";

export default function Disciplinary() {
  const { toast } = useToast();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { data: employees = [], isLoading: employeesLoading } = useAllEmployees();

  // Data state
  const [records, setRecords] = useState<DisciplinaryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Dialog state
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DisciplinaryRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<DisciplinaryRecord | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    employeeId: "",
    date: "",
    type: "" as DisciplinaryType | "",
    severity: "" as SeverityLevel | "",
    summary: "",
    fullDetails: "",
  });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [closing, setClosing] = useState(false);

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    type: "" as DisciplinaryType | "",
    severity: "" as SeverityLevel | "",
    status: "" as DisciplinaryStatus | "",
    summary: "",
    fullDetails: "",
    actionTaken: "",
  });

  // Load records
  const loadRecords = async () => {
    try {
      const data = await disciplinaryService.getRecords(tenantId);
      setRecords(data);
    } catch (error) {
      console.error("Error loading disciplinary records:", error);
      toast({
        title: "Error",
        description: "Failed to load disciplinary records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [tenantId]);

  // Get employee name by ID
  const getEmployeeName = (employeeId: string): string => {
    const employee = employees.find((e) => e.id === employeeId);
    return employee
      ? `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
      : "Unknown";
  };

  // Filter and pagination
  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (selectedEmployee && selectedEmployee !== "all") {
        if (record.employeeId !== selectedEmployee) return false;
      }
      if (selectedType && selectedType !== "all") {
        if (record.type !== selectedType) return false;
      }
      if (selectedStatus && selectedStatus !== "all") {
        if (record.status !== selectedStatus) return false;
      }
      return true;
    });
  }, [records, selectedEmployee, selectedType, selectedStatus]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedEmployee, selectedType, selectedStatus]);

  const getStatusBadge = (status: DisciplinaryStatus) => {
    switch (status) {
      case "open":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Open</Badge>;
      case "in_review":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">In Review</Badge>;
      case "closed":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: SeverityLevel) => {
    switch (severity) {
      case "low":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Low</Badge>;
      case "medium":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Medium</Badge>;
      case "high":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">High</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getTypeBadge = (type: DisciplinaryType) => {
    const colorMap: Record<DisciplinaryType, string> = {
      warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      suspension: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      termination: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      misconduct: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      attendance: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      performance: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    };

    return <Badge className={colorMap[type] || "bg-gray-100 text-gray-800"}>{getTypeName(type)}</Badge>;
  };

  const resetForm = () => {
    setFormData({
      employeeId: "",
      date: "",
      type: "",
      severity: "",
      summary: "",
      fullDetails: "",
    });
    setEvidenceFile(null);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const validation = disciplinaryService.validateEvidenceFile(file);
      if (!validation.valid) {
        toast({
          title: "Invalid File",
          description: validation.error,
          variant: "destructive",
        });
        return;
      }
    }
    setEvidenceFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employeeId || !formData.date || !formData.type || !formData.severity || !formData.summary) {
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

      await disciplinaryService.createRecord(
        tenantId,
        {
          employeeId: formData.employeeId,
          employeeName,
          department: employee?.jobDetails.department || "",
          date: formData.date,
          type: formData.type as DisciplinaryType,
          severity: formData.severity as SeverityLevel,
          summary: formData.summary,
          fullDetails: formData.fullDetails || undefined,
          createdBy: user?.email || "Unknown",
          createdDate: new Date().toISOString().split("T")[0],
        },
        evidenceFile || undefined
      );

      toast({
        title: "Success",
        description: "Incident recorded successfully.",
      });

      resetForm();
      setShowRecordDialog(false);
      await loadRecords();
    } catch (error) {
      console.error("Error recording incident:", error);
      toast({
        title: "Error",
        description: "Failed to record incident. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditDialog = (record: DisciplinaryRecord) => {
    setEditingRecord(record);
    setEditFormData({
      type: record.type,
      severity: record.severity,
      status: record.status,
      summary: record.summary,
      fullDetails: record.fullDetails || "",
      actionTaken: record.actionTaken || "",
    });
    setShowEditDialog(true);
  };

  const handleEditInputChange = (field: string, value: string) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editFormData.type || !editFormData.severity || !editFormData.summary || !editingRecord) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await disciplinaryService.updateRecord(tenantId, editingRecord.id!, {
        type: editFormData.type as DisciplinaryType,
        severity: editFormData.severity as SeverityLevel,
        status: editFormData.status as DisciplinaryStatus,
        summary: editFormData.summary,
        fullDetails: editFormData.fullDetails || undefined,
        actionTaken: editFormData.actionTaken || undefined,
      });

      toast({
        title: "Success",
        description: "Incident updated successfully.",
      });

      setShowEditDialog(false);
      setEditingRecord(null);
      await loadRecords();
    } catch (error) {
      console.error("Error updating incident:", error);
      toast({
        title: "Error",
        description: "Failed to update incident. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = (record: DisciplinaryRecord) => {
    setSelectedRecord(record);
    setShowViewDialog(true);
  };

  const handleCloseCase = async () => {
    if (!selectedRecord) return;

    setClosing(true);
    try {
      await disciplinaryService.closeCase(
        tenantId,
        selectedRecord.id!,
        user?.email || "Unknown"
      );

      toast({
        title: "Success",
        description: "Case closed successfully.",
      });

      setShowCloseDialog(false);
      setShowViewDialog(false);
      setSelectedRecord(null);
      await loadRecords();
    } catch (error) {
      console.error("Error closing case:", error);
      toast({
        title: "Error",
        description: "Failed to close case. Please try again.",
        variant: "destructive",
      });
    } finally {
      setClosing(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRecordId) return;

    setDeleting(true);
    try {
      await disciplinaryService.deleteRecord(tenantId, deletingRecordId);
      toast({
        title: "Success",
        description: "Record deleted successfully.",
      });
      setShowDeleteDialog(false);
      setDeletingRecordId(null);
      await loadRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast({
        title: "Error",
        description: "Failed to delete record.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = () => {
    const csvContent = [
      ["Employee", "Date", "Type", "Severity", "Status", "Summary"].join(","),
      ...filteredRecords.map((record) =>
        [
          `"${record.employeeName}"`,
          record.date,
          getTypeName(record.type),
          getSeverityName(record.severity),
          getStatusName(record.status),
          `"${record.summary.replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disciplinary_records_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Disciplinary records exported to CSV.",
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
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
      <SEO {...seoConfig.disciplinary} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-orange-50 dark:bg-orange-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Disciplinary</h1>
              <p className="text-muted-foreground mt-1">
                Manage disciplinary actions and incident reports
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
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
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
                <Label htmlFor="type-filter">Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {DISCIPLINARY_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status-filter">Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedEmployee("");
                    setSelectedType("");
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

        {/* Disciplinary Actions Table */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  Disciplinary Actions
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
                  open={showRecordDialog}
                  onOpenChange={(open) => {
                    setShowRecordDialog(open);
                    if (!open) resetForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Record Incident
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Record Disciplinary Incident</DialogTitle>
                      <DialogDescription>
                        Document a new disciplinary action or incident
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="employee">Employee *</Label>
                        <Select
                          value={formData.employeeId}
                          onValueChange={(value) => handleInputChange("employeeId", value)}
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
                        <Label htmlFor="incident-date">Date *</Label>
                        <Input
                          id="incident-date"
                          type="date"
                          value={formData.date}
                          onChange={(e) => handleInputChange("date", e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="type">Type *</Label>
                          <Select
                            value={formData.type}
                            onValueChange={(value) => handleInputChange("type", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {DISCIPLINARY_TYPES.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="severity">Severity *</Label>
                          <Select
                            value={formData.severity}
                            onValueChange={(value) => handleInputChange("severity", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {SEVERITY_LEVELS.map((level) => (
                                <SelectItem key={level.id} value={level.id}>
                                  {level.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="summary">Summary *</Label>
                        <Textarea
                          id="summary"
                          value={formData.summary}
                          onChange={(e) => handleInputChange("summary", e.target.value)}
                          placeholder="Brief description of the incident..."
                          rows={2}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="fullDetails">Full Details</Label>
                        <Textarea
                          id="fullDetails"
                          value={formData.fullDetails}
                          onChange={(e) => handleInputChange("fullDetails", e.target.value)}
                          placeholder="Complete incident details..."
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="evidence">Attach Evidence</Label>
                        <Input
                          id="evidence"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={handleFileChange}
                          className="cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          PDF, images, or Word documents (max 15MB)
                        </p>
                      </div>
                      <DialogFooter className="gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowRecordDialog(false);
                            resetForm();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                          {submitting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Recording...
                            </>
                          ) : (
                            "Record Incident"
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
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No disciplinary records found</p>
                <p className="text-sm mt-1">Record an incident to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.employeeName}</TableCell>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>{getTypeBadge(record.type)}</TableCell>
                      <TableCell>{getSeverityBadge(record.severity)}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>
                        <span title={record.summary}>{truncateText(record.summary, 40)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewDetails(record)}
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

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Disciplinary Record</DialogTitle>
            <DialogDescription>Update the incident details and status</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-type">Type *</Label>
                <Select
                  value={editFormData.type}
                  onValueChange={(value) => handleEditInputChange("type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCIPLINARY_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-severity">Severity *</Label>
                <Select
                  value={editFormData.severity}
                  onValueChange={(value) => handleEditInputChange("severity", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_LEVELS.map((level) => (
                      <SelectItem key={level.id} value={level.id}>
                        {level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value) => handleEditInputChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-summary">Summary *</Label>
              <Textarea
                id="edit-summary"
                value={editFormData.summary}
                onChange={(e) => handleEditInputChange("summary", e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="edit-details">Full Details</Label>
              <Textarea
                id="edit-details"
                value={editFormData.fullDetails}
                onChange={(e) => handleEditInputChange("fullDetails", e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-action">Action Taken</Label>
              <Textarea
                id="edit-action"
                value={editFormData.actionTaken}
                onChange={(e) => handleEditInputChange("actionTaken", e.target.value)}
                placeholder="Document actions taken..."
                rows={2}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Disciplinary Action Details</DialogTitle>
            <DialogDescription>Full details of the incident and actions taken</DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Employee</Label>
                  <p className="font-medium">{selectedRecord.employeeName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Date</Label>
                  <p>{formatDate(selectedRecord.date)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Type</Label>
                  <div className="mt-1">{getTypeBadge(selectedRecord.type)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Severity</Label>
                  <div className="mt-1">{getSeverityBadge(selectedRecord.severity)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedRecord.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Created By</Label>
                  <p>{selectedRecord.createdBy}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Summary</Label>
                <p className="mt-1">{selectedRecord.summary}</p>
              </div>
              {selectedRecord.fullDetails && (
                <div>
                  <Label className="text-muted-foreground text-xs">Full Details</Label>
                  <p className="mt-1 text-sm">{selectedRecord.fullDetails}</p>
                </div>
              )}
              {selectedRecord.actionTaken && (
                <div>
                  <Label className="text-muted-foreground text-xs">Action Taken</Label>
                  <p className="mt-1 text-sm">{selectedRecord.actionTaken}</p>
                </div>
              )}
              {selectedRecord.evidenceUrl && (
                <div>
                  <Label className="text-muted-foreground text-xs">Evidence</Label>
                  <div className="mt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(selectedRecord.evidenceUrl, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Evidence
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowViewDialog(false)} className="flex-1">
                  Close
                </Button>
                {selectedRecord.status !== "closed" && (
                  <Button
                    className="flex-1"
                    onClick={() => setShowCloseDialog(true)}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Close Case
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Close Case Confirmation */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Case</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close this disciplinary case? This action will mark the case as resolved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseCase} disabled={closing}>
              {closing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Closing...
                </>
              ) : (
                "Close Case"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this disciplinary record? This action cannot be undone.
              Any uploaded evidence will also be removed.
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
