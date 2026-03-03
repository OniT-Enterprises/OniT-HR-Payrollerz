/**
 * Hiring Overview — Sub-hub for the Hiring section.
 * Links to Jobs, Candidates, Interviews, Onboarding, and Offboarding.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { peopleNavConfig } from "@/lib/moduleNav";
import {
  Briefcase,
  UserCheck,
  Calendar,
  UserPlus,
  UserMinus,
  ChevronRight,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import GuidancePanel from "@/components/GuidancePanel";

const cards = [
  {
    label: "Job Postings",
    desc: "Create and manage open positions. Track applications and publish listings.",
    path: "/people/jobs",
    icon: Briefcase,
    color: "from-emerald-500 to-green-500",
  },
  {
    label: "Candidates",
    desc: "Review applicants, rate candidates, and move them through your hiring pipeline.",
    path: "/people/candidates",
    icon: UserCheck,
    color: "from-teal-500 to-emerald-500",
  },
  {
    label: "Interviews",
    desc: "Schedule interviews, assign interviewers, and record feedback and scores.",
    path: "/people/interviews",
    icon: Calendar,
    color: "from-cyan-500 to-teal-500",
  },
  {
    label: "Onboarding",
    desc: "Guide new hires through onboarding checklists — documents, training, and setup.",
    path: "/people/onboarding",
    icon: UserPlus,
    color: "from-green-500 to-lime-500",
  },
  {
    label: "Offboarding",
    desc: "Manage employee departures with structured exit workflows and handover tasks.",
    path: "/people/offboarding",
    icon: UserMinus,
    color: "from-slate-500 to-slate-600",
  },
];

export default function HiringOverview() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Hiring & Recruitment"
        description="Manage job postings, candidates, interviews, onboarding, and offboarding."
        url="/people/hiring"
      />
      <MainNavigation />
      <ModuleSectionNav config={peopleNavConfig} />

      {/* Hero */}
      <div className="border-b bg-emerald-50 dark:bg-emerald-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 shadow-lg shadow-emerald-500/25">
              <Briefcase className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Hiring</h1>
              <p className="text-muted-foreground mt-1">
                Job postings, candidates, interviews, and workforce transitions
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
              className="cursor-pointer transition-all hover:border-emerald-500/40 hover:shadow-md group"
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
