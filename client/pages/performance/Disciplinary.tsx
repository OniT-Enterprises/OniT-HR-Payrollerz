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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import {
  Filter,
  Plus,
  Download,
  Eye,
  Edit,
  Shield,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
} from "lucide-react";

export default function Disciplinary() {
  const { toast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    employee: "",
    date: "",
    type: "",
    severity: "",
    summary: "",
    evidence: null as File | null,
  });

  // Mock data
  const employees = [
    { id: "1", name: "Sarah Johnson" },
    { id: "2", name: "Michael Chen" },
    { id: "3", name: "Emily Rodriguez" },
    { id: "4", name: "James Miller" },
    { id: "5", name: "Jennifer Brown" },
    { id: "6", name: "David Wilson" },
    { id: "7", name: "Lisa Anderson" },
    { id: "8", name: "Robert Taylor" },
  ];

  const incidentTypes = [
    { id: "warning", name: "Warning" },
    { id: "suspension", name: "Suspension" },
    { id: "termination", name: "Termination" },
    { id: "misconduct", name: "Misconduct" },
    { id: "attendance", name: "Attendance Issue" },
    { id: "performance", name: "Performance Issue" },
  ];

  const severityLevels = [
    { id: "low", name: "Low" },
    { id: "medium", name: "Medium" },
    { id: "high", name: "High" },
  ];

  const statusOptions = [
    { id: "all", name: "All Statuses" },
    { id: "open", name: "Open" },
    { id: "in-review", name: "In Review" },
    { id: "closed", name: "Closed" },
  ];

  // Mock disciplinary actions data
  const disciplinaryActions = [
    {
      id: 1,
      employeeId: "3",
      employeeName: "Emily Rodriguez",
      date: "2024-01-10",
      type: "Warning",
      severity: "Low",
      status: "Closed",
      summary:
        "Late arrival to work on multiple occasions without prior notice.",
      evidenceUrl: "evidence_emily_attendance.pdf",
      fullDetails:
        "Employee has been consistently 15-30 minutes late over the past two weeks. Discussed expectations and provided warning. Employee acknowledged and committed to improvement.",
      actionTaken: "Verbal warning issued. Follow-up scheduled for 2 weeks.",
      createdBy: "Jennifer Brown",
      createdDate: "2024-01-10",
      closedDate: "2024-01-15",
    },
    {
      id: 2,
      employeeId: "6",
      employeeName: "David Wilson",
      date: "2024-01-08",
      type: "Misconduct",
      severity: "High",
      status: "In Review",
      summary:
        "Inappropriate behavior during team meeting, disrespectful comments towards colleagues.",
      evidenceUrl: "evidence_david_misconduct.pdf",
      fullDetails:
        "During the weekly team meeting, employee made several inappropriate comments about colleagues' abilities and interrupted others frequently. Multiple team members reported feeling uncomfortable.",
      actionTaken: "Under HR review. Investigation in progress.",
      createdBy: "Sarah Johnson",
      createdDate: "2024-01-08",
      closedDate: null,
    },
    {
      id: 3,
      employeeId: "8",
      employeeName: "Robert Taylor",
      date: "2024-01-05",
      type: "Performance Issue",
      severity: "Medium",
      status: "Open",
      summary:
        "Consistently missing project deadlines and quality standards below expectations.",
      evidenceUrl: null,
      fullDetails:
        "Employee has missed 3 consecutive project deadlines and delivered work that required significant revision. Performance metrics show 40% below team average.",
      actionTaken: "Performance improvement plan initiated.",
      createdBy: "Michael Chen",
      createdDate: "2024-01-05",
      closedDate: null,
    },
    {
      id: 4,
      employeeId: "4",
      employeeName: "James Miller",
      date: "2023-12-20",
      type: "Attendance Issue",
      severity: "Medium",
      status: "Closed",
      summary: "Excessive unexcused absences affecting team productivity.",
      evidenceUrl: "evidence_james_attendance.pdf",
      fullDetails:
        "Employee had 8 unexcused absences in the past month without following proper notification procedures. This has impacted project timelines and team morale.",
      actionTaken: "Written warning issued. Attendance tracking implemented.",
      createdBy: "Jennifer Brown",
      createdDate: "2023-12-20",
      closedDate: "2024-01-02",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
        return <Badge className="bg-red-100 text-red-800">Open</Badge>;
      case "In Review":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">In Review</Badge>
        );
      case "Closed":
        return <Badge className="bg-green-100 text-green-800">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "Low":
        return <Badge className="bg-blue-100 text-blue-800">Low</Badge>;
      case "Medium":
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case "High":
        return <Badge className="bg-red-100 text-red-800">High</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const colorMap: { [key: string]: string } = {
      Warning: "bg-yellow-100 text-yellow-800",
      Suspension: "bg-orange-100 text-orange-800",
      Termination: "bg-red-100 text-red-800",
      Misconduct: "bg-purple-100 text-purple-800",
      "Attendance Issue": "bg-blue-100 text-blue-800",
      "Performance Issue": "bg-green-100 text-green-800",
    };

    return (
      <Badge className={colorMap[type] || "bg-gray-100 text-gray-800"}>
        {type}
      </Badge>
    );
  };

  const handleInputChange = (field: string, value: string | File | null) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleInputChange("evidence", file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.employee ||
      !formData.date ||
      !formData.type ||
      !formData.severity ||
      !formData.summary
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Recording disciplinary incident:", formData);

      toast({
        title: "Success",
        description: "Incident recorded successfully.",
      });

      setFormData({
        employee: "",
        date: "",
        type: "",
        severity: "",
        summary: "",
        evidence: null,
      });
      setShowRecordDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record incident. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFilter = () => {
    console.log("Filtering disciplinary actions:", {
      selectedEmployee: selectedEmployee === "all" ? "" : selectedEmployee,
      selectedType: selectedType === "all" ? "" : selectedType,
      selectedStatus: selectedStatus === "all" ? "" : selectedStatus,
    });
    toast({
      title: "Filter Applied",
      description: "Disciplinary actions filtered successfully.",
    });
  };

  const handleExportCSV = () => {
    const csvData = paginatedActions.map((action) => ({
      Employee: action.employeeName,
      Date: action.date,
      Type: action.type,
      Severity: action.severity,
      Status: action.status,
      Summary: action.summary,
    }));

    console.log("Exporting CSV data:", csvData);
    toast({
      title: "Export Started",
      description: "CSV file will be downloaded shortly.",
    });
  };

  const handleViewDetails = (action: any) => {
    setSelectedIncident(action);
    setShowViewDialog(true);
  };

  const handleEditRecord = (actionId: number) => {
    console.log("Editing disciplinary action:", actionId);
    toast({
      title: "Edit Record",
      description: "Opening edit form...",
    });
  };

  const handleCloseCase = async (actionId: number) => {
    try {
      console.log("Closing case:", actionId);

      toast({
        title: "Success",
        description: "Case closed successfully.",
      });

      setShowViewDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to close case. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadEvidence = (evidenceUrl: string) => {
    console.log("Downloading evidence:", evidenceUrl);
    toast({
      title: "Download Started",
      description: "Evidence file will be downloaded shortly.",
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  // Filter and pagination
  const filteredActions = disciplinaryActions.filter((action) => {
    if (selectedEmployee && selectedEmployee !== "all") {
      if (action.employeeId !== selectedEmployee) return false;
    }
    if (selectedType && selectedType !== "all") {
      if (action.type.toLowerCase() !== selectedType.toLowerCase())
        return false;
    }
    if (selectedStatus && selectedStatus !== "all") {
      if (action.status.toLowerCase() !== selectedStatus.toLowerCase())
        return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredActions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedActions = filteredActions.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Disciplinary
            </h1>
            <p className="text-gray-600">
              Manage disciplinary actions and incident reports
            </p>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
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
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
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
                      {incidentTypes.map((type) => (
                        <SelectItem key={type.id} value={type.name}>
                          {type.name}
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
                  <Button onClick={handleFilter} className="w-full">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Disciplinary Actions Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Disciplinary Actions
                  </CardTitle>
                  <CardDescription>
                    Showing {paginatedActions.length} of{" "}
                    {filteredActions.length} actions
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Dialog
                    open={showRecordDialog}
                    onOpenChange={setShowRecordDialog}
                  >
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Record Incident
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
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
                                  {employee.name}
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
                            onChange={(e) =>
                              handleInputChange("date", e.target.value)
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="type">Type *</Label>
                          <Select
                            value={formData.type}
                            onValueChange={(value) =>
                              handleInputChange("type", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {incidentTypes.map((type) => (
                                <SelectItem key={type.id} value={type.name}>
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
                            onValueChange={(value) =>
                              handleInputChange("severity", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select severity" />
                            </SelectTrigger>
                            <SelectContent>
                              {severityLevels.map((level) => (
                                <SelectItem key={level.id} value={level.name}>
                                  {level.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="summary">Summary *</Label>
                          <Textarea
                            id="summary"
                            value={formData.summary}
                            onChange={(e) =>
                              handleInputChange("summary", e.target.value)
                            }
                            placeholder="Describe the incident..."
                            rows={3}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="evidence">Attach Evidence</Label>
                          <div className="mt-1">
                            <Input
                              id="evidence"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                              onChange={handleFileChange}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Upload documents, images, or evidence files
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowRecordDialog(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button type="submit" className="flex-1">
                            Record Incident
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
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Date of Incident</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedActions.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell className="font-medium">
                        {action.employeeName}
                      </TableCell>
                      <TableCell>{action.date}</TableCell>
                      <TableCell>{getTypeBadge(action.type)}</TableCell>
                      <TableCell>{getSeverityBadge(action.severity)}</TableCell>
                      <TableCell>{getStatusBadge(action.status)}</TableCell>
                      <TableCell>
                        <span title={action.summary}>
                          {truncateText(action.summary, 50)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewDetails(action)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditRecord(action.id)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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

          {/* View Details Dialog */}
          <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Disciplinary Action Details</DialogTitle>
                <DialogDescription>
                  Full details of the incident and actions taken
                </DialogDescription>
              </DialogHeader>
              {selectedIncident && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Employee</Label>
                      <p className="text-sm">{selectedIncident.employeeName}</p>
                    </div>
                    <div>
                      <Label>Date</Label>
                      <p className="text-sm">{selectedIncident.date}</p>
                    </div>
                    <div>
                      <Label>Type</Label>
                      <div className="mt-1">
                        {getTypeBadge(selectedIncident.type)}
                      </div>
                    </div>
                    <div>
                      <Label>Severity</Label>
                      <div className="mt-1">
                        {getSeverityBadge(selectedIncident.severity)}
                      </div>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <div className="mt-1">
                        {getStatusBadge(selectedIncident.status)}
                      </div>
                    </div>
                    <div>
                      <Label>Created By</Label>
                      <p className="text-sm">{selectedIncident.createdBy}</p>
                    </div>
                  </div>
                  <div>
                    <Label>Summary</Label>
                    <p className="text-sm mt-1">{selectedIncident.summary}</p>
                  </div>
                  <div>
                    <Label>Full Details</Label>
                    <p className="text-sm mt-1">
                      {selectedIncident.fullDetails}
                    </p>
                  </div>
                  <div>
                    <Label>Action Taken</Label>
                    <p className="text-sm mt-1">
                      {selectedIncident.actionTaken}
                    </p>
                  </div>
                  {selectedIncident.evidenceUrl && (
                    <div>
                      <Label>Evidence</Label>
                      <div className="mt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleDownloadEvidence(selectedIncident.evidenceUrl)
                          }
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Download Evidence
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowViewDialog(false)}
                      className="flex-1"
                    >
                      Close
                    </Button>
                    {selectedIncident.status !== "Closed" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button className="flex-1">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Close Case
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Close Case</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to close this disciplinary
                              case? This action will mark the case as resolved.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleCloseCase(selectedIncident.id)
                              }
                            >
                              Close Case
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
