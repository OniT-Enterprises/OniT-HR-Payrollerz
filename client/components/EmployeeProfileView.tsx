import React, { useState, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { type Employee } from "@/services/employeeService";
import { formatDateTL } from "@/lib/dateUtils";
import { getComplianceIssues } from "@/lib/employeeUtils";
import { useAllEmployees } from "@/hooks/useEmployees";
import { useLeaveBalance } from "@/hooks/useLeaveRequests";

import {
  User,
  Mail,
  Phone,
  Smartphone,
  MapPin,
  Calendar,
  Briefcase,
  DollarSign,
  Building,
  FileText,
  Shield,
  CreditCard,
  Globe,
  Users,
  Pencil,
  ScanFace,
  AlertTriangle,
  Flag,
} from "lucide-react";

import { NATIONALITY_FLAGS } from "@/lib/constants";

const FaceRegistration = lazy(() => import("@/components/attendance/FaceRegistration"));

interface EmployeeProfileViewProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// --- Helper functions ---

function formatSalary(monthlySalary: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(monthlySalary);
}

function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "inactive":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "terminated":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

interface ExpiryStatus {
  status: string;
  message: string;
  variant: "destructive" | "secondary" | "default";
}

function getExpiryStatus(expiryDate: string): ExpiryStatus | null {
  if (!expiryDate) return null;

  const today = new Date();
  const expiry = new Date(expiryDate);
  const timeDiff = expiry.getTime() - today.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

  if (daysDiff < 0) {
    return { status: "expired", message: "Expired", variant: "destructive" };
  } else if (daysDiff <= 28) {
    return { status: "expiring", message: `Expires in ${daysDiff} days`, variant: "destructive" };
  } else if (daysDiff <= 60) {
    return { status: "warning", message: `Expires in ${daysDiff} days`, variant: "secondary" };
  }
  return { status: "valid", message: "Valid", variant: "default" };
}

// --- Sub-components ---

interface ComplianceWarningsProps {
  issues: ReturnType<typeof getComplianceIssues>;
  onOpenChange: (open: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
}

function ComplianceWarnings({ issues, onOpenChange, navigate }: ComplianceWarningsProps) {
  if (issues.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
          {issues.length} item{issues.length > 1 ? "s" : ""} need attention
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {issues.map((issue, idx) => (
          <button
            key={idx}
            onClick={() => { onOpenChange(false); navigate(issue.path); }}
            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
              issue.severity === "error"
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50"
            }`}
          >
            {issue.issue}
          </button>
        ))}
      </div>
    </div>
  );
}

function PersonalInfoCard({ employee }: { employee: Employee }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Personal Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">{employee.personalInfo.email}</p>
              <p className="text-xs text-muted-foreground">Email</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">{employee.personalInfo.phone || "Not provided"}</p>
              <p className="text-xs text-muted-foreground">Phone</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Smartphone className="h-4 w-4 text-purple-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">{employee.personalInfo.phoneApp || "Not provided"}</p>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                Phone App
                {employee.personalInfo.appEligible && (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                    Eligible
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">{employee.personalInfo.emergencyContactName || "Not provided"}</p>
              <p className="text-xs text-muted-foreground">Emergency Contact</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">{employee.personalInfo.emergencyContactPhone || "Not provided"}</p>
              <p className="text-xs text-muted-foreground">Emergency Phone</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface JobInfoCardProps {
  employee: Employee;
  managerName: string | null;
}

function JobInfoCard({ employee, managerName }: JobInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Job Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Building className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">{employee.jobDetails.department}</p>
            <p className="text-sm text-muted-foreground">Department</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">{employee.jobDetails.position}</p>
            <p className="text-sm text-muted-foreground">Position</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">{employee.jobDetails.hireDate}</p>
            <p className="text-sm text-muted-foreground">Hire Date</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">{employee.jobDetails.workLocation}</p>
            <p className="text-sm text-muted-foreground">Work Location</p>
          </div>
        </div>
        <Badge variant="outline">{employee.jobDetails.employmentType}</Badge>
        {employee.jobDetails.manager && (
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{managerName}</p>
              <p className="text-sm text-muted-foreground">Manager</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CompensationCardProps {
  employee: Employee;
  leaveBalance: ReturnType<typeof useLeaveBalance>["data"];
}

function CompensationCard({ employee, leaveBalance }: CompensationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Compensation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium text-lg">
              {formatSalary(
                employee.compensation.monthlySalary ||
                  Math.round((employee.compensation.annualSalary ?? 0) / 12) ||
                  0,
              )}
            </p>
            <p className="text-sm text-muted-foreground">Monthly Salary</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">{employee.compensation.annualLeaveDays} days</p>
            <p className="text-sm text-muted-foreground">Annual Leave</p>
            {leaveBalance?.annual && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  {leaveBalance.annual.remaining} remaining
                </span>
                <span className="text-xs text-muted-foreground">
                  {leaveBalance.annual.used} used
                </span>
                {leaveBalance.annual.pending > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {leaveBalance.annual.pending} pending
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">{employee.compensation.benefitsPackage}</p>
            <p className="text-sm text-muted-foreground">Benefits Package</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ExpiryBadgeProps {
  expiryDate: string | undefined;
}

function ExpiryBadge({ expiryDate }: ExpiryBadgeProps) {
  if (!expiryDate) return null;
  const status = getExpiryStatus(expiryDate);
  if (!status) return null;
  return (
    <div className="mt-1">
      <Badge variant={status.variant} className="text-xs">
        {status.message}
      </Badge>
    </div>
  );
}

interface DocumentFieldProps {
  icon: React.ReactNode;
  label: string;
  number: string | undefined;
  expiryDate: string | undefined;
  editFallback?: React.ReactNode;
}

function DocumentField({ icon, label, number, expiryDate, editFallback }: DocumentFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      {number ? (
        <div>
          <p className="text-sm">{number}</p>
          <ExpiryBadge expiryDate={expiryDate} />
        </div>
      ) : (
        editFallback || <p className="text-sm text-muted-foreground">Not provided</p>
      )}
    </div>
  );
}

interface EditLinkProps {
  label: string;
  onOpenChange: (open: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
  employeeId: string;
}

function EditLink({ label, onOpenChange, navigate, employeeId }: EditLinkProps) {
  return (
    <button
      onClick={() => { onOpenChange(false); navigate(`/people/add?edit=${employeeId}`); }}
      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
    >
      <Pencil className="h-3 w-3" />
      {label}
    </button>
  );
}

interface WorkContractSectionProps {
  employee: Employee;
  onOpenChange: (open: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
}

function WorkContractSection({ employee, onOpenChange, navigate }: WorkContractSectionProps) {
  const hasFile = employee.documents?.workContract?.fileUrl &&
    employee.documents?.workContract?.fileUrl.trim() !== "";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Work Contract</span>
      </div>
      {hasFile ? (
        <div>
          <Badge
            variant="default"
            className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          >
            ✓ Document uploaded
          </Badge>
          {employee.documents?.workContract?.uploadDate && (
            <p className="text-xs text-muted-foreground mt-1">
              Uploaded: {formatDateTL(employee.documents?.workContract?.uploadDate)}
            </p>
          )}
        </div>
      ) : (
        <EditLink label="Upload contract" onOpenChange={onOpenChange} navigate={navigate} employeeId={employee.id!} />
      )}
    </div>
  );
}

interface WorkingVisaSectionProps {
  employee: Employee;
  onOpenChange: (open: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
}

function WorkingVisaSection({ employee, onOpenChange, navigate }: WorkingVisaSectionProps) {
  if (employee.documents?.nationality === "Timor-Leste") return null;

  const visa = employee.documents?.workingVisaResidency;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Working Visa/Residency</span>
      </div>
      {visa?.number ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{visa.number}</p>
          <ExpiryBadge expiryDate={visa.expiryDate} />
          {visa.fileUrl && visa.fileUrl.trim() !== "" ? (
            <Badge
              variant="default"
              className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
            >
              ✓ Document uploaded
            </Badge>
          ) : (
            <EditLink label="Upload visa document" onOpenChange={onOpenChange} navigate={navigate} employeeId={employee.id!} />
          )}
        </div>
      ) : (
        <EditLink label="Add visa details" onOpenChange={onOpenChange} navigate={navigate} employeeId={employee.id!} />
      )}
    </div>
  );
}

interface DocumentsCardProps {
  employee: Employee;
  onOpenChange: (open: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
}

function DocumentsCard({ employee, onOpenChange, navigate }: DocumentsCardProps) {
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documents & Identification
            </CardTitle>
            <CardDescription>
              Employee identification documents with expiry tracking
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {employee.documents?.nationality ? (
              <>
                <span className="text-3xl leading-none">
                  {NATIONALITY_FLAGS[employee.documents.nationality] || ""}
                </span>
                <span className="text-sm font-medium">
                  {employee.documents.nationality}
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Flag className="h-4 w-4" />
                No nationality yet
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <DocumentField
            icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
            label="Social Security Number"
            number={employee.documents?.socialSecurityNumber?.number}
            expiryDate={employee.documents?.socialSecurityNumber?.expiryDate}
          />
          <DocumentField
            icon={<Globe className="h-4 w-4 text-muted-foreground" />}
            label="Electoral Card"
            number={employee.documents?.electoralCard?.number}
            expiryDate={employee.documents?.electoralCard?.expiryDate}
          />
          <DocumentField
            icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
            label="ID Card"
            number={employee.documents?.idCard?.number}
            expiryDate={employee.documents?.idCard?.expiryDate}
          />
          <DocumentField
            icon={<Globe className="h-4 w-4 text-muted-foreground" />}
            label="Passport"
            number={employee.documents?.passport?.number}
            expiryDate={employee.documents?.passport?.expiryDate}
            editFallback={
              <EditLink label="Add passport" onOpenChange={onOpenChange} navigate={navigate} employeeId={employee.id!} />
            }
          />
        </div>
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Employment Documents
          </h4>
          <div className="grid md:grid-cols-2 gap-4">
            <WorkContractSection employee={employee} onOpenChange={onOpenChange} navigate={navigate} />
            <WorkingVisaSection employee={employee} onOpenChange={onOpenChange} navigate={navigate} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Profile dialog header ---

interface ProfileHeaderProps {
  employee: Employee;
  onOpenChange: (open: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
  onEnrollFace: () => void;
}

function ProfileHeader({ employee, onOpenChange, navigate, onEnrollFace }: ProfileHeaderProps) {
  return (
    <DialogHeader>
      <DialogTitle className="flex items-center gap-3">
        <Avatar className="w-12 h-12">
          <AvatarImage
            src={employee.photoUrl || ""}
            alt={employee.personalInfo.firstName}
          />
          <AvatarFallback>
            {employee.personalInfo.firstName[0]}
            {employee.personalInfo.lastName[0]}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-2xl font-bold">
            {employee.personalInfo.firstName}{" "}
            {employee.personalInfo.lastName}
          </h2>
          <p className="text-muted-foreground">
            {employee.jobDetails.position} • ID:{" "}
            {employee.jobDetails.employeeId}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              navigate(`/people/add?edit=${employee.id}`);
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEnrollFace}
            className="text-cyan-600 border-cyan-200 hover:bg-cyan-50 dark:text-cyan-400 dark:border-cyan-800 dark:hover:bg-cyan-950"
          >
            <ScanFace className="h-4 w-4 mr-2" />
            Enroll Face
          </Button>
          <Badge className={getStatusColor(employee.status)}>
            {employee.status.charAt(0).toUpperCase() +
              employee.status.slice(1)}
          </Badge>
        </div>
      </DialogTitle>
    </DialogHeader>
  );
}

// --- Main component ---

export default function EmployeeProfileView({
  employee,
  open,
  onOpenChange,
}: EmployeeProfileViewProps) {
  const navigate = useNavigate();
  const [showFaceRegistration, setShowFaceRegistration] = useState(false);

  const { data: allEmployees = [] } = useAllEmployees();
  const managerName = useMemo(() => {
    if (!employee?.jobDetails?.manager) return null;
    const mgr = employee.jobDetails.manager;
    const found = allEmployees.find(
      (e) => e.jobDetails?.employeeId === mgr || e.id === mgr,
    );
    if (found) return `${found.personalInfo.firstName} ${found.personalInfo.lastName}`;
    return mgr;
  }, [employee, allEmployees]);

  const issues = useMemo(
    () => (employee ? getComplianceIssues([employee]) : []),
    [employee],
  );

  const { data: leaveBalance } = useLeaveBalance(employee?.id);

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <ProfileHeader
          employee={employee}
          onOpenChange={onOpenChange}
          navigate={navigate}
          onEnrollFace={() => setShowFaceRegistration(true)}
        />

        <ComplianceWarnings issues={issues} onOpenChange={onOpenChange} navigate={navigate} />

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <PersonalInfoCard employee={employee} />
          <JobInfoCard employee={employee} managerName={managerName} />
          <CompensationCard employee={employee} leaveBalance={leaveBalance} />
          <DocumentsCard employee={employee} onOpenChange={onOpenChange} navigate={navigate} />
        </div>
      </DialogContent>

      {showFaceRegistration && employee && (
        <Suspense fallback={null}>
          <FaceRegistration
            employee={employee}
            open={showFaceRegistration}
            onOpenChange={setShowFaceRegistration}
          />
        </Suspense>
      )}
    </Dialog>
  );
}
