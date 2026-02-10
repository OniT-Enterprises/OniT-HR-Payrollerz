/**
 * QuickBooks Export Dialog
 * Allows users to export payroll journal entries to QuickBooks format
 */

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { useTenantId } from '@/contexts/TenantContext';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Settings,
  Check,
  Loader2,
} from 'lucide-react';
import type { PayrollRun, PayrollRecord } from '@/types/payroll';
import type { TLPayrollRun, TLPayrollRecord } from '@/types/payroll-tl';
import type { QBExportOptions } from '@/types/quickbooks';
import {
  buildJournalEntry,
  exportPayrollToQuickBooks,
  downloadFile,
  getDefaultMappings,
} from '@/services/quickbooksExportService';

interface QuickBooksExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payrollRun: PayrollRun | TLPayrollRun;
  records: (PayrollRecord | TLPayrollRecord)[];
  currentUser?: string;
}

export function QuickBooksExportDialog({
  open,
  onOpenChange,
  payrollRun,
  records,
  currentUser = 'Unknown',
}: QuickBooksExportDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const tenantId = useTenantId();

  const [format, setFormat] = useState<'csv' | 'iif'>('csv');
  const [includeEmployeeDetail, setIncludeEmployeeDetail] = useState(false);
  const [groupByDepartment, setGroupByDepartment] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Build preview journal entry
  const previewEntry = useMemo(() => {
    const mappings = getDefaultMappings();
    const options: QBExportOptions = {
      format,
      includeEmployeeDetail,
      groupByDepartment,
      useCustomMappings: false,
    };
    return buildJournalEntry(payrollRun, records, mappings, options);
  }, [payrollRun, records, format, includeEmployeeDetail, groupByDepartment]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Handle export
  const handleExport = async () => {
    setExporting(true);
    try {
      const options: QBExportOptions = {
        format,
        includeEmployeeDetail,
        groupByDepartment,
        useCustomMappings: false,
      };

      const result = await exportPayrollToQuickBooks(
        tenantId,
        payrollRun,
        records,
        options,
        currentUser
      );

      // Trigger download
      downloadFile(result.content, result.fileName, result.mimeType);

      toast({
        title: t('payroll.quickbooks.export.success'),
        description: t('payroll.quickbooks.export.successDesc', { fileName: result.fileName }),
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: t('payroll.quickbooks.export.error'),
        description: t('payroll.quickbooks.export.errorDesc'),
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            {t('payroll.quickbooks.export.title')}
          </DialogTitle>
          <DialogDescription>
            {t('payroll.quickbooks.export.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Payroll Summary */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">{t('payroll.quickbooks.export.payroll')}</span>
            <span className="font-medium">{previewEntry.memo.split(' - ')[0]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">{t('payroll.quickbooks.export.payDate')}</span>
            <span className="font-medium">{formatDate(payrollRun.payDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">{t('payroll.quickbooks.export.employees')}</span>
            <span className="font-medium">{records.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">{t('payroll.quickbooks.export.total')}</span>
            <span className="font-semibold text-lg">{formatCurrency(payrollRun.totalGrossPay)}</span>
          </div>
        </div>

        <Separator />

        {/* Export Format */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t('payroll.quickbooks.export.format')}</Label>
          <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'csv' | 'iif')}>
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="csv" id="csv" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  CSV (QuickBooks Online)
                  <Badge variant="secondary" className="text-xs">Recommended</Badge>
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('payroll.quickbooks.export.csvDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="iif" id="iif" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="iif" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-blue-600" />
                  IIF (QuickBooks Desktop)
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('payroll.quickbooks.export.iifDesc')}
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t('payroll.quickbooks.export.options')}</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="employeeDetail"
                checked={includeEmployeeDetail}
                onCheckedChange={(checked) => setIncludeEmployeeDetail(checked === true)}
              />
              <Label htmlFor="employeeDetail" className="text-sm cursor-pointer">
                {t('payroll.quickbooks.export.includeEmployeeDetail')}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="groupByDept"
                checked={groupByDepartment}
                onCheckedChange={(checked) => setGroupByDepartment(checked === true)}
              />
              <Label htmlFor="groupByDept" className="text-sm cursor-pointer">
                {t('payroll.quickbooks.export.groupByDepartment')}
              </Label>
            </div>
          </div>
        </div>

        <Separator />

        {/* Journal Entry Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{t('payroll.quickbooks.export.preview')}</Label>
            <Button variant="ghost" size="sm" className="text-xs h-7">
              <Settings className="h-3 w-3 mr-1" />
              {t('payroll.quickbooks.export.configureMappings')}
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40%]">{t('payroll.quickbooks.export.account')}</TableHead>
                  <TableHead className="text-right">{t('payroll.quickbooks.export.debit')}</TableHead>
                  <TableHead className="text-right">{t('payroll.quickbooks.export.credit')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewEntry.lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium text-sm">{line.accountName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.debit > 0 ? formatCurrency(line.debit) : ''}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.credit > 0 ? formatCurrency(line.credit) : ''}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell>{t('payroll.quickbooks.export.totals')}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(previewEntry.totalDebits)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(previewEntry.totalCredits)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Balance check */}
          {Math.abs(previewEntry.totalDebits - previewEntry.totalCredits) < 0.01 ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="h-4 w-4" />
              {t('payroll.quickbooks.export.balanced')}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-red-600">
              {t('payroll.quickbooks.export.unbalanced')}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('payroll.quickbooks.export.exporting')}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t('payroll.quickbooks.export.download')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuickBooksExportDialog;
