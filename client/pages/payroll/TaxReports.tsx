/**
 * Payroll Taxes (Timor-Leste)
 *
 * Entry point for payroll tax + social security compliance workflows:
 * - ATTL Monthly WIT return
 * - INSS Monthly contribution submission
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO, seoConfig } from "@/components/SEO";
import { useTenantId } from "@/contexts/TenantContext";
import { taxFilingService } from "@/services/taxFilingService";
import type { FilingDueDate } from "@/types/tax-filing";
import {
  ArrowRight,
  Building,
  Calendar,
  CheckCircle,
  Clock,
  Shield,
  AlertTriangle,
} from "lucide-react";

export default function TaxReports() {
  const navigate = useNavigate();
  const tenantId = useTenantId();

  const [loading, setLoading] = useState(true);
  const [dueDates, setDueDates] = useState<FilingDueDate[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const dues = await taxFilingService.getFilingsDueSoon(tenantId, 6);
        setDueDates(dues);
      } catch (error) {
        console.error("Failed to load tax due dates:", error);
        setDueDates([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [tenantId]);

  const nextWit = useMemo(() => {
    return dueDates
      .filter((d) => d.type === "monthly_wit")
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)[0];
  }, [dueDates]);

  const nextInss = useMemo(() => {
    return dueDates
      .filter((d) => d.type === "inss_monthly")
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)[0];
  }, [dueDates]);

  const hasOverdue = useMemo(() => dueDates.some((d) => d.isOverdue), [dueDates]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton className="h-8 w-8 rounded" />
              <div>
                <Skeleton className="h-8 w-40 mb-2" />
                <Skeleton className="h-4 w-72" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
              <Card><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.taxes} />
      <MainNavigation />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <AutoBreadcrumb className="mb-4" />

        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg shadow-slate-500/15">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Payroll Taxes & INSS</h1>
              <p className="text-muted-foreground">
                Timor-Leste compliance center for WIT (ATTL) and INSS monthly filings.
              </p>
            </div>
          </div>

          {hasOverdue ? (
            <Badge className="bg-red-100 text-red-800">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Action required
            </Badge>
          ) : (
            <Badge className="bg-emerald-100 text-emerald-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              On track
            </Badge>
          )}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              Upcoming Deadlines
            </CardTitle>
            <CardDescription>
              These deadlines are calculated from your filing periods; always verify against current ATTL/INSS guidance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Monthly WIT (ATTL)</span>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {nextWit ? `${nextWit.daysUntilDue}d` : "—"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Next: {nextWit ? `${nextWit.period} • due ${nextWit.dueDate}` : "No periods found"}
                </p>
              </div>

              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Monthly INSS</span>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {nextInss ? `${nextInss.daysUntilDue}d` : "—"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Next: {nextInss ? `${nextInss.period} • due ${nextInss.dueDate}` : "No periods found"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>ATTL Monthly WIT Return</CardTitle>
              <CardDescription>
                Generate, export (CSV/PDF), and track monthly Wage Income Tax filings.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <Button onClick={() => navigate("/reports/attl-monthly-wit")}>
                Open WIT Filing
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>INSS Monthly Return</CardTitle>
              <CardDescription>
                Generate and export monthly INSS contribution submissions and track filing status.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <Button onClick={() => navigate("/reports/inss-monthly")}>
                Open INSS Filing
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

