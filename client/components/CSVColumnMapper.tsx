import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";


import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  ArrowRight,
  Download,
  Upload,
  FileSpreadsheet,
  Columns,
  CheckCircle,
  AlertCircle,
  Trash2,
  RotateCcw,
} from "lucide-react";

interface CSVColumn {
  id: string;
  name: string;
  sample?: string;
}

interface EmployeeField {
  id: string;
  name: string;
  category: string;
  required: boolean;
  type: "text" | "email" | "phone" | "date" | "number" | "select";
  options?: string[];
}

interface ColumnMapping {
  csvColumn: string;
  employeeField: string;
}

interface CSVColumnMapperProps {
  csvFile: File | null;
  onMappingComplete: (mappings: ColumnMapping[], csvData: any[]) => void;
  onCancel: () => void;
}

const EMPLOYEE_FIELDS: EmployeeField[] = [
  // Personal Information
  {
    id: "firstName",
    name: "First Name",
    category: "Personal Information",
    required: true,
    type: "text",
  },
  {
    id: "lastName",
    name: "Last Name",
    category: "Personal Information",
    required: true,
    type: "text",
  },
  {
    id: "email",
    name: "Email",
    category: "Personal Information",
    required: true,
    type: "email",
  },
  {
    id: "phone",
    name: "Phone",
    category: "Personal Information",
    required: false,
    type: "phone",
  },
  {
    id: "address",
    name: "Address",
    category: "Personal Information",
    required: false,
    type: "text",
  },
  {
    id: "dateOfBirth",
    name: "Date of Birth",
    category: "Personal Information",
    required: false,
    type: "date",
  },
  {
    id: "emergencyContactName",
    name: "Emergency Contact Name",
    category: "Personal Information",
    required: false,
    type: "text",
  },
  {
    id: "emergencyContactPhone",
    name: "Emergency Contact Phone",
    category: "Personal Information",
    required: false,
    type: "phone",
  },
  // Job Details
  {
    id: "employeeId",
    name: "Employee ID",
    category: "Job Details",
    required: false,
    type: "text",
  },
  {
    id: "department",
    name: "Department",
    category: "Job Details",
    required: true,
    type: "select",
    options: [
      "Engineering",
      "Human Resources",
      "Marketing",
      "Sales",
      "Finance",
      "Operations",
      "Customer Service",
      "Information Technology",
      "Legal",
      "Research & Development",
      "Quality Assurance",
      "Administration",
      "Procurement",
      "Facilities",
      "Training",
    ],
  },
  {
    id: "position",
    name: "Job Title/Position",
    category: "Job Details",
    required: true,
    type: "text",
  },
  {
    id: "hireDate",
    name: "Hire Date",
    category: "Job Details",
    required: false,
    type: "date",
  },
  {
    id: "employmentType",
    name: "Employment Type",
    category: "Job Details",
    required: false,
    type: "select",
    options: ["Full-time", "Part-time", "Contract", "Temporary", "Intern"],
  },
  {
    id: "workLocation",
    name: "Work Location",
    category: "Job Details",
    required: false,
    type: "select",
    options: ["Office", "Remote", "Hybrid", "Field"],
  },
  {
    id: "manager",
    name: "Manager",
    category: "Job Details",
    required: false,
    type: "text",
  },
  // Compensation
  {
    id: "monthlySalary",
    name: "Monthly Salary",
    category: "Compensation",
    required: false,
    type: "number",
  },
  {
    id: "annualLeaveDays",
    name: "Annual Leave Days",
    category: "Compensation",
    required: false,
    type: "number",
  },
  {
    id: "benefitsPackage",
    name: "Benefits Package",
    category: "Compensation",
    required: false,
    type: "select",
    options: ["Basic", "Standard", "Premium", "Executive"],
  },
  // Documents
  {
    id: "employeeIdCard",
    name: "Employee ID Card Number",
    category: "Documents",
    required: false,
    type: "text",
  },
  {
    id: "employeeIdExpiryDate",
    name: "Employee ID Expiry Date",
    category: "Documents",
    required: false,
    type: "date",
  },
  {
    id: "nationality",
    name: "Nationality",
    category: "Documents",
    required: false,
    type: "text",
  },
  {
    id: "socialSecurityNumber",
    name: "Social Security Number",
    category: "Documents",
    required: false,
    type: "text",
  },
  {
    id: "ssnExpiryDate",
    name: "SSN Expiry Date",
    category: "Documents",
    required: false,
    type: "date",
  },
  {
    id: "electoralCardNumber",
    name: "Electoral Card Number",
    category: "Documents",
    required: false,
    type: "text",
  },
  {
    id: "electoralCardExpiryDate",
    name: "Electoral Card Expiry Date",
    category: "Documents",
    required: false,
    type: "date",
  },
  {
    id: "idCardNumber",
    name: "ID Card Number",
    category: "Documents",
    required: false,
    type: "text",
  },
  {
    id: "idCardExpiryDate",
    name: "ID Card Expiry Date",
    category: "Documents",
    required: false,
    type: "date",
  },
  {
    id: "passportNumber",
    name: "Passport Number",
    category: "Documents",
    required: false,
    type: "text",
  },
  {
    id: "passportExpiryDate",
    name: "Passport Expiry Date",
    category: "Documents",
    required: false,
    type: "date",
  },
];

