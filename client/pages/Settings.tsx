import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/contexts/TenantContext";
import { settingsService } from "@/services/settingsService";
import {
  TenantSettings,
  CompanyDetails,
  CompanyStructure,
  PaymentStructure,
  TimeOffPolicies,
  PayrollConfig,
  BusinessType,
  BusinessSector,
  PaymentMethod,
  PayrollFrequency,
  WorkLocation,
  DepartmentConfig,
  BankAccountConfig,
  SECTOR_DEPARTMENT_PRESETS,
  TL_DEFAULT_PAYROLL_CONFIG,
  TL_DEFAULT_LEAVE_POLICIES,
} from "@/types/settings";
import {
  Settings as SettingsIcon,
  Building,
  Building2,
  CreditCard,
  Calendar,
  Calculator,
  Users,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  MapPin,
  Briefcase,
  DollarSign,
  Percent,
  Clock,
} from "lucide-react";

// ============================================
// Loading Skeleton
// ============================================

function SettingsSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-8 w-8" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-10 w-full" />
          </CardHeader>
          <CardContent className="space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// Setup Progress Indicator
// ============================================

interface SetupProgressProps {
  progress: Record<string, boolean>;
}

function SetupProgress({ progress }: SetupProgressProps) {
  const steps = [
    { key: "companyDetails", label: "Company Details" },
    { key: "companyStructure", label: "Structure" },
    { key: "paymentStructure", label: "Payment" },
    { key: "timeOffPolicies", label: "Time Off" },
    { key: "payrollConfig", label: "Payroll" },
  ];

  const completed = Object.values(progress).filter(Boolean).length;
  const total = steps.length;

  return (
    <Card className="mb-6">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Setup Progress</span>
          <Badge variant={completed === total ? "default" : "secondary"}>
            {completed}/{total} Complete
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

// ============================================
// Main Settings Component
// ============================================

export default function Settings() {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("company");
  const [settings, setSettings] = useState<TenantSettings | null>(null);

  // Form states
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails>({
    legalName: "",
    registeredAddress: "",
    city: "Dili",
    country: "Timor-Leste",
    tinNumber: "",
    businessType: "Lda",
  });

  const [companyStructure, setCompanyStructure] = useState<CompanyStructure>({
    businessSector: "other",
    workLocations: [],
    departments: [],
    employeeGrades: [],
  });

  const [paymentStructure, setPaymentStructure] = useState<PaymentStructure>({
    paymentMethods: ["bank_transfer"],
    primaryPaymentMethod: "bank_transfer",
    bankAccounts: [],
    employmentTypes: ["open_ended", "fixed_term"],
    payrollFrequencies: ["monthly"],
    payrollPeriods: [],
  });

  const [timeOffPolicies, setTimeOffPolicies] = useState<TimeOffPolicies>(
    TL_DEFAULT_LEAVE_POLICIES
  );

  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig>(
    TL_DEFAULT_PAYROLL_CONFIG
  );

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [tenantId]);

  const loadSettings = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let existingSettings = await settingsService.getSettings(tenantId);

      if (!existingSettings) {
        existingSettings = await settingsService.createSettings(tenantId);
      }

      setSettings(existingSettings);
      setCompanyDetails(existingSettings.companyDetails);
      setCompanyStructure(existingSettings.companyStructure);
      setPaymentStructure(existingSettings.paymentStructure);
      setTimeOffPolicies(existingSettings.timeOffPolicies);
      setPayrollConfig(existingSettings.payrollConfig);
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Save handlers
  const saveCompanyDetails = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await settingsService.updateCompanyDetails(tenantId, companyDetails);
      toast({ title: "Saved", description: "Company details updated" });
      loadSettings();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveCompanyStructure = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await settingsService.updateCompanyStructure(tenantId, companyStructure);
      toast({ title: "Saved", description: "Company structure updated" });
      loadSettings();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const savePaymentStructure = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await settingsService.updatePaymentStructure(tenantId, paymentStructure);
      toast({ title: "Saved", description: "Payment structure updated" });
      loadSettings();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveTimeOffPolicies = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await settingsService.updateTimeOffPolicies(tenantId, timeOffPolicies);
      toast({ title: "Saved", description: "Time-off policies updated" });
      loadSettings();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const savePayrollConfig = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await settingsService.updatePayrollConfig(tenantId, payrollConfig);
      toast({ title: "Saved", description: "Payroll configuration updated" });
      loadSettings();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Helper functions
  const addWorkLocation = () => {
    const newLocation: WorkLocation = {
      id: `loc_${Date.now()}`,
      name: "",
      address: "",
      city: "Dili",
      isHeadquarters: companyStructure.workLocations.length === 0,
      isActive: true,
    };
    setCompanyStructure({
      ...companyStructure,
      workLocations: [...companyStructure.workLocations, newLocation],
    });
  };

  const addDepartment = () => {
    const newDept: DepartmentConfig = {
      id: `dept_${Date.now()}`,
      name: "",
      isActive: true,
    };
    setCompanyStructure({
      ...companyStructure,
      departments: [...companyStructure.departments, newDept],
    });
  };

  const addBankAccount = () => {
    const newAccount: BankAccountConfig = {
      id: `bank_${Date.now()}`,
      purpose: "payroll",
      bankName: "",
      accountName: "",
      accountNumber: "",
      isActive: true,
    };
    setPaymentStructure({
      ...paymentStructure,
      bankAccounts: [...paymentStructure.bankAccounts, newAccount],
    });
  };

  const loadSectorDepartments = (sector: BusinessSector) => {
    const presets = SECTOR_DEPARTMENT_PRESETS[sector] || [];
    const departments: DepartmentConfig[] = presets.map((name, index) => ({
      id: `dept_${Date.now()}_${index}`,
      name,
      isActive: true,
    }));
    setCompanyStructure({
      ...companyStructure,
      businessSector: sector,
      departments,
    });
  };

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Company Settings</h1>
            <p className="text-muted-foreground">
              Configure your company, payroll, and HR policies
            </p>
          </div>
        </div>

        {/* Setup Progress */}
        {settings && !settings.setupComplete && (
          <SetupProgress progress={settings.setupProgress} />
        )}

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="company" className="gap-2">
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Company</span>
            </TabsTrigger>
            <TabsTrigger value="structure" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Structure</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Payment</span>
            </TabsTrigger>
            <TabsTrigger value="timeoff" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Time Off</span>
            </TabsTrigger>
            <TabsTrigger value="payroll" className="gap-2">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Payroll</span>
            </TabsTrigger>
          </TabsList>

          {/* ================================ */}
          {/* Company Details Tab */}
          {/* ================================ */}
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Company Details</CardTitle>
                <CardDescription>
                  Basic information about your company for legal and tax purposes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="legalName">Legal Company Name *</Label>
                    <Input
                      id="legalName"
                      value={companyDetails.legalName}
                      onChange={(e) =>
                        setCompanyDetails({ ...companyDetails, legalName: e.target.value })
                      }
                      placeholder="e.g., OniT Security, Lda"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tradingName">Trading Name (if different)</Label>
                    <Input
                      id="tradingName"
                      value={companyDetails.tradingName || ""}
                      onChange={(e) =>
                        setCompanyDetails({ ...companyDetails, tradingName: e.target.value })
                      }
                      placeholder="e.g., OniT Guard Services"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessType">Business Type *</Label>
                    <Select
                      value={companyDetails.businessType}
                      onValueChange={(value: BusinessType) =>
                        setCompanyDetails({ ...companyDetails, businessType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SA">Sociedade Anônima (S.A.)</SelectItem>
                        <SelectItem value="Lda">Sociedade por Quotas (Lda)</SelectItem>
                        <SelectItem value="Unipessoal">Unipessoal</SelectItem>
                        <SelectItem value="ENIN">ENIN</SelectItem>
                        <SelectItem value="NGO">NGO / Non-Profit</SelectItem>
                        <SelectItem value="Government">Government</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tinNumber">TIN Number *</Label>
                    <Input
                      id="tinNumber"
                      value={companyDetails.tinNumber}
                      onChange={(e) =>
                        setCompanyDetails({ ...companyDetails, tinNumber: e.target.value })
                      }
                      placeholder="Tax Identification Number"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">Address</h3>
                  <div className="space-y-2">
                    <Label htmlFor="address">Registered Address *</Label>
                    <Textarea
                      id="address"
                      value={companyDetails.registeredAddress}
                      onChange={(e) =>
                        setCompanyDetails({
                          ...companyDetails,
                          registeredAddress: e.target.value,
                        })
                      }
                      placeholder="Street address, building name, etc."
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={companyDetails.city}
                        onChange={(e) =>
                          setCompanyDetails({ ...companyDetails, city: e.target.value })
                        }
                        placeholder="e.g., Dili"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        value={companyDetails.country}
                        disabled
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={companyDetails.phone || ""}
                      onChange={(e) =>
                        setCompanyDetails({ ...companyDetails, phone: e.target.value })
                      }
                      placeholder="+670 XXX XXXX"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={companyDetails.email || ""}
                      onChange={(e) =>
                        setCompanyDetails({ ...companyDetails, email: e.target.value })
                      }
                      placeholder="info@company.com"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={saveCompanyDetails} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Company Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================ */}
          {/* Company Structure Tab */}
          {/* ================================ */}
          <TabsContent value="structure">
            <Card>
              <CardHeader>
                <CardTitle>Company Structure</CardTitle>
                <CardDescription>
                  Define your business sector, locations, and departments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Business Sector */}
                <div className="space-y-2">
                  <Label>Business Sector *</Label>
                  <Select
                    value={companyStructure.businessSector}
                    onValueChange={(value: BusinessSector) => loadSectorDepartments(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="security">Security Services</SelectItem>
                      <SelectItem value="hotel">Hotel & Hospitality</SelectItem>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                      <SelectItem value="trading">Trading</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="construction">Construction</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="ngo">NGO</SelectItem>
                      <SelectItem value="government">Government</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Selecting a sector will suggest common departments
                  </p>
                </div>

                <Separator />

                {/* Work Locations */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Work Locations</h3>
                      <p className="text-sm text-muted-foreground">
                        Add all your office and work locations
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={addWorkLocation}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Location
                    </Button>
                  </div>

                  {companyStructure.workLocations.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No locations added yet</p>
                      <Button variant="link" onClick={addWorkLocation}>
                        Add your first location
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {companyStructure.workLocations.map((location, index) => (
                        <div
                          key={location.id}
                          className="flex items-start gap-4 p-4 border rounded-lg"
                        >
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                              placeholder="Location name"
                              value={location.name}
                              onChange={(e) => {
                                const updated = [...companyStructure.workLocations];
                                updated[index] = { ...location, name: e.target.value };
                                setCompanyStructure({
                                  ...companyStructure,
                                  workLocations: updated,
                                });
                              }}
                            />
                            <Input
                              placeholder="Address"
                              value={location.address}
                              onChange={(e) => {
                                const updated = [...companyStructure.workLocations];
                                updated[index] = { ...location, address: e.target.value };
                                setCompanyStructure({
                                  ...companyStructure,
                                  workLocations: updated,
                                });
                              }}
                            />
                            <Input
                              placeholder="City"
                              value={location.city}
                              onChange={(e) => {
                                const updated = [...companyStructure.workLocations];
                                updated[index] = { ...location, city: e.target.value };
                                setCompanyStructure({
                                  ...companyStructure,
                                  workLocations: updated,
                                });
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            {location.isHeadquarters && (
                              <Badge variant="secondary">HQ</Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setCompanyStructure({
                                  ...companyStructure,
                                  workLocations: companyStructure.workLocations.filter(
                                    (l) => l.id !== location.id
                                  ),
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Departments */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Departments</h3>
                      <p className="text-sm text-muted-foreground">
                        Define your organizational departments
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={addDepartment}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Department
                    </Button>
                  </div>

                  {companyStructure.departments.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <Briefcase className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No departments defined</p>
                      <p className="text-sm text-muted-foreground">
                        Select a business sector above to auto-populate
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {companyStructure.departments.map((dept, index) => (
                        <div
                          key={dept.id}
                          className="flex items-center gap-2 p-3 border rounded-lg"
                        >
                          <Input
                            placeholder="Department name"
                            value={dept.name}
                            onChange={(e) => {
                              const updated = [...companyStructure.departments];
                              updated[index] = { ...dept, name: e.target.value };
                              setCompanyStructure({
                                ...companyStructure,
                                departments: updated,
                              });
                            }}
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setCompanyStructure({
                                ...companyStructure,
                                departments: companyStructure.departments.filter(
                                  (d) => d.id !== dept.id
                                ),
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={saveCompanyStructure} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Structure
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================ */}
          {/* Payment Structure Tab */}
          {/* ================================ */}
          <TabsContent value="payment">
            <Card>
              <CardHeader>
                <CardTitle>Payment Structure</CardTitle>
                <CardDescription>
                  Configure payment methods, bank accounts, and payroll periods
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Payment Methods */}
                <div className="space-y-4">
                  <h3 className="font-medium">Payment Methods</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { value: "bank_transfer", label: "Bank Transfer" },
                      { value: "cash", label: "Cash" },
                      { value: "cheque", label: "Cheque" },
                      { value: "other", label: "Other" },
                    ].map((method) => (
                      <div
                        key={method.value}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          paymentStructure.paymentMethods.includes(
                            method.value as PaymentMethod
                          )
                            ? "border-primary bg-primary/5"
                            : "hover:border-muted-foreground"
                        }`}
                        onClick={() => {
                          const methods = paymentStructure.paymentMethods.includes(
                            method.value as PaymentMethod
                          )
                            ? paymentStructure.paymentMethods.filter(
                                (m) => m !== method.value
                              )
                            : [...paymentStructure.paymentMethods, method.value as PaymentMethod];
                          setPaymentStructure({ ...paymentStructure, paymentMethods: methods });
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {paymentStructure.paymentMethods.includes(
                            method.value as PaymentMethod
                          ) ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium">{method.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Bank Accounts */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Bank Accounts</h3>
                      <p className="text-sm text-muted-foreground">
                        Add accounts for payroll, tax, and social security payments
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={addBankAccount}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Account
                    </Button>
                  </div>

                  {paymentStructure.bankAccounts.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <CreditCard className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No bank accounts configured</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {paymentStructure.bankAccounts.map((account, index) => (
                        <div key={account.id} className="p-4 border rounded-lg space-y-4">
                          <div className="flex items-center justify-between">
                            <Select
                              value={account.purpose}
                              onValueChange={(value: "payroll" | "tax" | "social_security" | "general") => {
                                const updated = [...paymentStructure.bankAccounts];
                                updated[index] = { ...account, purpose: value };
                                setPaymentStructure({
                                  ...paymentStructure,
                                  bankAccounts: updated,
                                });
                              }}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="payroll">Payroll</SelectItem>
                                <SelectItem value="tax">Tax Payments</SelectItem>
                                <SelectItem value="social_security">Social Security</SelectItem>
                                <SelectItem value="general">General</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setPaymentStructure({
                                  ...paymentStructure,
                                  bankAccounts: paymentStructure.bankAccounts.filter(
                                    (a) => a.id !== account.id
                                  ),
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                              placeholder="Bank Name"
                              value={account.bankName}
                              onChange={(e) => {
                                const updated = [...paymentStructure.bankAccounts];
                                updated[index] = { ...account, bankName: e.target.value };
                                setPaymentStructure({
                                  ...paymentStructure,
                                  bankAccounts: updated,
                                });
                              }}
                            />
                            <Input
                              placeholder="Account Name"
                              value={account.accountName}
                              onChange={(e) => {
                                const updated = [...paymentStructure.bankAccounts];
                                updated[index] = { ...account, accountName: e.target.value };
                                setPaymentStructure({
                                  ...paymentStructure,
                                  bankAccounts: updated,
                                });
                              }}
                            />
                            <Input
                              placeholder="Account Number"
                              value={account.accountNumber}
                              onChange={(e) => {
                                const updated = [...paymentStructure.bankAccounts];
                                updated[index] = { ...account, accountNumber: e.target.value };
                                setPaymentStructure({
                                  ...paymentStructure,
                                  bankAccounts: updated,
                                });
                              }}
                            />
                            <Input
                              placeholder="Branch Code (optional)"
                              value={account.branchCode || ""}
                              onChange={(e) => {
                                const updated = [...paymentStructure.bankAccounts];
                                updated[index] = { ...account, branchCode: e.target.value };
                                setPaymentStructure({
                                  ...paymentStructure,
                                  bankAccounts: updated,
                                });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Payroll Frequency */}
                <div className="space-y-4">
                  <h3 className="font-medium">Payroll Frequency</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { value: "hourly", label: "Hourly" },
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "bi_weekly", label: "Bi-Weekly" },
                      { value: "monthly", label: "Monthly" },
                    ].map((freq) => (
                      <div
                        key={freq.value}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          paymentStructure.payrollFrequencies.includes(
                            freq.value as PayrollFrequency
                          )
                            ? "border-primary bg-primary/5"
                            : "hover:border-muted-foreground"
                        }`}
                        onClick={() => {
                          const frequencies = paymentStructure.payrollFrequencies.includes(
                            freq.value as PayrollFrequency
                          )
                            ? paymentStructure.payrollFrequencies.filter(
                                (f) => f !== freq.value
                              )
                            : [...paymentStructure.payrollFrequencies, freq.value as PayrollFrequency];
                          setPaymentStructure({
                            ...paymentStructure,
                            payrollFrequencies: frequencies,
                          });
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {paymentStructure.payrollFrequencies.includes(
                            freq.value as PayrollFrequency
                          ) ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium">{freq.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={savePaymentStructure} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Payment Structure
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================ */}
          {/* Time Off Policies Tab */}
          {/* ================================ */}
          <TabsContent value="timeoff">
            <Card>
              <CardHeader>
                <CardTitle>Time Off Policies</CardTitle>
                <CardDescription>
                  Configure leave entitlements based on Timor-Leste labor law
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Timor-Leste Labor Code (Law 4/2012)
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Default values are set according to TL labor law. Adjust only if your
                        company offers better benefits.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Probation Period */}
                <div className="space-y-2">
                  <Label>Probation Period Before Leave Eligibility</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      min={0}
                      max={12}
                      value={timeOffPolicies.probationMonthsBeforeLeave}
                      onChange={(e) =>
                        setTimeOffPolicies({
                          ...timeOffPolicies,
                          probationMonthsBeforeLeave: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-24"
                    />
                    <span className="text-muted-foreground">months</span>
                  </div>
                </div>

                <Separator />

                {/* Leave Types */}
                <div className="space-y-4">
                  <h3 className="font-medium">Leave Entitlements</h3>

                  {/* Annual Leave */}
                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        <span className="font-medium">Annual Leave</span>
                      </div>
                      <Badge variant="secondary">
                        {timeOffPolicies.annualLeave.daysPerYear} days
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Days per Year</Label>
                        <Input
                          type="number"
                          min={0}
                          value={timeOffPolicies.annualLeave.daysPerYear}
                          onChange={(e) =>
                            setTimeOffPolicies({
                              ...timeOffPolicies,
                              annualLeave: {
                                ...timeOffPolicies.annualLeave,
                                daysPerYear: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Carry Over Days</Label>
                        <Input
                          type="number"
                          min={0}
                          value={timeOffPolicies.annualLeave.maxCarryOverDays || 0}
                          onChange={(e) =>
                            setTimeOffPolicies({
                              ...timeOffPolicies,
                              annualLeave: {
                                ...timeOffPolicies.annualLeave,
                                maxCarryOverDays: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <Switch
                          checked={timeOffPolicies.annualLeave.carryOverAllowed}
                          onCheckedChange={(checked) =>
                            setTimeOffPolicies({
                              ...timeOffPolicies,
                              annualLeave: {
                                ...timeOffPolicies.annualLeave,
                                carryOverAllowed: checked,
                              },
                            })
                          }
                        />
                        <Label>Allow carry over</Label>
                      </div>
                    </div>
                  </div>

                  {/* Sick Leave */}
                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-orange-500" />
                        <span className="font-medium">Sick Leave</span>
                      </div>
                      <Badge variant="secondary">
                        {timeOffPolicies.sickLeave.daysPerYear} days
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Days per Year</Label>
                        <Input
                          type="number"
                          min={0}
                          value={timeOffPolicies.sickLeave.daysPerYear}
                          onChange={(e) =>
                            setTimeOffPolicies({
                              ...timeOffPolicies,
                              sickLeave: {
                                ...timeOffPolicies.sickLeave,
                                daysPerYear: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Paid Percentage</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={timeOffPolicies.sickLeave.paidPercentage}
                            onChange={(e) =>
                              setTimeOffPolicies({
                                ...timeOffPolicies,
                                sickLeave: {
                                  ...timeOffPolicies.sickLeave,
                                  paidPercentage: parseInt(e.target.value) || 0,
                                },
                              })
                            }
                          />
                          <Percent className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <Switch
                          checked={timeOffPolicies.sickLeave.requiresCertificate}
                          onCheckedChange={(checked) =>
                            setTimeOffPolicies({
                              ...timeOffPolicies,
                              sickLeave: {
                                ...timeOffPolicies.sickLeave,
                                requiresCertificate: checked,
                              },
                            })
                          }
                        />
                        <Label>Requires medical certificate</Label>
                      </div>
                    </div>
                  </div>

                  {/* Maternity Leave */}
                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-pink-500" />
                        <span className="font-medium">Maternity Leave</span>
                      </div>
                      <Badge variant="secondary">
                        {Math.round(timeOffPolicies.maternityLeave.daysPerYear / 7)} weeks
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Days (12 weeks = 84 days)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={timeOffPolicies.maternityLeave.daysPerYear}
                          onChange={(e) =>
                            setTimeOffPolicies({
                              ...timeOffPolicies,
                              maternityLeave: {
                                ...timeOffPolicies.maternityLeave,
                                daysPerYear: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Paid Percentage</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={timeOffPolicies.maternityLeave.paidPercentage}
                            onChange={(e) =>
                              setTimeOffPolicies({
                                ...timeOffPolicies,
                                maternityLeave: {
                                  ...timeOffPolicies.maternityLeave,
                                  paidPercentage: parseInt(e.target.value) || 0,
                                },
                              })
                            }
                          />
                          <Percent className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Paternity Leave */}
                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-500" />
                        <span className="font-medium">Paternity Leave</span>
                      </div>
                      <Badge variant="secondary">
                        {timeOffPolicies.paternityLeave.daysPerYear} days
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Days</Label>
                        <Input
                          type="number"
                          min={0}
                          value={timeOffPolicies.paternityLeave.daysPerYear}
                          onChange={(e) =>
                            setTimeOffPolicies({
                              ...timeOffPolicies,
                              paternityLeave: {
                                ...timeOffPolicies.paternityLeave,
                                daysPerYear: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Paid Percentage</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={timeOffPolicies.paternityLeave.paidPercentage}
                            onChange={(e) =>
                              setTimeOffPolicies({
                                ...timeOffPolicies,
                                paternityLeave: {
                                  ...timeOffPolicies.paternityLeave,
                                  paidPercentage: parseInt(e.target.value) || 0,
                                },
                              })
                            }
                          />
                          <Percent className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={saveTimeOffPolicies} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Time Off Policies
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================ */}
          {/* Payroll Config Tab */}
          {/* ================================ */}
          <TabsContent value="payroll">
            <Card>
              <CardHeader>
                <CardTitle>Payroll Configuration</CardTitle>
                <CardDescription>
                  Tax, social security, and overtime settings for Timor-Leste
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tax Settings */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Wage Income Tax (WIT)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Resident Tax Threshold</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">$</span>
                        <Input
                          type="number"
                          min={0}
                          value={payrollConfig.tax.residentThreshold}
                          onChange={(e) =>
                            setPayrollConfig({
                              ...payrollConfig,
                              tax: {
                                ...payrollConfig.tax,
                                residentThreshold: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        First ${payrollConfig.tax.residentThreshold} is tax-free for residents
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Resident Rate</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={payrollConfig.tax.residentRate}
                          onChange={(e) =>
                            setPayrollConfig({
                              ...payrollConfig,
                              tax: {
                                ...payrollConfig.tax,
                                residentRate: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Non-Resident Rate</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={payrollConfig.tax.nonResidentRate}
                          onChange={(e) =>
                            setPayrollConfig({
                              ...payrollConfig,
                              tax: {
                                ...payrollConfig.tax,
                                nonResidentRate: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground">Flat rate, no threshold</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Social Security */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Social Security (INSS)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Employee Contribution</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={payrollConfig.socialSecurity.employeeRate}
                          onChange={(e) =>
                            setPayrollConfig({
                              ...payrollConfig,
                              socialSecurity: {
                                ...payrollConfig.socialSecurity,
                                employeeRate: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Employer Contribution</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={payrollConfig.socialSecurity.employerRate}
                          onChange={(e) =>
                            setPayrollConfig({
                              ...payrollConfig,
                              socialSecurity: {
                                ...payrollConfig.socialSecurity,
                                employerRate: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                        />
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={payrollConfig.socialSecurity.excludeFoodAllowance}
                        onCheckedChange={(checked) =>
                          setPayrollConfig({
                            ...payrollConfig,
                            socialSecurity: {
                              ...payrollConfig.socialSecurity,
                              excludeFoodAllowance: checked,
                            },
                          })
                        }
                      />
                      <Label>Exclude food allowance from SS</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={payrollConfig.socialSecurity.excludePerDiem}
                        onCheckedChange={(checked) =>
                          setPayrollConfig({
                            ...payrollConfig,
                            socialSecurity: {
                              ...payrollConfig.socialSecurity,
                              excludePerDiem: checked,
                            },
                          })
                        }
                      />
                      <Label>Exclude per diem from SS</Label>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Overtime */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Working Hours & Overtime
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Max Hours/Week</Label>
                      <Input
                        type="number"
                        min={0}
                        value={payrollConfig.maxWorkHoursPerWeek}
                        onChange={(e) =>
                          setPayrollConfig({
                            ...payrollConfig,
                            maxWorkHoursPerWeek: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>First 2 hrs OT Rate</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          step={0.1}
                          value={payrollConfig.overtimeRates.first2Hours}
                          onChange={(e) =>
                            setPayrollConfig({
                              ...payrollConfig,
                              overtimeRates: {
                                ...payrollConfig.overtimeRates,
                                first2Hours: parseFloat(e.target.value) || 1,
                              },
                            })
                          }
                        />
                        <span className="text-muted-foreground">×</span>
                      </div>
                      <p className="text-xs text-muted-foreground">1.5× = +50%</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Beyond 2 hrs OT Rate</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          step={0.1}
                          value={payrollConfig.overtimeRates.beyond2Hours}
                          onChange={(e) =>
                            setPayrollConfig({
                              ...payrollConfig,
                              overtimeRates: {
                                ...payrollConfig.overtimeRates,
                                beyond2Hours: parseFloat(e.target.value) || 1,
                              },
                            })
                          }
                        />
                        <span className="text-muted-foreground">×</span>
                      </div>
                      <p className="text-xs text-muted-foreground">2× = +100%</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Sunday/Holiday Rate</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          step={0.1}
                          value={payrollConfig.overtimeRates.sundayHoliday}
                          onChange={(e) =>
                            setPayrollConfig({
                              ...payrollConfig,
                              overtimeRates: {
                                ...payrollConfig.overtimeRates,
                                sundayHoliday: parseFloat(e.target.value) || 1,
                              },
                            })
                          }
                        />
                        <span className="text-muted-foreground">×</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 13th Month */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Subsídio Anual (13th Month)
                  </h3>
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={payrollConfig.subsidioAnual.enabled}
                      onCheckedChange={(checked) =>
                        setPayrollConfig({
                          ...payrollConfig,
                          subsidioAnual: {
                            ...payrollConfig.subsidioAnual,
                            enabled: checked,
                          },
                        })
                      }
                    />
                    <Label>Enable 13th month payment</Label>
                  </div>
                  {payrollConfig.subsidioAnual.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label>Payment Deadline</Label>
                        <Input
                          value={payrollConfig.subsidioAnual.payByDate}
                          onChange={(e) =>
                            setPayrollConfig({
                              ...payrollConfig,
                              subsidioAnual: {
                                ...payrollConfig.subsidioAnual,
                                payByDate: e.target.value,
                              },
                            })
                          }
                          placeholder="MM-DD"
                        />
                        <p className="text-xs text-muted-foreground">
                          Format: MM-DD (e.g., 12-20 for December 20)
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <Switch
                          checked={payrollConfig.subsidioAnual.proRataForNewEmployees}
                          onCheckedChange={(checked) =>
                            setPayrollConfig({
                              ...payrollConfig,
                              subsidioAnual: {
                                ...payrollConfig.subsidioAnual,
                                proRataForNewEmployees: checked,
                              },
                            })
                          }
                        />
                        <Label>Pro-rata for employees with less than 12 months</Label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={savePayrollConfig} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Payroll Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
