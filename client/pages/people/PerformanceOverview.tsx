/**
 * Performance Overview — Sub-hub for the Performance section.
 * Links to Goals, Reviews, Training, and Disciplinary.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { peopleNavConfig } from "@/lib/moduleNav";
import {
  Target,
  Award,
  GraduationCap,
  Shield,
  ChevronRight,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import GuidancePanel from "@/components/GuidancePanel";

const cards = [
  {
    label: "Goals & KPIs",
    desc: "Set objectives and key results for individuals and teams. Track progress toward targets.",
    path: "/people/goals",
    icon: Target,
    color: "from-violet-500 to-purple-500",
  },
  {
    label: "Performance Reviews",
    desc: "Run review cycles — self-assessments, manager evaluations, and competency ratings.",
    path: "/people/reviews",
    icon: Award,
    color: "from-purple-500 to-fuchsia-500",
  },
  {
    label: "Training & Certifications",
    desc: "Track employee training records, certifications, and expiry dates.",
    path: "/people/training",
    icon: GraduationCap,
    color: "from-indigo-500 to-violet-500",
  },
  {
    label: "Disciplinary",
    desc: "Document disciplinary actions, warnings, and case resolutions.",
    path: "/people/disciplinary",
    icon: Shield,
    color: "from-slate-500 to-slate-600",
  },
];

export default function PerformanceOverview() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Performance Management"
        description="Track goals, conduct reviews, manage training, and handle disciplinary actions."
        url="/people/performance"
      />
      <MainNavigation />
      <ModuleSectionNav config={peopleNavConfig} />

      {/* Hero */}
      <div className="border-b bg-violet-50 dark:bg-violet-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
              <Target className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Performance</h1>
              <p className="text-muted-foreground mt-1">
                Goals, reviews, training, and disciplinary management
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <GuidancePanel section="people" />

        {/* Section cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((card) => (
            <Card
              key={card.path}
              className="cursor-pointer transition-all hover:border-violet-500/40 hover:shadow-md group"
              onClick={() => navigate(card.path)}
            >
              <CardContent className="flex items-start gap-4 pt-5 pb-5">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${card.color} shrink-0`}>
                  <card.icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{card.label}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
