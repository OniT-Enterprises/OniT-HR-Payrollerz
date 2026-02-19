import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  departmentService,
  type Department,
  type DepartmentInput,
} from "@/services/departmentService";
import { employeeService, type Employee } from "@/services/employeeService";
import { useTenantId } from "@/contexts/TenantContext";


import {
  Building,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
} from "lucide-react";

interface DepartmentManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  onDepartmentChange?: () => void;
}

export default function DepartmentManager({
  open,
  onOpenChange,
  mode,
  onDepartmentChange,
}: DepartmentManagerProps) {
  const { toast } = useToast();
  const tenantId = useTenantId();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [formData, setFormData] = useState<DepartmentInput>({
    name: "",
    director: "none",
    manager: "none",
    icon: "building",
    shape: "circle",
    color: "#3B82F6",
  });

  // Predefined colors for departments
  const departmentColors = [
    { name: "Blue", value: "#3B82F6" },
    { name: "Green", value: "#10B981" },
    { name: "Purple", value: "#8B5CF6" },
    { name: "Orange", value: "#F97316" },
    { name: "Pink", value: "#EC4899" },
    { name: "Indigo", value: "#6366F1" },
    { name: "Yellow", value: "#EAB308" },
    { name: "Red", value: "#EF4444" },
    { name: "Teal", value: "#14B8A6" },
    { name: "Cyan", value: "#06B6D4" },
  ];

  useEffect(() => {
    if (open) {
      loadData();
      if (mode === "add") {
        setShowAddForm(true);
        resetForm();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [deptData, empData] = await Promise.all([
        departmentService.getAllDepartments(tenantId),
        employeeService.getAllEmployees(tenantId),
      ]);
      setDepartments(deptData);
      setEmployees(empData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load departments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      director: "none",
      manager: "none",
      icon: "building",
      shape: "circle",
      color: "#3B82F6",
    });
    setEditingDept(null);
  };

  const handleInputChange = (field: keyof DepartmentInput, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Department name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      // Convert 'none' values to empty strings for storage
      const dataToSave = {
        ...formData,
        director: formData.director === "none" ? "" : formData.director,
        manager: formData.manager === "none" ? "" : formData.manager,
      };

      if (editingDept) {
        await departmentService.updateDepartment(tenantId, editingDept.id, dataToSave);
        toast({
          title: "Department Updated",
          description:
            "Changes will be reflected in both the Organization Chart and Departments page",
        });
      } else {
        await departmentService.addDepartment(tenantId, dataToSave);
        toast({
          title: "Department Added",
          description:
            "New department will appear in both the Organization Chart and Departments page",
        });
      }

      resetForm();
      setShowAddForm(false);
      loadData();
      onDepartmentChange?.();
    } catch (error) {
      console.error("Error saving department:", error);
      toast({
        title: "Error",
        description: "Failed to save department",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDept(department);
    setFormData({
      name: department.name,
      director: department.director || "none",
      manager: department.manager || "none",
      icon: department.icon || "building",
      shape: department.shape || "circle",
      color: department.color || "#3B82F6",
    });
    setShowAddForm(true);
  };

  const handleDelete = async (department: Department) => {
    const empInDept = employees.filter(
      (emp) => emp.jobDetails.department === department.name,
    );

    if (empInDept.length > 0) {
      toast({
        title: "Cannot Delete",
        description: `Cannot delete department with ${empInDept.length} employees. Move employees first.`,
        variant: "destructive",
      });
      return;
    }

    try {
      await departmentService.deleteDepartment(tenantId, department.id);
      toast({
        title: "Department Deleted",
        description:
          "Department removed from both Organization Chart and Departments page",
      });
      loadData();
      onDepartmentChange?.();
    } catch (error) {
      console.error("Error deleting department:", error);
      toast({
        title: "Error",
        description: "Failed to delete department",
        variant: "destructive",
      });
    }
  };

  const getDepartmentStats = (deptName: string) => {
    const deptEmployees = employees.filter(
      (emp) => emp.jobDetails.department === deptName,
    );
    const monthlyPayroll = deptEmployees.reduce(
      (sum, emp) =>
        sum +
        (emp.compensation.monthlySalary ||
          Math.round((emp.compensation.annualSalary ?? 0) / 12) ||
          0),
      0,
    );

    return {
      employeeCount: deptEmployees.length,
      monthlyPayroll,
      employees: deptEmployees,
    };
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Department Manager</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-3">Loading departments...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              {mode === "add" ? "Add Department" : "Manage Departments"}
            </div>
          </DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Create a new department"
              : "Add, edit, and organize your company departments"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add/Edit Form */}
          {showAddForm && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {editingDept ? (
                    <Edit className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {editingDept ? "Edit Department" : "Add New Department"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="deptName">Department Name *</Label>
                  <Input
                    id="deptName"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="e.g., Engineering, Marketing"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deptDirector">Director</Label>
                    <Select
                      value={formData.director}
                      onValueChange={(value) =>
                        handleInputChange("director", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select director" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Director</SelectItem>
                        {employees
                          .filter((emp) => emp.status === "active")
                          .map((employee) => (
                            <SelectItem
                              key={employee.id}
                              value={`${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`}
                            >
                              {employee.personalInfo.firstName}{" "}
                              {employee.personalInfo.lastName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deptManager">Manager</Label>
                    <Select
                      value={formData.manager}
                      onValueChange={(value) =>
                        handleInputChange("manager", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Manager</SelectItem>
                        {employees
                          .filter((emp) => emp.status === "active")
                          .map((employee) => (
                            <SelectItem
                              key={employee.id}
                              value={`${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`}
                            >
                              {employee.personalInfo.firstName}{" "}
                              {employee.personalInfo.lastName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Department Color */}
                <div className="space-y-2">
                  <Label htmlFor="deptColor">Department Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {departmentColors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => handleInputChange("color", color.value)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          formData.color === color.value
                            ? "border-gray-800 scale-110"
                            : "border-gray-300 hover:border-gray-500"
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: formData.color }}
                    />
                    <span>
                      Selected:{" "}
                      {departmentColors.find((c) => c.value === formData.color)
                        ?.name || "Custom"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSave} className="flex-1">
                    <Save className="mr-2 h-4 w-4" />
                    {editingDept ? "Update" : "Add"} Department
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false);
                      resetForm();
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add Department Button (for edit mode) */}
          {mode === "edit" && !showAddForm && (
            <Button
              onClick={() => {
                setShowAddForm(true);
                resetForm();
              }}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add New Department
            </Button>
          )}

          {/* Existing Departments */}
          {departments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Current Departments ({departments.length})
                </CardTitle>
                <CardDescription>
                  Manage and edit your organization's departments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">
                          Department
                        </th>
                        <th className="text-center p-3 font-medium">
                          Director
                        </th>
                        <th className="text-center p-3 font-medium">Manager</th>
                        <th className="text-center p-3 font-medium">
                          Employees
                        </th>
                        <th className="text-center p-3 font-medium">
                          Monthly Payroll
                        </th>
                        <th className="text-center p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departments.map((department) => {
                        const stats = getDepartmentStats(department.name);
                        return (
                          <tr
                            key={department.id}
                            className="border-b hover:bg-muted/50"
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded-full border"
                                  style={{
                                    backgroundColor:
                                      department.color || "#3B82F6",
                                  }}
                                />
                                <Building className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {department.name}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              {department.director ? (
                                <Badge
                                  variant="outline"
                                  className="text-blue-600"
                                >
                                  {department.director}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {department.manager ? (
                                <Badge
                                  variant="outline"
                                  className="text-green-600"
                                >
                                  {department.manager}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <Badge variant="secondary">
                                {stats.employeeCount}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              <span className="font-medium">
                                {new Intl.NumberFormat("en-US", {
                                  style: "currency",
                                  currency: "USD",
                                  maximumFractionDigits: 0,
                                }).format(stats.monthlyPayroll)}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(department)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(department)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {departments.length === 0 && (
            <div className="text-center py-8">
              <Building className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No Departments</h3>
              <p className="text-muted-foreground mb-4">
                Create your first department to get started
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