export default function CSVColumnMapper({
  csvFile,
  onMappingComplete,
  onCancel,
}: CSVColumnMapperProps) {
  const [csvColumns, setCsvColumns] = useState<CSVColumn[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [unmappedColumns, setUnmappedColumns] = useState<CSVColumn[]>([]);
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");
  const [, setLoading] = useState(false);

  useEffect(() => {
    if (csvFile) {
      parseCSVFile();
    }
  }, [csvFile]);

  const autoMapColumns = (columns: CSVColumn[]): ColumnMapping[] => {
    const mappings: ColumnMapping[] = [];

    columns.forEach((csvColumn) => {
      // Find exact match with employee field ID
      const matchingField = EMPLOYEE_FIELDS.find(
        (field) => field.id.toLowerCase() === csvColumn.name.toLowerCase(),
      );

      if (matchingField) {
        mappings.push({
          csvColumn: csvColumn.name,
          employeeField: matchingField.id,
        });
      }
    });

    return mappings;
  };

  const parseCSVFile = async () => {
    if (!csvFile) return;

    setLoading(true);
    try {
      const text = await csvFile.text();

      // Use papaparse for robust CSV handling:
      // - Correctly handles quoted fields with commas (e.g., "Address: Apt 1, Dili")
      // - Handles escaped quotes within quoted fields
      // - Handles different line endings (CRLF vs LF)
      // - Handles newlines within quoted fields
      const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        transform: (value) => value.trim(),
      });

      if (result.errors.length > 0) {
        console.warn("CSV parsing warnings:", result.errors);
      }

      const data = result.data;
      const headers = result.meta.fields || [];

      if (headers.length === 0 || data.length === 0) {
        throw new Error(
          "CSV file must have at least a header row and one data row",
        );
      }

      const columns: CSVColumn[] = headers.map((header, index) => ({
        id: `csv-col-${index}`,
        name: header,
        sample: data[0]?.[header] || "",
      }));

      setCsvColumns(columns);
      setCsvData(data);
      setUnmappedColumns([...columns]);

      // Auto-map columns that match exactly with employee field IDs
      const autoMappings = autoMapColumns(columns);
      setMappings(autoMappings);

      // Remove auto-mapped columns from unmapped list
      const mappedColumnNames = autoMappings.map((m) => m.csvColumn);
      setUnmappedColumns(
        columns.filter((col) => !mappedColumnNames.includes(col.name)),
      );

      setStep("map");
    } catch (error) {
      console.error("Error parsing CSV:", error);
      alert("Error parsing CSV file. Please check the file format.");
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;

    if (
      source.droppableId === "unmapped" &&
      destination.droppableId.startsWith("field-")
    ) {
      const fieldId = destination.droppableId.replace("field-", "");
      const columnId = result.draggableId;
      const column = csvColumns.find((col) => col.id === columnId);

      if (column) {
        // Remove from unmapped
        setUnmappedColumns((prev) => prev.filter((col) => col.id !== columnId));

        // Add to mappings (replace if field already mapped)
        setMappings((prev) => {
          const filtered = prev.filter(
            (mapping) => mapping.employeeField !== fieldId,
          );
          return [
            ...filtered,
            { csvColumn: column.name, employeeField: fieldId },
          ];
        });
      }
    }
  };

  const removeMapping = (fieldId: string) => {
    const mapping = mappings.find((m) => m.employeeField === fieldId);
    if (mapping) {
      const column = csvColumns.find((col) => col.name === mapping.csvColumn);
      if (column) {
        setUnmappedColumns((prev) => [...prev, column]);
      }
      setMappings((prev) => prev.filter((m) => m.employeeField !== fieldId));
    }
  };

  const resetMappings = () => {
    setMappings([]);
    setUnmappedColumns([...csvColumns]);
  };

  const getMappedColumn = (fieldId: string) => {
    const mapping = mappings.find((m) => m.employeeField === fieldId);
    return mapping
      ? csvColumns.find((col) => col.name === mapping.csvColumn)
      : null;
  };

  const getRequiredFieldsStatus = () => {
    const requiredFields = EMPLOYEE_FIELDS.filter((field) => field.required);
    const mappedRequiredFields = requiredFields.filter((field) =>
      mappings.some((mapping) => mapping.employeeField === field.id),
    );
    return {
      total: requiredFields.length,
      mapped: mappedRequiredFields.length,
      complete: mappedRequiredFields.length === requiredFields.length,
    };
  };

  const handleComplete = () => {
    const status = getRequiredFieldsStatus();
    if (!status.complete) {
      alert(
        `Please map all required fields. ${status.mapped}/${status.total} required fields mapped.`,
      );
      return;
    }
    onMappingComplete(mappings, csvData);
  };

  const downloadTemplate = () => {
    const headers = EMPLOYEE_FIELDS.map((field) => field.name);
    const sampleData = [
      "John",
      "Doe",
      "john.doe@company.com",
      "+1 (555) 123-4567",
      "123 Main St, City, State 12345",
      "1985-06-15",
      "Jane Doe",
      "+1 (555) 123-4568",
      "EMP001",
      "Engineering",
      "Software Engineer",
      "2023-01-15",
      "Full-time",
      "Remote",
      "Sarah Johnson",
      "85000",
      "25",
      "Standard",
      "***-**-1234",
      "2030-12-31",
      "EC123456",
      "2029-06-15",
      "ID987654",
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
    link.download = "meza_employee_template.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  if (step === "upload") {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <FileSpreadsheet className="h-16 w-16 mx-auto mb-4 text-blue-500" />
          <h3 className="text-lg font-semibold mb-2">CSV Column Mapping</h3>
          <p className="text-muted-foreground">
            Upload your CSV file and map columns to employee fields
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Option 1: Download Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Download our standard template with all fields properly
                formatted
              </p>
              <Button onClick={downloadTemplate} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Option 2: Map Your CSV</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Upload your existing CSV and map columns to our fields
              </p>
              <Button
                onClick={() => setStep("map")}
                variant="outline"
                className="w-full"
                disabled={!csvFile}
              >
                <Columns className="mr-2 h-4 w-4" />
                {csvFile ? "Map Columns" : "Upload CSV First"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (step === "map") {
    const status = getRequiredFieldsStatus();
    const categorizedFields = EMPLOYEE_FIELDS.reduce(
      (acc, field) => {
        if (!acc[field.category]) acc[field.category] = [];
        acc[field.category].push(field);
        return acc;
      },
      {} as Record<string, EmployeeField[]>,
    );

    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Map CSV Columns</h3>
              <p className="text-sm text-muted-foreground">
                Drag CSV columns from the left to the matching employee fields
                on the right
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={status.complete ? "default" : "secondary"}>
                {status.mapped}/{status.total} Required Fields
              </Badge>
              <Button variant="outline" size="sm" onClick={resetMappings}>
                <RotateCcw className="mr-2 h-3 w-3" />
                Reset
              </Button>
            </div>
          </div>

          {/* Auto-mapping notification */}
          {mappings.length > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Great! {mappings.length} columns were automatically mapped based
                on the template format.
                {status.complete
                  ? " All required fields are mapped - you can proceed directly."
                  : ` ${status.total - status.mapped} required fields still need mapping.`}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CSV Columns */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Your CSV Columns ({unmappedColumns.length} unmapped)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Droppable droppableId="unmapped">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2 min-h-[200px]"
                    >
                      {unmappedColumns.map((column, index) => (
                        <Draggable
                          key={column.id}
                          draggableId={column.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-3 border rounded-lg cursor-move transition-colors ${
                                snapshot.isDragging
                                  ? "bg-blue-50 border-blue-300"
                                  : "bg-white hover:bg-gray-50"
                              }`}
                            >
                              <div className="font-medium text-sm">
                                {column.name}
                              </div>
                              {column.sample && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Sample: {column.sample}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {unmappedColumns.length === 0 && (
                        <div className="text-center text-muted-foreground text-sm py-8">
                          All columns have been mapped
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </CardContent>
            </Card>

            {/* Employee Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Employee Fields
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(categorizedFields).map(([category, fields]) => (
                  <div key={category}>
                    <h4 className="font-medium text-sm mb-2 text-blue-600">
                      {category}
                    </h4>
                    <div className="space-y-2">
                      {fields.map((field) => {
                        const mappedColumn = getMappedColumn(field.id);
                        return (
                          <Droppable
                            key={field.id}
                            droppableId={`field-${field.id}`}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`p-3 border rounded-lg min-h-[60px] transition-colors ${
                                  snapshot.isDraggingOver
                                    ? "bg-green-50 border-green-300"
                                    : mappedColumn
                                      ? "bg-green-50 border-green-200"
                                      : field.required
                                        ? "bg-red-50 border-red-200"
                                        : "bg-gray-50 border-gray-200"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">
                                        {field.name}
                                      </span>
                                      {field.required && (
                                        <Badge
                                          variant="destructive"
                                          className="text-xs"
                                        >
                                          Required
                                        </Badge>
                                      )}
                                    </div>
                                    {mappedColumn ? (
                                      <div className="text-xs text-green-600 mt-1">
                                        Mapped to: {mappedColumn.name}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {field.required
                                          ? "Drag a CSV column here"
                                          : "Optional field"}
                                      </div>
                                    )}
                                  </div>
                                  {mappedColumn && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeMapping(field.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("upload")}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                onClick={handleComplete}
                disabled={!status.complete}
                className={
                  status.complete && mappings.length > 0
                    ? "bg-green-600 hover:bg-green-700"
                    : ""
                }
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Import {csvData.length} Employees
              </Button>
            </div>
          </div>

          {!status.complete && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please map all required fields to continue. Missing:{" "}
                {EMPLOYEE_FIELDS.filter(
                  (f) =>
                    f.required &&
                    !mappings.some((m) => m.employeeField === f.id),
                )
                  .map((f) => f.name)
                  .join(", ")}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DragDropContext>
    );
  }

  return null;
}
