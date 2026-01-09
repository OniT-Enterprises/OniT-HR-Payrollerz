import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import {
  DollarSign,
  Plus,
  Download,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Filter,
} from "lucide-react";

export default function BankTransfers() {
  const { toast } = useToast();
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");

  const [formData, setFormData] = useState({
    payrollPeriod: "",
    bankAccount: "",
    transferDate: "",
    notes: "",
  });

  // Mock data
  const bankAccounts = [
    { id: "main", name: "Main Business Account - ****1234" },
    { id: "payroll", name: "Payroll Account - ****5678" },
    { id: "backup", name: "Backup Account - ****9012" },
  ];

  const transfers = [
    {
      id: 1,
      payrollPeriod: "January 2024",
      amount: 125000.0,
      employeeCount: 25,
      transferDate: "2024-01-31",
      bankAccount: "Payroll Account - ****5678",
      status: "Completed",
      reference: "TXN-202401-001",
      initiatedBy: "Sarah Johnson",
    },
    {
      id: 2,
      payrollPeriod: "December 2023",
      amount: 118500.0,
      employeeCount: 24,
      transferDate: "2023-12-31",
      bankAccount: "Payroll Account - ****5678",
      status: "Completed",
      reference: "TXN-202312-001",
      initiatedBy: "Sarah Johnson",
    },
    {
      id: 3,
      payrollPeriod: "February 2024",
      amount: 132000.0,
      employeeCount: 26,
      transferDate: "2024-02-29",
      bankAccount: "Payroll Account - ****5678",
      status: "Pending",
      reference: "TXN-202402-001",
      initiatedBy: "Michael Chen",
    },
    {
      id: 4,
      payrollPeriod: "November 2023",
      amount: 115000.0,
      employeeCount: 23,
      transferDate: "2023-11-30",
      bankAccount: "Main Business Account - ****1234",
      status: "Failed",
      reference: "TXN-202311-001",
      initiatedBy: "Sarah Johnson",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completed":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "Pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "Failed":
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.payrollPeriod ||
      !formData.bankAccount ||
      !formData.transferDate
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Creating bank transfer:", formData);

      toast({
        title: "Success",
        description: "Bank transfer initiated successfully.",
      });

      setFormData({
        payrollPeriod: "",
        bankAccount: "",
        transferDate: "",
        notes: "",
      });
      setShowTransferDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate transfer. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = () => {
    const csvData = transfers.map((transfer) => ({
      "Payroll Period": transfer.payrollPeriod,
      Amount: `$${transfer.amount.toFixed(2)}`,
      "Employee Count": transfer.employeeCount,
      "Transfer Date": transfer.transferDate,
      "Bank Account": transfer.bankAccount,
      Status: transfer.status,
      Reference: transfer.reference,
      "Initiated By": transfer.initiatedBy,
    }));

    console.log("Exporting CSV data:", csvData);
    toast({
      title: "Export Started",
      description: "CSV file will be downloaded shortly.",
    });
  };

  const filteredTransfers = transfers.filter((transfer) => {
    if (
      selectedStatus &&
      selectedStatus !== "all" &&
      transfer.status !== selectedStatus
    )
      return false;
    if (
      selectedPeriod &&
      selectedPeriod !== "all" &&
      transfer.payrollPeriod !== selectedPeriod
    )
      return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Bank Transfers
            </h1>
            <p className="text-gray-600">
              Manage payroll bank transfers and transaction history
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      This Month
                    </p>
                    <p className="text-2xl font-bold">$132,000</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Pending Transfers
                    </p>
                    <p className="text-2xl font-bold">1</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Completed
                    </p>
                    <p className="text-2xl font-bold">2</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Failed</p>
                    <p className="text-2xl font-bold">1</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="status-filter">Status</Label>
                  <Select
                    value={selectedStatus}
                    onValueChange={setSelectedStatus}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="period-filter">Payroll Period</Label>
                  <Select
                    value={selectedPeriod}
                    onValueChange={setSelectedPeriod}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All periods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All periods</SelectItem>
                      <SelectItem value="February 2024">
                        February 2024
                      </SelectItem>
                      <SelectItem value="January 2024">January 2024</SelectItem>
                      <SelectItem value="December 2023">
                        December 2023
                      </SelectItem>
                      <SelectItem value="November 2023">
                        November 2023
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transfers Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Transfer History
                  </CardTitle>
                  <CardDescription>
                    Showing {filteredTransfers.length} transfers
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Dialog
                    open={showTransferDialog}
                    onOpenChange={setShowTransferDialog}
                  >
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        New Transfer
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Initiate Bank Transfer</DialogTitle>
                        <DialogDescription>
                          Set up a new payroll bank transfer
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="payroll-period">
                            Payroll Period *
                          </Label>
                          <Input
                            id="payroll-period"
                            value={formData.payrollPeriod}
                            onChange={(e) =>
                              handleInputChange("payrollPeriod", e.target.value)
                            }
                            placeholder="e.g., March 2024"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="bank-account">Bank Account *</Label>
                          <Select
                            value={formData.bankAccount}
                            onValueChange={(value) =>
                              handleInputChange("bankAccount", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select bank account" />
                            </SelectTrigger>
                            <SelectContent>
                              {bankAccounts.map((account) => (
                                <SelectItem
                                  key={account.id}
                                  value={account.name}
                                >
                                  {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="transfer-date">Transfer Date *</Label>
                          <Input
                            id="transfer-date"
                            type="date"
                            value={formData.transferDate}
                            onChange={(e) =>
                              handleInputChange("transferDate", e.target.value)
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="notes">Notes</Label>
                          <Input
                            id="notes"
                            value={formData.notes}
                            onChange={(e) =>
                              handleInputChange("notes", e.target.value)
                            }
                            placeholder="Optional notes"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowTransferDialog(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button type="submit" className="flex-1">
                            Initiate Transfer
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payroll Period</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Transfer Date</TableHead>
                    <TableHead>Bank Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell className="font-medium">
                        {transfer.payrollPeriod}
                      </TableCell>
                      <TableCell>${transfer.amount.toLocaleString()}</TableCell>
                      <TableCell>{transfer.employeeCount}</TableCell>
                      <TableCell>{transfer.transferDate}</TableCell>
                      <TableCell>{transfer.bankAccount}</TableCell>
                      <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {transfer.reference}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
