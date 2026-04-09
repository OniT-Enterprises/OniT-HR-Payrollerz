/**
 * Wizard Step 1 — "When are you paying?"
 * Big radio cards for frequency. Auto-filled dates. Subsidio toggle.
 * Design: Kids-app simple — one choice at a time, big targets, minimal text.
 */
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { CalendarDays, CalendarRange, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TLPayFrequency } from "@/lib/payroll/constants-tl";
import { useI18n } from "@/i18n/I18nProvider";

interface WizardStepPeriodProps {
  payFrequency: TLPayFrequency;
  setPayFrequency: (v: TLPayFrequency) => void;
  periodStart: string;
  setPeriodStart: (v: string) => void;
  periodEnd: string;
  setPeriodEnd: (v: string) => void;
  payDate: string;
  setPayDate: (v: string) => void;
  includeSubsidioAnual: boolean;
  setIncludeSubsidioAnual: (v: boolean) => void;
}

const frequencyOptions: { value: TLPayFrequency; icon: typeof CalendarDays; labelKey: string; descKey: string }[] = [
  { value: "monthly", icon: CalendarDays, labelKey: "runPayroll.monthly", descKey: "runPayroll.monthlyDesc" },
  { value: "biweekly", icon: CalendarRange, labelKey: "runPayroll.biweekly", descKey: "runPayroll.biweeklyDesc" },
  { value: "weekly", icon: CalendarClock, labelKey: "runPayroll.weekly", descKey: "runPayroll.weeklyDesc" },
];

export function WizardStepPeriod({
  payFrequency,
  setPayFrequency,
  periodStart,
  setPeriodStart,
  periodEnd,
  setPeriodEnd,
  payDate,
  setPayDate,
  includeSubsidioAnual,
  setIncludeSubsidioAnual,
}: WizardStepPeriodProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">{t("runPayroll.stepPeriodTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("runPayroll.stepPeriodDesc")}</p>
      </div>

      {/* Frequency Radio Cards — big, obvious, one tap */}
      <div>
        <Label className="text-base font-semibold mb-4 block">{t("runPayroll.payFrequency")}</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {frequencyOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = payFrequency === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPayFrequency(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all text-center",
                  isSelected
                    ? "border-green-500 bg-green-50 dark:bg-green-950/30 shadow-md shadow-green-500/10 scale-[1.02]"
                    : "border-border/50 hover:border-green-300 hover:bg-muted/30"
                )}
              >
                <div className={cn(
                  "p-3 rounded-2xl transition-all",
                  isSelected
                    ? "bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25"
                    : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <span className={cn("text-base font-bold block", isSelected && "text-green-700 dark:text-green-300")}>
                    {t(opt.labelKey)}
                  </span>
                  <span className="text-sm text-muted-foreground mt-1 block">
                    {t(opt.descKey)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Pickers — popover calendars, not native inputs */}
      <div>
        <Label className="text-base font-semibold mb-4 block">{t("runPayroll.periodConfig")}</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              {t("runPayroll.periodStart")}
            </Label>
            <DatePicker
              value={periodStart}
              onChange={setPeriodStart}
              placeholder={t("runPayroll.periodStart")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              {t("runPayroll.periodEnd")}
            </Label>
            <DatePicker
              value={periodEnd}
              onChange={setPeriodEnd}
              placeholder={t("runPayroll.periodEnd")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              {t("runPayroll.payDate")}
            </Label>
            <DatePicker
              value={payDate}
              onChange={setPayDate}
              placeholder={t("runPayroll.payDate")}
            />
          </div>
        </div>
      </div>

      {/* Subsidio Anual — simple toggle card */}
      <div
        className={cn(
          "flex items-start gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all",
          includeSubsidioAnual
            ? "border-green-500 bg-green-50/50 dark:bg-green-950/20"
            : "border-border/50 hover:border-green-300 hover:bg-muted/20"
        )}
        onClick={() => setIncludeSubsidioAnual(!includeSubsidioAnual)}
      >
        <Checkbox
          checked={includeSubsidioAnual}
          onCheckedChange={(checked) => setIncludeSubsidioAnual(!!checked)}
          className="mt-0.5 h-5 w-5 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
        />
        <div>
          <span className="text-sm font-semibold">{t("runPayroll.includeSubsidio")}</span>
          <p className="text-sm text-muted-foreground mt-1">
            {t("runPayroll.subsidioDesc")}
          </p>
        </div>
      </div>
    </div>
  );
}
