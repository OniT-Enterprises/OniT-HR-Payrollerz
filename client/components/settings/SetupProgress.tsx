/**
 * Setup Progress Indicator for Settings page
 * Shows completion status of each settings section
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/I18nProvider";

interface SetupProgressProps {
  progress: Record<string, boolean>;
}

export function SetupProgress({ progress }: SetupProgressProps) {
  const { t } = useI18n();
  const steps = [
    { key: "companyDetails", label: t("settings.tabs.company") },
    { key: "companyStructure", label: t("settings.tabs.structure") },
    { key: "paymentStructure", label: t("settings.tabs.payment") },
    { key: "timeOffPolicies", label: t("settings.tabs.timeOff") },
    { key: "payrollConfig", label: t("settings.tabs.payroll") },
  ];

  const completed = Object.values(progress).filter(Boolean).length;
  const total = steps.length;

  return (
    <Card className="mb-6">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">{t("settings.setupProgress")}</span>
          <Badge variant={completed === total ? "default" : "secondary"}>
            {t("settings.progressComplete", { completed, total })}
          </Badge>
        </div>
        <div className="flex gap-2">
          {steps.map((step) => (
            <div key={step.key} className="flex-1">
              <div
                className={`h-2 rounded-full ${
                  progress[step.key] ? "bg-primary" : "bg-muted"
                }`}
              />
              <p className="text-xs text-muted-foreground mt-1 text-center truncate">
                {step.label}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
