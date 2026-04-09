/**
 * Wizard Step 2 — "Who are you paying?"
 * Simple employee list. Green check = included, tap to exclude.
 * Compliance issues show as amber badges — tap "Exclude flagged" or acknowledge.
 * Design: Big rows, big tap targets, one action per row.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertTriangle,
  CheckCircle,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";
import type { Employee } from "@/services/employeeService";
import { useI18n } from "@/i18n/I18nProvider";

interface ComplianceIssue {
  employee: Employee;
  issues: string[];
}

interface WizardStepEmployeesProps {
  employees: Employee[];
  complianceIssues: ComplianceIssue[];
  excludedEmployees: Set<string>;
  setExcludedEmployees: (v: Set<string>) => void;
  complianceAcknowledged: boolean;
  setComplianceAcknowledged: (v: boolean) => void;
  complianceOverrideReason: string;
  setComplianceOverrideReason: (v: string) => void;
}

const OVERRIDE_REASONS = [
  "Documents pending — expected this week",
  "Verbal confirmation from employee",
  "Government office delay — receipt obtained",
  "Manager approved exception",
  "Other",
];

export function WizardStepEmployees({
  employees,
  complianceIssues,
  excludedEmployees,
  setExcludedEmployees,
  complianceAcknowledged,
  setComplianceAcknowledged,
  complianceOverrideReason,
  setComplianceOverrideReason,
}: WizardStepEmployeesProps) {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState("");

  const issueMap = new Map(
    complianceIssues.map((ci) => [ci.employee.id, ci.issues])
  );

  const filteredEmployees = searchTerm
    ? employees.filter((emp) => {
        const term = searchTerm.toLowerCase();
        return (
          emp.personalInfo.firstName.toLowerCase().includes(term) ||
          emp.personalInfo.lastName.toLowerCase().includes(term) ||
          emp.jobDetails.department.toLowerCase().includes(term)
        );
      })
    : employees;

  const includedCount = employees.length - excludedEmployees.size;
  const hasUnresolvedIssues =
    complianceIssues.length > 0 &&
    complianceIssues.some((ci) => !excludedEmployees.has(ci.employee.id || ""));

  const handleToggle = (empId: string) => {
    const newExcluded = new Set(excludedEmployees);
    if (newExcluded.has(empId)) {
      newExcluded.delete(empId);
    } else {
      newExcluded.add(empId);
    }
    setExcludedEmployees(newExcluded);
  };

  const handleExcludeAllFlagged = () => {
    const newExcluded = new Set(excludedEmployees);
    complianceIssues.forEach((ci) => newExcluded.add(ci.employee.id || ""));
    setExcludedEmployees(newExcluded);
  };

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">{t("runPayroll.stepEmployeesTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("runPayroll.stepEmployeesDesc")}</p>
      </div>

      {/* Summary Bar — big numbers, obvious */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-5 text-sm">
          <span className="flex items-center gap-1.5">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            <span className="text-lg font-bold">{includedCount}</span>
            <span className="text-muted-foreground">{t("runPayroll.included")}</span>
          </span>
          {excludedEmployees.size > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <UserX className="h-4 w-4 text-red-500" />
              <span className="text-lg font-bold">{excludedEmployees.size}</span>
              {t("runPayroll.excluded")}
            </span>
          )}
          {complianceIssues.length > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-lg font-bold">{complianceIssues.length}</span>
              {t("runPayroll.withIssues")}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {complianceIssues.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExcludeAllFlagged}>
              <UserX className="h-3.5 w-3.5 mr-1.5" />
              {t("runPayroll.excludeFlagged")}
            </Button>
          )}
          {excludedEmployees.size > 0 && (
            <Button variant="outline" size="sm" onClick={() => setExcludedEmployees(new Set())}>
              <UserCheck className="h-3.5 w-3.5 mr-1.5" />
              {t("runPayroll.includeAll")}
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      {employees.length > 8 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("runPayroll.searchEmployees")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 border-border/50 h-11"
          />
        </div>
      )}

      {/* Employee List — big rows, easy tapping */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {filteredEmployees.map((emp) => {
          const empId = emp.id || "";
          const isExcluded = excludedEmployees.has(empId);
          const issues = issueMap.get(empId);
          const hasIssues = !!issues && issues.length > 0;

          return (
            <button
              key={empId}
              type="button"
              onClick={() => handleToggle(empId)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                isExcluded
                  ? "bg-red-50/30 border-red-200 dark:bg-red-950/10 dark:border-red-800/50 opacity-50"
                  : hasIssues
                    ? "bg-amber-50/30 border-amber-200 dark:bg-amber-950/10 dark:border-amber-700/50"
                    : "border-border/50 hover:border-green-300 hover:bg-green-50/20 dark:hover:bg-green-950/10"
              }`}
            >
              {/* Status Icon */}
              {isExcluded ? (
                <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <UserX className="h-4 w-4 text-red-500" />
                </div>
              ) : (
                <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
              )}

              {/* Name & Role */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {emp.jobDetails.department} &middot; {emp.jobDetails.position}
                </p>
              </div>

              {/* Issue Badge */}
              {hasIssues && !isExcluded && (
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs shrink-0"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {issues.length} {issues.length === 1 ? "issue" : "issues"}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Compliance Override — only if including employees with issues */}
      {hasUnresolvedIssues && (
        <div className="p-4 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/20 space-y-3">
          <div
            className="flex items-start gap-3 cursor-pointer"
            onClick={() => setComplianceAcknowledged(!complianceAcknowledged)}
          >
            <Checkbox
              checked={complianceAcknowledged}
              onCheckedChange={(checked) => setComplianceAcknowledged(!!checked)}
              className="mt-0.5 h-5 w-5 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
            />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {t("runPayroll.complianceAckText")}
            </span>
          </div>
          {complianceAcknowledged && (
            <div>
              <Label className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1.5 block">
                {t("runPayroll.overrideReasonLabel")}
              </Label>
              <Select
                value={complianceOverrideReason}
                onValueChange={setComplianceOverrideReason}
              >
                <SelectTrigger className="border-amber-300 dark:border-amber-700 h-11">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {OVERRIDE_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
