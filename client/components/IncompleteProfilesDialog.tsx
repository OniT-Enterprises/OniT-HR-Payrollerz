import React from "react";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { type Employee } from "@/services/employeeService";
import {
  getProfileCompleteness,
  getCompletionStatusColor,
} from "@/lib/employeeUtils";
import {
  AlertTriangle,
  Building,
  Mail,
  Phone,
  Edit,
  FileText,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface IncompleteProfilesDialogProps {
  employees: Employee[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditEmployee?: (employee: Employee) => void;
}

export default function IncompleteProfilesDialog({
  employees,
  open,
  onOpenChange,
  onEditEmployee,
}: IncompleteProfilesDialogProps) {
  const incompleteEmployees = employees
    .map((employee) => ({
      employee,
      completeness: getProfileCompleteness(employee),
    }))
    .filter(({ completeness }) => !completeness.isComplete)
    .sort(
      (a, b) =>
        a.completeness.completionPercentage -
        b.completeness.completionPercentage,
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Incomplete Employee Profiles
          </DialogTitle>
          <DialogDescription>
            {incompleteEmployees.length} employee
            {incompleteEmployees.length !== 1 ? "s" : ""} with incomplete
            profiles. Complete these profiles to ensure proper employee
            management.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          {incompleteEmployees.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold mb-2">
                All Profiles Complete!
              </h3>
              <p className="text-muted-foreground">
                All employee profiles have been completed successfully.
              </p>
            </div>
          ) : (
            incompleteEmployees.map(({ employee, completeness }) => (
              <Card
                key={employee.id}
                className="border-l-4 border-l-orange-500"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage
                          src=""
                          alt={employee.personalInfo.firstName}
                        />
                        <AvatarFallback>
                          {employee.personalInfo.firstName[0]}
                          {employee.personalInfo.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">
                          {employee.personalInfo.firstName}{" "}
                          {employee.personalInfo.lastName}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Building className="h-3 w-3" />
                          {employee.jobDetails.department} •{" "}
                          {employee.jobDetails.position}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p
                          className={`text-2xl font-bold ${getCompletionStatusColor(
                            completeness.completionPercentage,
                          )}`}
                        >
                          {completeness.completionPercentage}%
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Complete
                        </p>
                      </div>
                      {onEditEmployee && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditEmployee(employee)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <Progress
                      value={completeness.completionPercentage}
                      className="h-2"
                    />
                  </div>

                  {/* Missing Fields */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        Missing Information ({completeness.missingFields.length}
                        )
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {completeness.missingFields.map((field) => (
                          <Badge
                            key={field}
                            variant="destructive"
                            className="text-xs"
                          >
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Document Status */}
                    <div>
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Document Status
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {completeness.requiredDocuments.map((doc) => (
                          <div
                            key={doc.field}
                            className={`p-2 rounded text-xs ${
                              doc.missing && doc.required
                                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                : doc.required
                                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              {doc.missing && doc.required ? (
                                <XCircle className="h-3 w-3" />
                              ) : doc.required ? (
                                <CheckCircle className="h-3 w-3" />
                              ) : (
                                <div className="h-3 w-3 rounded-full bg-muted-foreground/50" />
                              )}
                              <span className="truncate">{doc.field}</span>
                            </div>
                            <div className="mt-1 text-xs opacity-75">
                              {doc.required ? "Required" : "Optional"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quick Contact */}
                    <div className="flex items-center gap-4 pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {employee.personalInfo.email || "No email"}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {employee.personalInfo.phone || "No phone"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {incompleteEmployees.length > 0 && (
          <div className="mt-6 p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-foreground">
                  Complete Profiles for Better Management
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Incomplete profiles may affect payroll processing, compliance
                  reporting, and employee management. Please ensure all required
                  information is collected.
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
