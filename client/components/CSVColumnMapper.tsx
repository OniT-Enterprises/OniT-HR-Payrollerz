import React, { useState, useEffect, useCallback, useMemo } from "react";
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

export interface ColumnMapping {
  csvColumn: string;
  employeeField: string;
}

interface CSVColumnMapperProps {
  csvFile: File | null;
  onMappingComplete: (mappings: ColumnMapping[], csvData: Record<string, string>[]) => void;
  onCancel: () => void;
}

const EMPLOYEE_FIELDS: EmployeeField[] = [
  // Personal Information
  { id: "firstName", name: "First Name", category: "Personal Information", required: true, type: "text" },
  { id: "lastName", name: "Last Name", category: "Personal Information", required: true, type: "text" },
  { id: "email", name: "Email", category: "Personal Information", required: true, type: "email" },
  { id: "phone", name: "Phone", category: "Personal Information", required: false, type: "phone" },
  { id: "address", name: "Address", category: "Personal Information", required: false, type: "text" },
  { id: "dateOfBirth", name: "Date of Birth", category: "Personal Information", required: false, type: "date" },
  { id: "emergencyContactName", name: "Emergency Contact Name", category: "Personal Information", required: false, type: "text" },
  { id: "emergencyContactPhone", name: "Emergency Contact Phone", category: "Personal Information", required: false, type: "phone" },
  // Job Details
  { id: "employeeId", name: "Employee ID", category: "Job Details", required: false, type: "text" },
  {
    id: "department", name: "Department", category: "Job Details", required: true, type: "select",
    options: ["Engineering", "Human Resources", "Marketing", "Sales", "Finance", "Operations", "Customer Service", "Information Technology", "Legal", "Research & Development", "Quality Assurance", "Administration", "Procurement", "Facilities", "Training"],
  },
  { id: "position", name: "Job Title/Position", category: "Job Details", required: true, type: "text" },
  { id: "hireDate", name: "Hire Date", category: "Job Details", required: false, type: "date" },
  { id: "employmentType", name: "Employment Type", category: "Job Details", required: false, type: "select", options: ["Full-time", "Part-time", "Contract", "Temporary", "Intern"] },
  { id: "workLocation", name: "Work Location", category: "Job Details", required: false, type: "select", options: ["Office", "Remote", "Hybrid", "Field"] },
  { id: "manager", name: "Manager", category: "Job Details", required: false, type: "text" },
  // Compensation
  { id: "monthlySalary", name: "Monthly Salary", category: "Compensation", required: false, type: "number" },
  { id: "annualLeaveDays", name: "Annual Leave Days", category: "Compensation", required: false, type: "number" },
  { id: "benefitsPackage", name: "Benefits Package", category: "Compensation", required: false, type: "select", options: ["Basic", "Standard", "Premium", "Executive"] },
  // Documents
  { id: "employeeIdCard", name: "Employee ID Card Number", category: "Documents", required: false, type: "text" },
  { id: "employeeIdExpiryDate", name: "Employee ID Expiry Date", category: "Documents", required: false, type: "date" },
  { id: "nationality", name: "Nationality", category: "Documents", required: false, type: "text" },
  { id: "socialSecurityNumber", name: "Social Security Number", category: "Documents", required: false, type: "text" },
  { id: "ssnExpiryDate", name: "SSN Expiry Date", category: "Documents", required: false, type: "date" },
  { id: "electoralCardNumber", name: "Electoral Card Number", category: "Documents", required: false, type: "text" },
  { id: "electoralCardExpiryDate", name: "Electoral Card Expiry Date", category: "Documents", required: false, type: "date" },
  { id: "idCardNumber", name: "ID Card Number", category: "Documents", required: false, type: "text" },
  { id: "idCardExpiryDate", name: "ID Card Expiry Date", category: "Documents", required: false, type: "date" },
  { id: "passportNumber", name: "Passport Number", category: "Documents", required: false, type: "text" },
  { id: "passportExpiryDate", name: "Passport Expiry Date", category: "Documents", required: false, type: "date" },
];

// --- Helper functions ---

