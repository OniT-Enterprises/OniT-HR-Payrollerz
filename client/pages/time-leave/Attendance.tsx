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
import { useToast } from "@/hooks/use-toast";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import {
  Calendar,
  Filter,
  Plus,
  Download,
  Clock,
  User,
  Grid,
  List,
} from "lucide-react";

export default function Attendance() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [viewMode, setViewMode] = useState<"calendar" | "table">("calendar");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showMarkDialog, setShowMarkDialog] = useState(false);

  const [formData, setFormData] = useState({
    employee: "",
    date: "",
    checkIn: "",
    checkOut: "",
  });

  // Data (will come from respective services)
  const departments: { id: string; name: string }[] = [];
  const employees: { id: string; name: string; department: string }[] = [];
  const attendanceRecords: {
    id: number;
    employeeId: string;
    employeeName: string;
    department: string;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    totalHours: number;
    status: string;
  }[] = [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "On-time":
        return <Badge className="bg-green-100 text-green-800">On-time</Badge>;
      case "Late":
        return <Badge className="bg-yellow-100 text-yellow-800">Late</Badge>;
      case "Absent":
        return <Badge className="bg-red-100 text-red-800">Absent</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const calculateTotalHours = (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(`2000-01-01 ${checkIn}`);
    const end = new Date(`2000-01-01 ${checkOut}`);
    const diff = end.getTime() - start.getTime();
    return Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employee || !formData.date || !formData.checkIn) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Marking attendance:", formData);

      toast({
        title: "Success",
        description: "Attendance marked successfully.",
      });

      setFormData({
        employee: "",
        date: "",
        checkIn: "",
        checkOut: "",
      });
      setShowMarkDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark attendance. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleView = () => {
    console.log("Viewing attendance for date:", selectedDate);
    toast({
      title: "View Updated",
      description: `Showing attendance for ${selectedDate}`,
    });
  };

  const handleExportCSV = () => {
    const csvData = attendanceRecords.map((record) => ({
      Employee: record.employeeName,
      Department: record.department,
      Date: record.date,
      "Check In": record.checkIn || "N/A",
      "Check Out": record.checkOut || "N/A",
      "Total Hours": record.totalHours,
      Status: record.status,
    }));

    console.log("Exporting CSV data:", csvData);
    toast({
      title: "Export Started",
      description: "CSV file will be downloaded shortly.",
    });
  };

  const filteredRecords = attendanceRecords.filter((record) => {
    if (
      selectedDepartment &&
      selectedDepartment !== "all" &&
      record.department !==
        departments.find((d) => d.id === selectedDepartment)?.name
    ) {
      return false;
    }
    if (
      selectedStatus &&
      selectedStatus !== "all" &&
      record.status !== selectedStatus
    ) {
      return false;
    }
    return true;
  });

  const renderCalendarView = () => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM
    const todayRecords = filteredRecords.filter(
      (record) => record.date === selectedDate,
    );

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Calendar View
          </CardTitle>
          <CardDescription>
            Visual timeline of employee check-ins and check-outs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayRecords.map((record) => (
              <Card key={record.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{record.employeeName}</h4>
                  {getStatusBadge(record.status)}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Check-in:</span>
                    <span>{record.checkIn || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Check-out:</span>
                    <span>{record.checkOut || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total:</span>
                    <span>{record.totalHours}h</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {todayRecords.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No attendance records found for {selectedDate}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderTableView = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              Attendance Records
            </CardTitle>
            <CardDescription>
              Showing {filteredRecords.length} attendance records
            </CardDescription>
          </div>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Check-In</TableHead>
              <TableHead>Check-Out</TableHead>
              <TableHead>Total Hours</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">
                  {record.employeeName}
                </TableCell>
                <TableCell>{record.department}</TableCell>
                <TableCell>{record.checkIn || "N/A"}</TableCell>
                <TableCell>{record.checkOut || "N/A"}</TableCell>
                <TableCell>{record.totalHours}h</TableCell>
                <TableCell>{getStatusBadge(record.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Attendance
            </h1>
            <p className="text-gray-600">
              Track and manage employee attendance
            </p>
          </div>

          {/* Controls */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters & View
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
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
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={selectedStatus}
                    onValueChange={setSelectedStatus}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="On-time">On-time</SelectItem>
                      <SelectItem value="Late">Late</SelectItem>
                      <SelectItem value="Absent">Absent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Button onClick={handleView} className="w-full">
                    <Calendar className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
                <div>
                  <Dialog
                    open={showMarkDialog}
                    onOpenChange={setShowMarkDialog}
                  >
                    <DialogTrigger asChild>
                      <Button className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Mark Attendance
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Mark Attendance</DialogTitle>
                        <DialogDescription>
                          Record employee check-in and check-out times
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
                          <Label htmlFor="attendance-date">Date *</Label>
                          <Input
                            id="attendance-date"
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
                            <Label htmlFor="check-in">Check-In Time *</Label>
                            <Input
                              id="check-in"
                              type="time"
                              value={formData.checkIn}
                              onChange={(e) =>
                                handleInputChange("checkIn", e.target.value)
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="check-out">Check-Out Time</Label>
                            <Input
                              id="check-out"
                              type="time"
                              value={formData.checkOut}
                              onChange={(e) =>
                                handleInputChange("checkOut", e.target.value)
                              }
                            />
                          </div>
                        </div>
                        {formData.checkIn && formData.checkOut && (
                          <div className="text-sm text-gray-600">
                            Total Hours:{" "}
                            {calculateTotalHours(
                              formData.checkIn,
                              formData.checkOut,
                            )}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowMarkDialog(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button type="submit" className="flex-1">
                            Mark Attendance
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* View Toggle */}
          <div className="mb-6 flex gap-2">
            <Button
              variant={viewMode === "calendar" ? "default" : "outline"}
              onClick={() => setViewMode("calendar")}
            >
              <Grid className="h-4 w-4 mr-2" />
              Calendar View
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4 mr-2" />
              Table View
            </Button>
          </div>

          {/* Content */}
          {viewMode === "calendar" ? renderCalendarView() : renderTableView()}
        </div>
      </div>
    </div>
  );
}
