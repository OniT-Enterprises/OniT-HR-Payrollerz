/**
 * INSS Monthly Return Page
 *
 * Generate and track monthly Social Security (INSS) submissions for Timor-Leste.
 *
 * Note: INSS reporting is submitted via the Social Security portal.
 */

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  Building,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  Loader2,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/hooks/useSettings";
import {
  useTaxFilings,
  useTaxFilingsDueSoon,
  useGenerateMonthlyINSS,
  useSaveTaxFiling,
  useMarkTaxFilingAsFiled,
} from "@/hooks/useTaxFiling";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import type {
  FilingDueDate,
  MonthlyINSSReturn,
  SubmissionMethod,
  TaxFiling,
} from "@/types/tax-filing";
import type { CompanyDetails } from "@/types/settings";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800",
    icon: Clock,
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-100 text-red-800",
    icon: AlertTriangle,
  },
  filed: {
    label: "Filed",
    className: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  draft: {
    label: "Draft",
    className: "bg-gray-100 text-gray-800",
    icon: FileSpreadsheet,
  },
};

export default function INSSMonthly() {
  const { toast } = useToast();
  const { user } = useAuth();

  // React Query hooks
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: filings = [], isLoading: filingsLoading } = useTaxFilings("inss_monthly");
  const { data: allDueDates = [], isLoading: duesLoading } = useTaxFilingsDueSoon(6);
  const generateINSS = useGenerateMonthlyINSS();
  const saveFiling = useSaveTaxFiling();
  const markFiled = useMarkTaxFilingAsFiled();

  const company: Partial<CompanyDetails> = settings?.companyDetails || {};
  const dueDates = useMemo(() => allDueDates.filter(d => d.type === "inss_monthly"), [allDueDates]);
  const loading = settingsLoading || filingsLoading || duesLoading;

  // Local state
  const [selectedReturn, setSelectedReturn] = useState<MonthlyINSSReturn | null>(null);
  const [showMarkFiledDialog, setShowMarkFiledDialog] = useState(false);
  const [selectedFilingId, setSelectedFilingId] = useState<string | null>(null);

  const currentDate = new Date();
  const previousMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const defaultYear = previousMonthDate.getFullYear();
  const defaultMonth = String(previousMonthDate.getMonth() + 1).padStart(2, "0");
  const [selectedYear, setSelectedYear] = useState(String(defaultYear));
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const [filedMethod, setFiledMethod] = useState<SubmissionMethod>("inss_portal");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [filedNotes, setFiledNotes] = useState("");

  const handleGenerateReturn = async () => {
    const period = `${selectedYear}-${selectedMonth}`;
    try {
      const returnData = await generateINSS.mutateAsync({ period, company });
      setSelectedReturn(returnData);

      await saveFiling.mutateAsync({
        type: "inss_monthly",
        period,
        dataSnapshot: returnData,
        userId: user?.uid || "",
      });

      toast({
        title: "INSS return generated",
        description: `Monthly INSS return for ${period} has been generated.`,
      });
    } catch (error) {
      console.error("Failed to generate INSS return:", error);
      toast({
        title: "Error",
        description: "Failed to generate INSS return. Make sure you have paid payroll data for this period.",
        variant: "destructive",
      });
    }
  };

  const handleViewReturn = async (filing: TaxFiling) => {
    setSelectedReturn(filing.dataSnapshot as MonthlyINSSReturn);
    setSelectedFilingId(filing.id);
  };

  const handleExportCSV = () => {
    if (!selectedReturn) return;

    const header = [
      "Employee ID",
      "Full Name",
      "INSS Number",
      "Contribution Base (USD)",
      "Employee (4%)",
      "Employer (6%)",
      "Total (10%)",
    ];

    const rows = selectedReturn.employees.map((e) => [
      e.employeeId,
      e.fullName,
      e.inssNumber || "",
      e.contributionBase.toFixed(2),
      e.employeeContribution.toFixed(2),
      e.employerContribution.toFixed(2),
      e.totalContribution.toFixed(2),
    ]);

    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `INSS_Monthly_${selectedReturn.reportingPeriod}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Exported",
      description: "INSS return exported to CSV.",
    });
  };

  const handleOpenMarkFiled = (filingId: string) => {
    setSelectedFilingId(filingId);
    setShowMarkFiledDialog(true);
  };

  const handleMarkFiled = async () => {
    if (!selectedFilingId) return;
    try {
      await markFiled.mutateAsync({
        filingId: selectedFilingId,
        method: filedMethod,
        receiptNumber: receiptNumber || "",
        notes: filedNotes || "",
        userId: user?.uid || "",
      });

      toast({
        title: "Saved",
        description: "INSS filing marked as filed.",
      });

      setShowMarkFiledDialog(false);
      setReceiptNumber("");
      setFiledNotes("");
    } catch (error) {
      console.error("Failed to mark INSS filing as filed:", error);
      toast({
        title: "Error",
        description: "Failed to update filing status.",
        variant: "destructive",
      });
    }
  };

  const availableYears = useMemo(() => {
    const year = new Date().getFullYear();
    return [year, year - 1, year - 2].map(String);
  }, []);

  const overdueFiling = useMemo(
    () => dueDates.find((d) => d.status === "overdue"),
    [dueDates]
  );

  const upcomingDue = useMemo(() => {
    const upcoming = dueDates
      .filter((d) => d.status === "pending")
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    return upcoming[0];
  }, [dueDates]);

  const formatDueTask = (due: FilingDueDate | undefined | null) => {
    if (!due) return "INSS";
    return due.task === "payment" ? "INSS payment" : "INSS statement";
  };

  const generating = generateINSS.isPending || saveFiling.isPending;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton className="h-8 w-8 rounded" />
              <div>
                <Skeleton className="h-8 w-56 mb-2" />
                <Skeleton className="h-4 w-80" />
              </div>
            </div>
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="INSS Monthly Return" description="Generate and track monthly INSS submissions for Timor-Leste" />
      <MainNavigation />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <AutoBreadcrumb className="mb-4" />

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg shadow-slate-500/15">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">INSS Monthly Return</h1>
              <p className="text-muted-foreground">
                Generate and track monthly INSS contribution submissions.
              </p>
            </div>
          </div>
        </div>

        {(overdueFiling || upcomingDue) && (
          <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <CardContent className="p-4">
              {overdueFiling ? (
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-red-700 dark:text-red-300">
                      Overdue {formatDueTask(overdueFiling)}
                    </p>
                    <p className="text-muted-foreground">
                      {formatDueTask(overdueFiling)} for {overdueFiling.period} was due on {overdueFiling.dueDate}.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Upcoming {formatDueTask(upcomingDue)} due
                    </p>
                    <p className="text-muted-foreground">
                      {formatDueTask(upcomingDue)} for {upcomingDue?.period} is due on {upcomingDue?.dueDate} ({upcomingDue?.daysUntilDue} days)
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-muted-foreground" />
              Generate Monthly INSS Return
            </CardTitle>
            <CardDescription>
              Builds a monthly contribution summary from paid payroll runs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 flex gap-2">
                <Button onClick={handleGenerateReturn} disabled={generating} className="flex-1">
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <DollarSign className="h-4 w-4 mr-2" />
                      Generate Return
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedReturn && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>INSS Return - {selectedReturn.reportingPeriod}</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Employer: {selectedReturn.employerName || company.legalName || "-"} | TIN: {selectedReturn.employerTIN || company.tinNumber || "-"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Employees</p>
                  <p className="text-2xl font-bold">{selectedReturn.totalEmployees}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Contribution Base</p>
                  <p className="text-2xl font-bold">{formatCurrencyTL(selectedReturn.totalContributionBase)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Employee (4%)</p>
                  <p className="text-2xl font-bold">{formatCurrencyTL(selectedReturn.totalEmployeeContributions)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Employer (6%)</p>
                  <p className="text-2xl font-bold">{formatCurrencyTL(selectedReturn.totalEmployerContributions)}</p>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>INSS #</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Employee</TableHead>
                      <TableHead className="text-right">Employer</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedReturn.employees.map((emp) => (
                      <TableRow key={emp.employeeId}>
                        <TableCell>
                          <div className="font-medium">{emp.fullName}</div>
                          <div className="text-xs text-muted-foreground">{emp.employeeId}</div>
                        </TableCell>
                        <TableCell className={emp.inssNumber ? "" : "text-amber-700"}>
                          {emp.inssNumber || "Missing"}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrencyTL(emp.contributionBase)}</TableCell>
                        <TableCell className="text-right">{formatCurrencyTL(emp.employeeContribution)}</TableCell>
                        <TableCell className="text-right">{formatCurrencyTL(emp.employerContribution)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrencyTL(emp.totalContribution)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Filing Tracker</CardTitle>
            <CardDescription>Track your monthly INSS submissions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Employees</TableHead>
                    <TableHead className="text-right">Employee</TableHead>
                    <TableHead className="text-right">Employer</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No INSS filings yet. Generate your first return above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filings.map((f) => {
                      const status = STATUS_CONFIG[f.status];
                      const Icon = status.icon;
                      return (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.period}</TableCell>
                          <TableCell>{f.dueDate}</TableCell>
                          <TableCell>
                            <Badge className={status.className}>
                              <Icon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{f.employeeCount}</TableCell>
                          <TableCell className="text-right">{formatCurrencyTL(f.totalINSSEmployee || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrencyTL(f.totalINSSEmployer || 0)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleViewReturn(f)}>
                                View
                              </Button>
                              {f.status !== "filed" && (
                                <Button size="sm" onClick={() => handleOpenMarkFiled(f.id)}>
                                  Mark Filed
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showMarkFiledDialog} onOpenChange={setShowMarkFiledDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Filed</DialogTitle>
            <DialogDescription>
              Record submission details for this INSS return.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Submission Method</Label>
              <Select value={filedMethod} onValueChange={(v) => setFiledMethod(v as SubmissionMethod)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inss_portal">INSS Portal</SelectItem>
                  <SelectItem value="not_filed">Not filed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Receipt / Reference (optional)</Label>
              <Input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} placeholder="Reference number" />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={filedNotes} onChange={(e) => setFiledNotes(e.target.value)} placeholder="Notes about submission/payment" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMarkFiledDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkFiled}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
