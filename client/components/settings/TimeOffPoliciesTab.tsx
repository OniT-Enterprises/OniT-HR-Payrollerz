import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ComponentType,
  type ReactNode,
} from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Calendar,
  Clock,
  Users,
  Percent,
  AlertCircle,
  Save,
  Loader2,
  Trash2,
  Heart,
  GraduationCap,
  Plus,
  ChevronDown,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import MoreDetailsSection from "@/components/MoreDetailsSection";
import { PRESSABLE } from "@/lib/pressable";

import { useToast } from "@/hooks/use-toast";
import { settingsService } from "@/services/settingsService";
import { holidayService, type HolidayOverride } from "@/services/holidayService";
import { getTLPublicHolidays } from "@/lib/payroll/tl-holidays";
import { formatDateTL, parseDateISO } from "@/lib/dateUtils";

import { DatePicker } from "@/components/ui/date-picker";
import { useI18n } from "@/i18n/I18nProvider";
import type {
  LeaveTypeConfig,
  SettingsTabProps,
  TimeOffPolicies,
} from "./types";
import {
  holidayOverrideFormSchema,
  type HolidayOverrideFormData,
} from "./types";

interface TimeOffPoliciesTabProps extends SettingsTabProps {
  initialTimeOff: TimeOffPolicies;
  initialHolidayOverrides: HolidayOverride[];
  userId: string | undefined;
}

function isInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function leaveSliceIsValid(leave: LeaveTypeConfig): boolean {
  return (
    isInRange(leave.daysPerYear, 0, 366) &&
    isInRange(leave.paidPercentage, 0, 100) &&
    (leave.maxCarryOverDays === undefined ||
      isInRange(leave.maxCarryOverDays, 0, 366))
  );
}

/** Art. 32 floor — the one number on this page the law puts a minimum under. */
const ANNUAL_LEAVE_MINIMUM_DAYS = 12;

// ── Small presentational helpers ────────────────────────────────────

/**
 * One collapsible topic row.
 *
 * Depth 1 (always visible) answers the row's question with the tenant's real
 * numbers; depth 2 holds the controls. Two deliberate departures from
 * MoreDetailsSection, both load-bearing:
 *
 *  1. The summary line stays visible when the row is open — the answer must
 *     not vanish the moment you go to edit it.
 *  2. The body is `hidden`, NOT a Radix CollapsibleContent. Radix unmounts its
 *     content, and the holiday override form below is a live react-hook-form
 *     populated by the per-day Override buttons: unmounting would discard a
 *     half-typed override. `hidden` keeps it mounted, keeps it out of the tab
 *     order, and animates nothing (so no prefers-reduced-motion exposure).
 */
