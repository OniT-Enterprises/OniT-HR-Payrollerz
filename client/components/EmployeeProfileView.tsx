import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
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
import { settingsService } from "@/services/settingsService";
import { useTenantId } from "@/contexts/TenantContext";
import { CompanyDetails } from "@/types/settings";
import { formatDateTL } from "@/lib/dateUtils";

// Lazy load PDF generation to avoid loading react-pdf in main bundle
const downloadSefopeForm = async (
  employee: Employee,
  companyDetails: Partial<CompanyDetails>
) => {
  const { downloadSefopeForm: download } = await import(
    "@/components/documents/SefopePDF"
  );
  return download(employee, companyDetails);
};
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
  Download,
  Loader2,
  Pencil,
  ScanFace,
} from "lucide-react";

const FaceRegistration = lazy(() => import("@/components/attendance/FaceRegistration"));

interface EmployeeProfileViewProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EmployeeProfileView({
  employee,
  open,
  onOpenChange,
}: EmployeeProfileViewProps) {
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const [companyDetails, setCompanyDetails] = useState<Partial<CompanyDetails>>({});
  const [isGeneratingSefope, setIsGeneratingSefope] = useState(false);
  const [showFaceRegistration, setShowFaceRegistration] = useState(false);

  // Preload PDF module so download resolves instantly from cache
  const preloaded = useRef(false);
  useEffect(() => {
    if (preloaded.current) return;
    preloaded.current = true;
    import("@/components/documents/SefopePDF");
  }, []);

  // Fetch company details for SEFOPE form
  useEffect(() => {
    const fetchCompanyDetails = async () => {
      if (!tenantId || tenantId === "local-dev-tenant") {
        // Use default values for local dev
        setCompanyDetails({
          legalName: "Meza Demo Company",
          tinNumber: "000000000",
          registeredAddress: "Dili, Timor-Leste",
          city: "Dili",
          country: "Timor-Leste",
        });
        return;
      }
      try {
        const settings = await settingsService.getSettings(tenantId);
        if (settings?.companyDetails) {
          setCompanyDetails(settings.companyDetails);
        }
      } catch (error) {
        console.error("Failed to fetch company details:", error);
      }
    };
    fetchCompanyDetails();
  }, [tenantId]);

  const handleDownloadSefope = async () => {
    if (!employee) return;
    setIsGeneratingSefope(true);
    try {
      await downloadSefopeForm(employee, companyDetails);
    } catch (error) {
      console.error("Failed to generate SEFOPE form:", error);
    } finally {
      setIsGeneratingSefope(false);
    }
  };

  if (!employee) return null;

  const formatSalary = (monthlySalary: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(monthlySalary);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-yellow-100 text-yellow-800";
      case "terminated":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
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
                onClick={() => setShowFaceRegistration(true)}
                className="text-cyan-600 border-cyan-200 hover:bg-cyan-50 dark:text-cyan-400 dark:border-cyan-800 dark:hover:bg-cyan-950"
              >
                <ScanFace className="h-4 w-4 mr-2" />
                Enroll Face
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSefope}
                disabled={isGeneratingSefope}
                className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950"
              >
                {isGeneratingSefope ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                SEFOPE Form
              </Button>
              <Badge className={getStatusColor(employee.status)}>
                {employee.status.charAt(0).toUpperCase() +
                  employee.status.slice(1)}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Personal Contact Information */}
              <div className="space-y-3">
                {/* Email */}
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {employee.personalInfo.email}
                    </p>
                    <p className="text-xs text-muted-foreground">Email</p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {employee.personalInfo.phone || "Not provided"}
                    </p>
                    <p className="text-xs text-muted-foreground">Phone</p>
                  </div>
                </div>

                {/* Phone App */}
                <div className="flex items-center gap-3">
                  <Smartphone className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {employee.personalInfo.phoneApp ||
                        "Not provided"}
                    </p>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      Phone App
                      {employee.personalInfo.appEligible && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-green-50 text-green-700"
                        >
                          Eligible
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contact Information */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {employee.personalInfo.emergencyContactName ||
                        "Not provided"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Emergency Contact
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {employee.personalInfo.emergencyContactPhone ||
                        "Not provided"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Emergency Phone
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Job Information */}
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
                  <p className="font-medium">
                    {employee.jobDetails.department}
                  </p>
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
                  <p className="font-medium">
                    {employee.jobDetails.workLocation}
                  </p>
                  <p className="text-sm text-muted-foreground">Work Location</p>
                </div>
              </div>
              <Badge variant="outline">
                {employee.jobDetails.employmentType}
              </Badge>
              {employee.jobDetails.manager && (
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{employee.jobDetails.manager}</p>
                    <p className="text-sm text-muted-foreground">Manager</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Compensation */}
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
                        Math.round(
                          (employee.compensation.annualSalary ?? 0) / 12,
                        ) ||
                        0,
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Monthly Salary
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {employee.compensation.annualLeaveDays} days
                  </p>
                  <p className="text-sm text-muted-foreground">Annual Leave</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {employee.compensation.benefitsPackage}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Benefits Package
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents - Full Width */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents & Identification
              </CardTitle>
              <CardDescription>
                Employee identification documents with expiry tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Social Security Number */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Social Security Number</span>
                  </div>
                  {employee.documents?.socialSecurityNumber?.number ? (
                    <div>
                      <p className="text-sm">
                        {employee.documents?.socialSecurityNumber?.number}
                      </p>
                      {employee.documents?.socialSecurityNumber?.expiryDate && (
                        <div className="mt-1">
                          {(() => {
                            const status = getExpiryStatus(
                              employee.documents?.socialSecurityNumber
                                ?.expiryDate ?? "",
                            );
                            return status ? (
                              <Badge
                                variant={status.variant}
                                className="text-xs"
                              >
                                {status.message}
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Not provided
                    </p>
                  )}
                </div>

                {/* Electoral Card */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Electoral Card</span>
                  </div>
                  {employee.documents?.electoralCard?.number ? (
                    <div>
                      <p className="text-sm">
                        {employee.documents?.electoralCard?.number}
                      </p>
                      {employee.documents?.electoralCard?.expiryDate && (
                        <div className="mt-1">
                          {(() => {
                            const status = getExpiryStatus(
                              employee.documents?.electoralCard?.expiryDate ?? "",
                            );
                            return status ? (
                              <Badge
                                variant={status.variant}
                                className="text-xs"
                              >
                                {status.message}
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Not provided
                    </p>
                  )}
                </div>

                {/* ID Card */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">ID Card</span>
                  </div>
                  {employee.documents?.idCard?.number ? (
                    <div>
                      <p className="text-sm">
                        {employee.documents?.idCard?.number}
                      </p>
                      {employee.documents?.idCard?.expiryDate && (
                        <div className="mt-1">
                          {(() => {
                            const status = getExpiryStatus(
                              employee.documents?.idCard?.expiryDate ?? "",
                            );
                            return status ? (
                              <Badge
                                variant={status.variant}
                                className="text-xs"
                              >
                                {status.message}
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Not provided
                    </p>
                  )}
                </div>

                {/* Passport */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Passport</span>
                  </div>
                  {employee.documents?.passport?.number ? (
                    <div>
                      <p className="text-sm">
                        {employee.documents?.passport?.number}
                      </p>
                      {employee.documents?.passport?.expiryDate && (
                        <div className="mt-1">
                          {(() => {
                            const status = getExpiryStatus(
                              employee.documents?.passport?.expiryDate ?? "",
                            );
                            return status ? (
                              <Badge
                                variant={status.variant}
                                className="text-xs"
                              >
                                {status.message}
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        onOpenChange(false);
                        navigate(`/people/add?edit=${employee.id}`);
                      }}
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      <Pencil className="h-3 w-3" />
                      Add passport
                    </button>
                  )}
                </div>
              </div>

              {/* Additional Documents Section */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Employment Documents
                </h4>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Work Contract */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Work Contract</span>
                    </div>
                    {employee.documents?.workContract?.fileUrl &&
                    employee.documents?.workContract?.fileUrl.trim() !== "" ? (
                      <div>
                        <Badge
                          variant="default"
                          className="bg-green-100 text-green-800"
                        >
                          ✓ Document uploaded
                        </Badge>
                        {employee.documents?.workContract?.uploadDate && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Uploaded:{" "}
                            {formatDateTL(employee.documents?.workContract?.uploadDate)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          onOpenChange(false);
                          navigate(`/people/add?edit=${employee.id}`);
                        }}
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" />
                        Upload contract
                      </button>
                    )}
                  </div>

                  {/* Working Visa/Residency */}
                  {employee.documents?.nationality !== "Timor-Leste" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          Working Visa/Residency
                        </span>
                      </div>
                      {employee.documents?.workingVisaResidency?.number ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">
                            {employee.documents?.workingVisaResidency?.number}
                          </p>
                          {employee.documents?.workingVisaResidency
                            ?.expiryDate && (
                            <div>
                              {(() => {
                                const status = getExpiryStatus(
                                  employee.documents?.workingVisaResidency
                                    ?.expiryDate ?? "",
                                );
                                return status ? (
                                  <Badge
                                    variant={status.variant}
                                    className="text-xs"
                                  >
                                    {status.message}
                                  </Badge>
                                ) : null;
                              })()}
                            </div>
                          )}
                          {employee.documents?.workingVisaResidency?.fileUrl &&
                          employee.documents?.workingVisaResidency?.fileUrl.trim() !==
                            "" ? (
                            <Badge
                              variant="default"
                              className="bg-green-100 text-green-800"
                            >
                              ✓ Document uploaded
                            </Badge>
                          ) : (
                            <button
                              onClick={() => {
                                onOpenChange(false);
                                navigate(`/people/add?edit=${employee.id}`);
                              }}
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              <Pencil className="h-3 w-3" />
                              Upload visa document
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            onOpenChange(false);
                            navigate(`/people/add?edit=${employee.id}`);
                          }}
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          <Pencil className="h-3 w-3" />
                          Add visa details
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>

      {/* Face Registration Dialog (lazy loaded) */}
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
