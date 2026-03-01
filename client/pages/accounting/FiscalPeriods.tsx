/**
 * Fiscal Period Management Page
 * View, close, and reopen fiscal periods. Create fiscal years.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Calendar,
  Lock,
  Unlock,
  Plus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/I18nProvider';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyTL } from '@/lib/payroll/constants-tl';
import {
  useAccounts,
  useFiscalYear,
  useFiscalPeriods,
  useCreateFiscalYear,
  useCloseFiscalPeriod,
  useReopenFiscalPeriod,
  useLockFiscalPeriod,
  usePostOpeningBalances,
} from '@/hooks/useAccounting';
import type { Account } from '@/types/accounting';

export default function FiscalPeriods() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: fiscalYear, isLoading: loadingYear } = useFiscalYear(selectedYear);
  const { data: periods = [], isLoading: loadingPeriods } = useFiscalPeriods(selectedYear);

  const { data: allAccounts = [] } = useAccounts();

  const createYearMutation = useCreateFiscalYear();
  const closePeriodMutation = useCloseFiscalPeriod();
  const reopenPeriodMutation = useReopenFiscalPeriod();
  const lockPeriodMutation = useLockFiscalPeriod();
  const openingBalanceMutation = usePostOpeningBalances();

  // Opening balance dialog state
  const [showOpeningDialog, setShowOpeningDialog] = useState(false);
  const [obAmounts, setObAmounts] = useState<Record<string, { debit: string; credit: string }>>({});

  // Balance sheet accounts only (asset, liability, equity)
  const bsAccounts = useMemo(() =>
    allAccounts
      .filter((a: Account) => a.isActive && ['asset', 'liability', 'equity'].includes(a.type))
      .sort((a: Account, b: Account) => a.code.localeCompare(b.code)),
    [allAccounts]
  );

  const openOpeningDialog = useCallback(() => {
    // Initialize amounts from scratch
    const init: Record<string, { debit: string; credit: string }> = {};
    bsAccounts.forEach((a: Account) => { init[a.id!] = { debit: '', credit: '' }; });
    setObAmounts(init);
    setShowOpeningDialog(true);
  }, [bsAccounts]);

  const obTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    Object.values(obAmounts).forEach(({ debit, credit }) => {
      totalDebit += parseFloat(debit) || 0;
      totalCredit += parseFloat(credit) || 0;
    });
    return { totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  }, [obAmounts]);

  const handlePostOpeningBalances = async () => {
    if (!fiscalYear?.id || !obTotals.balanced) return;
    const lines = bsAccounts
      .map((a: Account) => {
        const debit = parseFloat(obAmounts[a.id!]?.debit || '0') || 0;
        const credit = parseFloat(obAmounts[a.id!]?.credit || '0') || 0;
        if (debit === 0 && credit === 0) return null;
        return { accountId: a.id!, accountCode: a.code, accountName: a.name, debit, credit };
      })
      .filter(Boolean) as { accountId: string; accountCode: string; accountName: string; debit: number; credit: number }[];

    if (lines.length === 0) return;

    try {
      await openingBalanceMutation.mutateAsync({
        fiscalYearId: fiscalYear.id,
        year: selectedYear,
        lines,
        createdBy: user?.email || 'unknown',
      });
      setShowOpeningDialog(false);
      toast({
        title: t("accounting.fiscalPeriods.obPosted"),
        description: t("accounting.fiscalPeriods.obPostedDesc", { year: selectedYear }),
      });
    } catch {
      toast({
        title: t("common.error"),
        description: t("accounting.fiscalPeriods.obError"),
        variant: "destructive",
      });
    }
  };

  const handleCreateYear = async () => {
    try {
      await createYearMutation.mutateAsync({
        year: selectedYear,
        createdBy: user?.email || 'unknown',
      });
      toast({
        title: t("accounting.fiscalPeriods.yearCreated"),
        description: t("accounting.fiscalPeriods.yearCreatedDesc", { year: selectedYear }),
      });
    } catch {
      toast({
        title: t("common.error"),
        description: t("accounting.fiscalPeriods.errorCreatingYear"),
        variant: "destructive",
      });
    }
  };

  const handleClosePeriod = async (periodId: string) => {
    try {
      await closePeriodMutation.mutateAsync({
        periodId,
        closedBy: user?.email || 'unknown',
      });
      toast({
        title: t("accounting.fiscalPeriods.periodClosed"),
        description: t("accounting.fiscalPeriods.periodClosedDesc"),
      });
    } catch {
      toast({
        title: t("common.error"),
        description: t("accounting.fiscalPeriods.errorClosingPeriod"),
        variant: "destructive",
      });
    }
  };

  const handleReopenPeriod = async (periodId: string) => {
    try {
      await reopenPeriodMutation.mutateAsync({
        periodId,
        reopenedBy: user?.email || 'unknown',
      });
      toast({
        title: t("accounting.fiscalPeriods.periodReopened"),
        description: t("accounting.fiscalPeriods.periodReopenedDesc"),
      });
    } catch {
      toast({
        title: t("common.error"),
        description: t("accounting.fiscalPeriods.errorReopeningPeriod"),
        variant: "destructive",
      });
    }
  };

  const handleLockPeriod = async (periodId: string) => {
    try {
      await lockPeriodMutation.mutateAsync({
        periodId,
        lockedBy: user?.email || 'unknown',
      });
      toast({
        title: t("accounting.fiscalPeriods.periodLocked"),
        description: t("accounting.fiscalPeriods.periodLockedDesc"),
      });
    } catch {
      toast({
        title: t("common.error"),
        description: t("accounting.fiscalPeriods.errorLockingPeriod"),
        variant: "destructive",
      });
    }
  };

  const openCount = periods.filter(p => p.status === 'open').length;
  const closedCount = periods.filter(p => p.status === 'closed').length;
  const lockedCount = periods.filter(p => p.status === 'locked').length;
  const loading = loadingYear || loadingPeriods;

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-slate-50 dark:bg-slate-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-500 to-gray-600 shadow-lg shadow-slate-500/25">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{t("accounting.fiscalPeriods.title")}</h1>
                <p className="text-muted-foreground mt-1">
                  {t("accounting.fiscalPeriods.subtitle")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Year Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("accounting.fiscalPeriods.selectYear")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => currentYear + 1 - i).map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!loading && !fiscalYear && (
              <Button onClick={handleCreateYear} disabled={createYearMutation.isPending}>
                {createYearMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {t("accounting.fiscalPeriods.createYear", { year: selectedYear })}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-8">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-8 w-20 ml-auto" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !fiscalYear ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">
                {t("accounting.fiscalPeriods.noYear", { year: selectedYear })}
              </h3>
              <p>{t("accounting.fiscalPeriods.noYearDesc")}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Opening Balances Banner */}
          {!fiscalYear.openingBalancesPosted && (
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-200">
                        {t("accounting.fiscalPeriods.obNotPosted")}
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-400">
                        {t("accounting.fiscalPeriods.obNotPostedDesc")}
                      </p>
                    </div>
                  </div>
                  <Button onClick={openOpeningDialog} variant="default" size="sm">
                    <BookOpen className="h-4 w-4 mr-2" />
                    {t("accounting.fiscalPeriods.enterOpeningBalances")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t("accounting.fiscalPeriods.fiscalYear")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{selectedYear}</div>
                <p className="text-xs text-muted-foreground">
                  {fiscalYear.startDate} — {fiscalYear.endDate}
                </p>
                {fiscalYear.openingBalancesPosted && (
                  <Badge className="mt-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {t("accounting.fiscalPeriods.obPostedBadge")}
                  </Badge>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  {t("accounting.fiscalPeriods.openPeriods")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{openCount}</div>
                <p className="text-xs text-muted-foreground">{t("accounting.fiscalPeriods.acceptingEntries")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  {t("accounting.fiscalPeriods.closedPeriods")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{closedCount}</div>
                <p className="text-xs text-muted-foreground">{t("accounting.fiscalPeriods.noNewEntries")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4 text-red-600 dark:text-red-400" />
                  {t("accounting.fiscalPeriods.lockedPeriods")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{lockedCount}</div>
                <p className="text-xs text-muted-foreground">{t("accounting.fiscalPeriods.permanentlyLocked")}</p>
              </CardContent>
            </Card>
          </div>

          {/* Periods Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("accounting.fiscalPeriods.periodsLabel")}</CardTitle>
              <CardDescription>
                {t("accounting.fiscalPeriods.periodsDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead>{t("accounting.fiscalPeriods.month")}</TableHead>
                    <TableHead>{t("accounting.fiscalPeriods.dateRange")}</TableHead>
                    <TableHead>{t("accounting.fiscalPeriods.status")}</TableHead>
                    <TableHead className="text-right">{t("accounting.fiscalPeriods.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((period) => {
                    const isCurrent = period.period === new Date().getMonth() + 1 && selectedYear === currentYear;
                    return (
                      <TableRow key={period.id} className={isCurrent ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}>
                        <TableCell className="font-mono text-sm">{period.period}</TableCell>
                        <TableCell className="font-medium">
                          {t(`common.months.${period.period}`)}
                          {isCurrent && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {t("accounting.fiscalPeriods.current")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {period.startDate} — {period.endDate}
                        </TableCell>
                        <TableCell>
                          {period.status === 'open' ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {t("accounting.fiscalPeriods.open")}
                            </Badge>
                          ) : period.status === 'locked' ? (
                            <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                              <Lock className="h-3 w-3 mr-1" />
                              {t("accounting.fiscalPeriods.locked")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              <Lock className="h-3 w-3 mr-1" />
                              {t("accounting.fiscalPeriods.closed")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {period.status === 'open' ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={closePeriodMutation.isPending}
                                >
                                  <Lock className="h-3 w-3 mr-1" />
                                  {t("accounting.fiscalPeriods.closePeriod")}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                                    {t("accounting.fiscalPeriods.confirmClose")}
                                  </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {t("accounting.fiscalPeriods.confirmCloseDesc", { month: t(`common.months.${period.period}`), year: selectedYear })}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleClosePeriod(period.id!)}>
                                    {t("accounting.fiscalPeriods.closePeriod")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : period.status === 'locked' ? (
                            <Button variant="ghost" size="sm" disabled>
                              <Lock className="h-3 w-3 mr-1" />
                              {t("accounting.fiscalPeriods.locked")}
                            </Button>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              {/* Reopen */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={reopenPeriodMutation.isPending}
                                  >
                                    <Unlock className="h-3 w-3 mr-1" />
                                    {t("accounting.fiscalPeriods.reopenPeriod")}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {t("accounting.fiscalPeriods.confirmReopen")}
                                    </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          {t("accounting.fiscalPeriods.confirmReopenDesc", { month: t(`common.months.${period.period}`), year: selectedYear })}
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleReopenPeriod(period.id!)}>
                                      {t("accounting.fiscalPeriods.reopenPeriod")}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>

                              {/* Lock */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={lockPeriodMutation.isPending}
                                  >
                                    <Lock className="h-3 w-3 mr-1" />
                                    {t("accounting.fiscalPeriods.lockPeriod")}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                      <Lock className="h-5 w-5 text-red-500" />
                                      {t("accounting.fiscalPeriods.confirmLock")}
                                    </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          {t("accounting.fiscalPeriods.confirmLockDesc", { month: t(`common.months.${period.period}`), year: selectedYear })}
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleLockPeriod(period.id!)}>
                                      {t("accounting.fiscalPeriods.lockPeriod")}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      </div>

      {/* Opening Balances Dialog */}
      <Dialog open={showOpeningDialog} onOpenChange={setShowOpeningDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {t("accounting.fiscalPeriods.enterOpeningBalances")} — {selectedYear}
            </DialogTitle>
            <DialogDescription>
              {t("accounting.fiscalPeriods.obDialogDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">{t("accounting.fiscalPeriods.obCode")}</TableHead>
                  <TableHead>{t("accounting.fiscalPeriods.obAccount")}</TableHead>
                  <TableHead className="w-[60px] text-center">{t("accounting.fiscalPeriods.obType")}</TableHead>
                  <TableHead className="w-[140px] text-right">{t("accounting.trialBalance.debit")}</TableHead>
                  <TableHead className="w-[140px] text-right">{t("accounting.trialBalance.credit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bsAccounts.map((account: Account) => {
                  const vals = obAmounts[account.id!] || { debit: '', credit: '' };
                  return (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono text-xs">{account.code}</TableCell>
                      <TableCell className="text-sm">{account.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {account.type === 'asset' ? 'A' : account.type === 'liability' ? 'L' : 'E'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="text-right h-8 text-sm"
                          value={vals.debit}
                          onChange={(e) => {
                            const v = e.target.value;
                            setObAmounts(prev => ({
                              ...prev,
                              [account.id!]: { ...prev[account.id!], debit: v, credit: v ? '' : prev[account.id!]?.credit || '' },
                            }));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="text-right h-8 text-sm"
                          value={vals.credit}
                          onChange={(e) => {
                            const v = e.target.value;
                            setObAmounts(prev => ({
                              ...prev,
                              [account.id!]: { ...prev[account.id!], credit: v, debit: v ? '' : prev[account.id!]?.debit || '' },
                            }));
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {obTotals.balanced ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {t("accounting.trialBalance.balanced")}
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {t("accounting.trialBalance.notBalanced")} ({formatCurrencyTL(Math.abs(obTotals.totalDebit - obTotals.totalCredit))})
                  </Badge>
                )}
              </div>
              <div className="flex gap-6 font-medium">
                <span>{t("accounting.trialBalance.debit")}: {formatCurrencyTL(obTotals.totalDebit)}</span>
                <span>{t("accounting.trialBalance.credit")}: {formatCurrencyTL(obTotals.totalCredit)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOpeningDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handlePostOpeningBalances}
              disabled={!obTotals.balanced || obTotals.totalDebit === 0 || openingBalanceMutation.isPending}
            >
              {openingBalanceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("accounting.fiscalPeriods.postOpeningBalances")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