function PolicyRow({
  id,
  icon: Icon,
  iconClass,
  title,
  summary,
  badges,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  summary: string;
  badges?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left hover:bg-muted/40 ${PRESSABLE}`}
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-medium">{title}</p>
            {badges}
          </div>
          <p className="text-xs text-muted-foreground">{summary}</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        id={`${id}-panel`}
        hidden={!open}
        className="space-y-4 border-t border-border/70 px-4 py-4"
      >
        {children}
      </div>
    </div>
  );
}

/** Amber = a state the tenant caused, or a risk they need to see. */
function AmberNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 space-y-2">{children}</div>
    </div>
  );
}

/**
 * The statutory text for a row, shown INLINE at the bottom of its body.
 *
 * It used to sit behind a second `MoreDetailsSection`. That was one tap too
 * many: the row itself is already the disclosure, so anyone reading this has
 * chosen to look at the topic — and burying the article number behind another
 * collapse made the law read as optional fine print, which is exactly backwards
 * for a compliance product. Kept visually subordinate with the house eyebrow,
 * not hidden.
 */
function LawNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5 border-t border-border/60 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

export function TimeOffPoliciesTab({
  tenantId,
  saving,
  setSaving,
  onReload,
  t,
  initialTimeOff,
  initialHolidayOverrides,
  userId,
}: TimeOffPoliciesTabProps) {
  const { toast } = useToast();
  const { locale } = useI18n();

  // Local state for time-off policies
  const [timeOffPolicies, setTimeOffPolicies] =
    useState<TimeOffPolicies>(initialTimeOff);

  // One row open at a time. On a phone that keeps the scroll predictable, and
  // it incidentally means the six identical INSS/parental-pay paragraphs can
  // never be on screen together — without deleting a word of any of them.
  const [openRow, setOpenRow] = useState<string | null>(null);
  const toggleRow = useCallback(
    (id: string) => setOpenRow((current) => (current === id ? null : id)),
    [],
  );

  // Sync local state when parent reloads — but NEVER over unsaved edits.
  //
  // `initialTimeOff` is a fresh object on every settings refetch (React Query,
  // staleTime 5 min), so plainly re-applying it silently threw away whatever
  // the user was half-way through changing. Same snapshot-comparison guard as
  // CompanyDetailsTab: compare the VALUES, not the object identity.
  //
  // `appliedTimeOffSnapshot` = the server payload local state currently
  // reflects; local state that no longer matches it means unsaved edits.
  // `seenTimeOffSnapshot` = the last payload we looked at, applied or not, so
  // a repeat refetch of the SAME values does not keep retrying the overwrite.
  const appliedTimeOffSnapshot = useRef<string>(JSON.stringify(initialTimeOff));
  const seenTimeOffSnapshot = useRef<string>(JSON.stringify(initialTimeOff));
  const hasUnsavedTimeOffEdits =
    JSON.stringify(timeOffPolicies) !== appliedTimeOffSnapshot.current;

  useEffect(() => {
    const snapshot = JSON.stringify(initialTimeOff);
    if (seenTimeOffSnapshot.current === snapshot) return;
    seenTimeOffSnapshot.current = snapshot;
    if (hasUnsavedTimeOffEdits) return;
    appliedTimeOffSnapshot.current = snapshot;
    setTimeOffPolicies(initialTimeOff);
  }, [initialTimeOff, hasUnsavedTimeOffEdits]);

  // The saved baseline, so each row can show its own "Not saved yet" chip.
  // Re-parsed whenever local state moves; the ref itself only changes on save
  // or on an applied refetch.
  const savedTimeOff = useMemo<TimeOffPolicies>(() => {
    try {
      return JSON.parse(appliedTimeOffSnapshot.current) as TimeOffPolicies;
    } catch {
      return initialTimeOff;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTimeOff, timeOffPolicies]);

  const sliceIsDirty = useCallback(
    (pick: (policies: TimeOffPolicies) => unknown) =>
      JSON.stringify(pick(timeOffPolicies)) !== JSON.stringify(pick(savedTimeOff)),
    [timeOffPolicies, savedTimeOff],
  );

  // ── Validity, per row ─────────────────────────────────────────────
  // Kept per-row so a failed save can open the offending row and put the
  // message beside the field, instead of one anonymous line at the bottom of
  // the page. The Save button stays ENABLED: hard-disabling would lock a
  // tenant carrying legacy out-of-range data out of saving anything at all.
  const invalidRows = useMemo(() => {
    const checks: Array<[string, boolean]> = [
      [
        "annual",
        leaveSliceIsValid(timeOffPolicies.annualLeave) &&
          isInRange(timeOffPolicies.maxCarryOverDays, 0, 366),
      ],
      [
        "probation",
        isInRange(timeOffPolicies.probationMonthsBeforeLeave, 0, 12),
      ],
      ["sick", leaveSliceIsValid(timeOffPolicies.sickLeave)],
      ["maternity", leaveSliceIsValid(timeOffPolicies.maternityLeave)],
      ["paternity", leaveSliceIsValid(timeOffPolicies.paternityLeave)],
      ["miscarriage", leaveSliceIsValid(timeOffPolicies.miscarriageLeave)],
      ["special", leaveSliceIsValid(timeOffPolicies.specialLeave)],
      ["study", leaveSliceIsValid(timeOffPolicies.studyLeave)],
      ["unpaid", leaveSliceIsValid(timeOffPolicies.unpaidLeave)],
      ["custom", timeOffPolicies.customLeaveTypes.every(leaveSliceIsValid)],
    ];
    return new Set(checks.filter(([, ok]) => !ok).map(([id]) => id));
  }, [timeOffPolicies]);

  const policiesAreValid = invalidRows.size === 0;

  /** The invalid-value message, shown inside the row that owns the problem. */
  const invalidNote = (rowId: string) =>
    invalidRows.has(rowId) ? (
      <p role="alert" className="text-sm text-destructive">
        {t("settings.timeOff.invalidValues")}
      </p>
    ) : null;

  const notSavedBadge = (dirty: boolean) =>
    dirty ? (
      <Badge variant="secondary">{t("settings.timeOff.notSavedYet")}</Badge>
    ) : null;

  /** Same markup as StatutoryRatesCard's pending marker, same key. */
  const pendingBadge = (
    <Badge
      variant="outline"
      className="border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
    >
      {t("settings.payroll.statutory.pending")}
    </Badge>
  );

  // ── Custom leave types ────────────────────────────────────────────
  // Ids the server treats as built-in (functions createLeaveRequest whitelist
  // + legacy render-only types) — a custom type must not shadow them.
  const RESERVED_LEAVE_TYPE_IDS = new Set([
    "annual",
    "sick",
    "maternity",
    "paternity",
    "miscarriage",
    "special",
    "unpaid",
    "study",
    "custom",
    "bereavement",
    "marriage",
  ]);
  const emptyCustomType = {
    name: "",
    code: "",
    daysPerYear: 0,
    paidPercentage: 100,
    requiresCertificate: false,
  };
  const [newCustomType, setNewCustomType] = useState(emptyCustomType);
  // Same id charset the server enforces (createLeaveRequest rejects anything
  // outside /^[a-zA-Z0-9_-]+$/).
  const customTypeId = newCustomType.code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const customIdTaken =
    RESERVED_LEAVE_TYPE_IDS.has(customTypeId) ||
    timeOffPolicies.customLeaveTypes.some((ct) => ct.id === customTypeId);
  const canAddCustomType =
    newCustomType.name.trim().length > 0 &&
    customTypeId.length > 0 &&
    !customIdTaken &&
    isInRange(newCustomType.daysPerYear, 0, 366) &&
    isInRange(newCustomType.paidPercentage, 0, 100);

  const addCustomType = () => {
    if (!canAddCustomType) return;
    const custom: LeaveTypeConfig = {
      id: customTypeId,
      name: newCustomType.name.trim(),
      code: newCustomType.code.trim().toUpperCase(),
      daysPerYear: newCustomType.daysPerYear,
      isPaid: newCustomType.paidPercentage > 0,
      paidPercentage: newCustomType.paidPercentage,
      requiresCertificate: newCustomType.requiresCertificate,
      carryOverAllowed: false,
      isActive: true,
    };
    setTimeOffPolicies({
      ...timeOffPolicies,
      customLeaveTypes: [...timeOffPolicies.customLeaveTypes, custom],
    });
    setNewCustomType(emptyCustomType);
  };

  const updateCustomType = (
    index: number,
    patch: Partial<LeaveTypeConfig>,
  ) => {
    setTimeOffPolicies({
      ...timeOffPolicies,
      customLeaveTypes: timeOffPolicies.customLeaveTypes.map((ct, i) =>
        i === index ? { ...ct, ...patch } : ct,
      ),
    });
  };

  // Holiday overrides (tenant-scoped)
  const [holidayYear, setHolidayYear] = useState<number>(
    new Date().getFullYear()
  );
  const [holidayOverridesLoading, setHolidayOverridesLoading] = useState(false);
  const [holidayOverrides, setHolidayOverrides] = useState<HolidayOverride[]>(
    initialHolidayOverrides
  );
  const [holidayOverrideSaving, setHolidayOverrideSaving] = useState(false);

  // Holiday Override form (react-hook-form)
  const holidayOverrideForm = useForm<HolidayOverrideFormData>({
    resolver: zodResolver(holidayOverrideFormSchema),
    defaultValues: {
      date: "",
      name: "",
      nameTetun: "",
      isHoliday: true,
      notes: "",
    },
    mode: "onChange",
  });
  const holidayFormValues = holidayOverrideForm.watch();

  // Load holiday overrides when tenantId or year changes
  const loadHolidayOverrides = useCallback(async () => {
    if (!tenantId) return;
    try {
      setHolidayOverridesLoading(true);
      const overrides = await holidayService.listTenantHolidayOverrides(
        tenantId,
        holidayYear
      );
      setHolidayOverrides(overrides);
    } catch (error) {
      console.error("Error loading holiday overrides:", error);
      toast({
        title: t("settings.notifications.errorTitle"),
        description: t("settings.notifications.holidayLoadFailed"),
        variant: "destructive",
      });
    } finally {
      setHolidayOverridesLoading(false);
    }
  }, [tenantId, holidayYear, toast, t]);

  useEffect(() => {
    loadHolidayOverrides();
  }, [loadHolidayOverrides]);

  const holidayOverrideByDate = useMemo(() => {
    const map = new Map<string, HolidayOverride>();
    holidayOverrides.forEach((o) => map.set(o.date, o));
    return map;
  }, [holidayOverrides]);

  const mergedHolidays = useMemo(() => {
    const base = getTLPublicHolidays(holidayYear);
    const map = new Map<
      string,
      {
        date: string;
        name: string;
        nameTetun?: string;
        namePt?: string;
        source: "built_in" | "override";
      }
    >();

    base.forEach((h) => {
      map.set(h.date, {
        date: h.date,
        name: h.name,
        nameTetun: h.nameTetun,
        namePt: h.namePt,
        source: "built_in",
      });
    });

    holidayOverrides.forEach((o) => {
      if (!o.date?.startsWith(`${holidayYear}-`)) return;
      if (o.isHoliday === false) {
        map.delete(o.date);
        return;
      }
      map.set(o.date, {
        date: o.date,
        name: o.name || t("settings.notifications.holidayName"),
        nameTetun: o.nameTetun || "",
        namePt: "",
        source: "override",
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [holidayYear, holidayOverrides, t]);

  /** Every override stored for the shown year — what "You changed N" counts. */
  const overridesThisYear = useMemo(
    () =>
      holidayOverrides.filter((o) => o.date?.startsWith(`${holidayYear}-`)),
    [holidayOverrides, holidayYear]
  );

  // ONLY the overrides that turn a public holiday into a working day.
  //
  // Those are the ones mergedHolidays deletes (map.delete when isHoliday is
  // false), so their row vanishes together with the only control that could
  // undo it — and payroll quietly loses a statutory holiday. Every other
  // override still appears in the merged list with its own Override badge and
  // Remove button, so listing them here too would just duplicate rows on an
  // already long page.
  const changedHolidayDays = useMemo(
    () =>
      overridesThisYear
        .filter((o) => o.isHoliday === false)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [overridesThisYear]
  );

  const onSaveHolidayOverride = useCallback(
    async (data: HolidayOverrideFormData) => {
      if (!tenantId) return;

      try {
        setHolidayOverrideSaving(true);
        await holidayService.upsertTenantHolidayOverride(
          tenantId,
          {
            date: data.date,
            name: data.name?.trim() || "",
            nameTetun: data.nameTetun?.trim() || "",
            isHoliday: data.isHoliday,
            notes: data.notes?.trim() || "",
          },
          userId
        );

        // Keep the list year in sync with the saved date
        const savedYear = parseInt(data.date.slice(0, 4), 10);
        if (!Number.isNaN(savedYear) && savedYear !== holidayYear) {
          setHolidayYear(savedYear);
        } else {
          await loadHolidayOverrides();
        }

        // Reset form
        holidayOverrideForm.reset({
          date: "",
          name: "",
          nameTetun: "",
          isHoliday: true,
          notes: "",
        });

        toast({
          title: t("settings.notifications.savedTitle"),
          description: t("settings.notifications.holidaySaved"),
        });
      } catch (error) {
        console.error("Error saving holiday override:", error);
        toast({
          title: t("settings.notifications.errorTitle"),
          description: t("settings.notifications.holidaySaveFailed"),
          variant: "destructive",
        });
      } finally {
        setHolidayOverrideSaving(false);
      }
    },
    [tenantId, userId, holidayYear, holidayOverrideForm, toast, t, loadHolidayOverrides]
  );

  const removeHolidayOverride = async (date: string) => {
    if (!tenantId) return;
    try {
      await holidayService.deleteTenantHolidayOverride(tenantId, date);
      await loadHolidayOverrides();
      toast({
        title: t("settings.notifications.savedTitle"),
        description: t("settings.notifications.holidayRemoved"),
      });
    } catch (error) {
      console.error("Error removing holiday override:", error);
      toast({
        title: t("settings.notifications.errorTitle"),
        description: t("settings.notifications.holidayRemoveFailed"),
        variant: "destructive",
      });
    }
  };

  const saveTimeOffPolicies = async () => {
    if (!tenantId) return;
    if (!policiesAreValid) {
      // Open the row that owns the bad value so the message is beside the field.
      const firstInvalid = [
        "annual",
        "probation",
        "sick",
        "maternity",
        "paternity",
        "miscarriage",
        "special",
        "study",
        "unpaid",
        "custom",
      ].find((id) => invalidRows.has(id));
      if (firstInvalid) setOpenRow(firstInvalid);
      toast({
        title: t("settings.notifications.errorTitle"),
        description: t("settings.timeOff.invalidValues"),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await settingsService.updateTimeOffPolicies(tenantId, timeOffPolicies);
      // What is on screen is now what is on the server: nothing is unsaved any
      // more, so the reload below (and any later refetch) may apply freely.
      appliedTimeOffSnapshot.current = JSON.stringify(timeOffPolicies);
      toast({
        title: t("settings.notifications.savedTitle"),
        description: t("settings.notifications.timeOffSaved"),
      });
      onReload();
    } catch {
      toast({
        title: t("settings.notifications.errorTitle"),
        description: t("settings.notifications.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Derived summary lines (depth 1) ───────────────────────────────

  const annual = timeOffPolicies.annualLeave;
  const annualCarry = annual.maxCarryOverDays || 0;
  const annualSummary = annual.carryOverAllowed
    ? t("settings.timeOff.rows.annual.summaryCarry", {
        days: annual.daysPerYear,
        carry: annualCarry,
      })
    : t("settings.timeOff.rows.annual.summaryNoCarry", {
        days: annual.daysPerYear,
      });

  const holidaySummary =
    overridesThisYear.length === 0
      ? t("settings.timeOff.rows.holidays.summaryNone", {
          count: mergedHolidays.length,
          year: holidayYear,
        })
      : t("settings.timeOff.rows.holidays.summaryChanged", {
          count: mergedHolidays.length,
          year: holidayYear,
          changed: overridesThisYear.length,
        });

  const customSummary =
    timeOffPolicies.customLeaveTypes.length === 0
      ? t("settings.timeOff.rows.custom.summaryNone")
      : timeOffPolicies.customLeaveTypes
          .map((ct) =>
            ct.isActive
              ? ct.name
              : t("settings.timeOff.rows.custom.turnedOff", { name: ct.name })
          )
          .join(", ");

  const probationSummary =
    timeOffPolicies.probationMonthsBeforeLeave > 0
      ? t("settings.timeOff.rows.probation.summary", {
          months: timeOffPolicies.probationMonthsBeforeLeave,
        })
      : t("settings.timeOff.rows.probation.summaryNone");

  /**
   * What payroll will actually pay for a leave type. `leavePayFraction` needs
   * `isPaid === true`, so a stored 100% with isPaid false pays nothing — the
   * read-only lines must show 0%, not 100%, or they would lie about the money.
   */
  const effectivePaidPercent = (leave: LeaveTypeConfig) =>
    leave.isPaid ? leave.paidPercentage : 0;

  /**
   * Parental summary. When the tenant has configured employer-paid parental
   * leave the line CHANGES and the row grows an amber marker — a risk the
   * tenant configured is never one tap away.
   */
  const parentalSummary = (
    key: "maternity" | "paternity" | "miscarriage",
    leave: LeaveTypeConfig,
  ) => {
    const percent = effectivePaidPercent(leave);
    return percent > 0
      ? t(`settings.timeOff.rows.${key}.summaryPaid`, {
          days: leave.daysPerYear,
          percent,
        })
      : t(`settings.timeOff.rows.${key}.summary`, { days: leave.daysPerYear });
  };

  /**
   * Art. 33(3) and Art. 76(3) days are paid in full by law. The control is
   * gone, but a tenant may already have a lower value stored — so show what is
   * stored, say what the law requires, and offer a one-tap repair. Read-only
   * must never lie about what payroll will do.
   */
  const paidInFullLine = (
    leave: LeaveTypeConfig,
    statementKey: string,
    onRepair: () => void,
  ) => {
    const percent = effectivePaidPercent(leave);
    if (percent === 100) {
      return (
        <p className="text-sm text-muted-foreground">{t(statementKey)}</p>
      );
    }
    return (
      <AmberNote>
        <p>{t("settings.timeOff.paidMismatch", { percent })}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRepair}>
          {t("settings.timeOff.setPaidInFull")}
        </Button>
      </AmberNote>
    );
  };

  /** Shared depth-2 editor for the three INSS-funded parental leaves. */
  const parentalRowBody = (
    key: "maternity" | "paternity" | "miscarriage",
    policyKey: "maternityLeave" | "paternityLeave" | "miscarriageLeave",
    hintKey: string,
    hintFallback: string,
  ) => {
    const leave = timeOffPolicies[policyKey];
    return (
      <>
        <div className="space-y-2">
          <Label htmlFor={`${key}-days`}>
            {t("settings.timeOff.rows.parental.daysLabel")}
          </Label>
          <Input
            id={`${key}-days`}
            type="number"
            min={0}
            value={leave.daysPerYear}
            onChange={(e) =>
              setTimeOffPolicies({
                ...timeOffPolicies,
                [policyKey]: {
                  ...leave,
                  daysPerYear: parseInt(e.target.value, 10) || 0,
                },
              })
            }
          />
        </div>
        {invalidNote(key)}

        {/* The deliberate employer-paid option: legal, so it must stay
            reachable; rare and consequential, so it stays the deepest thing on
            the page — and the Art. 21(3) warning sits ABOVE the input, not only
            after the value goes positive. This one is a CONTROL, not law, which
            is why it keeps its collapse while the statute below does not. */}
        <MoreDetailsSection
          title={t("settings.timeOff.rows.parental.payYourselfTitle")}
        >
          <div className="space-y-3 pb-1">
            <AmberNote>
              <p>
                {t("settings.timeOff.parentalPaidWarning") ||
                  "INSS does not pay the subsidy for days the worker receives salary (DL 18/2017 Art. 21(3)) — employer-paid maternity/paternity replaces, not tops up, the INSS subsidy."}
              </p>
            </AmberNote>
            <div className="space-y-2">
              <Label htmlFor={`${key}-paid`}>
                {t("settings.timeOff.paidPercentage")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`${key}-paid`}
                  type="number"
                  min={0}
                  max={100}
                  value={leave.paidPercentage}
                  onChange={(e) => {
                    // A percentage > 0 is the deliberate employer-paid
                    // option — keep isPaid in sync so the payroll engines
                    // (which require isPaid === true) honor it.
                    const paidPercentage = parseInt(e.target.value, 10) || 0;
                    setTimeOffPolicies({
                      ...timeOffPolicies,
                      [policyKey]: {
                        ...leave,
                        paidPercentage,
                        isPaid: paidPercentage > 0,
                      },
                    });
                  }}
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </MoreDetailsSection>

        <LawNote title={t("settings.timeOff.whatTheLawSays")}>
          <p className="text-xs text-muted-foreground">
            {t(hintKey) || hintFallback}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("settings.timeOff.parentalInssExplainer") ||
              "Paid 100% by INSS directly to the worker when they have 6 months of contributions in the last 12 (DL 18/2017) — the employer normally pays nothing during the leave."}
          </p>
        </LawNote>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Replaces the old hardcoded blue panel. Both laborCodeTitle and
          laborCodeHint survive in this one sentence. */}
      <p className="text-sm text-muted-foreground">
        {t("settings.timeOff.intro")}
      </p>

      {/* ── Your company's decisions ─────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("settings.timeOff.groupYours")}
        </h2>
        <div className="space-y-3">
          {/* Days off every year */}
          <PolicyRow
            id="annual"
            icon={Calendar}
            iconClass="bg-primary/10 text-primary"
            title={t("settings.timeOff.rows.annual.title")}
            summary={annualSummary}
            badges={notSavedBadge(sliceIsDirty((p) => p.annualLeave))}
            open={openRow === "annual"}
            onToggle={() => toggleRow("annual")}
          >
            <div className="space-y-2">
              <Label htmlFor="annual-days">
                {t("settings.timeOff.rows.annual.daysLabel")}
              </Label>
              <Input
                id="annual-days"
                type="number"
                min={0}
                value={annual.daysPerYear}
                onChange={(e) =>
                  setTimeOffPolicies({
                    ...timeOffPolicies,
                    annualLeave: {
                      ...annual,
                      daysPerYear: parseInt(e.target.value, 10) || 0,
                    },
                  })
                }
              />
            </div>

            {annual.daysPerYear < ANNUAL_LEAVE_MINIMUM_DAYS && (
              <AmberNote>
                <p>{t("settings.timeOff.rows.annual.belowMinimum")}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setTimeOffPolicies({
                      ...timeOffPolicies,
                      annualLeave: {
                        ...annual,
                        daysPerYear: ANNUAL_LEAVE_MINIMUM_DAYS,
                      },
                    })
                  }
                >
                  {t("settings.timeOff.rows.annual.setMinimum")}
                </Button>
              </AmberNote>
            )}

            <div className="flex items-center gap-2">
              <Switch
                id="annual-carry"
                checked={annual.carryOverAllowed}
                onCheckedChange={(checked) =>
                  setTimeOffPolicies({
                    ...timeOffPolicies,
                    annualLeave: { ...annual, carryOverAllowed: checked },
                  })
                }
              />
              <Label htmlFor="annual-carry">
                {t("settings.timeOff.rows.annual.carryQuestion")}
              </Label>
            </div>

            <div
              className={`space-y-2 ${
                annual.carryOverAllowed ? "" : "opacity-60"
              }`}
            >
              <Label htmlFor="annual-carry-max">
                {t("settings.timeOff.rows.annual.carryMaxLabel")}
              </Label>
              <Input
                id="annual-carry-max"
                type="number"
                min={0}
                disabled={!annual.carryOverAllowed}
                value={annualCarry}
                onChange={(e) =>
                  setTimeOffPolicies({
                    ...timeOffPolicies,
                    annualLeave: {
                      ...annual,
                      maxCarryOverDays: parseInt(e.target.value, 10) || 0,
                    },
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                {t("settings.timeOff.rows.annual.carryIsYours")}
              </p>
            </div>
            {invalidNote("annual")}

            <LawNote title={t("settings.timeOff.whatTheLawSays")}>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t("settings.timeOff.annualLeaveHint")}
                </p>
                {/* Art. 32: untaken annual leave is not lost when someone
                    leaves — it is cashed out on the final payslip. Payroll owns
                    the payment (calculateUntakenLeavePayout), offboarding owns
                    the day count; see docs/TIME_LEAVE.md. The most financially
                    consequential fact about annual leave. */}
                <p className="text-xs text-muted-foreground">
                  {t("settings.timeOff.annualLeaveCashOutNote")}
                </p>
              </div>
            </LawNote>
          </PolicyRow>

          {/* Public holidays */}
          <PolicyRow
            id="holidays"
            icon={Calendar}
            iconClass="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
            title={t("settings.timeOff.rows.holidays.title")}
            summary={holidaySummary}
            open={openRow === "holidays"}
            onToggle={() => toggleRow("holidays")}
          >
            <div className="space-y-2">
              <Label htmlFor="holiday-year">
                {t("settings.timeOff.rows.holidays.yearLabel")}
              </Label>
              <Input
                id="holiday-year"
                type="number"
                min={2000}
                max={2100}
                value={holidayYear}
                onChange={(e) =>
                  setHolidayYear(
                    parseInt(e.target.value, 10) || new Date().getFullYear()
                  )
                }
              />
            </div>

            {/* Days you changed — the undo list. Built from holidayOverrides so
                a day turned into a working day is still listed (and removable)
                even though it is gone from the merged list. */}
            {!holidayOverridesLoading && changedHolidayDays.length > 0 && (
              <div className="space-y-2">
                <div>
                  <h4 className="text-sm font-medium">
                    {t("settings.timeOff.changedDays.title")}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.timeOff.changedDays.hint")}
                  </p>
                </div>
                <div className="divide-y rounded-lg border">
                  {changedHolidayDays.map((o) => (
                    <div
                      key={o.date}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm">
                            {formatDateTL(parseDateISO(o.date))}
                          </span>
                          <Badge variant="secondary">
                            {t("settings.timeOff.changedDays.workingDay")}
                          </Badge>
                        </div>
                        <div className="truncate text-sm font-medium">
                          {o.name?.trim() ||
                            t("settings.timeOff.changedDays.notAHoliday")}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            holidayOverrideForm.reset({
                              date: o.date,
                              name: o.name ?? "",
                              nameTetun: o.nameTetun ?? "",
                              isHoliday: o.isHoliday ?? true,
                              notes: o.notes ?? "",
                            })
                          }
                        >
                          {t("settings.notifications.edit")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("settings.notifications.removeOverride")}
                          onClick={() => removeHolidayOverride(o.date)}
                          title={t("settings.notifications.removeOverride")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* This form writes to Firestore on its own, immediately — it does
                NOT wait for the page's Save button. Trap: it must never be
                unmounted (see PolicyRow), so it lives directly in the row body
                and not inside a Collapsible. */}
            <form
              className="space-y-4 rounded-lg border p-4"
              onSubmit={holidayOverrideForm.handleSubmit(
                onSaveHolidayOverride,
                () => {
                  toast({
                    title: t("settings.notifications.errorTitle"),
                    description: t(
                      "settings.timeOff.rows.holidays.formIncomplete"
                    ),
                    variant: "destructive",
                  });
                }
              )}
            >
              <h4 className="text-sm font-medium">
                {t("settings.notifications.addOverrideHoliday")}
              </h4>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Controller
                    name="isHoliday"
                    control={holidayOverrideForm.control}
                    render={({ field }) => (
                      <Switch
                        id="holiday-is-day-off"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <Label htmlFor="holiday-is-day-off">
                    {t("settings.timeOff.rows.holidays.isDayOff")}
                  </Label>
                </div>
                {!holidayFormValues.isHoliday && (
                  <p className="text-xs text-muted-foreground">
                    {t("settings.timeOff.rows.holidays.isDayOffHint")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t("common.date")}</Label>
                <Controller
                  name="date"
                  control={holidayOverrideForm.control}
                  render={({ field }) => (
                    <DatePicker
                      value={field.value || ""}
                      onChange={field.onChange}
                    />
                  )}
                />
                {holidayOverrideForm.formState.errors.date && (
                  <p className="text-sm text-destructive">
                    {holidayOverrideForm.formState.errors.date.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="holiday-name">{t("common.name")}</Label>
                <Input
                  id="holiday-name"
                  {...holidayOverrideForm.register("name")}
                  disabled={!holidayFormValues.isHoliday}
                  placeholder={
                    holidayFormValues.isHoliday
                      ? t("settings.notifications.holidayNamePlaceholder")
                      : t("settings.notifications.optional")
                  }
                />
                {holidayOverrideForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {holidayOverrideForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="holiday-name-tet">
                  {t("settings.notifications.nameTetun")}
                </Label>
                <Input
                  id="holiday-name-tet"
                  {...holidayOverrideForm.register("nameTetun")}
                  disabled={!holidayFormValues.isHoliday}
                  placeholder={t("settings.notifications.optional")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="holiday-notes">
                  {t("settings.notifications.notes")}
                </Label>
                <Textarea
                  id="holiday-notes"
                  {...holidayOverrideForm.register("notes")}
                  placeholder={t("settings.notifications.notesPlaceholder")}
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    holidayOverrideForm.reset({
                      date: "",
                      name: "",
                      nameTetun: "",
                      isHoliday: true,
                      notes: "",
                    })
                  }
                >
                  {t("settings.notifications.clear")}
                </Button>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={holidayOverrideSaving}
                >
                  {holidayOverrideSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {t("settings.timeOff.rows.holidays.saveDay")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("settings.timeOff.rows.holidays.savesImmediately")}
              </p>
            </form>

            <MoreDetailsSection
              title={t("settings.timeOff.rows.holidays.seeAll", {
                count: mergedHolidays.length,
                year: holidayYear,
              })}
            >
              <div className="divide-y rounded-lg border">
                {holidayOverridesLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-40" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </div>
                  ))
                ) : mergedHolidays.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    {t("settings.notifications.noHolidaysFound", {
                      year: String(holidayYear),
                    })}
                  </div>
                ) : (
                  mergedHolidays.map((h) => {
                    const override = holidayOverrideByDate.get(h.date);
                    // A Tetun reader saw "New Year's Day" in bold with
                    // "Loron Tinan Foun" as grey subtext, and a Portuguese
                    // reader got no Portuguese at all. Lead with the reader's
                    // own language.
                    const localName =
                      (locale === "tet" && h.nameTetun) ||
                      (locale === "pt" && h.namePt) ||
                      h.name;
                    const secondary =
                      localName === h.name ? h.nameTetun : h.name;
                    return (
                      <div
                        key={h.date}
                        className="flex items-center justify-between gap-3 p-3"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm">
                              {formatDateTL(parseDateISO(h.date))}
                            </span>
                            {h.source === "override" && (
                              <Badge variant="default">
                                {t("settings.notifications.override")}
                              </Badge>
                            )}
                          </div>
                          <div className="truncate text-sm font-medium">
                            {localName}
                          </div>
                          {secondary && secondary !== localName ? (
                            <div className="truncate text-xs text-muted-foreground">
                              {secondary}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              holidayOverrideForm.reset({
                                date: h.date,
                                name: override?.name ?? h.name,
                                nameTetun:
                                  override?.nameTetun ?? (h.nameTetun ?? ""),
                                isHoliday: override?.isHoliday ?? true,
                                notes: override?.notes ?? "",
                              })
                            }
                          >
                            {override
                              ? t("settings.notifications.edit")
                              : t("settings.notifications.override")}
                          </Button>
                          {override ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t(
                                "settings.notifications.removeOverride"
                              )}
                              onClick={() => removeHolidayOverride(h.date)}
                              title={t("settings.notifications.removeOverride")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </MoreDetailsSection>

            <LawNote title={t("settings.timeOff.whatTheLawSays")}>
              <p className="text-xs text-muted-foreground">
                {t("settings.timeOff.rows.holidays.law")}
              </p>
            </LawNote>
          </PolicyRow>

          {/* Extra leave your company offers */}
          <PolicyRow
            id="custom"
            icon={Calendar}
            iconClass="bg-muted text-muted-foreground"
            title={t("settings.timeOff.rows.custom.title")}
            summary={customSummary}
            badges={notSavedBadge(sliceIsDirty((p) => p.customLeaveTypes))}
            open={openRow === "custom"}
            onToggle={() => toggleRow("custom")}
          >
            <p className="text-xs text-muted-foreground">
              {t("settings.timeOff.customTypes.hint")}
            </p>

            {timeOffPolicies.customLeaveTypes.map((custom, index) => (
              <div key={custom.id} className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{custom.name}</span>
                    {!custom.isActive && (
                      <Badge variant="secondary">
                        {t("settings.timeOff.customTypes.inactive")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      id={`custom-active-${custom.id}`}
                      checked={custom.isActive}
                      onCheckedChange={(checked) =>
                        updateCustomType(index, { isActive: checked })
                      }
                    />
                    <Label htmlFor={`custom-active-${custom.id}`}>
                      {t("settings.timeOff.customTypes.active")}
                    </Label>
                  </div>
                </div>
                <div className="space-y-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0">
                  <div className="space-y-2">
                    <Label htmlFor={`custom-name-${custom.id}`}>
                      {t("settings.timeOff.customTypes.name")}
                    </Label>
                    <Input
                      id={`custom-name-${custom.id}`}
                      value={custom.name}
                      onChange={(e) =>
                        updateCustomType(index, { name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`custom-days-${custom.id}`}>
                      {t("settings.timeOff.daysPerYear")}
                    </Label>
                    <Input
                      id={`custom-days-${custom.id}`}
                      type="number"
                      min={0}
                      value={custom.daysPerYear}
                      onChange={(e) =>
                        updateCustomType(index, {
                          daysPerYear: parseInt(e.target.value, 10) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`custom-paid-${custom.id}`}>
                      {t("settings.timeOff.paidPercentage")}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`custom-paid-${custom.id}`}
                        type="number"
                        min={0}
                        max={100}
                        value={custom.paidPercentage}
                        onChange={(e) => {
                          // isPaid stays in sync — the payroll engines pay a
                          // policy only when isPaid === true.
                          const paidPercentage =
                            parseInt(e.target.value, 10) || 0;
                          updateCustomType(index, {
                            paidPercentage,
                            isPaid: paidPercentage > 0,
                          });
                        }}
                      />
                      <Percent className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`custom-cert-${custom.id}`}
                    checked={custom.requiresCertificate}
                    onCheckedChange={(checked) =>
                      updateCustomType(index, { requiresCertificate: checked })
                    }
                  />
                  <Label htmlFor={`custom-cert-${custom.id}`}>
                    {t("settings.timeOff.customTypes.requiresCertificate")}
                  </Label>
                </div>
              </div>
            ))}

            {/* Add form */}
            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="text-sm font-medium">
                {t("settings.timeOff.customTypes.addTitle")}
              </h4>
              <div className="space-y-4 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
                <div className="space-y-2">
                  <Label htmlFor="new-custom-name">
                    {t("settings.timeOff.customTypes.name")}
                  </Label>
                  <Input
                    id="new-custom-name"
                    value={newCustomType.name}
                    onChange={(e) =>
                      setNewCustomType({
                        ...newCustomType,
                        name: e.target.value,
                      })
                    }
                    placeholder={t(
                      "settings.timeOff.customTypes.namePlaceholder"
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-custom-code">
                    {t("settings.timeOff.customTypes.code")}
                  </Label>
                  <Input
                    id="new-custom-code"
                    value={newCustomType.code}
                    onChange={(e) =>
                      setNewCustomType({
                        ...newCustomType,
                        code: e.target.value,
                      })
                    }
                    placeholder="VOL"
                  />
                  {newCustomType.code.trim().length > 0 && customIdTaken && (
                    <p className="text-sm text-destructive">
                      {t("settings.timeOff.customTypes.codeTaken")}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-custom-days">
                    {t("settings.timeOff.daysPerYear")}
                  </Label>
                  <Input
                    id="new-custom-days"
                    type="number"
                    min={0}
                    value={newCustomType.daysPerYear}
                    onChange={(e) =>
                      setNewCustomType({
                        ...newCustomType,
                        daysPerYear: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-custom-paid">
                    {t("settings.timeOff.paidPercentage")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="new-custom-paid"
                      type="number"
                      min={0}
                      max={100}
                      value={newCustomType.paidPercentage}
                      onChange={(e) =>
                        setNewCustomType({
                          ...newCustomType,
                          paidPercentage: parseInt(e.target.value, 10) || 0,
                        })
                      }
                    />
                    <Percent className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="new-custom-cert"
                    checked={newCustomType.requiresCertificate}
                    onCheckedChange={(checked) =>
                      setNewCustomType({
                        ...newCustomType,
                        requiresCertificate: checked,
                      })
                    }
                  />
                  <Label htmlFor="new-custom-cert">
                    {t("settings.timeOff.customTypes.requiresCertificate")}
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addCustomType}
                  disabled={!canAddCustomType}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("settings.timeOff.customTypes.add")}
                </Button>
              </div>
            </div>
            {invalidNote("custom")}

            <LawNote title={t("settings.timeOff.whatTheLawSays")}>
              <p className="text-xs text-muted-foreground">
                {t("settings.timeOff.rows.custom.noLaw")}
              </p>
            </LawNote>
          </PolicyRow>

          {/* Waiting time before annual leave */}
          <PolicyRow
            id="probation"
            icon={Clock}
            iconClass="bg-muted text-muted-foreground"
            title={t("settings.timeOff.rows.probation.title")}
            summary={probationSummary}
            badges={
              <>
                {pendingBadge}
                {notSavedBadge(
                  sliceIsDirty((p) => p.probationMonthsBeforeLeave)
                )}
              </>
            }
            open={openRow === "probation"}
            onToggle={() => toggleRow("probation")}
          >
            {/* Page rule: a "Being confirmed" badge never appears without this
                sentence at depth 2. */}
            <p className="text-sm text-muted-foreground">
              {t("settings.timeOff.rows.probation.pendingExplainer")}
            </p>
            <div className="space-y-2">
              <Label htmlFor="probation-months">
                {t("settings.timeOff.rows.probation.monthsLabel")}
              </Label>
              <Input
                id="probation-months"
                type="number"
                min={0}
                max={12}
                value={timeOffPolicies.probationMonthsBeforeLeave}
                onChange={(e) =>
                  setTimeOffPolicies({
                    ...timeOffPolicies,
                    probationMonthsBeforeLeave:
                      parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </div>
            {invalidNote("probation")}

            <LawNote title={t("settings.timeOff.whatTheLawSays")}>
              <p className="text-xs text-muted-foreground">
                {t("settings.timeOff.probationHint")}
              </p>
            </LawNote>
          </PolicyRow>
        </div>
      </section>

      {/* ── Fixed by Timor-Leste law ─────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("settings.timeOff.groupLaw")}
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {t("settings.timeOff.statutoryNote")}
        </p>
        <div className="space-y-3">
          {/* When someone is sick */}
          <PolicyRow
            id="sick"
            icon={Clock}
            iconClass="bg-orange-500/10 text-orange-600 dark:text-orange-400"
            title={t("settings.timeOff.rows.sick.title")}
            summary={t("settings.timeOff.rows.sick.summary", {
              days: timeOffPolicies.sickLeave.daysPerYear,
            })}
            badges={pendingBadge}
            open={openRow === "sick"}
            onToggle={() => toggleRow("sick")}
          >
            <p className="text-sm text-muted-foreground">
              {t("settings.timeOff.rows.sick.pendingExplainer")}
            </p>
            {/* The switch that used to sit here enforced nothing: no consumer in
                functions/src, mobile/ekipa or server/xefe-api. Rendering the
                stored value as a sentence is honest either way — see the open
                question in docs/TIME_OFF_REDESIGN_SPEC.md (h)5. */}
            <p className="text-sm text-muted-foreground">
              {timeOffPolicies.sickLeave.requiresCertificate
                ? t("settings.timeOff.rows.sick.certificateOn")
                : t("settings.timeOff.rows.sick.certificateOff")}
            </p>
            {invalidNote("sick")}

            <LawNote title={t("settings.timeOff.whatTheLawSays")}>
              <p className="text-xs font-medium">
                {t("settings.timeOff.sickPayBandsTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("settings.timeOff.sickPayBandsText")}
              </p>
            </LawNote>
          </PolicyRow>

          {/* Maternity */}
          <PolicyRow
            id="maternity"
            icon={Users}
            iconClass="bg-pink-500/10 text-pink-600 dark:text-pink-400"
            title={t("settings.timeOff.rows.maternity.title")}
            summary={parentalSummary(
              "maternity",
              timeOffPolicies.maternityLeave
            )}
            badges={
              <>
                {effectivePaidPercent(timeOffPolicies.maternityLeave) > 0 && (
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                )}
                {notSavedBadge(sliceIsDirty((p) => p.maternityLeave))}
              </>
            }
            open={openRow === "maternity"}
            onToggle={() => toggleRow("maternity")}
          >
            {parentalRowBody(
              "maternity",
              "maternityLeave",
              "settings.timeOff.maternityHint",
              "Legal duration: 12 weeks (Labour Law Art. 59)."
            )}
          </PolicyRow>

          {/* Paternity */}
          <PolicyRow
            id="paternity"
            icon={Users}
            iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            title={t("settings.timeOff.rows.paternity.title")}
            summary={parentalSummary(
              "paternity",
              timeOffPolicies.paternityLeave
            )}
            badges={
              <>
                {effectivePaidPercent(timeOffPolicies.paternityLeave) > 0 && (
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                )}
                {notSavedBadge(sliceIsDirty((p) => p.paternityLeave))}
              </>
            }
            open={openRow === "paternity"}
            onToggle={() => toggleRow("paternity")}
          >
            {parentalRowBody(
              "paternity",
              "paternityLeave",
              "settings.timeOff.paternityHint",
              "Legal minimum: 5 working days (Labour Law Art. 60)."
            )}
          </PolicyRow>

          {/* Miscarriage */}
          <PolicyRow
            id="miscarriage"
            icon={Heart}
            iconClass="bg-rose-500/10 text-rose-600 dark:text-rose-400"
            title={t("settings.timeOff.rows.miscarriage.title")}
            summary={parentalSummary(
              "miscarriage",
              timeOffPolicies.miscarriageLeave
            )}
            badges={
              <>
                {effectivePaidPercent(timeOffPolicies.miscarriageLeave) > 0 && (
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                )}
                {notSavedBadge(sliceIsDirty((p) => p.miscarriageLeave))}
              </>
            }
            open={openRow === "miscarriage"}
            onToggle={() => toggleRow("miscarriage")}
          >
            {parentalRowBody(
              "miscarriage",
              "miscarriageLeave",
              "settings.timeOff.miscarriageLeaveHint",
              "4 weeks after a pregnancy interruption (Labour Law Art. 59.4), as working days. Clinical-risk leave BEFORE the birth (Art. 59.3) has no fixed length — record it as sick leave with a medical certificate."
            )}
          </PolicyRow>

          {/* Breastfeeding breaks and pregnancy check-ups (Art. 62) —
              deliberately note-only: these are hour-level dispensations inside
              a worked day, not day-based leave. Promoted to its own row because
              it is an OPERATOR INSTRUCTION (record as worked time, never dock)
              and missing it costs the worker money. */}
          <PolicyRow
            id="breastfeeding"
            icon={Heart}
            iconClass="bg-pink-500/10 text-pink-600 dark:text-pink-400"
            title={t("settings.timeOff.rows.breastfeeding.title")}
            summary={t("settings.timeOff.rows.breastfeeding.summary")}
            open={openRow === "breastfeeding"}
            onToggle={() => toggleRow("breastfeeding")}
          >
            <p className="text-sm text-muted-foreground">
              {t("settings.timeOff.breastfeedingNote")}
            </p>
          </PolicyRow>

          {/* Weddings, funerals and community days */}
          <PolicyRow
            id="special"
            icon={Calendar}
            iconClass="bg-teal-500/10 text-teal-600 dark:text-teal-400"
            title={t("settings.timeOff.rows.special.title")}
            summary={t("settings.timeOff.rows.special.summary", {
              days: timeOffPolicies.specialLeave.daysPerYear,
            })}
            badges={notSavedBadge(sliceIsDirty((p) => p.specialLeave))}
            open={openRow === "special"}
            onToggle={() => toggleRow("special")}
          >
            <div className="space-y-2">
              <Label htmlFor="special-days">
                {t("settings.timeOff.rows.special.daysLabel")}
              </Label>
              <Input
                id="special-days"
                type="number"
                min={0}
                value={timeOffPolicies.specialLeave.daysPerYear}
                onChange={(e) =>
                  setTimeOffPolicies({
                    ...timeOffPolicies,
                    specialLeave: {
                      ...timeOffPolicies.specialLeave,
                      daysPerYear: parseInt(e.target.value, 10) || 0,
                    },
                  })
                }
              />
            </div>
            {paidInFullLine(
              timeOffPolicies.specialLeave,
              "settings.timeOff.paidInFull",
              () =>
                setTimeOffPolicies({
                  ...timeOffPolicies,
                  specialLeave: {
                    ...timeOffPolicies.specialLeave,
                    paidPercentage: 100,
                    isPaid: true,
                  },
                })
            )}
            {invalidNote("special")}

            <LawNote title={t("settings.timeOff.whatTheLawSays")}>
              <p className="text-xs text-muted-foreground">
                {t("settings.timeOff.specialLeaveHint")}
              </p>
            </LawNote>
          </PolicyRow>

          {/* Exam days — statutory PAID entitlement (Art. 76.3) whose annual
              number is genuinely the company's, since the statute sets no cap.
              Both halves of that truth are in the summary line. */}
          <PolicyRow
            id="study"
            icon={GraduationCap}
            iconClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
            title={t("settings.timeOff.rows.study.title")}
            summary={t("settings.timeOff.rows.study.summary", {
              days: timeOffPolicies.studyLeave.daysPerYear,
            })}
            badges={notSavedBadge(sliceIsDirty((p) => p.studyLeave))}
            open={openRow === "study"}
            onToggle={() => toggleRow("study")}
          >
            <div className="space-y-2">
              <Label htmlFor="study-days">
                {t("settings.timeOff.rows.study.daysLabel")}
              </Label>
              <Input
                id="study-days"
                type="number"
                min={0}
                value={timeOffPolicies.studyLeave.daysPerYear}
                onChange={(e) =>
                  setTimeOffPolicies({
                    ...timeOffPolicies,
                    studyLeave: {
                      ...timeOffPolicies.studyLeave,
                      daysPerYear: parseInt(e.target.value, 10) || 0,
                    },
                  })
                }
              />
            </div>
            {paidInFullLine(
              timeOffPolicies.studyLeave,
              "settings.timeOff.paidInFullStudy",
              () =>
                setTimeOffPolicies({
                  ...timeOffPolicies,
                  studyLeave: {
                    ...timeOffPolicies.studyLeave,
                    paidPercentage: 100,
                    isPaid: true,
                  },
                })
            )}
            {invalidNote("study")}

            <LawNote title={t("settings.timeOff.whatTheLawSays")}>
              <p className="text-xs text-muted-foreground">
                {t("settings.timeOff.studyLeaveHint")}
              </p>
            </LawNote>
          </PolicyRow>

          {/* Unpaid time off — enforced today by findEntitlementBreaches in
              functions/src/timeleave.ts with NO UI anywhere, so an employee is
              blocked and nobody can find out why. Read-only: surfacing the
              limit is a pure information add; making it editable is a product
              decision. */}
          <PolicyRow
            id="unpaid"
            icon={Calendar}
            iconClass="bg-muted text-muted-foreground"
            title={t("settings.timeOff.rows.unpaid.title")}
            summary={t("settings.timeOff.rows.unpaid.summary", {
              days: timeOffPolicies.unpaidLeave.daysPerYear,
            })}
            open={openRow === "unpaid"}
            onToggle={() => toggleRow("unpaid")}
          >
            <p className="text-sm text-muted-foreground">
              {t("settings.timeOff.rows.unpaid.detail", {
                days: timeOffPolicies.unpaidLeave.daysPerYear,
              })}
            </p>
            {invalidNote("unpaid")}

            <LawNote title={t("settings.timeOff.whatTheLawSays")}>
              <p className="text-xs text-muted-foreground">
                {t("settings.timeOff.rows.unpaid.noStatute")}
              </p>
            </LawNote>
          </PolicyRow>
        </div>
      </section>

      {/* Last in the scroll, which is where the thumb already is. This saves the
          leave policies and the custom types — the holiday override has its own
          "Save this day" and writes immediately. */}
      <Button
        onClick={saveTimeOffPolicies}
        disabled={saving}
        className="min-h-11 w-full sm:w-auto"
      >
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        {t("settings.timeOff.save")}
      </Button>
    </div>
  );
}
