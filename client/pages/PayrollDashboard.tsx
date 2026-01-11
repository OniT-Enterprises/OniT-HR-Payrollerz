/**
 * Payroll Dashboard - Section Hub
 * Quick access to all payroll features
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { employeeService } from "@/services/employeeService";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import {
  Calculator,
  DollarSign,
  FileText,
  Banknote,
  FileSpreadsheet,
  Heart,
  ChevronRight,
  Calendar,
  Users,
  CheckCircle,
} from "lucide-react";
import { sectionThemes } from "@/lib/sectionTheme";
import { SEO, seoConfig } from "@/components/SEO";

const theme = sectionThemes.payroll;

// Payroll links
const PAYROLL_LINKS = [
  {
    label: "Run Payroll",
    description: "Process payroll for current period",
    path: "/payroll/run",
    icon: Calculator,
    color: "bg-emerald-500",
    primary: true,
  },
  {
    label: "Payroll History",
    description: "View past payroll runs",
    path: "/payroll/history",
    icon: FileText,
    color: "bg-blue-500",
  },
  {
    label: "Bank Transfers",
    description: "Manage salary payments",
    path: "/payroll/transfers",
    icon: Banknote,
    color: "bg-violet-500",
  },
  {
    label: "Tax Reports",
    description: "WIT and INSS reports",
    path: "/payroll/taxes",
    icon: FileSpreadsheet,
    color: "bg-amber-500",
  },
  {
    label: "Benefits",
    description: "Employee benefits enrollment",
    path: "/payroll/benefits",
    icon: Heart,
    color: "bg-pink-500",
  },
  {
    label: "Deductions",
    description: "Loans and advances",
    path: "/payroll/deductions",
    icon: DollarSign,
    color: "bg-red-500",
  },
];

export default function PayrollDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    monthlyPayroll: 0,
    nextPayDate: "",
    lastPayrollDate: "",
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const employees = await employeeService.getAllEmployees();
      const activeEmployees = employees.filter((e) => e.status === "active");
      const totalPayroll = activeEmployees.reduce(
        (sum, emp) => sum + (emp.compensation?.monthlySalary || 0),
        0
      );

      // Calculate next pay date (25th of current or next month)
      const now = new Date();
      let nextPay = new Date(now.getFullYear(), now.getMonth(), 25);
      if (now.getDate() > 25) {
        nextPay = new Date(now.getFullYear(), now.getMonth() + 1, 25);
      }

      setStats({
        totalEmployees: activeEmployees.length,
        monthlyPayroll: totalPayroll,
        nextPayDate: nextPay.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        lastPayrollDate: "Dec 25, 2025", // Would come from payroll history
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate days until next payroll
  const getDaysUntilPayday = () => {
    const now = new Date();
    let nextPay = new Date(now.getFullYear(), now.getMonth(), 25);
    if (now.getDate() > 25) {
      nextPay = new Date(now.getFullYear(), now.getMonth() + 1, 25);
    }
    const diff = Math.ceil((nextPay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const daysUntilPayday = getDaysUntilPayday();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-7xl mx-auto">
          <Skeleton className="h-6 w-32 mb-6" />
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96 mb-8" />
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.payroll} />
      <MainNavigation />

      <div className="p-6 max-w-7xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header with Section Accent */}
        <div className={`-mx-6 px-6 py-6 mb-8 ${theme.bgSubtle} border-b ${theme.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-lg`}>
                <Calculator className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Payroll</h1>
                <p className="text-muted-foreground">
                  Process payroll, manage payments, and generate reports
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/payroll/run")} size="lg" className={`bg-gradient-to-r ${theme.gradient} hover:opacity-90`}>
              <Calculator className="h-5 w-5 mr-2" />
              Run Payroll
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card className={theme.borderLeft}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.totalEmployees}</p>
                  <p className="text-sm text-muted-foreground">Employees</p>
                </div>
                <div className={`h-12 w-12 rounded-full ${theme.bg} flex items-center justify-center`}>
                  <Users className={`h-6 w-6 ${theme.text}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={theme.borderLeft}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{formatCurrencyTL(stats.monthlyPayroll)}</p>
                  <p className="text-sm text-muted-foreground">Monthly Payroll</p>
                </div>
                <div className={`h-12 w-12 rounded-full ${theme.bg} flex items-center justify-center`}>
                  <DollarSign className={`h-6 w-6 ${theme.text}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={theme.borderLeft}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.nextPayDate}</p>
                  <p className="text-sm text-muted-foreground">Next Pay Date</p>
                </div>
                <div className={`h-12 w-12 rounded-full ${theme.bg} flex items-center justify-center`}>
                  <Calendar className={`h-6 w-6 ${theme.text}`} />
                </div>
              </div>
              {daysUntilPayday <= 7 && (
                <Badge className={`mt-2 ${theme.bg} ${theme.text}`}>
                  {daysUntilPayday} days away
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card className={theme.borderLeft}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold">{stats.lastPayrollDate}</p>
                  <p className="text-sm text-muted-foreground">Last Payroll</p>
                </div>
                <div className={`h-12 w-12 rounded-full ${theme.bg} flex items-center justify-center`}>
                  <CheckCircle className={`h-6 w-6 ${theme.text}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payroll Links */}
        <div className="grid gap-4 md:grid-cols-3">
          {PAYROLL_LINKS.map((link) => {
            const LinkIcon = link.icon;
            return (
              <Card
                key={link.path}
                className={`cursor-pointer hover:shadow-md transition-all ${
                  link.primary ? "ring-2 ring-primary/20" : ""
                }`}
                onClick={() => navigate(link.path)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-lg ${link.color} flex items-center justify-center flex-shrink-0`}>
                      <LinkIcon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold flex items-center gap-2">
                        {link.label}
                        {link.primary && (
                          <Badge variant="secondary" className="text-xs">
                            Primary
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">{link.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* TL Compliance Info */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Timor-Leste Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium mb-1">Income Tax (WIT)</p>
                <p className="text-muted-foreground">10% on income above $500/month</p>
                <p className="text-xs text-muted-foreground mt-1">Due: 15th of following month</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium mb-1">Social Security (INSS)</p>
                <p className="text-muted-foreground">Employee: 4% | Employer: 6%</p>
                <p className="text-xs text-muted-foreground mt-1">Due: 10th of following month</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium mb-1">Minimum Wage</p>
                <p className="text-muted-foreground">$115 USD per month</p>
                <p className="text-xs text-muted-foreground mt-1">44 hours/week standard</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
