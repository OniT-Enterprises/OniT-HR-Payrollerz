import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import { employeeService, type Employee } from "@/services/employeeService";
import OfflineStatusBanner from "@/components/OfflineStatusBanner";
import { fileUploadService } from "@/services/fileUploadService";
import {
  departmentService,
  type Department,
} from "@/services/departmentService";
import CSVColumnMapper from "@/components/CSVColumnMapper";
import {
  UserPlus,
  Upload,
  Save,
  ArrowLeft,
  CreditCard,
  DollarSign,
  Calendar,
  AlertTriangle,
  FileDown,
  FileUp,
  Info,
  FileText,
  Mail,
  Phone,
  Cross,
  Smartphone,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

// Helper function to get monthly salary with fallback for legacy data
const getMonthlySalary = (compensation: any): number => {
  return (
    compensation.monthlySalary ||
    Math.round((compensation.annualSalary || 0) / 12) ||
    0
  );
};

export default function AddEmployee() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const editEmployeeId = searchParams.get("edit");
  const [formData, setFormData] = useState({
    profilePhoto: null,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    phoneApp: "",
    appEligible: false,
    emergencyContactName: "",
    emergencyContactPhone: "",
    department: "",
    jobTitle: "",
    manager: "",
    startDate: "",
    employmentType: "Full-time",
    salary: "",
    leaveDays: "",
    benefits: "",
  });

  const [documents, setDocuments] = useState([
    {
      id: 1,
      type: "Employee ID Card",
      number: "",
      expiryDate: "",
      required: true,
    },
    {
      id: 2,
      type: "Social Security Number",
      number: "",
      expiryDate: "",
      required: true,
    },
    {
      id: 3,
      type: "Electoral Card Number",
      number: "",
      expiryDate: "",
      required: false,
    },
    { id: 4, type: "ID Card", number: "", expiryDate: "", required: true },
    { id: 5, type: "Passport", number: "", expiryDate: "", required: false },
  ]);

  const [additionalInfo, setAdditionalInfo] = useState({
    nationality: "Timor-Leste",
    workContract: null as File | null,
    workingVisaNumber: "",
    workingVisaExpiry: "",
    workingVisaFile: null as File | null,
  });

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    loadDepartmentsAndManagers();
    // Check if we're in edit mode
    if (editEmployeeId) {
      loadEmployeeForEdit(editEmployeeId);
    }
  }, [editEmployeeId]);

  const loadEmployeeForEdit = async (employeeId: string) => {
    try {
      setLoading(true);
      const employee = await employeeService.getEmployeeById(employeeId);
      if (employee) {
        setIsEditMode(true);
        setEditingEmployee(employee);

        // Populate form with employee data
        setFormData({
          profilePhoto: null,
          firstName: employee.personalInfo.firstName,
          lastName: employee.personalInfo.lastName,
          email: employee.personalInfo.email,
          phone: employee.personalInfo.phone,
          phoneApp: (employee.personalInfo as any).phoneApp || "",
          appEligible: (employee.personalInfo as any).appEligible || false,
          emergencyContactName:
            employee.personalInfo.emergencyContactName || "",
          emergencyContactPhone:
            employee.personalInfo.emergencyContactPhone || "",
          department: employee.jobDetails.department,
          jobTitle: employee.jobDetails.position,
          manager: employee.jobDetails.manager || "",
          startDate: employee.jobDetails.hireDate,
          employmentType: employee.jobDetails.employmentType,
          salary: getMonthlySalary(employee.compensation).toString(),
          leaveDays: employee.compensation.annualLeave?.toString() || "",
          benefits: employee.compensation.benefitsPackage || "",
        });

        // Populate documents if they exist
        if (employee.documents) {
          setDocuments((prev) =>
            prev.map((doc) => {
              let empDoc = null;

              // Map form document types to database field names
              switch (doc.type) {
                case "Employee ID Card":
                  empDoc = employee.documents?.employeeIdCard;
                  break;
                case "Social Security Number":
                  empDoc = employee.documents?.socialSecurityNumber;
                  break;
                case "Electoral Card Number":
                  empDoc = employee.documents?.electoralCard;
                  break;
                case "ID Card":
                  empDoc = employee.documents?.idCard;
                  break;
                case "Passport":
                  empDoc = employee.documents?.passport;
                  break;
                default:
                  empDoc = null;
              }

              if (empDoc) {
                return {
                  ...doc,
                  number: empDoc.number || "",
                  expiryDate: empDoc.expiryDate || "",
                  required: empDoc.required ?? doc.required,
                };
              }
              return doc;
            }),
          );

          if (employee.documents.nationality) {
            setAdditionalInfo((prev) => ({
              ...prev,
              nationality: employee.documents?.nationality || "Timor-Leste",
              workContract: null, // File uploads can't be pre-populated, but we can show if exists
              workingVisaNumber:
                employee.documents?.workingVisaResidency?.number || "",
              workingVisaExpiry:
                employee.documents?.workingVisaResidency?.expiryDate || "",
              workingVisaFile: null, // File uploads can't be pre-populated
            }));
          }
        }
      } else {
        toast({
          title: "Error",
          description: "Employee not found",
          variant: "destructive",
        });
        navigate("/staff");
      }
    } catch (error) {
      console.error("Error loading employee for edit:", error);
      toast({
        title: "Error",
        description: "Failed to load employee data",
        variant: "destructive",
      });
      navigate("/staff");
    } finally {
      setLoading(false);
    }
  };

  const loadDepartmentsAndManagers = async () => {
    try {
      const [departmentsData, employeesData] = await Promise.all([
        departmentService.getAllDepartments(),
        employeeService.getAllEmployees(),
      ]);

      // Auto-migrate departments that exist in employee records but not in departments collection
      const migrationResult = await migrateMissingDepartments(
        employeesData,
        departmentsData,
      );

      setDepartments(migrationResult.departments);
      // Filter employees who could be managers (exclude current employee from manager list)
      const potentialManagers = employeesData.filter(
        (emp) => emp.id !== editEmployeeId,
      );
      setManagers(potentialManagers);
    } catch (error) {
      console.error("Error loading departments and managers:", error);
      toast({
        title: "Error",
        description: "Failed to load departments and managers",
        variant: "destructive",
      });
    } finally {
      if (!editEmployeeId) {
        setLoading(false);
      }
    }
  };

  const migrateMissingDepartments = async (
    employees: Employee[],
    existingDepartments: Department[],
  ) => {
    try {
      // Only run migration on initial load, not during updates
      if (existingDepartments.length > 0) {
        return { departments: existingDepartments }; // Skip migration if departments already exist
      }

      // Get unique department names from employees
      const employeeDepartments = [
        ...new Set(employees.map((emp) => emp.jobDetails.department)),
      ];

      // Filter out empty department names
      const validDepartments = employeeDepartments.filter(
        (deptName) => deptName && deptName.trim(),
      );

      // Create missing departments only if we have employees but no departments
      if (validDepartments.length > 0 && existingDepartments.length === 0) {
        for (const deptName of validDepartments) {
          await departmentService.addDepartment({
            name: deptName,
            icon: "building",
            shape: "circle",
            color: "#3B82F6",
          });
        }

        // Return updated departments
        const finalDepartments = await departmentService.getAllDepartments();
        return { departments: finalDepartments };
      }

      return { departments: existingDepartments };
    } catch (error) {
      console.error("Error migrating departments:", error);
      return { departments: existingDepartments };
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDocumentChange = (id: number, field: string, value: string) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, [field]: value } : doc)),
    );
  };

  const handleAdditionalInfoChange = (
    field: string,
    value: string | File | null,
  ) => {
    setAdditionalInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getExpiryStatus = (expiryDate: string) => {
    if (!expiryDate) return null;

    const today = new Date();
    const expiry = new Date(expiryDate);
    const timeDiff = expiry.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysDiff < 0) {
      return {
        status: "expired",
        message: "Expired",
        variant: "destructive" as const,
      };
    } else if (daysDiff <= 28) {
      return {
        status: "expiring",
        message: `Expires in ${daysDiff} days`,
        variant: "destructive" as const,
      };
    } else if (daysDiff <= 60) {
      return {
        status: "warning",
        message: `Expires in ${daysDiff} days`,
        variant: "secondary" as const,
      };
    }
    return { status: "valid", message: "Valid", variant: "default" as const };
  };

  const downloadTemplate = () => {
    const headers = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "phoneApp",
      "emergencyContactName",
      "emergencyContactPhone",
      "department",
      "jobTitle",
      "manager",
      "startDate",
      "employmentType",
      "salary",
      "leaveDays",
      "benefits",
      "socialSecurityNumber",
      "socialSecurityExpiry",
      "electoralCardNumber",
      "electoralCardExpiry",
      "idCardNumber",
      "idCardExpiry",
      "passportNumber",
      "passportExpiry",
    ];

    const sampleData = [
      "John",
      "Doe",
      "john.doe@company.com",
      "+1234567890",
      "Jane Doe",
      "+1987654321",
      "eng",
      "Software Engineer",
      "1",
      "2024-02-01",
      "Full-time",
      "75000",
      "25",
      "standard",
      "123-45-6789",
      "2030-12-31",
      "EC123456789",
      "2029-06-15",
      "ID987654321",
      "2028-03-20",
      "P123456789",
      "2030-01-15",
    ];

    const csvContent = [headers, sampleData]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employee_import_template.csv";
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "Employee import template has been downloaded successfully.",
    });
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      setShowImportDialog(false);
      setShowColumnMapper(true);
    }
  };

  const handleMappingComplete = async (mappings: any[], csvData: any[]) => {
    try {
      if (csvData.length === 0) {
        toast({
          title: "No Data",
          description: "The CSV file contains no employee data.",
          variant: "destructive",
        });
        return;
      }

      setIsSubmitting(true);
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Show initial progress
      toast({
        title: "Starting Bulk Import",
        description: `Processing ${csvData.length} employees...`,
      });

      // Process all rows of data with the mappings
      for (let i = 0; i < csvData.length; i++) {
        try {
          const employeeData = csvData[i];
          const mappedData: any = {};

          // Apply column mappings to extract data
          mappings.forEach((mapping) => {
            const csvValue = employeeData[mapping.csvColumn] || "";
            mappedData[mapping.employeeField] = csvValue.toString().trim();
          });

          // Validate required fields
          if (
            !mappedData.firstName ||
            !mappedData.lastName ||
            !mappedData.email
          ) {
            errorCount++;
            errors.push(
              `Row ${i + 1}: Missing required fields (First Name, Last Name, or Email)`,
            );
            continue;
          }

          // Use Employee ID Card number as employeeId, fallback to mapped data or temp ID
          const employeeId =
            mappedData.employeeIdCard ||
            mappedData.employeeId ||
            `TEMP${Date.now()}`;
          const currentDate = new Date();

          // Create employee object in the format expected by Firebase
          const newEmployee: Omit<Employee, "id"> = {
            personalInfo: {
              firstName: mappedData.firstName,
              lastName: mappedData.lastName,
              email: mappedData.email,
              phone: mappedData.phone || "",
              phoneApp: mappedData.phoneApp || "",
              appEligible: mappedData.appEligible === "true" || false,
              address: mappedData.address || "",
              dateOfBirth: mappedData.dateOfBirth || "",
              socialSecurityNumber: mappedData.socialSecurityNumber || "",
              emergencyContactName: mappedData.emergencyContactName || "",
              emergencyContactPhone: mappedData.emergencyContactPhone || "",
            },
            jobDetails: {
              employeeId: employeeId,
              department: mappedData.department || "General",
              position: mappedData.position || "Employee",
              hireDate:
                mappedData.hireDate || currentDate.toISOString().split("T")[0],
              employmentType: mappedData.employmentType || "Full-time",
              workLocation: mappedData.workLocation || "Office",
              manager: mappedData.manager || "",
            },
            compensation: {
              monthlySalary: parseInt(mappedData.monthlySalary) || 0,
              annualLeaveDays: parseInt(mappedData.annualLeaveDays) || 25,
              benefitsPackage: mappedData.benefitsPackage || "Standard",
            },
            documents: {
              socialSecurityNumber: {
                number: mappedData.socialSecurityNumber || "",
                expiryDate: mappedData.ssnExpiryDate || "",
              },
              electoralCard: {
                number: mappedData.electoralCardNumber || "",
                expiryDate: mappedData.electoralCardExpiryDate || "",
              },
              idCard: {
                number: mappedData.idCardNumber || "",
                expiryDate: mappedData.idCardExpiryDate || "",
              },
              passport: {
                number: mappedData.passportNumber || "",
                expiryDate: mappedData.passportExpiryDate || "",
              },
            },
            status: "active",
          };

          // Save to Firebase
          const employeeId_returned =
            await employeeService.addEmployee(newEmployee);

          if (employeeId_returned) {
            successCount++;

            // Show progress every 10 employees
            if (successCount % 10 === 0) {
              toast({
                title: "Import Progress",
                description: `${successCount}/${csvData.length} employees imported...`,
              });
            }
          } else {
            errorCount++;
            errors.push(
              `Row ${i + 1}: Failed to save ${mappedData.firstName} ${mappedData.lastName}`,
            );
          }

          // Add small delay to avoid overwhelming Firebase
          if (i % 5 === 0 && i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error) {
          errorCount++;
          const employeeData = csvData[i];
          const name = `${employeeData[mappings.find((m) => m.employeeField === "firstName")?.csvColumn] || "Unknown"} ${employeeData[mappings.find((m) => m.employeeField === "lastName")?.csvColumn] || "Employee"}`;
          errors.push(`Row ${i + 1}: Error importing ${name} - ${error}`);
          console.error(`Error importing employee ${i + 1}:`, error);
        }
      }

      setShowColumnMapper(false);
      setImportFile(null);

      // Show final results
      if (successCount > 0) {
        toast({
          title: "Bulk Import Complete!",
          description: `Successfully imported ${successCount} employees. ${errorCount > 0 ? `${errorCount} errors occurred.` : ""}`,
        });

        // Navigate to All Employees to see the imported data
        setTimeout(() => {
          navigate("/staff/employees");
        }, 2000);
      } else {
        toast({
          title: "Import Failed",
          description:
            "No employees were successfully imported. Please check your data and try again.",
          variant: "destructive",
        });
      }

      // Show detailed errors if any
      if (errors.length > 0 && errors.length <= 5) {
        setTimeout(() => {
          toast({
            title: "Import Errors",
            description: errors.join("; "),
            variant: "destructive",
          });
        }, 1000);
      } else if (errors.length > 5) {
        setTimeout(() => {
          toast({
            title: "Multiple Import Errors",
            description: `${errors.length} errors occurred. Check console for details.`,
            variant: "destructive",
          });
        }, 1000);
        console.error("Import errors:", errors);
      }
    } catch (error) {
      console.error("Error during bulk import:", error);
      toast({
        title: "Import Failed",
        description: "Failed to process the CSV file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMappingCancel = () => {
    setShowColumnMapper(false);
    setImportFile(null);
  };

  const processCSVImport = async () => {
    if (!importFile) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to import.",
        variant: "destructive",
      });
      return;
    }

    try {
      const text = await importFile.text();
      const lines = text.split("\n");
      const headers = lines[0]
        .split(",")
        .map((header) => header.replace(/"/g, "").trim());

      if (lines.length < 2) {
        toast({
          title: "Empty File",
          description:
            "The CSV file appears to be empty or contains only headers.",
          variant: "destructive",
        });
        return;
      }

      // Process first data row (for demo - in production you'd handle multiple rows)
      const dataRow = lines[1]
        .split(",")
        .map((cell) => cell.replace(/"/g, "").trim());

      const employeeData: any = {};
      headers.forEach((header, index) => {
        employeeData[header] = dataRow[index] || "";
      });

      // Map CSV data to form data
      setFormData({
        profilePhoto: null,
        firstName: employeeData.firstName || "",
        lastName: employeeData.lastName || "",
        email: employeeData.email || "",
        phone: employeeData.phone || "",
        phoneApp: employeeData.phoneApp || "",
        appEligible: employeeData.appEligible || false,
        emergencyContactName: employeeData.emergencyContactName || "",
        emergencyContactPhone: employeeData.emergencyContactPhone || "",
        department: employeeData.department || "",
        jobTitle: employeeData.jobTitle || "",
        manager: employeeData.manager || "",
        startDate: employeeData.startDate || "",
        employmentType: employeeData.employmentType || "Full-time",
        salary: employeeData.salary || "",
        leaveDays: employeeData.leaveDays || "",
        benefits: employeeData.benefits || "",
      });

      // Map documents data
      setDocuments([
        {
          id: 1,
          type: "Social Security Number",
          number: employeeData.socialSecurityNumber || "",
          expiryDate: employeeData.socialSecurityExpiry || "",
        },
        {
          id: 2,
          type: "Electoral Card Number",
          number: employeeData.electoralCardNumber || "",
          expiryDate: employeeData.electoralCardExpiry || "",
        },
        {
          id: 3,
          type: "ID Card",
          number: employeeData.idCardNumber || "",
          expiryDate: employeeData.idCardExpiry || "",
        },
        {
          id: 4,
          type: "Passport",
          number: employeeData.passportNumber || "",
          expiryDate: employeeData.passportExpiry || "",
        },
      ]);

      setShowImportDialog(false);
      setImportFile(null);

      toast({
        title: "Import Successful",
        description: `Employee data imported successfully. Please review and save.`,
      });
    } catch (error) {
      toast({
        title: "Import Failed",
        description:
          "Failed to process CSV file. Please check the file format.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return; // Prevent double submission

    // Basic validation
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.department ||
      !formData.jobTitle
    ) {
      toast({
        title: "Validation Error",
        description:
          "Please fill in all required fields (First Name, Last Name, Email, Department, Job Title).",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate employee ID
      const currentDate = new Date();
      // Use Employee ID Card number from documents as employeeId
      const employeeId = documents[0]?.number || `TEMP${Date.now()}`;

      // Create employee object in the format expected by Firebase
      const newEmployee: Omit<Employee, "id"> = {
        personalInfo: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          phoneApp: formData.phoneApp,
          appEligible: formData.appEligible,
          address: "", // Could be added to form later
          dateOfBirth: "", // Could be added to form later
          socialSecurityNumber: documents[1]?.number || "",
          emergencyContactName: formData.emergencyContactName,
          emergencyContactPhone: formData.emergencyContactPhone,
        },
        jobDetails: {
          employeeId: employeeId,
          department: formData.department,
          position: formData.jobTitle,
          hireDate:
            formData.startDate || currentDate.toISOString().split("T")[0],
          employmentType: formData.employmentType,
          workLocation: "Office", // Default value
          manager: formData.manager,
        },
        compensation: {
          monthlySalary: parseInt(formData.salary) || 0,
          annualLeaveDays: parseInt(formData.leaveDays) || 25,
          benefitsPackage: formData.benefits || "Standard",
        },
        documents: {
          employeeIdCard: {
            number: documents[0]?.number || "",
            expiryDate: documents[0]?.expiryDate || "",
            required: documents[0]?.required || true,
          },
          socialSecurityNumber: {
            number: documents[1]?.number || "",
            expiryDate: documents[1]?.expiryDate || "",
            required: documents[1]?.required || true,
          },
          electoralCard: {
            number: documents[2]?.number || "",
            expiryDate: documents[2]?.expiryDate || "",
            required: documents[2]?.required || false,
          },
          idCard: {
            number: documents[3]?.number || "",
            expiryDate: documents[3]?.expiryDate || "",
            required: documents[3]?.required || true,
          },
          passport: {
            number: documents[4]?.number || "",
            expiryDate: documents[4]?.expiryDate || "",
            required: documents[4]?.required || false,
          },
          workContract: {
            fileUrl: "", // Will be updated after file upload
            uploadDate: new Date().toISOString(),
          },
          nationality: additionalInfo.nationality,
          workingVisaResidency: {
            number: additionalInfo.workingVisaNumber,
            expiryDate: additionalInfo.workingVisaExpiry,
            fileUrl: "", // Will be updated after file upload
          },
        },
        status: "active", // Default all new employees to active
      };

      // Upload files if they exist
      let workContractUrl = "";
      let workingVisaUrl = "";

      const employeeIdForUpload = isEditMode
        ? editingEmployee.id
        : fileUploadService.generateTempEmployeeId();

      try {
        // Upload work contract file if provided
        if (additionalInfo.workContract) {
          workContractUrl = await fileUploadService.uploadEmployeeDocument(
            additionalInfo.workContract,
            employeeIdForUpload,
            "workContract",
          );
        }

        // Upload working visa file if provided
        if (additionalInfo.workingVisaFile) {
          workingVisaUrl = await fileUploadService.uploadEmployeeDocument(
            additionalInfo.workingVisaFile,
            employeeIdForUpload,
            "workingVisa",
          );
        }
      } catch (uploadError) {
        console.error("Error uploading files:", uploadError);
        toast({
          title: "File Upload Error",
          description:
            "Some documents failed to upload. Employee will be saved without documents.",
          variant: "destructive",
        });
      }

      // Update document URLs in the employee object
      if (workContractUrl) {
        newEmployee.documents.workContract.fileUrl = workContractUrl;
      }
      if (workingVisaUrl) {
        newEmployee.documents.workingVisaResidency.fileUrl = workingVisaUrl;
      }

      // Save to Firebase
      if (isEditMode && editingEmployee) {
        // Update existing employee
        await employeeService.updateEmployee(editingEmployee.id, newEmployee);
        toast({
          title: "Success",
          description: `Employee ${formData.firstName} ${formData.lastName} updated successfully!`,
        });
      } else {
        // Add new employee
        const employeeId_returned =
          await employeeService.addEmployee(newEmployee);
        if (!employeeId_returned) {
          throw new Error("Failed to save employee");
        }
        toast({
          title: "Success",
          description: `Employee ${formData.firstName} ${formData.lastName} added successfully!`,
        });
      }

      // Navigate back to All Employees
      navigate("/staff/employees");
    } catch (error) {
      console.error("Error adding employee:", error);
      toast({
        title: "Error",
        description: "Failed to add employee. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <HotDogStyleNavigation />
        <div className="p-6">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-3">Loading departments...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <HotDogStyleNavigation />

      <div className="p-6">
        <OfflineStatusBanner />
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/staff/employees")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <UserPlus className="h-8 w-8 text-purple-400" />
            <div>
              <h2 className="text-3xl font-bold">
                {isEditMode ? "Edit Employee Profile" : "New Employee Profile"}
              </h2>
              <p className="text-muted-foreground">
                {isEditMode
                  ? "Update employee information and documents"
                  : "Add a new team member to your organization"}
              </p>
            </div>
          </div>

          {/* CSV Import Options */}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              <FileDown className="mr-2 h-4 w-4" />
              Download Template
            </Button>

            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline">
                  <FileUp className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Import Employee Data</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file with employee information or download our
                    template.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="csvFile">CSV File</Label>
                    <Input
                      id="csvFile"
                      type="file"
                      accept=".csv"
                      onChange={handleFileImport}
                      className="mt-1"
                    />
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-muted-foreground">or</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={downloadTemplate}
                    className="w-full"
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Download Template
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowImportDialog(false);
                        setImportFile(null);
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* CSV Column Mapper Dialog */}
            <Dialog open={showColumnMapper} onOpenChange={setShowColumnMapper}>
              <DialogContent className="max-w-7xl max-h-[90vh] overflow-auto">
                <DialogHeader>
                  <DialogTitle>Import Employees from CSV</DialogTitle>
                </DialogHeader>
                <CSVColumnMapper
                  csvFile={importFile}
                  onMappingComplete={handleMappingComplete}
                  onCancel={handleMappingCancel}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Profile Photo */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Photo</CardTitle>
                <CardDescription>
                  Upload a profile picture for the employee
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-32 h-32 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <Upload className="h-8 w-8 text-gray-400" />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="profilePhoto"
                  />
                  <label htmlFor="profilePhoto">
                    <Button type="button" variant="outline" asChild>
                      <span>Upload Photo</span>
                    </Button>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Personal Information */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Basic information about the employee
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        handleInputChange("firstName", e.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        handleInputChange("lastName", e.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                {/* Personal Contact Information - One Row */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-600" />
                      Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      required
                      placeholder="employee@company.com"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-green-600" />
                      Phone
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        handleInputChange("phone", e.target.value)
                      }
                      placeholder="+670 123 4567"
                    />
                  </div>

                  {/* Phone App */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="phoneApp"
                      className="flex items-center gap-2"
                    >
                      <Smartphone className="h-4 w-4 text-purple-600" />
                      Phone App
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Phone number for the company mobile app access.
                              This will be used for app enrollment.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="phoneApp"
                      type="tel"
                      value={formData.phoneApp}
                      onChange={(e) =>
                        handleInputChange("phoneApp", e.target.value)
                      }
                      placeholder="+670 987 6543"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        id={`app-eligible-form`}
                        className="rounded border-gray-300"
                        checked={formData.appEligible}
                        onChange={(e) =>
                          handleInputChange("appEligible", e.target.checked)
                        }
                      />
                      <Label
                        htmlFor={`app-eligible-form`}
                        className="text-sm text-muted-foreground cursor-pointer"
                      >
                        Eligible for mobile app enrollment
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Separator Line */}
                <div className="border-t border-gray-200 my-4"></div>

                {/* Emergency Contact Information - One Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Emergency Contact Name */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="emergencyContactName"
                      className="flex items-center gap-2"
                    >
                      <Cross className="h-4 w-4 text-red-600" />
                      Emergency Contact
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Person to contact in case of emergency, medical
                              situation, or urgent workplace incident.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      id="emergencyContactName"
                      value={formData.emergencyContactName}
                      onChange={(e) =>
                        handleInputChange(
                          "emergencyContactName",
                          e.target.value,
                        )
                      }
                      placeholder="Contact name"
                    />
                  </div>

                  {/* Emergency Contact Phone */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="emergencyContactPhone"
                      className="flex items-center gap-2"
                    >
                      <Phone className="h-4 w-4 text-red-600" />
                      Emergency Phone
                    </Label>
                    <Input
                      id="emergencyContactPhone"
                      type="tel"
                      value={formData.emergencyContactPhone}
                      onChange={(e) =>
                        handleInputChange(
                          "emergencyContactPhone",
                          e.target.value,
                        )
                      }
                      placeholder="Contact phone"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Job Information */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Job Information</CardTitle>
                <CardDescription>Role and department details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department *</Label>
                    <Select
                      value={formData.department}
                      onValueChange={(value) =>
                        handleInputChange("department", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.name}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Job Title *</Label>
                    <Input
                      id="jobTitle"
                      value={formData.jobTitle}
                      onChange={(e) =>
                        handleInputChange("jobTitle", e.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manager">Manager</Label>
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
                        {managers.map((manager) => (
                          <SelectItem
                            key={manager.id}
                            value={`${manager.personalInfo.firstName} ${manager.personalInfo.lastName}`}
                          >
                            {manager.personalInfo.firstName}{" "}
                            {manager.personalInfo.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) =>
                        handleInputChange("startDate", e.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employmentType">Employment Type</Label>
                    <Select
                      value={formData.employmentType}
                      onValueChange={(value) =>
                        handleInputChange("employmentType", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Full-time">Full-time</SelectItem>
                        <SelectItem value="Part-time">Part-time</SelectItem>
                        <SelectItem value="Contractor">Contractor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="workContractJob">
                      Work Contract Document
                      {isEditMode &&
                        editingEmployee?.documents?.workContract?.fileUrl && (
                          <span className="ml-2 text-xs text-green-600">
                            (Current file exists)
                          </span>
                        )}
                    </Label>
                    <Input
                      id="workContractJob"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) =>
                        handleAdditionalInfoChange(
                          "workContract",
                          e.target.files?.[0] || null,
                        )
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload employment contract (PDF/DOC)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documents Section */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Documents & Identification
                </CardTitle>
                <CardDescription>
                  Employee identification documents with expiry tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Type</TableHead>
                      <TableHead>Number/ID</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((document) => {
                      const expiryStatus = getExpiryStatus(document.expiryDate);
                      return (
                        <TableRow key={document.id}>
                          <TableCell className="font-medium">
                            {document.type}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={document.number}
                              onChange={(e) =>
                                handleDocumentChange(
                                  document.id,
                                  "number",
                                  e.target.value,
                                )
                              }
                              placeholder="Enter number"
                              className="max-w-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={document.expiryDate}
                              onChange={(e) =>
                                handleDocumentChange(
                                  document.id,
                                  "expiryDate",
                                  e.target.value,
                                )
                              }
                              className="max-w-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <RadioGroup
                              value={
                                document.required ? "required" : "optional"
                              }
                              onValueChange={(value) => {
                                setDocuments((prev) =>
                                  prev.map((doc) =>
                                    doc.id === document.id
                                      ? {
                                          ...doc,
                                          required: value === "required",
                                        }
                                      : doc,
                                  ),
                                );
                              }}
                              className="flex flex-col gap-2"
                            >
                              <div className="flex items-center space-x-2 p-1 rounded hover:bg-green-50">
                                <RadioGroupItem
                                  value="required"
                                  id={`required-${document.id}`}
                                  className="text-green-600 border-green-600 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                />
                                <Label
                                  htmlFor={`required-${document.id}`}
                                  className="text-sm text-green-600 font-medium cursor-pointer select-none"
                                >
                                  ✓ Required
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 p-1 rounded hover:bg-red-50">
                                <RadioGroupItem
                                  value="optional"
                                  id={`optional-${document.id}`}
                                  className="text-red-600 border-red-600 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                />
                                <Label
                                  htmlFor={`optional-${document.id}`}
                                  className="text-sm text-red-600 font-medium cursor-pointer select-none"
                                >
                                  ✗ Optional
                                </Label>
                              </div>
                            </RadioGroup>
                          </TableCell>
                          <TableCell>
                            {expiryStatus && (
                              <Badge variant={expiryStatus.variant}>
                                {expiryStatus.status === "expiring" && (
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                )}
                                {expiryStatus.message}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Additional Document Fields */}
                <div className="mt-6 space-y-4">
                  <div className="grid md:grid-cols-1 gap-4">
                    {/* Nationality */}
                    <div className="space-y-2">
                      <Label htmlFor="nationality">Nationality *</Label>
                      <Select
                        value={additionalInfo.nationality}
                        onValueChange={(value) =>
                          handleAdditionalInfoChange("nationality", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select nationality" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Most Popular Countries */}
                          <SelectItem value="Timor-Leste">
                            🇹🇱 Timor-Leste
                          </SelectItem>
                          <SelectItem value="Australia">
                            🇦🇺 Australia
                          </SelectItem>
                          <SelectItem value="Chinese">🇨🇳 Chinese</SelectItem>
                          <SelectItem value="Indonesian">
                            🇮🇩 Indonesian
                          </SelectItem>
                          <SelectItem value="Filipino">🇵🇭 Filipino</SelectItem>
                          <SelectItem value="Malaysian">
                            🇲🇾 Malaysian
                          </SelectItem>
                          <SelectItem value="Singaporean">
                            🇸🇬 Singaporean
                          </SelectItem>
                          <SelectItem value="Portuguese">
                            🇵🇹 Portuguese
                          </SelectItem>

                          {/* Separator */}
                          <SelectItem
                            value="separator"
                            disabled
                            className="px-2 py-1 text-xs text-muted-foreground font-medium border-t mt-1 justify-center"
                          >
                            ────── Other Countries ──────
                          </SelectItem>

                          {/* All Other Countries */}
                          <SelectItem value="Afghanistan">
                            🇦🇫 Afghanistan
                          </SelectItem>
                          <SelectItem value="Albania">🇦🇱 Albania</SelectItem>
                          <SelectItem value="Algeria">🇩🇿 Algeria</SelectItem>
                          <SelectItem value="Argentina">
                            🇦🇷 Argentina
                          </SelectItem>
                          <SelectItem value="Armenia">🇦🇲 Armenia</SelectItem>
                          <SelectItem value="Austria">🇦���� Austria</SelectItem>
                          <SelectItem value="Azerbaijan">
                            🇦🇿 Azerbaijan
                          </SelectItem>
                          <SelectItem value="Bahrain">🇧🇭 Bahrain</SelectItem>
                          <SelectItem value="Bangladesh">
                            🇧🇩 Bangladesh
                          </SelectItem>
                          <SelectItem value="Belarus">🇧🇾 Belarus</SelectItem>
                          <SelectItem value="Belgium">🇧🇪 Belgium</SelectItem>
                          <SelectItem value="Bolivia">🇧🇴 Bolivia</SelectItem>
                          <SelectItem value="Bosnia and Herzegovina">
                            🇧🇦 Bosnia and Herzegovina
                          </SelectItem>
                          <SelectItem value="Brazil">🇧🇷 Brazil</SelectItem>
                          <SelectItem value="Brunei">🇧🇳 Brunei</SelectItem>
                          <SelectItem value="Bulgaria">🇧🇬 Bulgaria</SelectItem>
                          <SelectItem value="Cambodia">🇰🇭 Cambodia</SelectItem>
                          <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
                          <SelectItem value="Chile">🇨🇱 Chile</SelectItem>
                          <SelectItem value="Colombia">🇨🇴 Colombia</SelectItem>
                          <SelectItem value="Croatia">🇭🇷 Croatia</SelectItem>
                          <SelectItem value="Czech Republic">
                            🇨🇿 Czech Republic
                          </SelectItem>
                          <SelectItem value="Denmark">🇩🇰 Denmark</SelectItem>
                          <SelectItem value="Egypt">🇪🇬 Egypt</SelectItem>
                          <SelectItem value="Estonia">🇪🇪 Estonia</SelectItem>
                          <SelectItem value="Finland">🇫🇮 Finland</SelectItem>
                          <SelectItem value="France">🇫🇷 France</SelectItem>
                          <SelectItem value="Georgia">🇬🇪 Georgia</SelectItem>
                          <SelectItem value="Germany">🇩🇪 Germany</SelectItem>
                          <SelectItem value="Greece">🇬🇷 Greece</SelectItem>
                          <SelectItem value="Hungary">🇭🇺 Hungary</SelectItem>
                          <SelectItem value="Iceland">🇮🇸 Iceland</SelectItem>
                          <SelectItem value="India">🇮🇳 India</SelectItem>
                          <SelectItem value="Iran">🇮🇷 Iran</SelectItem>
                          <SelectItem value="Iraq">🇮🇶 Iraq</SelectItem>
                          <SelectItem value="Ireland">🇮🇪 Ireland</SelectItem>
                          <SelectItem value="Israel">🇮🇱 Israel</SelectItem>
                          <SelectItem value="Italy">🇮🇹 Italy</SelectItem>
                          <SelectItem value="Japan">🇯🇵 Japan</SelectItem>
                          <SelectItem value="Jordan">🇯🇴 Jordan</SelectItem>
                          <SelectItem value="Kazakhstan">
                            🇰🇿 Kazakhstan
                          </SelectItem>
                          <SelectItem value="Kuwait">🇰🇼 Kuwait</SelectItem>
                          <SelectItem value="Laos">🇱🇦 Laos</SelectItem>
                          <SelectItem value="Latvia">🇱🇻 Latvia</SelectItem>
                          <SelectItem value="Lebanon">
                            ������� Lebanon
                          </SelectItem>
                          <SelectItem value="Lithuania">
                            🇱🇹 Lithuania
                          </SelectItem>
                          <SelectItem value="Luxembourg">
                            🇱🇺 Luxembourg
                          </SelectItem>
                          <SelectItem value="Mexico">🇲🇽 Mexico</SelectItem>
                          <SelectItem value="Mongolia">🇲🇳 Mongolia</SelectItem>
                          <SelectItem value="Morocco">🇲🇦 Morocco</SelectItem>
                          <SelectItem value="Myanmar">🇲���� Myanmar</SelectItem>
                          <SelectItem value="Nepal">🇳🇵 Nepal</SelectItem>
                          <SelectItem value="Netherlands">
                            🇳🇱 Netherlands
                          </SelectItem>
                          <SelectItem value="New Zealand">
                            🇳🇿 New Zealand
                          </SelectItem>
                          <SelectItem value="North Korea">
                            🇰🇵 North Korea
                          </SelectItem>
                          <SelectItem value="Norway">🇳🇴 Norway</SelectItem>
                          <SelectItem value="Oman">🇴🇲 Oman</SelectItem>
                          <SelectItem value="Pakistan">🇵🇰 Pakistan</SelectItem>
                          <SelectItem value="Palestine">
                            🇵🇸 Palestine
                          </SelectItem>
                          <SelectItem value="Peru">🇵🇪 Peru</SelectItem>
                          <SelectItem value="Poland">��🇱 Poland</SelectItem>
                          <SelectItem value="Portugal">🇵🇹 Portugal</SelectItem>
                          <SelectItem value="Qatar">🇶🇦 Qatar</SelectItem>
                          <SelectItem value="Romania">🇷🇴 Romania</SelectItem>
                          <SelectItem value="Russia">🇷🇺 Russia</SelectItem>
                          <SelectItem value="Saudi Arabia">
                            🇸🇦 Saudi Arabia
                          </SelectItem>
                          <SelectItem value="Serbia">🇷🇸 Serbia</SelectItem>
                          <SelectItem value="Slovakia">🇸🇰 Slovakia</SelectItem>
                          <SelectItem value="Slovenia">🇸🇮 Slovenia</SelectItem>
                          <SelectItem value="South Africa">
                            🇿🇦 South Africa
                          </SelectItem>
                          <SelectItem value="South Korea">
                            🇰🇷 South Korea
                          </SelectItem>
                          <SelectItem value="Spain">🇪🇸 Spain</SelectItem>
                          <SelectItem value="Sri Lanka">
                            🇱🇰 Sri Lanka
                          </SelectItem>
                          <SelectItem value="Sweden">🇸🇪 Sweden</SelectItem>
                          <SelectItem value="Switzerland">
                            🇨🇭 Switzerland
                          </SelectItem>
                          <SelectItem value="Syria">🇸🇾 Syria</SelectItem>
                          <SelectItem value="Taiwan">🇹🇼 Taiwan</SelectItem>
                          <SelectItem value="Thailand">🇹🇭 Thailand</SelectItem>
                          <SelectItem value="Turkey">🇹🇷 Turkey</SelectItem>
                          <SelectItem value="Ukraine">🇺🇦 Ukraine</SelectItem>
                          <SelectItem value="United Arab Emirates">
                            🇦🇪 United Arab Emirates
                          </SelectItem>
                          <SelectItem value="United Kingdom">
                            🇬🇧 United Kingdom
                          </SelectItem>
                          <SelectItem value="United States">
                            🇺🇸 United States
                          </SelectItem>
                          <SelectItem value="Uruguay">🇺🇾 Uruguay</SelectItem>
                          <SelectItem value="Uzbekistan">
                            🇺🇿 Uzbekistan
                          </SelectItem>
                          <SelectItem value="Venezuela">
                            🇻🇪 Venezuela
                          </SelectItem>
                          <SelectItem value="Vietnam">���🇳 Vietnam</SelectItem>
                          <SelectItem value="Yemen">🇾🇪 Yemen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Working Visa/Residency - only show if not Timor-Leste */}
                  {additionalInfo.nationality !== "Timor-Leste" && (
                    <div className="mt-4 p-4 border rounded-lg bg-orange-50">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Working Visa / Residency Documentation
                      </h4>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="workingVisaNumber">
                            Visa/Residency Number
                          </Label>
                          <Input
                            id="workingVisaNumber"
                            value={additionalInfo.workingVisaNumber}
                            onChange={(e) =>
                              handleAdditionalInfoChange(
                                "workingVisaNumber",
                                e.target.value,
                              )
                            }
                            placeholder="Enter visa number"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="workingVisaExpiry">Expiry Date</Label>
                          <Input
                            id="workingVisaExpiry"
                            type="date"
                            value={additionalInfo.workingVisaExpiry}
                            onChange={(e) =>
                              handleAdditionalInfoChange(
                                "workingVisaExpiry",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="workingVisaFile">
                            Upload Document
                            {isEditMode &&
                              editingEmployee?.documents?.workingVisaResidency
                                ?.fileUrl && (
                                <span className="ml-2 text-xs text-green-600">
                                  (Current file exists)
                                </span>
                              )}
                          </Label>
                          <Input
                            id="workingVisaFile"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) =>
                              handleAdditionalInfoChange(
                                "workingVisaFile",
                                e.target.files?.[0] || null,
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Show expiry warnings */}
                {documents.some((doc) => {
                  const status = getExpiryStatus(doc.expiryDate);
                  return (
                    status &&
                    (status.status === "expired" ||
                      status.status === "expiring")
                  );
                }) && (
                  <Alert className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Some documents are expired or expiring soon. Please ensure
                      all employee documents are up to date.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Salary & Benefits Section */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Compensation & Benefits
                </CardTitle>
                <CardDescription>
                  Monthly salary, leave allowance, and benefits information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="salary">Monthly Salary</Label>
                    <Input
                      id="salary"
                      type="number"
                      value={formData.salary}
                      onChange={(e) =>
                        handleInputChange("salary", e.target.value)
                      }
                      placeholder="e.g., 6250"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter monthly salary amount
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="leaveDays">Annual Leave Days</Label>
                    <Input
                      id="leaveDays"
                      type="number"
                      value={formData.leaveDays}
                      onChange={(e) =>
                        handleInputChange("leaveDays", e.target.value)
                      }
                      placeholder="e.g., 25"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="benefits">Benefits Package</Label>
                    <Select
                      value={formData.benefits}
                      onValueChange={(value) =>
                        handleInputChange("benefits", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select benefits package" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic Package</SelectItem>
                        <SelectItem value="standard">
                          Standard Package
                        </SelectItem>
                        <SelectItem value="premium">Premium Package</SelectItem>
                        <SelectItem value="executive">
                          Executive Package
                        </SelectItem>
                        <SelectItem value="custom">Custom Package</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/staff/employees")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting
                ? isEditMode
                  ? "Updating..."
                  : "Saving..."
                : isEditMode
                  ? "Update Employee"
                  : "Save Employee"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
