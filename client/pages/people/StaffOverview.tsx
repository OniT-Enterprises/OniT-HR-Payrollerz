/**
 * Staff Overview — Sub-hub for the Staff section.
 * Links to Employee Directory, Announcements, and Grievances.
 */

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { peopleNavConfig } from "@/lib/moduleNav";
import { useAllEmployees } from "@/hooks/useEmployees";
import { getComplianceIssues } from "@/lib/employeeUtils";
import {
  Users,
  UserPlus,
  Megaphone,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import GuidancePanel from "@/components/GuidancePanel";

export default function StaffOverview() {
  const navigate = useNavigate();
  const { data: employees = [] } = useAllEmployees();

  const stats = useMemo(() => ({
    active: employees.filter((e) => e.status === "active").length,
    issues: getComplianceIssues(employees).length,
  }), [employees]);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Staff"
        description="Employee directory, company announcements, and grievance management."
        url="/people/staff"
      />
      <MainNavigation />
      <ModuleSectionNav config={peopleNavConfig} />

      {/* Hero */}
      <div className="border-b bg-blue-50 dark:bg-blue-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Staff</h1>
                <p className="text-muted-foreground mt-1">
                  Employee directory, announcements, and grievances
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate("/people/add")}
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              Add Employee
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <GuidancePanel section="people" />

        {/* Quick stats */}
        <div className="flex items-center gap-4 mb-6 text-sm">
          <span className="font-medium">{stats.active} active employees</span>
          {stats.issues > 0 ? (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {stats.issues} compliance issue{stats.issues > 1 ? "s" : ""}
            </Badge>
          ) : (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <CheckCircle className="h-3 w-3 mr-1" />
              All clear
            </Badge>
          )}
        </div>

        {/* Section cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card
            className="cursor-pointer transition-all hover:border-blue-500/40 hover:shadow-md group"
            onClick={() => navigate("/people/employees")}
          >
            <CardContent className="flex items-start gap-4 pt-5 pb-5">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shrink-0">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">Employee Directory</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  View and manage your complete employee directory with profiles, compliance status, and quick actions.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all hover:border-blue-500/40 hover:shadow-md group"
            onClick={() => navigate("/people/announcements")}
          >
            <CardContent className="flex items-start gap-4 pt-5 pb-5">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 shrink-0">
                <Megaphone className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">Announcements</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Broadcast company announcements to all employees via the Ekipa mobile app.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all hover:border-blue-500/40 hover:shadow-md group"
            onClick={() => navigate("/people/grievances")}
          >
            <CardContent className="flex items-start gap-4 pt-5 pb-5">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 shrink-0">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">Grievances</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Review and respond to anonymous employee grievances and workplace concerns.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
