/**
 * QuickBooks Export Settings Component
 * Allows users to configure account mappings for QuickBooks integration
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import {
  FileSpreadsheet,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { QBAccountMapping, QBExportSettings } from '@/types/quickbooks';
import {
  DEFAULT_TL_ACCOUNT_MAPPINGS,
} from '@/types/quickbooks';
import {
  getExportSettingsForTenant,
  saveExportSettingsForTenant,
} from '@/services/quickbooksExportService';

interface QuickBooksSettingsProps {
  tenantId: string;
}

export function QuickBooksSettings({ tenantId }: QuickBooksSettingsProps) {
  const { t } = useI18n();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<QBExportSettings>({
    defaultFormat: 'csv',
    includeEmployeeDetail: false,
    groupByDepartment: false,
    accountMappings: [...DEFAULT_TL_ACCOUNT_MAPPINGS],
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const existingSettings = await getExportSettingsForTenant(tenantId);
      if (existingSettings) {
        setSettings(existingSettings);
      }
    } catch (error) {
      console.error('Error loading QuickBooks settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveExportSettingsForTenant(tenantId, settings);
      toast({
        title: t('payroll.quickbooks.settings.savedTitle') || 'Settings Saved',
        description: t('payroll.quickbooks.settings.savedDesc') || 'QuickBooks export settings have been updated.',
      });
    } catch (error) {
      console.error('Error saving QuickBooks settings:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('payroll.quickbooks.settings.saveFailed') || 'Failed to save settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setSettings({
      ...settings,
      accountMappings: [...DEFAULT_TL_ACCOUNT_MAPPINGS],
    });
    toast({
      title: t('payroll.quickbooks.settings.resetTitle') || 'Reset Complete',
      description: t('payroll.quickbooks.settings.resetDesc') || 'Account mappings reset to defaults.',
    });
  };

  const updateMapping = (index: number, field: keyof QBAccountMapping, value: string) => {
    const updated = [...settings.accountMappings];
    updated[index] = {
      ...updated[index],
      [field]: value,
      isDefault: false,
    };
    setSettings({ ...settings, accountMappings: updated });
  };

  // Group mappings by type
  const expenseMappings = settings.accountMappings.filter(m => m.accountType === 'expense');
  const liabilityMappings = settings.accountMappings.filter(m => m.accountType === 'liability');
  const assetMappings = settings.accountMappings.filter(m => m.accountType === 'asset');

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <CardTitle>{t('payroll.quickbooks.settings.title')}</CardTitle>
            <CardDescription>
              {t('payroll.quickbooks.settings.description')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status indicator */}
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm">
            QuickBooks export is configured with {settings.accountMappings.length} account mappings
          </span>
        </div>

        {/* Default Format */}
        <div className="space-y-3">
          <Label>{t('payroll.quickbooks.settings.defaultFormat')}</Label>
          <Select
            value={settings.defaultFormat}
            onValueChange={(value: 'csv' | 'iif') =>
              setSettings({ ...settings, defaultFormat: value })
            }
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  CSV (QuickBooks Online)
                </div>
              </SelectItem>
              <SelectItem value="iif">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  IIF (QuickBooks Desktop)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Account Mappings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">{t('payroll.quickbooks.settings.accountMappings')}</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {t('payroll.quickbooks.settings.accountMappingsDesc')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleResetDefaults}>
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('payroll.quickbooks.settings.resetDefaults')}
            </Button>
          </div>

          <Accordion type="multiple" defaultValue={['expenses', 'liabilities']} className="w-full">
            {/* Expense Accounts */}
            <AccordionItem value="expenses">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    {t('payroll.quickbooks.settings.expenses')}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    ({expenseMappings.length} accounts)
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%]">{t('payroll.quickbooks.settings.onitAccount')}</TableHead>
                      <TableHead className="w-[50%]">{t('payroll.quickbooks.settings.qbAccount')}</TableHead>
                      <TableHead className="w-[15%]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseMappings.map((mapping, _idx) => {
                      const globalIndex = settings.accountMappings.findIndex(
                        m => m.onitAccountCode === mapping.onitAccountCode
                      );
                      return (
                        <TableRow key={mapping.onitAccountCode}>
                          <TableCell className="font-medium">
                            <div>
                              <span className="text-muted-foreground text-xs">{mapping.onitAccountCode}</span>
                              <br />
                              {mapping.onitAccountName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={mapping.qbAccountName}
                              onChange={(e) => updateMapping(globalIndex, 'qbAccountName', e.target.value)}
                              placeholder="Enter QuickBooks account name"
                            />
                          </TableCell>
                          <TableCell>
                            {mapping.isDefault ? (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Custom</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>

            {/* Liability Accounts */}
            <AccordionItem value="liabilities">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    {t('payroll.quickbooks.settings.liabilities')}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    ({liabilityMappings.length} accounts)
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%]">{t('payroll.quickbooks.settings.onitAccount')}</TableHead>
                      <TableHead className="w-[50%]">{t('payroll.quickbooks.settings.qbAccount')}</TableHead>
                      <TableHead className="w-[15%]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liabilityMappings.map((mapping) => {
                      const globalIndex = settings.accountMappings.findIndex(
                        m => m.onitAccountCode === mapping.onitAccountCode
                      );
                      return (
                        <TableRow key={mapping.onitAccountCode}>
                          <TableCell className="font-medium">
                            <div>
                              <span className="text-muted-foreground text-xs">{mapping.onitAccountCode}</span>
                              <br />
                              {mapping.onitAccountName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={mapping.qbAccountName}
                              onChange={(e) => updateMapping(globalIndex, 'qbAccountName', e.target.value)}
                              placeholder="Enter QuickBooks account name"
                            />
                          </TableCell>
                          <TableCell>
                            {mapping.isDefault ? (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Custom</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>

            {/* Asset Accounts */}
            {assetMappings.length > 0 && (
              <AccordionItem value="assets">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Assets
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      ({assetMappings.length} accounts)
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[35%]">{t('payroll.quickbooks.settings.onitAccount')}</TableHead>
                        <TableHead className="w-[50%]">{t('payroll.quickbooks.settings.qbAccount')}</TableHead>
                        <TableHead className="w-[15%]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assetMappings.map((mapping) => {
                        const globalIndex = settings.accountMappings.findIndex(
                          m => m.onitAccountCode === mapping.onitAccountCode
                        );
                        return (
                          <TableRow key={mapping.onitAccountCode}>
                            <TableCell className="font-medium">
                              <div>
                                <span className="text-muted-foreground text-xs">{mapping.onitAccountCode}</span>
                                <br />
                                {mapping.onitAccountName}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={mapping.qbAccountName}
                                onChange={(e) => updateMapping(globalIndex, 'qbAccountName', e.target.value)}
                                placeholder="Enter QuickBooks account name"
                              />
                            </TableCell>
                            <TableCell>
                              {mapping.isDefault ? (
                                <Badge variant="secondary" className="text-xs">Default</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Custom</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>

        <Separator />

        {/* Help text */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                How to use these mappings
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                The QuickBooks account names should match your Chart of Accounts in QuickBooks exactly.
                Use colons to specify sub-accounts (e.g., "Payroll Expenses:Salaries").
              </p>
              <a
                href="https://quickbooks.intuit.com/learn-support/en-us/help-article/account-management/import-chart-accounts-quickbooks-online/L3vYXKjqo_US_en_US"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                Learn more about QuickBooks import
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t('payroll.quickbooks.settings.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default QuickBooksSettings;
