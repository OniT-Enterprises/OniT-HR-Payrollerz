import React from "react";
import { BookOpen } from "lucide-react";
import { useGuidance } from "@/contexts/GuidanceContext";
import { useI18n } from "@/i18n/I18nProvider";
import { sectionThemes, type SectionId } from "@/lib/sectionTheme";

/** Maps section id → translation key prefix (e.g. "dashboard" → "guidance.dashboardTitle") */
const keyMap: Record<SectionId, { title: string; body: string }> = {
  dashboard:  { title: "guidance.dashboardTitle",  body: "guidance.dashboardBody" },
  people:     { title: "guidance.peopleTitle",      body: "guidance.peopleBody" },
  payroll:    { title: "guidance.payrollTitle",     body: "guidance.payrollBody" },
  money:      { title: "guidance.moneyTitle",       body: "guidance.moneyBody" },
  accounting: { title: "guidance.accountingTitle",  body: "guidance.accountingBody" },
  reports:    { title: "guidance.reportsTitle",     body: "guidance.reportsBody" },
};

interface GuidancePanelProps {
  section: SectionId;
}

export default function GuidancePanel({ section }: GuidancePanelProps) {
  const { guidanceEnabled, toggleGuidance } = useGuidance();
  const { t } = useI18n();

  if (!guidanceEnabled) return null;

  const theme = sectionThemes[section];
  const keys = keyMap[section];

  return (
    <div
      className={`
        ${theme.borderLeft} rounded-lg px-5 py-4 mb-6
        ${theme.bgSubtle}
        animate-fade-up
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-1.5 rounded-md ${theme.bg}`}>
          <BookOpen className={`h-4 w-4 ${theme.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{t(keys.title)}</span>{" "}
            <span className="text-muted-foreground">{t(keys.body)}</span>
          </p>
          <button
            onClick={toggleGuidance}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            {t("guidance.hideGuidance")}
          </button>
        </div>
      </div>
    </div>
  );
}