function autoMapColumns(columns: CSVColumn[]): ColumnMapping[] {
  const result: ColumnMapping[] = [];
  columns.forEach((csvColumn) => {
    const matchingField = EMPLOYEE_FIELDS.find(
      (field) => field.id.toLowerCase() === csvColumn.name.toLowerCase(),
    );
    if (matchingField) {
      result.push({ csvColumn: csvColumn.name, employeeField: matchingField.id });
    }
  });
  return result;
}

function getRequiredFieldsStatus(mappings: ColumnMapping[]) {
  const requiredFields = EMPLOYEE_FIELDS.filter((field) => field.required);
  const mappedRequiredFields = requiredFields.filter((field) =>
    mappings.some((mapping) => mapping.employeeField === field.id),
  );
  return {
    total: requiredFields.length,
    mapped: mappedRequiredFields.length,
    complete: mappedRequiredFields.length === requiredFields.length,
  };
}

function getMissingRequiredFieldNames(mappings: ColumnMapping[]): string {
  return EMPLOYEE_FIELDS
    .filter((f) => f.required && !mappings.some((m) => m.employeeField === f.id))
    .map((f) => f.name)
    .join(", ");
}

function downloadTemplate() {
  const headers = EMPLOYEE_FIELDS.map((field) => field.name);
  const sampleData = [
    "John", "Doe", "john.doe@company.com", "+1 (555) 123-4567",
    "123 Main St, City, State 12345", "1985-06-15", "Jane Doe",
    "+1 (555) 123-4568", "EMP001", "Engineering", "Software Engineer",
    "2023-01-15", "Full-time", "Remote", "Sarah Johnson", "85000", "25",
    "Standard", "***-**-1234", "2030-12-31", "EC123456", "2029-06-15",
    "ID987654", "2028-03-20", "P123456789", "2030-01-15",
  ];

  const csvContent = [headers, sampleData]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "meza_employee_template.csv";
  link.click();
  window.URL.revokeObjectURL(url);
}

function categorizeFields(): Record<string, EmployeeField[]> {
  return EMPLOYEE_FIELDS.reduce(
    (acc, field) => {
      if (!acc[field.category]) acc[field.category] = [];
      acc[field.category].push(field);
      return acc;
    },
    {} as Record<string, EmployeeField[]>,
  );
}

// --- Sub-components ---

interface UploadStepProps {
  csvFile: File | null;
  onCancel: () => void;
  onMapColumns: () => void;
}

