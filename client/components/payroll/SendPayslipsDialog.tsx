/**
 * Send Payslips Dialog
 * Bulk email payslips to employees after payroll approval
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Mail,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  Users,
  MailX,
} from "lucide-react";
import type { PayrollRun, PayrollRecord } from "@/types/payroll";
import { Employee, employeeService } from "@/services/employeeService";
import { settingsService } from "@/services/settingsService";
import {
  sendBulkPayslipEmails,
  type PayslipEmailData,
  type SendPayslipsResult,
} from "@/services/emailService";
import { formatCurrency } from "@/lib/payroll/constants";

interface SendPayslipsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payrollRun: PayrollRun;
  records: PayrollRecord[];
}

interface EmployeeEmailInfo {
  employeeId: string;
  employeeName: string;
  email: string | null;
  selected: boolean;
  record: PayrollRecord;
}

type SendStatus = "idle" | "preparing" | "sending" | "complete";

export function SendPayslipsDialog({
  open,
  onOpenChange,
  payrollRun,
  records,
}: SendPayslipsDialogProps) {
  const { toast } = useToast();
  const { session } = useTenant();
  const { user } = useAuth();
  const tenantId = session?.tid;

  const [employees, setEmployees] = useState<EmployeeEmailInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<SendStatus>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<SendPayslipsResult | null>(null);
  const [companyInfo, setCompanyInfo] = useState<{
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  }>({});

  // Load employee email info and company settings
  useEffect(() => {
    if (!open || !tenantId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Load employees to get emails
        const allEmployees = await employeeService.getAllEmployees(tenantId);
        const employeeMap = new Map<string, Employee>();
        allEmployees.forEach((emp) => {
          if (emp.id) employeeMap.set(emp.id, emp);
        });

        // Map records to employee email info
        const emailInfo: EmployeeEmailInfo[] = records.map((record) => {
          const employee = employeeMap.get(record.employeeId);
          const email = employee?.personalInfo?.email || null;
          return {
            employeeId: record.employeeId,
            employeeName: record.employeeName,
            email,
            selected: !!email, // Pre-select employees with email
            record,
          };
        });

        setEmployees(emailInfo);

        // Load company settings
        const settings = tenantId ? await settingsService.getSettings(tenantId) : null;
        if (settings?.companyDetails) {
          setCompanyInfo({
            name: settings.companyDetails.legalName,
            address: settings.companyDetails.registeredAddress,
            phone: undefined, // CompanyDetails doesn't have phone
            email: undefined, // CompanyDetails doesn't have email
          });
        }
      } catch (error) {
        console.error("Error loading employee data:", error);
        toast({
          title: "Error",
          description: "Failed to load employee information.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [open, tenantId, records, toast]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setProgress({ current: 0, total: 0 });
      setResult(null);
    }
  }, [open]);

  // Calculate stats
  const stats = useMemo(() => {
    const withEmail = employees.filter((e) => e.email);
    const withoutEmail = employees.filter((e) => !e.email);
    const selected = employees.filter((e) => e.selected && e.email);
    return {
      total: employees.length,
      withEmail: withEmail.length,
      withoutEmail: withoutEmail.length,
      selected: selected.length,
    };
  }, [employees]);

  // Toggle employee selection
  const toggleEmployee = (employeeId: string) => {
    setEmployees((prev) =>
      prev.map((e) =>
        e.employeeId === employeeId ? { ...e, selected: !e.selected } : e
      )
    );
  };

  // Select/deselect all with email
  const toggleSelectAll = () => {
    const allWithEmailSelected = employees
      .filter((e) => e.email)
      .every((e) => e.selected);

    setEmployees((prev) =>
      prev.map((e) =>
        e.email ? { ...e, selected: !allWithEmailSelected } : e
      )
    );
  };

  // Send payslips
  const handleSendPayslips = async () => {
    if (!tenantId || !user?.uid) {
      toast({
        title: "Error",
        description: "Missing tenant or user information.",
        variant: "destructive",
      });
      return;
    }

    const selectedEmployees = employees.filter((e) => e.selected && e.email);
    if (selectedEmployees.length === 0) {
      toast({
        title: "No Recipients",
        description: "Please select at least one employee with an email address.",
        variant: "destructive",
      });
      return;
    }

    setStatus("preparing");
    setProgress({ current: 0, total: selectedEmployees.length });

    try {
      // Prepare email data
      const payslipData: PayslipEmailData[] = selectedEmployees.map((emp) => ({
        employeeId: emp.employeeId,
        employeeEmail: emp.email!,
        employeeName: emp.employeeName,
        record: emp.record,
        payrollRun,
      }));

      setStatus("sending");

      // Send emails with progress callback
      const sendResult = await sendBulkPayslipEmails(
        tenantId,
        payslipData,
        companyInfo,
        user.uid,
        (current, total) => {
          setProgress({ current, total });
        }
      );

      setResult(sendResult);
      setStatus("complete");

      // Show summary toast
      if (sendResult.failed === 0 && sendResult.skipped === 0) {
        toast({
          title: "Payslips Sent",
          description: `Successfully sent ${sendResult.sent} payslip${sendResult.sent !== 1 ? "s" : ""}.`,
        });
      } else {
        toast({
          title: "Payslips Sent with Issues",
          description: `Sent: ${sendResult.sent}, Failed: ${sendResult.failed}, Skipped: ${sendResult.skipped}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error sending payslips:", error);
      toast({
        title: "Error",
        description: "Failed to send payslips. Please try again.",
        variant: "destructive",
      });
      setStatus("idle");
    }
  };

  const renderContent = () => {
    // Loading state
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-green-600 mb-4" />
          <p className="text-muted-foreground">Loading employee information...</p>
        </div>
      );
    }

    // Sending progress
    if (status === "preparing" || status === "sending") {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative mb-6">
            <Send className="h-12 w-12 text-green-600 animate-pulse" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {status === "preparing" ? "Preparing Payslips..." : "Sending Payslips..."}
          </h3>
          <p className="text-muted-foreground mb-4">
            {progress.current} of {progress.total} completed
          </p>
          <div className="w-full max-w-md">
            <Progress
              value={(progress.current / progress.total) * 100}
              className="h-2"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Please wait, this may take a few minutes...
          </p>
        </div>
      );
    }

    // Results
    if (status === "complete" && result) {
      return (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-600">{result.sent}</p>
              <p className="text-sm text-muted-foreground">Sent</p>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg text-center">
              <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-600">{result.failed}</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg text-center">
              <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
              <p className="text-sm text-muted-foreground">Skipped</p>
            </div>
          </div>

          {/* Error details */}
          {result.errors.length > 0 && (
            <div className="border rounded-lg">
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border-b">
                <h4 className="font-medium text-red-800 dark:text-red-200">
                  Errors ({result.errors.length})
                </h4>
              </div>
              <ScrollArea className="max-h-48">
                <div className="p-3 space-y-2">
                  {result.errors.map((err, idx) => {
                    const emp = employees.find((e) => e.employeeId === err.employeeId);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-medium">{emp?.employeeName || err.employeeId}</span>
                        <span className="text-red-600">{err.error}</span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </div>
      );
    }

    // Employee selection (idle state)
    return (
      <div className="space-y-4">
        {/* Stats summary */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">
                <strong>{stats.withEmail}</strong> with email
              </span>
            </div>
            {stats.withoutEmail > 0 && (
              <div className="flex items-center gap-2">
                <MailX className="h-5 w-5 text-yellow-600" />
                <span className="text-sm text-yellow-600">
                  <strong>{stats.withoutEmail}</strong> without email
                </span>
              </div>
            )}
          </div>
          <div>
            <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400">
              {stats.selected} selected
            </Badge>
          </div>
        </div>

        {/* Employee list */}
        <ScrollArea className="h-[350px] border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      stats.withEmail > 0 &&
                      employees.filter((e) => e.email).every((e) => e.selected)
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow
                  key={emp.employeeId}
                  className={!emp.email ? "opacity-60" : ""}
                >
                  <TableCell>
                    <Checkbox
                      checked={emp.selected}
                      onCheckedChange={() => toggleEmployee(emp.employeeId)}
                      disabled={!emp.email}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{emp.employeeName}</p>
                      <p className="text-sm text-muted-foreground">
                        {emp.record.department}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {emp.email ? (
                      <span className="text-sm">{emp.email}</span>
                    ) : (
                      <span className="text-sm text-yellow-600 flex items-center gap-1">
                        <MailX className="h-3 w-3" />
                        No email
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    {formatCurrency(emp.record.netPay)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-green-600" />
            Send Payslips
          </DialogTitle>
          <DialogDescription>
            Email payslips to employees for{" "}
            {new Date(payrollRun.periodStart).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </DialogDescription>
        </DialogHeader>

        {renderContent()}

        {status === "idle" && !loading && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendPayslips}
              disabled={stats.selected === 0}
              className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600"
            >
              <Send className="h-4 w-4 mr-2" />
              Send to {stats.selected} Employee{stats.selected !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SendPayslipsDialog;
