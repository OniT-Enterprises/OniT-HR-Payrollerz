/**
 * PayrollComplianceCard — Compliance issues, exclude checkboxes, override reason
 * Extracted from RunPayroll.tsx
 */
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import type { Employee } from '@/services/employeeService';
import { useI18n } from '@/i18n/I18nProvider';

interface ComplianceIssue {
  employee: Employee;
  issues: string[];
}

interface PayrollComplianceCardProps {
  complianceIssues: ComplianceIssue[];
  excludedEmployees: Set<string>;
  setExcludedEmployees: (v: Set<string>) => void;
  complianceAcknowledged: boolean;
  setComplianceAcknowledged: (v: boolean) => void;
  complianceOverrideReason: string;
  setComplianceOverrideReason: (v: string) => void;
  showAllCompliance: boolean;
  setShowAllCompliance: (v: boolean) => void;
  totalEmployees: number;
}

export function PayrollComplianceCard({
  complianceIssues,
  excludedEmployees,
  setExcludedEmployees,
  complianceAcknowledged,
  setComplianceAcknowledged,
  complianceOverrideReason,
  setComplianceOverrideReason,
  showAllCompliance,
  setShowAllCompliance,
  totalEmployees,
}: PayrollComplianceCardProps) {
  const { t } = useI18n();

  if (complianceIssues.length === 0) return null;

  return (
    <Card className="mb-6 border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10 animate-fade-up">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <div className="p-1.5 rounded-lg bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          {t('runPayroll.employeesNeedDocs', { count: String(complianceIssues.length) })}
        </CardTitle>
        <CardDescription className="text-amber-700 dark:text-amber-400">
          {t('runPayroll.needDocsDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Issue List */}
        <div className="space-y-2">
          {complianceIssues.slice(0, showAllCompliance ? undefined : 5).map(({ employee, issues }) => (
            <div
              key={employee.id}
              className="flex items-center justify-between p-2 rounded-lg bg-background border border-amber-200 dark:border-amber-800"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={excludedEmployees.has(employee.id || '')}
                  onCheckedChange={(checked) => {
                    const newExcluded = new Set(excludedEmployees);
                    if (checked) {
                      newExcluded.add(employee.id || '');
                    } else {
                      newExcluded.delete(employee.id || '');
                    }
                    setExcludedEmployees(newExcluded);
                  }}
                  className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                />
                <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    {employee.personalInfo.firstName[0]}{employee.personalInfo.lastName[0]}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {employee.personalInfo.firstName} {employee.personalInfo.lastName}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {issues.join(', ')}
                  </p>
                </div>
              </div>
              <Badge className={
                excludedEmployees.has(employee.id || '')
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-xs'
                  : 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 text-xs'
              }>
                {excludedEmployees.has(employee.id || '') ? t('runPayroll.excluded') : t('runPayroll.included')}
              </Badge>
            </div>
          ))}
          {complianceIssues.length > 5 && !showAllCompliance && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllCompliance(true)}
              className="w-full text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-100/50 dark:text-amber-400 dark:hover:text-amber-200 dark:hover:bg-amber-900/20 h-8"
            >
              {t('runPayroll.showMore', { count: String(complianceIssues.length - 5) })}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          )}
          {showAllCompliance && complianceIssues.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllCompliance(false)}
              className="w-full text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-100/50 dark:text-amber-400 dark:hover:text-amber-200 dark:hover:bg-amber-900/20 h-8"
            >
              {t('runPayroll.showLess')}
              <ChevronDown className="h-3 w-3 ml-1 rotate-180" />
            </Button>
          )}
        </div>

        {/* Override Acknowledgment */}
        {excludedEmployees.size < complianceIssues.length && (
          <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-100/50 dark:bg-amber-900/20">
            <div className="flex items-start gap-3 cursor-pointer" onClick={() => setComplianceAcknowledged(!complianceAcknowledged)}>
              <Checkbox
                checked={complianceAcknowledged}
                onCheckedChange={(checked) => setComplianceAcknowledged(!!checked)}
                className="mt-0.5 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
              />
              <span className="text-sm text-amber-800 dark:text-amber-200">
                {t('runPayroll.complianceAckText')}
              </span>
            </div>
            {complianceAcknowledged && (
              <div className="mt-3">
                <Label className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  {t('runPayroll.overrideReasonLabel')}
                </Label>
                <Input
                  value={complianceOverrideReason}
                  onChange={(e) => setComplianceOverrideReason(e.target.value)}
                  placeholder={t('runPayroll.overrideReasonPlaceholder')}
                  className="mt-1 text-sm border-amber-300 border-border/50"
                />
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="flex items-center justify-between text-sm pt-2 border-t border-amber-200 dark:border-amber-800">
          <span className="text-amber-700 dark:text-amber-400">
            {t('runPayroll.employeesIncluded', { included: String(totalEmployees - excludedEmployees.size), total: String(totalEmployees) })}
          </span>
          {excludedEmployees.size > 0 && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setExcludedEmployees(new Set())}
              className="text-amber-600 hover:text-amber-800 dark:hover:text-amber-200 h-auto p-0"
            >
              {t('runPayroll.includeAll')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
