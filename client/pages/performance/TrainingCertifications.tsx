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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import {
  Filter,
  Plus,
  Download,
  Eye,
  Edit,
  Award,
  Upload,
  FileText,
  Calendar,
  ExternalLink,
} from "lucide-react";

export default function TrainingCertifications() {
  const { toast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    employee: "",
    courseTitle: "",
    provider: "",
    startDate: "",
    completionDate: "",
    expiryDate: "",
    certificate: null as File | null,
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

  const statusOptions = [
    { id: "all", name: "All Statuses" },
    { id: "pending", name: "Pending" },
    { id: "completed", name: "Completed" },
    { id: "expired", name: "Expired" },
  ];

  // Mock training records data
  const trainingRecords = [
    {
      id: 1,
      employeeId: "1",
      employeeName: "Sarah Johnson",
      courseTitle: "Advanced React Development",
      provider: "Tech Academy",
      startDate: "2024-01-15",
      completionDate: "2024-02-15",
      expiryDate: "2026-02-15",
      status: "Completed",
      certificateUrl: "cert_sarah_react.pdf",
    },
    {
      id: 2,
      employeeId: "2",
      employeeName: "Michael Chen",
      courseTitle: "AWS Solutions Architect",
      provider: "Amazon Web Services",
      startDate: "2024-01-10",
      completionDate: null,
      expiryDate: null,
      status: "Pending",
      certificateUrl: null,
    },
    {
      id: 3,
      employeeId: "3",
      employeeName: "Emily Rodriguez",
      courseTitle: "Digital Marketing Certification",
      provider: "Google",
      startDate: "2023-06-01",
      completionDate: "2023-07-01",
      expiryDate: "2024-07-01",
      status: "Expired",
      certificateUrl: "cert_emily_marketing.pdf",
    },
    {
      id: 4,
      employeeId: "4",
      employeeName: "James Miller",
      courseTitle: "Project Management Professional",
      provider: "PMI",
      startDate: "2023-11-01",
      completionDate: "2024-01-01",
      expiryDate: "2027-01-01",
      status: "Completed",
      certificateUrl: "cert_james_pmp.pdf",
    },
    {
      id: 5,
      employeeId: "5",
      employeeName: "Jennifer Brown",
      courseTitle: "SHRM Certified Professional",
      provider: "SHRM",
      startDate: "2024-01-01",
      completionDate: null,
      expiryDate: null,
      status: "Pending",
      certificateUrl: null,
    },
    {
      id: 6,
      employeeId: "6",
      employeeName: "David Wilson",
      courseTitle: "Cybersecurity Fundamentals",
      provider: "CompTIA",
      startDate: "2023-09-01",
      completionDate: "2023-12-01",
      expiryDate: "2026-12-01",
      status: "Completed",
      certificateUrl: "cert_david_security.pdf",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "Pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "Expired":
        return <Badge className="bg-red-100 text-red-800">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleInputChange = (field: string, value: string | File | null) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleInputChange("certificate", file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.employee ||
      !formData.courseTitle ||
      !formData.provider ||
      !formData.startDate
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Creating training record:", formData);

      toast({
        title: "Success",
        description: "Training record saved successfully.",
      });

      setFormData({
        employee: "",
        courseTitle: "",
        provider: "",
        startDate: "",
        completionDate: "",
        expiryDate: "",
        certificate: null,
      });
      setShowAddDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save training record. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFilter = () => {
    console.log("Filtering training records:", {
      selectedEmployee: selectedEmployee === "all" ? "" : selectedEmployee,
      selectedStatus: selectedStatus === "all" ? "" : selectedStatus,
    });
    toast({
      title: "Filter Applied",
      description: "Training records filtered successfully.",
    });
  };

  const handleExportCSV = () => {
    const csvData = paginatedRecords.map((record) => ({
      Employee: record.employeeName,
      Course: record.courseTitle,
      Provider: record.provider,
      "Start Date": record.startDate,
      "Completion Date": record.completionDate || "N/A",
      "Expiry Date": record.expiryDate || "N/A",
      Status: record.status,
    }));

    console.log("Exporting CSV data:", csvData);
    toast({
      title: "Export Started",
      description: "CSV file will be downloaded shortly.",
    });
  };

  const handleViewRecord = (recordId: number) => {
    console.log("Viewing training record:", recordId);
    toast({
      title: "View Record",
      description: "Opening training record details...",
    });
  };

  const handleEditRecord = (recordId: number) => {
    console.log("Editing training record:", recordId);
    toast({
      title: "Edit Record",
      description: "Opening edit form...",
    });
  };

  const handleDownloadCertificate = (certificateUrl: string) => {
    console.log("Downloading certificate:", certificateUrl);
    toast({
      title: "Download Started",
      description: "Certificate will be downloaded shortly.",
    });
  };

  // Filter and pagination
  const filteredRecords = trainingRecords.filter((record) => {
    if (selectedEmployee && selectedEmployee !== "all") {
      if (record.employeeId !== selectedEmployee) return false;
    }
    if (selectedStatus && selectedStatus !== "all") {
      if (record.status.toLowerCase() !== selectedStatus.toLowerCase())
        return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Training & Certifications
            </h1>
            <p className="text-gray-600">
              Manage employee training programs and certifications
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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

          {/* Training Records Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Training Records
                  </CardTitle>
                  <CardDescription>
                    Showing {paginatedRecords.length} of{" "}
                    {filteredRecords.length} records
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Training
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Training Record</DialogTitle>
                        <DialogDescription>
                          Create a new training record for an employee
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
                          <Label htmlFor="course-title">Course Title *</Label>
                          <Input
                            id="course-title"
                            value={formData.courseTitle}
                            onChange={(e) =>
                              handleInputChange("courseTitle", e.target.value)
                            }
                            placeholder="Enter course title"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="provider">Provider *</Label>
                          <Input
                            id="provider"
                            value={formData.provider}
                            onChange={(e) =>
                              handleInputChange("provider", e.target.value)
                            }
                            placeholder="Enter training provider"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="start-date">Start Date *</Label>
                            <Input
                              id="start-date"
                              type="date"
                              value={formData.startDate}
                              onChange={(e) =>
                                handleInputChange("startDate", e.target.value)
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="completion-date">
                              Completion Date
                            </Label>
                            <Input
                              id="completion-date"
                              type="date"
                              value={formData.completionDate}
                              onChange={(e) =>
                                handleInputChange(
                                  "completionDate",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="expiry-date">Expiry Date</Label>
                          <Input
                            id="expiry-date"
                            type="date"
                            value={formData.expiryDate}
                            onChange={(e) =>
                              handleInputChange("expiryDate", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="certificate">
                            Certificate Upload
                          </Label>
                          <div className="mt-1">
                            <Input
                              id="certificate"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={handleFileChange}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Upload PDF, JPG, or PNG files
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowAddDialog(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button type="submit" className="flex-1">
                            Save Training
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
                    <TableHead>Course Title</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Completion Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Certificate</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.employeeName}
                      </TableCell>
                      <TableCell>{record.courseTitle}</TableCell>
                      <TableCell>{record.provider}</TableCell>
                      <TableCell>
                        {record.completionDate || (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.expiryDate || (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>
                        {record.certificateUrl ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleDownloadCertificate(record.certificateUrl!)
                            }
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewRecord(record.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditRecord(record.id)}
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
        </div>
      </div>
    </div>
  );
}
