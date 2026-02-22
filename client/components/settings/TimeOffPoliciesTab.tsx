import { useState, useEffect, useMemo, useCallback } from "react";
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
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useToast } from "@/hooks/use-toast";
import { settingsService } from "@/services/settingsService";
import { holidayService, type HolidayOverride } from "@/services/holidayService";
import { getTLPublicHolidays } from "@/lib/payroll/tl-holidays";

import type { SettingsTabProps, TimeOffPolicies } from "./types";
import {
  holidayOverrideFormSchema,
  type HolidayOverrideFormData,
} from "./types";

interface TimeOffPoliciesTabProps extends SettingsTabProps {
  initialTimeOff: TimeOffPolicies;
  initialHolidayOverrides: HolidayOverride[];
  userId: string | undefined;
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

  // Local state for time-off policies
  const [timeOffPolicies, setTimeOffPolicies] =
    useState<TimeOffPolicies>(initialTimeOff);

  // Sync local state when parent reloads
  useEffect(() => {
    setTimeOffPolicies(initialTimeOff);
  }, [initialTimeOff]);

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
        source: "built_in" | "override";
      }
    >();

    base.forEach((h) => {
      map.set(h.date, {
        date: h.date,
        name: h.name,
        nameTetun: h.nameTetun,
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
        nameTetun: o.nameTetun || undefined,
        source: "override",
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [holidayYear, holidayOverrides, t]);

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
    setSaving(true);
    try {
      await settingsService.updateTimeOffPolicies(tenantId, timeOffPolicies);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.timeOff.title")}</CardTitle>
        <CardDescription>{t("settings.timeOff.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {t("settings.timeOff.laborCodeTitle")}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {t("settings.timeOff.laborCodeHint")}
              </p>
            </div>
          </div>
        </div>

        {/* Probation Period */}
        <div className="space-y-2">
          <Label>{t("settings.timeOff.probationLabel")}</Label>
          <div className="flex items-center gap-4">
            <Input
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
              className="w-24"
            />
            <span className="text-muted-foreground">
              {t("settings.timeOff.months")}
            </span>
          </div>
        </div>

        <Separator />

        {/* Leave Types */}
        <div className="space-y-4">
          <h3 className="font-medium">{t("settings.timeOff.entitlements")}</h3>

          {/* Annual Leave */}
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="font-medium">
                  {t("settings.timeOff.annualLeave")}
                </span>
              </div>
              <Badge variant="secondary">
                {timeOffPolicies.annualLeave.daysPerYear}{" "}
                {t("settings.timeOff.days")}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t("settings.timeOff.daysPerYear")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={timeOffPolicies.annualLeave.daysPerYear}
                  onChange={(e) =>
                    setTimeOffPolicies({
                      ...timeOffPolicies,
                      annualLeave: {
                        ...timeOffPolicies.annualLeave,
                        daysPerYear: parseInt(e.target.value, 10) || 0,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.timeOff.carryOverDays")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={timeOffPolicies.annualLeave.maxCarryOverDays || 0}
                  onChange={(e) =>
                    setTimeOffPolicies({
                      ...timeOffPolicies,
                      annualLeave: {
                        ...timeOffPolicies.annualLeave,
                        maxCarryOverDays: parseInt(e.target.value, 10) || 0,
                      },
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={timeOffPolicies.annualLeave.carryOverAllowed}
                  onCheckedChange={(checked) =>
                    setTimeOffPolicies({
                      ...timeOffPolicies,
                      annualLeave: {
                        ...timeOffPolicies.annualLeave,
                        carryOverAllowed: checked,
                      },
                    })
                  }
                />
                <Label>{t("settings.timeOff.allowCarryOver")}</Label>
              </div>
            </div>
          </div>

          {/* Sick Leave */}
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <span className="font-medium">
                  {t("settings.timeOff.sickLeave")}
                </span>
              </div>
              <Badge variant="secondary">
                {timeOffPolicies.sickLeave.daysPerYear}{" "}
                {t("settings.timeOff.days")}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t("settings.timeOff.daysPerYear")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={timeOffPolicies.sickLeave.daysPerYear}
                  onChange={(e) =>
                    setTimeOffPolicies({
                      ...timeOffPolicies,
                      sickLeave: {
                        ...timeOffPolicies.sickLeave,
                        daysPerYear: parseInt(e.target.value, 10) || 0,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.timeOff.paidPercentage")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={timeOffPolicies.sickLeave.paidPercentage}
                    onChange={(e) =>
                      setTimeOffPolicies({
                        ...timeOffPolicies,
                        sickLeave: {
                          ...timeOffPolicies.sickLeave,
                          paidPercentage: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                  />
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={timeOffPolicies.sickLeave.requiresCertificate}
                  onCheckedChange={(checked) =>
                    setTimeOffPolicies({
                      ...timeOffPolicies,
                      sickLeave: {
                        ...timeOffPolicies.sickLeave,
                        requiresCertificate: checked,
                      },
                    })
                  }
                />
                <Label>{t("settings.timeOff.requiresMedicalCert")}</Label>
              </div>
            </div>
          </div>

          {/* Maternity Leave */}
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-pink-500" />
                <span className="font-medium">
                  {t("settings.timeOff.maternityLeave")}
                </span>
              </div>
              <Badge variant="secondary">
                {Math.round(
                  timeOffPolicies.maternityLeave.daysPerYear / 7
                )}{" "}
                {t("settings.timeOff.weeks")}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("settings.timeOff.maternityDaysHint")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={timeOffPolicies.maternityLeave.daysPerYear}
                  onChange={(e) =>
                    setTimeOffPolicies({
                      ...timeOffPolicies,
                      maternityLeave: {
                        ...timeOffPolicies.maternityLeave,
                        daysPerYear: parseInt(e.target.value, 10) || 0,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.timeOff.paidPercentage")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={timeOffPolicies.maternityLeave.paidPercentage}
                    onChange={(e) =>
                      setTimeOffPolicies({
                        ...timeOffPolicies,
                        maternityLeave: {
                          ...timeOffPolicies.maternityLeave,
                          paidPercentage: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                  />
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* Paternity Leave */}
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="font-medium">
                  {t("settings.timeOff.paternityLeave")}
                </span>
              </div>
              <Badge variant="secondary">
                {timeOffPolicies.paternityLeave.daysPerYear}{" "}
                {t("settings.timeOff.days")}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("settings.timeOff.days")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={timeOffPolicies.paternityLeave.daysPerYear}
                  onChange={(e) =>
                    setTimeOffPolicies({
                      ...timeOffPolicies,
                      paternityLeave: {
                        ...timeOffPolicies.paternityLeave,
                        daysPerYear: parseInt(e.target.value, 10) || 0,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.timeOff.paidPercentage")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={timeOffPolicies.paternityLeave.paidPercentage}
                    onChange={(e) =>
                      setTimeOffPolicies({
                        ...timeOffPolicies,
                        paternityLeave: {
                          ...timeOffPolicies.paternityLeave,
                          paidPercentage: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                  />
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Public Holidays (Timor-Leste) + tenant overrides */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Public Holidays (Timor-Leste)
              </h3>
              <p className="text-sm text-muted-foreground">
                Built-in holidays include fixed dates plus Easter-based holidays
                (Good Friday, Corpus Christi). Add overrides for variable
                holidays (e.g., Eid) and government-declared days.
              </p>
            </div>
            <div className="w-32 space-y-2">
              <Label>Year</Label>
              <Input
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
          </div>

          <div className="border rounded-lg divide-y">
            {holidayOverridesLoading ? (
              <div className="p-4">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-6 w-72 mt-2" />
              </div>
            ) : mergedHolidays.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                {t("settings.notifications.noHolidaysFound", {
                  year: String(holidayYear),
                })}
              </div>
            ) : (
              mergedHolidays.map((h) => {
                const override = holidayOverrideByDate.get(h.date);
                return (
                  <div
                    key={h.date}
                    className="p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{h.date}</span>
                        <Badge
                          variant={
                            h.source === "override" ? "default" : "secondary"
                          }
                        >
                          {h.source === "override"
                            ? t("settings.notifications.override")
                            : t("settings.notifications.builtIn")}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium truncate">
                        {h.name}
                      </div>
                      {h.nameTetun ? (
                        <div className="text-xs text-muted-foreground truncate">
                          {h.nameTetun}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
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

          <form
            className="p-4 border rounded-lg space-y-4"
            onSubmit={holidayOverrideForm.handleSubmit(onSaveHolidayOverride)}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-medium">
                {t("settings.notifications.addOverrideHoliday")}
              </h4>
              <div className="flex items-center gap-2">
                <Controller
                  name="isHoliday"
                  control={holidayOverrideForm.control}
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label>{t("settings.notifications.holidayName")}</Label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t("common.date")}</Label>
                <Input
                  type="date"
                  {...holidayOverrideForm.register("date")}
                />
                {holidayOverrideForm.formState.errors.date && (
                  <p className="text-sm text-destructive">
                    {holidayOverrideForm.formState.errors.date.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("common.name")}</Label>
                <Input
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
                <Label>{t("settings.notifications.nameTetun")}</Label>
                <Input
                  {...holidayOverrideForm.register("nameTetun")}
                  disabled={!holidayFormValues.isHoliday}
                  placeholder={t("settings.notifications.optional")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("settings.notifications.notes")}</Label>
              <Textarea
                {...holidayOverrideForm.register("notes")}
                placeholder={t("settings.notifications.notesPlaceholder")}
              />
            </div>

            <div className="flex justify-end gap-2">
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
              <Button type="submit" disabled={holidayOverrideSaving}>
                {holidayOverrideSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {t("settings.notifications.saveOverride")}
              </Button>
            </div>
          </form>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={saveTimeOffPolicies} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t("settings.timeOff.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

