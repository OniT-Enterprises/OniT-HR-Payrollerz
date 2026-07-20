/**
 * Fixed Assets — the depreciation register.
 * Add assets by class, watch the schedule, post one aggregate depreciation
 * journal per month (source 'depreciation'), dispose with automatic gain/loss.
 * Math: client/lib/accounting/depreciation.ts. Posting: fixedAssetService.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { SEO, seoConfig } from "@/components/SEO";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Plus, Download, CalendarCheck, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useInvalidateAccounting } from "@/hooks/useAccounting";
import { fixedAssetService } from "@/services/fixedAssetService";
import type { FixedAsset } from "@/types/accounting";
import {
  ASSET_CLASSES,
  ACCUMULATED_DEPRECIATION_CODE,
  DEPRECIATION_EXPENSE_CODE,
  buildSchedule,
  disposalResult,
  monthlyCharge,
  periodOf,
} from "@/lib/accounting/depreciation";
import { getTodayTL, formatDateTL } from "@/lib/dateUtils";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableColumnHeader } from "@/components/ui/SortableColumnHeader";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Columns the fixed-asset register can be sorted by (Actions is not sortable)
type FixedAssetSortKey =
  | "name"
  | "class"
  | "acquired"
  | "cost"
  | "accumulated"
  | "nbv"
  | "status";

const EMPTY_FORM = {
  name: "",
  assetClass: "equipment",
  reference: "",
  acquisitionDate: getTodayTL(),
  acquisitionCost: "",
  residualValue: "0",
  usefulLifeMonths: "60",
};

export default function FixedAssets() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { canManage, session } = useTenant();
  const { user } = useAuth();
  const invalidateAccounting = useInvalidateAccounting();
  const tenantId = session?.tid;
  const canManageTenant = canManage();

  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [scheduleAsset, setScheduleAsset] = useState<FixedAsset | null>(null);
  const [disposeAsset, setDisposeAsset] = useState<FixedAsset | null>(null);
  const [disposeDate, setDisposeDate] = useState(getTodayTL());
  const [disposeProceeds, setDisposeProceeds] = useState("0");
  const [deleteAsset, setDeleteAsset] = useState<FixedAsset | null>(null);
  const [showPost, setShowPost] = useState(false);
  const [postPeriod, setPostPeriod] = useState(periodOf(getTodayTL()));
  // Desktop Firefox/Safari render type="month" as free text and ignore `max`,
  // so the value must be validated here as well as in the service.
  const postPeriodValid =
    /^\d{4}-(0[1-9]|1[0-2])$/.test(postPeriod) &&
    postPeriod <= periodOf(getTodayTL());
  // Every class except land must depreciate; a 0-life asset would sit active
  // forever with no charge and no error anywhere.
  const lifeInvalid =
    form.assetClass !== "land" && !(Number(form.usefulLifeMonths) > 0);
  const [posting, setPosting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const reload = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      setAssets(await fixedAssetService.list(tenantId));
    } catch (error) {
      console.error("Failed to load fixed assets:", error);
      toast({
        title: t("common.error"),
        description: t("accounting.fixedAssets.loadError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totals = useMemo(() => {
    const live = assets.filter((a) => a.status !== "disposed");
    return {
      count: live.length,
      cost: round2(live.reduce((s, a) => s + a.acquisitionCost, 0)),
      accumulated: round2(
        live.reduce((s, a) => s + (a.accumulatedDepreciation || 0), 0),
      ),
      nbv: round2(
        live.reduce(
          (s, a) => s + a.acquisitionCost - (a.accumulatedDepreciation || 0),
          0,
        ),
      ),
    };
  }, [assets]);

  const postPreview = useMemo(
    () => fixedAssetService.previewPeriod(assets, postPeriod),
    [assets, postPeriod],
  );
  const postTotal = round2(postPreview.reduce((s, l) => s + l.charge, 0));

  const classLife = (key: string) =>
    ASSET_CLASSES.find((c) => c.key === key)?.defaultLifeMonths ?? 60;

  const handleClassChange = (key: string) => {
    setForm((f) => ({
      ...f,
      assetClass: key,
      usefulLifeMonths: String(classLife(key)),
    }));
  };

  const handleSave = async () => {
    if (!tenantId) return;
    const cls = ASSET_CLASSES.find((c) => c.key === form.assetClass);
    if (!cls) return;
    setSaving(true);
    try {
      await fixedAssetService.create(tenantId, {
        name: form.name.trim(),
        assetClass: form.assetClass,
        reference: form.reference.trim() || undefined,
        acquisitionDate: form.acquisitionDate,
        acquisitionCost: Number(form.acquisitionCost) || 0,
        residualValue: Number(form.residualValue) || 0,
        usefulLifeMonths: Number(form.usefulLifeMonths) || 0,
        method: "straight_line",
        assetAccountCode: cls.accountCode,
        accumulatedAccountCode: ACCUMULATED_DEPRECIATION_CODE,
        expenseAccountCode: DEPRECIATION_EXPENSE_CODE,
        depreciationStartPeriod: periodOf(form.acquisitionDate),
        createdBy: user?.email || user?.uid || "unknown",
      });
      toast({
        title: t("accounting.fixedAssets.createdTitle"),
        description: form.name,
      });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      await reload();
    } catch (error) {
      console.error("Failed to save asset:", error);
      toast({
        title: t("common.error"),
        description:
          error instanceof Error
            ? error.message
            : t("accounting.fixedAssets.saveError"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    if (!tenantId) return;
    setPosting(true);
    try {
      const result = await fixedAssetService.postDepreciationForPeriod(
        tenantId,
        postPeriod,
        user?.email || user?.uid || "unknown",
      );
      toast({
        title: t("accounting.fixedAssets.postedTitle"),
        description: t("accounting.fixedAssets.postedDescription", {
          period: postPeriod,
          amount: formatCurrencyTL(result.totalAmount),
        }),
      });
      setShowPost(false);
      await reload();
      // Depreciation posts a GL journal — refresh the ledger/trial-balance/
      // dashboard caches or they show stale balances until a hard reload.
      await invalidateAccounting();
    } catch (error) {
      console.error("Failed to post depreciation:", error);
      toast({
        title: t("common.error"),
        description:
          error instanceof Error
            ? error.message
            : t("accounting.fixedAssets.saveError"),
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  const handleDispose = async () => {
    if (!tenantId || !disposeAsset) return;
    setSaving(true);
    try {
      const result = await fixedAssetService.dispose(
        tenantId,
        disposeAsset,
        { date: disposeDate, proceeds: Number(disposeProceeds) || 0 },
        user?.email || user?.uid || "unknown",
      );
      toast({
        title: t("accounting.fixedAssets.disposedTitle"),
        description: t(
          result.gainOrLoss >= 0
            ? "accounting.fixedAssets.disposedGain"
            : "accounting.fixedAssets.disposedLoss",
          { amount: formatCurrencyTL(Math.abs(result.gainOrLoss)) },
        ),
      });
      setDisposeAsset(null);
      await reload();
      // Disposal posts a GL journal (removal + gain/loss) — refresh accounting.
      await invalidateAccounting();
    } catch (error) {
      console.error("Failed to dispose asset:", error);
      toast({
        title: t("common.error"),
        description: t("accounting.fixedAssets.saveError"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!tenantId || !deleteAsset) return;
    try {
      await fixedAssetService.remove(tenantId, deleteAsset);
      toast({ title: t("accounting.fixedAssets.deletedTitle") });
      setDeleteAsset(null);
      await reload();
    } catch (error) {
      console.error("Failed to delete asset:", error);
      toast({
        title: t("common.error"),
        description:
          error instanceof Error
            ? error.message
            : t("accounting.fixedAssets.saveError"),
        variant: "destructive",
      });
    }
  };

  const handleExport = async () => {
    if (!tenantId || !assets.length) return;
    setExporting(true);
    try {
      const { exportFixedAssetRegister } = await import(
        "@/lib/accounting/fixedAssetExport"
      );
      await exportFixedAssetRegister(assets, {
        companyName: session?.config?.legalName || session?.config?.name || "",
        asOf: getTodayTL(),
        // Localize the enum-ish cells (class, status) — the register must not
        // leak raw database keys like "furniture" into a user-facing document.
        labels: {
          classLabels: Object.fromEntries(
            ASSET_CLASSES.map((cls) => [
              cls.key,
              t(`accounting.fixedAssets.classes.${cls.key}`),
            ]),
          ),
          statusActive: t("accounting.fixedAssets.statusActive"),
          statusFullyDepreciated: t("accounting.fixedAssets.statusFully"),
          statusDisposed: t("accounting.fixedAssets.statusDisposed"),
        },
      });
    } catch (error) {
      console.error("Failed to export register:", error);
      toast({
        title: t("common.error"),
        description: t("accounting.fixedAssets.exportError"),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const statusBadge = (asset: FixedAsset) => {
    if (asset.status === "disposed")
      return (
        <Badge variant="secondary">
          {t("accounting.fixedAssets.statusDisposed")}
        </Badge>
      );
    if (asset.status === "fully_depreciated")
      return (
        <Badge variant="outline">
          {t("accounting.fixedAssets.statusFully")}
        </Badge>
      );
    return (
      <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
        {t("accounting.fixedAssets.statusActive")}
      </Badge>
    );
  };

  // Raw label used for the "Status" column sort (mirrors statusBadge's text)
  const getAssetStatusLabel = (asset: FixedAsset) => {
    if (asset.status === "disposed") return t("accounting.fixedAssets.statusDisposed");
    if (asset.status === "fully_depreciated") return t("accounting.fixedAssets.statusFully");
    return t("accounting.fixedAssets.statusActive");
  };

  // Column sorting (asc → desc → off)
  const { sorted: sortedAssets, sort, toggleSort } = useTableSort<FixedAsset, FixedAssetSortKey>(
    assets,
    {
      name: (a) => a.name,
      class: (a) => t(`accounting.fixedAssets.classes.${a.assetClass}`),
      acquired: (a) => a.acquisitionDate,
      cost: (a) => a.acquisitionCost,
      accumulated: (a) => a.accumulatedDepreciation || 0,
      nbv: (a) => round2(a.acquisitionCost - (a.accumulatedDepreciation || 0)),
      status: (a) => getAssetStatusLabel(a),
    },
  );

  // Renders a sortable shadcn <TableHead> wired to the sort state above
  const sortableHead = (key: FixedAssetSortKey, label: string, align: "left" | "right" = "left") => {
    const active = sort?.key === key;
    return (
      <TableHead
        aria-sort={active ? (sort!.direction === "asc" ? "ascending" : "descending") : "none"}
        className={align === "right" ? "text-right" : undefined}
      >
        <SortableColumnHeader
          label={label}
          active={active}
          direction={active ? sort!.direction : "asc"}
          onSort={() => toggleSort(key)}
          align={align}
        />
      </TableHead>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.fixedAssets} />
      <MainNavigation />
      <div className="p-6 mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("accounting.fixedAssets.title")}
          subtitle={t("accounting.fixedAssets.subtitle")}
          icon={Package}
          iconColor="text-orange-500"
          actions={
            canManageTenant ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleExport()}
                  disabled={exporting || !assets.length}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t("accounting.fixedAssets.export")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPost(true)}
                  disabled={!assets.some((a) => a.status === "active")}
                >
                  <CalendarCheck className="h-4 w-4 mr-2" />
                  {t("accounting.fixedAssets.postDepreciation")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setShowAdd(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("accounting.fixedAssets.addAsset")}
                </Button>
              </div>
            ) : undefined
          }
        />

        {loading ? (
          <Card className="border-border/70 shadow-sm">
            <CardContent className="pt-6">
              <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="space-y-2.5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-4"
                  >
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-7 w-28 rounded-md" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/70 shadow-sm">
            <CardContent className="pt-6">
              <div className="mb-4 flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted-foreground">
                <span>
                  {t("accounting.fixedAssets.summaryCount", {
                    count: String(totals.count),
                  })}
                </span>
                <span>
                  {t("accounting.fixedAssets.summaryCost")}:{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrencyTL(totals.cost)}
                  </span>
                </span>
                <span>
                  {t("accounting.fixedAssets.summaryAccumulated")}:{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrencyTL(totals.accumulated)}
                  </span>
                </span>
                <span>
                  {t("accounting.fixedAssets.summaryNbv")}:{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrencyTL(totals.nbv)}
                  </span>
                </span>
              </div>

              {assets.length === 0 ? (
                <div className="rounded-lg border border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
                  {t("accounting.fixedAssets.empty")}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {sortableHead("name", t("accounting.fixedAssets.colAsset"))}
                        {sortableHead("class", t("accounting.fixedAssets.colClass"))}
                        {sortableHead("acquired", t("accounting.fixedAssets.colAcquired"))}
                        {sortableHead("cost", t("accounting.fixedAssets.colCost"), "right")}
                        {sortableHead("accumulated", t("accounting.fixedAssets.colAccumulated"), "right")}
                        {sortableHead("nbv", t("accounting.fixedAssets.colNbv"), "right")}
                        {sortableHead("status", t("accounting.fixedAssets.colStatus"))}
                        <TableHead className="text-right">
                          {t("accounting.fixedAssets.colActions")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAssets.map((asset) => (
                        <TableRow key={asset.id}>
                          <TableCell>
                            <div className="font-medium">{asset.name}</div>
                            {asset.reference && (
                              <div className="text-xs text-muted-foreground">
                                {asset.reference}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {t(
                              `accounting.fixedAssets.classes.${asset.assetClass}`,
                            )}
                          </TableCell>
                          <TableCell>
                            {formatDateTL(asset.acquisitionDate)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {formatCurrencyTL(asset.acquisitionCost)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {formatCurrencyTL(
                              asset.accumulatedDepreciation || 0,
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {formatCurrencyTL(
                              round2(
                                asset.acquisitionCost -
                                  (asset.accumulatedDepreciation || 0),
                              ),
                            )}
                          </TableCell>
                          <TableCell>{statusBadge(asset)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setScheduleAsset(asset)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                {t("accounting.fixedAssets.schedule")}
                              </Button>
                              {canManageTenant &&
                                asset.status !== "disposed" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      setDisposeAsset(asset);
                                      setDisposeDate(getTodayTL());
                                      setDisposeProceeds("0");
                                    }}
                                  >
                                    {t("accounting.fixedAssets.dispose")}
                                  </Button>
                                )}
                              {canManageTenant &&
                                asset.status === "active" &&
                                !(asset.accumulatedDepreciation > 0) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-destructive"
                                    onClick={() => setDeleteAsset(asset)}
                                  >
                                    {t("common.delete")}
                                  </Button>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add asset */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("accounting.fixedAssets.addAsset")}</DialogTitle>
            <DialogDescription>
              {t("accounting.fixedAssets.addDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="fa-name">
                {t("accounting.fixedAssets.fieldName")}
              </Label>
              <Input
                id="fa-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("accounting.fixedAssets.colClass")}</Label>
                <Select
                  value={form.assetClass}
                  onValueChange={handleClassChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CLASSES.map((cls) => (
                      <SelectItem key={cls.key} value={cls.key}>
                        {t(`accounting.fixedAssets.classes.${cls.key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="fa-ref">
                  {t("accounting.fixedAssets.fieldReference")}
                </Label>
                <Input
                  id="fa-ref"
                  value={form.reference}
                  onChange={(e) =>
                    setForm({ ...form, reference: e.target.value })
                  }
                  placeholder={t("common.optional")}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="fa-date">
                  {t("accounting.fixedAssets.fieldAcquired")}
                </Label>
                <Input
                  id="fa-date"
                  type="date"
                  value={form.acquisitionDate}
                  onChange={(e) =>
                    setForm({ ...form, acquisitionDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="fa-cost">
                  {t("accounting.fixedAssets.fieldCost")}
                </Label>
                <Input
                  id="fa-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.acquisitionCost}
                  onChange={(e) =>
                    setForm({ ...form, acquisitionCost: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="fa-residual">
                  {t("accounting.fixedAssets.fieldResidual")}
                </Label>
                <Input
                  id="fa-residual"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.residualValue}
                  onChange={(e) =>
                    setForm({ ...form, residualValue: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="fa-life">
                  {t("accounting.fixedAssets.fieldLife")}
                </Label>
                <Input
                  id="fa-life"
                  type="number"
                  min="0"
                  value={form.usefulLifeMonths}
                  onChange={(e) =>
                    setForm({ ...form, usefulLifeMonths: e.target.value })
                  }
                />
                {lifeInvalid ? (
                  <p className="mt-1 text-xs text-destructive">
                    {t("accounting.fixedAssets.lifeRequired")}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("accounting.fixedAssets.fieldLifeHint")}
                  </p>
                )}
              </div>
            </div>
            {Number(form.acquisitionCost) > 0 &&
              Number(form.usefulLifeMonths) > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("accounting.fixedAssets.monthlyPreview", {
                    amount: formatCurrencyTL(
                      monthlyCharge({
                        acquisitionCost: Number(form.acquisitionCost) || 0,
                        residualValue: Number(form.residualValue) || 0,
                        usefulLifeMonths: Number(form.usefulLifeMonths) || 0,
                      }),
                    ),
                  })}
                </p>
              )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={
                saving ||
                !form.name.trim() ||
                !(Number(form.acquisitionCost) > 0) ||
                lifeInvalid
              }
            >
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post depreciation */}
      <Dialog open={showPost} onOpenChange={setShowPost}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("accounting.fixedAssets.postDepreciation")}
            </DialogTitle>
            <DialogDescription>
              {t("accounting.fixedAssets.postDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="fa-period">
                {t("accounting.fixedAssets.fieldPeriod")}
              </Label>
              <Input
                id="fa-period"
                type="month"
                max={periodOf(getTodayTL())}
                value={postPeriod}
                onChange={(e) => setPostPeriod(e.target.value)}
                className="w-44"
              />
              {!postPeriodValid && (
                <p className="mt-1 text-xs text-destructive">
                  {t("accounting.fixedAssets.invalidPeriod")}
                </p>
              )}
            </div>
            {postPreview.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("accounting.fixedAssets.postNothing")}
              </p>
            ) : (
              <div className="rounded-lg border border-border/70">
                {postPreview.map(({ asset, charge }) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between border-b border-border/50 px-3 py-2 text-sm last:border-b-0"
                  >
                    <span className="truncate">{asset.name}</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrencyTL(charge)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 text-sm font-semibold">
                  <span>{t("accounting.fixedAssets.rowTotal")}</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrencyTL(postTotal)}
                  </span>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {t("accounting.fixedAssets.postHint")}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowPost(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => void handlePost()}
              disabled={posting || postPreview.length === 0 || !postPeriodValid}
            >
              {posting
                ? t("common.saving")
                : t("accounting.fixedAssets.postConfirm", {
                    amount: formatCurrencyTL(postTotal),
                  })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule viewer */}
      <Dialog
        open={!!scheduleAsset}
        onOpenChange={(o) => !o && setScheduleAsset(null)}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{scheduleAsset?.name}</DialogTitle>
            <DialogDescription>
              {t("accounting.fixedAssets.scheduleDescription", {
                life: String(scheduleAsset?.usefulLifeMonths || 0),
              })}
            </DialogDescription>
          </DialogHeader>
          {scheduleAsset && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("accounting.fixedAssets.colPeriod")}</TableHead>
                  <TableHead className="text-right">
                    {t("accounting.fixedAssets.colCharge")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("accounting.fixedAssets.colAccumulated")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("accounting.fixedAssets.colNbv")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buildSchedule(scheduleAsset).map((row) => (
                  <TableRow
                    key={row.period}
                    className={
                      scheduleAsset.depreciatedThroughPeriod &&
                      row.period <= scheduleAsset.depreciatedThroughPeriod
                        ? "text-muted-foreground"
                        : undefined
                    }
                  >
                    <TableCell className="font-mono tabular-nums">
                      {row.period}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrencyTL(row.charge)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrencyTL(row.accumulated)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrencyTL(row.netBookValue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Dispose */}
      <Dialog
        open={!!disposeAsset}
        onOpenChange={(o) => !o && setDisposeAsset(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("accounting.fixedAssets.disposeTitle", {
                name: disposeAsset?.name || "",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("accounting.fixedAssets.disposeDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="fa-dispose-date">
                  {t("accounting.fixedAssets.fieldDisposeDate")}
                </Label>
                <Input
                  id="fa-dispose-date"
                  type="date"
                  value={disposeDate}
                  onChange={(e) => setDisposeDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="fa-proceeds">
                  {t("accounting.fixedAssets.fieldProceeds")}
                </Label>
                <Input
                  id="fa-proceeds"
                  type="number"
                  min="0"
                  step="0.01"
                  value={disposeProceeds}
                  onChange={(e) => setDisposeProceeds(e.target.value)}
                />
              </div>
            </div>
            {disposeAsset && (
              <p className="text-sm text-muted-foreground">
                {(() => {
                  const r = disposalResult(
                    disposeAsset,
                    Number(disposeProceeds) || 0,
                  );
                  return t(
                    r.gainOrLoss >= 0
                      ? "accounting.fixedAssets.disposePreviewGain"
                      : "accounting.fixedAssets.disposePreviewLoss",
                    {
                      nbv: formatCurrencyTL(r.netBookValue),
                      amount: formatCurrencyTL(Math.abs(r.gainOrLoss)),
                    },
                  );
                })()}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDisposeAsset(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void handleDispose()} disabled={saving}>
              {saving
                ? t("common.saving")
                : t("accounting.fixedAssets.disposeConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete (never-depreciated only) */}
      <AlertDialog
        open={!!deleteAsset}
        onOpenChange={(o) => !o && setDeleteAsset(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("accounting.fixedAssets.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("accounting.fixedAssets.deleteDescription", {
                name: deleteAsset?.name || "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