function UploadStep({ csvFile, onCancel, onMapColumns }: UploadStepProps) {
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
            <CardTitle className="text-sm">Option 1: Download Template</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Download our standard template with all fields properly formatted
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
              onClick={onMapColumns}
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

interface UnmappedColumnsListProps {
  unmappedColumns: CSVColumn[];
}

function UnmappedColumnsList({ unmappedColumns }: UnmappedColumnsListProps) {
  return (
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
                <Draggable key={column.id} draggableId={column.id} index={index}>
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
                      <div className="font-medium text-sm">{column.name}</div>
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
  );
}

interface FieldDropTargetProps {
  field: EmployeeField;
  mappedColumn: CSVColumn | null;
  onRemoveMapping: (fieldId: string) => void;
}

function FieldDropTarget({ field, mappedColumn, onRemoveMapping }: FieldDropTargetProps) {
  return (
    <Droppable key={field.id} droppableId={`field-${field.id}`}>
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
                <span className="font-medium text-sm">{field.name}</span>
                {field.required && (
                  <Badge variant="destructive" className="text-xs">Required</Badge>
                )}
              </div>
              {mappedColumn ? (
                <div className="text-xs text-green-600 mt-1">
                  Mapped to: {mappedColumn.name}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground mt-1">
                  {field.required ? "Drag a CSV column here" : "Optional field"}
                </div>
              )}
            </div>
            {mappedColumn && (
              <Button variant="ghost" size="sm" onClick={() => onRemoveMapping(field.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}

interface EmployeeFieldsListProps {
  csvColumns: CSVColumn[];
  mappings: ColumnMapping[];
  onRemoveMapping: (fieldId: string) => void;
}

function EmployeeFieldsList({ csvColumns, mappings, onRemoveMapping }: EmployeeFieldsListProps) {
  const categorizedFields = categorizeFields();

  const getMappedColumn = (fieldId: string): CSVColumn | null => {
    const mapping = mappings.find((m) => m.employeeField === fieldId);
    return mapping ? csvColumns.find((col) => col.name === mapping.csvColumn) || null : null;
  };

  return (
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
            <h4 className="font-medium text-sm mb-2 text-blue-600">{category}</h4>
            <div className="space-y-2">
              {fields.map((field) => (
                <FieldDropTarget
                  key={field.id}
                  field={field}
                  mappedColumn={getMappedColumn(field.id)}
                  onRemoveMapping={onRemoveMapping}
                />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface MappingStepProps {
  csvColumns: CSVColumn[];
  csvData: Record<string, string>[];
  mappings: ColumnMapping[];
  unmappedColumns: CSVColumn[];
  onDragEnd: (result: DropResult) => void;
  onRemoveMapping: (fieldId: string) => void;
  onResetMappings: () => void;
  onBack: () => void;
  onCancel: () => void;
  onComplete: () => void;
}

function MappingStep({
  csvColumns,
  csvData,
  mappings,
  unmappedColumns,
  onDragEnd,
  onRemoveMapping,
  onResetMappings,
  onBack,
  onCancel,
  onComplete,
}: MappingStepProps) {
  const status = getRequiredFieldsStatus(mappings);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Map CSV Columns</h3>
            <p className="text-sm text-muted-foreground">
              Drag CSV columns from the left to the matching employee fields on the right
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status.complete ? "default" : "secondary"}>
              {status.mapped}/{status.total} Required Fields
            </Badge>
            <Button variant="outline" size="sm" onClick={onResetMappings}>
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
              Great! {mappings.length} columns were automatically mapped based on the template format.
              {status.complete
                ? " All required fields are mapped - you can proceed directly."
                : ` ${status.total - status.mapped} required fields still need mapping.`}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UnmappedColumnsList unmappedColumns={unmappedColumns} />
          <EmployeeFieldsList
            csvColumns={csvColumns}
            mappings={mappings}
            onRemoveMapping={onRemoveMapping}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={onComplete}
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
              {getMissingRequiredFieldNames(mappings)}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </DragDropContext>
  );
}

// --- CSV parsing helper ---

async function parseCSVFile(file: File): Promise<{
  columns: CSVColumn[];
  data: Record<string, string>[];
  autoMappings: ColumnMapping[];
  unmapped: CSVColumn[];
}> {
  const text = await file.text();
  const { default: PapaParse } = await import("papaparse");
  const result = PapaParse.parse<Record<string, string>>(text, {
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
    throw new Error("CSV file must have at least a header row and one data row");
  }

  const columns: CSVColumn[] = headers.map((header, index) => ({
    id: `csv-col-${index}`,
    name: header,
    sample: data[0]?.[header] || "",
  }));

  const autoMappings = autoMapColumns(columns);
  const mappedColumnNames = autoMappings.map((m) => m.csvColumn);
  const unmapped = columns.filter((col) => !mappedColumnNames.includes(col.name));

  return { columns, data, autoMappings, unmapped };
}

// --- Drag-drop handler ---

function handleColumnDragEnd(
  result: DropResult,
  csvColumns: CSVColumn[],
  setUnmappedColumns: React.Dispatch<React.SetStateAction<CSVColumn[]>>,
  setMappings: React.Dispatch<React.SetStateAction<ColumnMapping[]>>,
) {
  const { source, destination } = result;
  if (!destination) return;

  if (source.droppableId === "unmapped" && destination.droppableId.startsWith("field-")) {
    const fieldId = destination.droppableId.replace("field-", "");
    const column = csvColumns.find((col) => col.id === result.draggableId);

    if (column) {
      setUnmappedColumns((prev) => prev.filter((col) => col.id !== result.draggableId));
      setMappings((prev) => {
        const filtered = prev.filter((m) => m.employeeField !== fieldId);
        return [...filtered, { csvColumn: column.name, employeeField: fieldId }];
      });
    }
  }
}

// --- Helpers for CSV state management ---

interface CSVStateSetters {
  setCsvColumns: (v: CSVColumn[]) => void;
  setCsvData: (v: Record<string, string>[]) => void;
  setMappings: (v: ColumnMapping[]) => void;
  setUnmappedColumns: (v: CSVColumn[]) => void;
  setStep: (v: "upload" | "map" | "preview") => void;
}

function resetCSVState(s: CSVStateSetters) {
  s.setCsvColumns([]);
  s.setCsvData([]);
  s.setMappings([]);
  s.setUnmappedColumns([]);
  s.setStep("upload");
}

function applyParsedCSV(s: CSVStateSetters, result: { columns: CSVColumn[]; data: Record<string, string>[]; autoMappings: ColumnMapping[]; unmapped: CSVColumn[] }) {
  s.setCsvColumns(result.columns);
  s.setCsvData(result.data);
  s.setMappings(result.autoMappings);
  s.setUnmappedColumns(result.unmapped);
  s.setStep("map");
}

// --- Custom hook for CSV parsing and mapping state ---

function useCSVMapper(csvFile: File | null) {
  const [csvColumns, setCsvColumns] = useState<CSVColumn[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [unmappedColumns, setUnmappedColumns] = useState<CSVColumn[]>([]);
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");

  const setters: CSVStateSetters = useMemo(() => ({ setCsvColumns, setCsvData, setMappings, setUnmappedColumns, setStep }), []);

  useEffect(() => {
    if (!csvFile) { resetCSVState(setters); return; }

    let cancelled = false;

    void parseCSVFile(csvFile)
      .then((result) => {
        if (cancelled) return;
        applyParsedCSV(setters, result);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Error parsing CSV:", error);
        alert("Error parsing CSV file. Please check the file format.");
      });

    return () => { cancelled = true; };
  }, [csvFile, setters]);

  const handleDragEnd = useCallback((result: DropResult) => {
    handleColumnDragEnd(result, csvColumns, setUnmappedColumns, setMappings);
  }, [csvColumns]);

  const removeMapping = useCallback((fieldId: string) => {
    const mapping = mappings.find((m) => m.employeeField === fieldId);
    if (mapping) {
      const column = csvColumns.find((col) => col.name === mapping.csvColumn);
      if (column) setUnmappedColumns((prev) => [...prev, column]);
      setMappings((prev) => prev.filter((m) => m.employeeField !== fieldId));
    }
  }, [mappings, csvColumns]);

  const resetMappings = useCallback(() => {
    setMappings([]);
    setUnmappedColumns([...csvColumns]);
  }, [csvColumns]);

  return {
    csvColumns, csvData, mappings, unmappedColumns, step, setStep,
    handleDragEnd, removeMapping, resetMappings,
  };
}

// --- Main component ---

export default function CSVColumnMapper({
  csvFile,
  onMappingComplete,
  onCancel,
}: CSVColumnMapperProps) {
  const {
    csvColumns, csvData, mappings, unmappedColumns, step, setStep,
    handleDragEnd, removeMapping, resetMappings,
  } = useCSVMapper(csvFile);

  const handleComplete = useCallback(() => {
    const status = getRequiredFieldsStatus(mappings);
    if (!status.complete) {
      alert(`Please map all required fields. ${status.mapped}/${status.total} required fields mapped.`);
      return;
    }
    onMappingComplete(mappings, csvData);
  }, [mappings, csvData, onMappingComplete]);

  if (step === "upload") {
    return (
      <UploadStep
        csvFile={csvFile}
        onCancel={onCancel}
        onMapColumns={() => setStep("map")}
      />
    );
  }

  if (step === "map") {
    return (
      <MappingStep
        csvColumns={csvColumns}
        csvData={csvData}
        mappings={mappings}
        unmappedColumns={unmappedColumns}
        onDragEnd={handleDragEnd}
        onRemoveMapping={removeMapping}
        onResetMappings={resetMappings}
        onBack={() => setStep("upload")}
        onCancel={onCancel}
        onComplete={handleComplete}
      />
    );
  }

  return null;
}
