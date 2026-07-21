/**
 * Annual Income Tax preparation (TADR-IT 1, "Form C"). The default flow is a
 * short hand-off checklist; advanced tax mode adds the accountant workpaper.
 *
 * Maps the year's posted GL into the official form's line numbers, applies
 * the accountant's adjustments and credits, and computes the Table A/B tax —
 * as a PREPARATION AID for transcription onto the official ATTL form. Xefe
 * does not generate or file the official form (see
 * docs/LAUNCH_READINESS_TODO.md — accountant sign-off is still external).
 */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { useAdvancedTax, useTenantId } from "@/contexts/TenantContext";
import { useIncomeStatement } from "@/hooks/useAccounting";
import {
  useSaveAnnualIncomeTaxPreparation,
  useTaxFilingByPeriod,
} from "@/hooks/useTaxFiling";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  buildFormCWorkpaper,
  EMPTY_FORM_C_MANUAL_INPUTS,
  FORM_C_LINE_CODES,
  formCDueDate,
  type FormCGlRow,
  type FormCLineCode,
  type FormCManualInputs,
  type FormCWarning,
} from "@/lib/tax/form-c";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import { formatDateTL, getTodayTL, parseDateISO } from "@/lib/dateUtils";
import { fixedAssetService } from "@/services/fixedAssetService";
import type {
  AnnualIncomeTaxPreparation,
  AnnualIncomeTaxWorkpaperState,
} from "@/types/tax-filing";
import {
  AlertTriangle,
  CalendarRange,
  Calculator,
  Download,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";

const WHT_CREDIT_ROWS = [
  ["royalties", "180"],
  ["rentalLandBuildings", "185"],
  ["buildingConstruction", "190"],
  ["constructionConsulting", "195"],
  ["airSeaTransport", "200"],
  ["mining", "205"],
] as const;

type WhtCreditKey = (typeof WHT_CREDIT_ROWS)[number][0];

const numberOr = (value: string, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default function AnnualIncomeTaxPrep() {
  const tenantId = useTenantId();
  const showAdvancedTax = useAdvancedTax();
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const savePreparation = useSaveAnnualIncomeTaxPreparation();

  // Default to the year whose return is being prepared (previous calendar year).
  const currentYear = Number(getTodayTL().slice(0, 4));
  const defaultYear = currentYear - 1;
  const [taxYear, setTaxYear] = useState(defaultYear);
  const yearOptions = useMemo(() => {
    return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  }, [currentYear]);

  const [manual, setManual] = useState<FormCManualInputs>(
    EMPTY_FORM_C_MANUAL_INPUTS,
  );
  const [checklist, setChecklist] = useState({
    profitAndLossReady: false,
    balanceSheetReady: false,
    cashFlowReady: false,
    taxAdjustmentsReviewed: false,
    reviewNote: "",
  });

  const { data: statement, isLoading: statementLoading } = useIncomeStatement(
    `${taxYear}-01-01`,
    `${taxYear}-12-31`,
    taxYear,
    showAdvancedTax,
  );
  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ["tenants", tenantId, "fixedAssets", "list"],
    queryFn: () => fixedAssetService.list(tenantId),
    staleTime: 5 * 60 * 1000,
    enabled: showAdvancedTax,
  });
  const { data: savedFiling, isLoading: filingLoading } = useTaxFilingByPeriod(
    "annual_income_tax",
    String(taxYear),
  );

  // Hydrate saved inputs once per loaded record; keep unsaved edits otherwise.
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    const hydrationKey = `${taxYear}:${savedFiling?.id || "none"}`;
    if (hydratedFor.current === hydrationKey) return;
    hydratedFor.current = hydrationKey;
    const snapshot = savedFiling?.dataSnapshot as
      | Partial<AnnualIncomeTaxPreparation>
      | undefined;
    setChecklist({
      profitAndLossReady: snapshot?.profitAndLossReady === true,
      balanceSheetReady: snapshot?.balanceSheetReady === true,
      cashFlowReady: snapshot?.cashFlowReady === true,
      taxAdjustmentsReviewed: snapshot?.taxAdjustmentsReviewed === true,
      reviewNote: snapshot?.reviewNote || "",
    });
    const saved = snapshot?.workpaper;
    if (saved) {
      setManual({
        entityType: saved.entityType,
        taxDepreciationMethod:
          saved.taxDepreciationMethod === "full_expensing"
            ? "full_expensing"
            : "useful_life",
        lossCarriedForward: saved.lossCarriedForward,
        installmentsPaid: saved.installmentsPaid,
        foreignTaxCredits: saved.foreignTaxCredits,
        whtCredits: {
          ...EMPTY_FORM_C_MANUAL_INPUTS.whtCredits,
          ...saved.whtCredits,
        },
        adjustments: saved.adjustments.filter(
          (entry): entry is FormCManualInputs["adjustments"][number] =>
            (FORM_C_LINE_CODES as readonly string[]).includes(entry.line),
        ),
      });
    } else {
      setManual(EMPTY_FORM_C_MANUAL_INPUTS);
    }
  }, [savedFiling, taxYear]);

  const glRows = useMemo<FormCGlRow[]>(() => {
    if (!statement) return [];
    return [...statement.revenueItems, ...statement.expenseItems]
      .filter((row) => !row.isTotal)
      .map((row) => ({
        accountCode: row.accountCode,
        accountName: row.accountName,
        accountType: row.accountType,
        amount: row.amount,
      }));
  }, [statement]);

  const workpaper = useMemo(
    () =>
      buildFormCWorkpaper({
        taxYear,
        glRows,
        assets: assets
          .filter((asset) => asset.status !== undefined)
          .map((asset) => ({
            name: asset.name,
            reference: asset.reference,
            acquisitionDate: asset.acquisitionDate,
            acquisitionCost: asset.acquisitionCost,
            residualValue: asset.residualValue,
            usefulLifeMonths: asset.usefulLifeMonths,
            depreciationStartPeriod: asset.depreciationStartPeriod,
            status: asset.status,
            disposalDate: asset.disposalDate,
            disposalProceeds: asset.disposalProceeds,
          })),
        manual,
      }),
    [taxYear, glRows, assets, manual],
  );

  const loading =
    filingLoading ||
    (showAdvancedTax && (statementLoading || assetsLoading));

  const lineLabel = (code: FormCLineCode) =>
    t(`taxReports.formC.workpaper.lines.l${code}`);

  const warningText = (warning: FormCWarning): string => {
    switch (warning.code) {
      case "interest_excluded":
        return t("taxReports.formC.workpaper.warnings.interestExcluded", {
          account: warning.accountName,
          amount: formatCurrencyTL(warning.amount),
        });
      case "income_tax_expense_excluded":
        return t("taxReports.formC.workpaper.warnings.incomeTaxExcluded", {
          account: warning.accountName,
          amount: formatCurrencyTL(warning.amount),
        });
      case "sole_trader_own_salary":
        return t("taxReports.formC.workpaper.warnings.soleTraderOwnSalary");
      case "depreciation_schedule_mismatch":
        return t("taxReports.formC.workpaper.warnings.depreciationMismatch", {
          gl: formatCurrencyTL(warning.glAmount),
          schedule: formatCurrencyTL(warning.scheduleAmount),
        });
      case "books_depreciation_replaced":
        return t(
          "taxReports.formC.workpaper.warnings.booksDepreciationReplaced",
          { gl: formatCurrencyTL(warning.glAmount) },
        );
      case "expensed_disposal_proceeds":
        return t(
          "taxReports.formC.workpaper.warnings.expensedDisposalProceeds",
          {
            asset: warning.assetDescription,
            amount: formatCurrencyTL(warning.amount),
          },
        );
      case "negative_line":
        return t("taxReports.formC.workpaper.warnings.negativeLine", {
          line: warning.line,
          amount: formatCurrencyTL(warning.amount),
        });
    }
  };

  const setWhtCredit = (
    key: WhtCreditKey,
    patch: Partial<{ amount: number; payerTin: string }>,
  ) => {
    setManual((current) => ({
      ...current,
      whtCredits: {
        ...current.whtCredits,
        [key]: { ...current.whtCredits[key], ...patch },
      },
    }));
  };

  const updateAdjustment = (
    index: number,
    patch: Partial<FormCManualInputs["adjustments"][number]>,
  ) => {
    setManual((current) => ({
      ...current,
      adjustments: current.adjustments.map((entry, i) =>
        i === index ? { ...entry, ...patch } : entry,
      ),
    }));
  };

  const saveProgress = async () => {
    if (!user) return;
    const preparation = showAdvancedTax
      ? {
          ...checklist,
          workpaper: {
            ...manual,
            computed: {
              grossIncome:
                workpaper.lines.find((line) => line.line === "05")?.amount || 0,
              totalExpenses: workpaper.totals.totalExpenses,
              netIncome: workpaper.totals.netIncome,
              taxableIncome: workpaper.totals.taxableIncome,
              tax: workpaper.totals.tax,
              totalCredits: workpaper.totals.totalCredits,
              taxOwing: workpaper.totals.taxOwing,
            },
          } satisfies AnnualIncomeTaxWorkpaperState,
        }
      : checklist;
    try {
      await savePreparation.mutateAsync({
        taxYear,
        preparation,
        userId: user.uid,
        audit: {
          tenantId,
          userId: user.uid,
          userEmail: user.email || "",
          userName: user.displayName || undefined,
        },
      });
      toast({
        title: t("taxReports.formC.savedTitle"),
        description: t("taxReports.formC.savedDescription"),
      });
    } catch (error) {
      toast({
        title: t("common.error"),
        description:
          error instanceof Error
            ? error.message
            : t("taxReports.formC.saveError"),
        variant: "destructive",
      });
    }
  };

  const exportWorkpaper = async () => {
    try {
      const { downloadFormCWorkpaperExcel } = await import(
        "@/lib/reports/formCWorkpaperExcel"
      );
      await downloadFormCWorkpaperExcel(workpaper);
    } catch (error) {
      toast({
        title: t("common.error"),
        description:
          error instanceof Error
            ? error.message
            : t("taxReports.formC.workpaper.exportError"),
        variant: "destructive",
      });
    }
  };

  const dueDate = formatDateTL(parseDateISO(formCDueDate(taxYear)), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const summaryRows: { label: string; value: number; strong?: boolean }[] = [
    {
      label: t("taxReports.formC.workpaper.grossIncome"),
      value: workpaper.lines.find((line) => line.line === "05")?.amount || 0,
    },
    {
      label: t("taxReports.formC.workpaper.totalExpenses"),
      value: workpaper.totals.totalExpenses,
    },
    {
      label: t("taxReports.formC.workpaper.netIncome"),
      value: workpaper.totals.netIncome,
    },
    {
      label: t("taxReports.formC.workpaper.lossApplied"),
      value: -workpaper.totals.lossApplied,
    },
    {
      label: t("taxReports.formC.workpaper.taxableIncome"),
      value: workpaper.totals.taxableIncome,
    },
    {
      label: t("taxReports.formC.workpaper.tax"),
      value: workpaper.totals.tax,
      strong: true,
    },
    {
      label: t("taxReports.formC.workpaper.totalCredits"),
      value: -workpaper.totals.totalCredits,
    },
    {
      label: t("taxReports.formC.workpaper.taxOwing"),
      value: workpaper.totals.taxOwing,
      strong: true,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-80" />
            </div>
          </div>
          <Skeleton className="h-24 w-full mb-6 rounded-lg" />
          <Skeleton className="h-64 w-full mb-6 rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (!showAdvancedTax) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title={t("taxReports.formC.title")}
          description={t("taxReports.formC.dialogDescription")}
        />
        <MainNavigation />
        <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
          <PageHeader
            title={t("taxReports.formC.title")}
            subtitle={t("taxReports.formC.dialogDescription")}
            icon={CalendarRange}
            iconColor="text-orange-500"
            actions={
              <Button
                onClick={() => void saveProgress()}
                disabled={savePreparation.isPending}
              >
                {savePreparation.isPending
                  ? t("common.saving")
                  : t("common.save")}
              </Button>
            }
          />

          <p className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            {t("taxReports.formC.externalWarning")}
          </p>

          <Card className="max-w-2xl border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>
                {t("taxReports.formC.dialogTitle", { year: taxYear })}
              </CardTitle>
              <CardDescription>
                {t("taxReports.formC.workpaper.dueBy", { date: dueDate })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="max-w-xs space-y-2">
                <Label htmlFor="form-c-simple-year">
                  {t("taxReports.formC.workpaper.taxYear")}
                </Label>
                <Select
                  value={String(taxYear)}
                  onValueChange={(value) => setTaxYear(Number(value))}
                >
                  <SelectTrigger id="form-c-simple-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(
                [
                  ["profitAndLossReady", "profitAndLoss"],
                  ["balanceSheetReady", "balanceSheet"],
                  ["cashFlowReady", "cashFlow"],
                  ["taxAdjustmentsReviewed", "taxAdjustments"],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="flex items-start gap-3">
                  <Checkbox
                    id={`form-c-simple-${field}`}
                    checked={checklist[field]}
                    onCheckedChange={(checked) =>
                      setChecklist((current) => ({
                        ...current,
                        [field]: checked === true,
                      }))
                    }
                  />
                  <Label
                    htmlFor={`form-c-simple-${field}`}
                    className="font-normal leading-5"
                  >
                    {t(`taxReports.formC.checklist.${label}`)}
                  </Label>
                </div>
              ))}

              <div className="space-y-2">
                <Label htmlFor="form-c-simple-review-note">
                  {t("taxReports.formC.reviewNote")}
                </Label>
                <Textarea
                  id="form-c-simple-review-note"
                  value={checklist.reviewNote}
                  onChange={(event) =>
                    setChecklist((current) => ({
                      ...current,
                      reviewNote: event.target.value,
                    }))
                  }
                  placeholder={t("taxReports.formC.reviewNotePlaceholder")}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("taxReports.formC.workpaper.pageTitle")}
        description={t("taxReports.formC.workpaper.pageSubtitle")}
      />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={t("taxReports.formC.workpaper.pageTitle")}
          subtitle={t("taxReports.formC.workpaper.pageSubtitle")}
          icon={Calculator}
          iconColor="text-orange-500"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="min-h-10"
                onClick={() => void exportWorkpaper()}
              >
                <Download className="h-4 w-4 mr-2" />
                {t("taxReports.formC.workpaper.exportWorkpaper")}
              </Button>
              <Button
                className="min-h-10"
                onClick={() => void saveProgress()}
                disabled={savePreparation.isPending}
              >
                {savePreparation.isPending
                  ? t("common.saving")
                  : t("taxReports.formC.workpaper.saveProgress")}
              </Button>
            </div>
          }
        />

        <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 mb-6">
          <p className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {t("taxReports.formC.workpaper.disclaimer")}{" "}
              <span className="font-medium">
                {t("taxReports.formC.workpaper.dueBy", { date: dueDate })}
              </span>
            </span>
          </p>
          <a
            href="https://attl.gov.tl/annual-domestic-tax-forms/"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-medium underline underline-offset-2"
          >
            {t("taxReports.formC.workpaper.officialFormLink")}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("taxReports.formC.workpaper.taxYear")}</Label>
            <Select
              value={String(taxYear)}
              onValueChange={(value) => setTaxYear(Number(value))}
            >
              <SelectTrigger className="min-h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("taxReports.formC.workpaper.entityType")}</Label>
            <Select
              value={manual.entityType}
              onValueChange={(value) =>
                setManual((current) => ({
                  ...current,
                  entityType: value as FormCManualInputs["entityType"],
                }))
              }
            >
              <SelectTrigger className="min-h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">
                  {t("taxReports.formC.workpaper.entityCompany")}
                </SelectItem>
                <SelectItem value="sole_trader">
                  {t("taxReports.formC.workpaper.entitySoleTrader")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              {t("taxReports.formC.workpaper.depreciationMethod")}
            </Label>
            <Select
              value={manual.taxDepreciationMethod}
              onValueChange={(value) =>
                setManual((current) => ({
                  ...current,
                  taxDepreciationMethod:
                    value as FormCManualInputs["taxDepreciationMethod"],
                }))
              }
            >
              <SelectTrigger className="min-h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="useful_life">
                  {t("taxReports.formC.workpaper.depreciationUsefulLife")}
                </SelectItem>
                <SelectItem value="full_expensing">
                  {t("taxReports.formC.workpaper.depreciationFullExpensing")}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("taxReports.formC.workpaper.depreciationMethodHint")}
            </p>
          </div>
        </div>

        {workpaper.warnings.length > 0 && (
          <Card className="mb-6 border-amber-300/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {t("taxReports.formC.workpaper.warningsTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {workpaper.warnings.map((warning, index) => (
                  <li key={index}>{warningText(warning)}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("taxReports.formC.workpaper.summaryTitle")}</CardTitle>
            <CardDescription>
              {t("taxReports.formC.workpaper.summaryDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {summaryRows.map((row) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between py-2 text-sm ${row.strong ? "font-semibold" : ""}`}
                >
                  <span>{row.label}</span>
                  <span className="tabular-nums">
                    {formatCurrencyTL(row.value)}
                  </span>
                </div>
              ))}
            </div>
            {workpaper.totals.overpaid && (
              <Badge className="mt-3 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                {t("taxReports.formC.workpaper.overpaid")}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("taxReports.formC.workpaper.linesTitle")}</CardTitle>
            <CardDescription>
              {t("taxReports.formC.workpaper.linesDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">
                    {t("taxReports.formC.workpaper.colLine")}
                  </TableHead>
                  <TableHead>
                    {t("taxReports.formC.workpaper.colDescription")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("taxReports.formC.workpaper.colFromBooks")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("taxReports.formC.workpaper.colAdjustment")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("taxReports.formC.workpaper.colAmount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workpaper.lines.map((line) => (
                  <Fragment key={line.line}>
                    <TableRow>
                      <TableCell className="font-mono text-xs">
                        {line.line}
                      </TableCell>
                      <TableCell>{lineLabel(line.line)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyTL(line.fromBooks)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.adjustment !== 0
                          ? formatCurrencyTL(line.adjustment)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrencyTL(line.amount)}
                      </TableCell>
                    </TableRow>
                    {line.accounts.map((account) => (
                      <TableRow
                        key={`${line.line}-${account.accountCode}`}
                        className="border-0"
                      >
                        <TableCell />
                        <TableCell className="py-1 pl-6 text-xs text-muted-foreground">
                          {account.accountCode} · {account.accountName}
                        </TableCell>
                        <TableCell className="py-1 text-right text-xs text-muted-foreground tabular-nums">
                          {formatCurrencyTL(account.amount)}
                        </TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
                <TableRow className="font-semibold">
                  <TableCell className="font-mono text-xs">135</TableCell>
                  <TableCell>
                    {t("taxReports.formC.workpaper.totalExpenses")}
                  </TableCell>
                  <TableCell colSpan={2} />
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyTL(workpaper.totals.totalExpenses)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            {workpaper.otherExpenseDetails.length > 0 && (
              <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-sm">
                <p className="font-medium mb-2">
                  {t("taxReports.formC.workpaper.otherDetailTitle")}
                </p>
                {workpaper.otherExpenseDetails.map((detail) => (
                  <div
                    key={detail.accountCode}
                    className="flex items-center justify-between py-0.5 text-muted-foreground"
                  >
                    <span>
                      {detail.accountCode} · {detail.accountName}
                    </span>
                    <span className="tabular-nums">
                      {formatCurrencyTL(detail.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {workpaper.excluded.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-300/60 bg-amber-50/50 p-3 text-sm dark:bg-amber-950/20">
                <p className="font-medium mb-2">
                  {t("taxReports.formC.workpaper.excludedTitle")}
                </p>
                {workpaper.excluded.map((entry) => (
                  <div
                    key={entry.accountCode}
                    className="flex items-center justify-between py-0.5 text-muted-foreground"
                  >
                    <span>
                      {entry.accountCode} · {entry.accountName}
                    </span>
                    <span className="tabular-nums">
                      {formatCurrencyTL(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {t("taxReports.formC.workpaper.adjustmentsTitle")}
            </CardTitle>
            <CardDescription>
              {t("taxReports.formC.workpaper.adjustmentsDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {manual.adjustments.map((adjustment, index) => (
              <div
                key={index}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_8rem_1fr_auto]"
              >
                <Select
                  value={adjustment.line}
                  onValueChange={(value) =>
                    updateAdjustment(index, { line: value as FormCLineCode })
                  }
                >
                  <SelectTrigger className="min-h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORM_C_LINE_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code} · {lineLabel(code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="1"
                  value={adjustment.amount || ""}
                  onChange={(event) =>
                    updateAdjustment(index, {
                      amount: numberOr(event.target.value),
                    })
                  }
                />
                <Input
                  value={adjustment.note}
                  placeholder={t(
                    "taxReports.formC.workpaper.adjustmentNote",
                  )}
                  onChange={(event) =>
                    updateAdjustment(index, { note: event.target.value })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-10"
                  aria-label={t("common.delete")}
                  onClick={() =>
                    setManual((current) => ({
                      ...current,
                      adjustments: current.adjustments.filter(
                        (_, i) => i !== index,
                      ),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setManual((current) => ({
                  ...current,
                  adjustments: [
                    ...current.adjustments,
                    { line: "110", amount: 0, note: "" },
                  ],
                }))
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("taxReports.formC.workpaper.addAdjustment")}
            </Button>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("taxReports.formC.workpaper.creditsTitle")}</CardTitle>
            <CardDescription>
              {t("taxReports.formC.workpaper.creditsDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>
                  {t("taxReports.formC.workpaper.lossCarriedForward")}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={manual.lossCarriedForward || ""}
                  onChange={(event) =>
                    setManual((current) => ({
                      ...current,
                      lossCarriedForward: numberOr(event.target.value),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("taxReports.formC.workpaper.lossCarriedForwardHint")}
                </p>
              </div>
              <div className="space-y-2">
                <Label>
                  {t("taxReports.formC.workpaper.installmentsPaid")}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={manual.installmentsPaid || ""}
                  onChange={(event) =>
                    setManual((current) => ({
                      ...current,
                      installmentsPaid: numberOr(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {t("taxReports.formC.workpaper.foreignTaxCredits")}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={manual.foreignTaxCredits || ""}
                  onChange={(event) =>
                    setManual((current) => ({
                      ...current,
                      foreignTaxCredits: numberOr(event.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t("taxReports.formC.workpaper.whtCreditsTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("taxReports.formC.workpaper.whtCreditsHint")}
              </p>
              {WHT_CREDIT_ROWS.map(([key, lineCode]) => (
                <div
                  key={key}
                  className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_8rem_10rem]"
                >
                  <Label className="font-normal">
                    {lineCode} · {t(`taxReports.formC.workpaper.wht.${key}`)}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={manual.whtCredits[key].amount || ""}
                    onChange={(event) =>
                      setWhtCredit(key, {
                        amount: numberOr(event.target.value),
                      })
                    }
                  />
                  <Input
                    value={manual.whtCredits[key].payerTin}
                    placeholder={t("taxReports.formC.workpaper.payerTin")}
                    onChange={(event) =>
                      setWhtCredit(key, { payerTin: event.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {workpaper.depreciationSchedule.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>
                {t("taxReports.formC.workpaper.depreciationTitle")}
              </CardTitle>
              <CardDescription>
                {t("taxReports.formC.workpaper.depreciationDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t("taxReports.formC.workpaper.assetDescription")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("taxReports.formC.workpaper.openingValue")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("taxReports.formC.workpaper.purchaseCost")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("taxReports.formC.workpaper.disposalProceeds")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("taxReports.formC.workpaper.rate")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("taxReports.formC.workpaper.yearDepreciation")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("taxReports.formC.workpaper.closingValue")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workpaper.depreciationSchedule.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row.description}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyTL(row.openingValue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.purchaseCost !== undefined
                          ? formatCurrencyTL(row.purchaseCost)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.disposalProceeds !== undefined
                          ? formatCurrencyTL(row.disposalProceeds)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.ratePercent}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyTL(row.yearDepreciation)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyTL(row.closingValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell>
                      {t("taxReports.formC.workpaper.scheduleTotal")}
                    </TableCell>
                    <TableCell colSpan={4} />
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyTL(workpaper.scheduleTotalDepreciation)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              {t("taxReports.formC.workpaper.readinessTitle")}
            </CardTitle>
            <CardDescription>
              {t("taxReports.formC.dialogDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(
              [
                ["profitAndLossReady", "profitAndLoss"],
                ["balanceSheetReady", "balanceSheet"],
                ["cashFlowReady", "cashFlow"],
                ["taxAdjustmentsReviewed", "taxAdjustments"],
              ] as const
            ).map(([field, label]) => (
              <div key={field} className="flex items-start gap-3">
                <Checkbox
                  id={`workpaper-${field}`}
                  checked={checklist[field]}
                  onCheckedChange={(checked) =>
                    setChecklist((current) => ({
                      ...current,
                      [field]: checked === true,
                    }))
                  }
                />
                <Label
                  htmlFor={`workpaper-${field}`}
                  className="font-normal leading-5"
                >
                  {t(`taxReports.formC.checklist.${label}`)}
                </Label>
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="workpaper-review-note">
                {t("taxReports.formC.reviewNote")}
              </Label>
              <Textarea
                id="workpaper-review-note"
                value={checklist.reviewNote}
                onChange={(event) =>
                  setChecklist((current) => ({
                    ...current,
                    reviewNote: event.target.value,
                  }))
                }
                placeholder={t("taxReports.formC.reviewNotePlaceholder")}
                rows={3}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => void saveProgress()}
                disabled={savePreparation.isPending}
              >
                {savePreparation.isPending
                  ? t("common.saving")
                  : t("taxReports.formC.workpaper.saveProgress")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
