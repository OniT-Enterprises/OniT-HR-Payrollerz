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
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/contexts/TenantContext";
import { settingsService } from "@/services/settingsService";
import { useI18n } from "@/i18n/I18nProvider";
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
  const { t } = useI18n();
  const steps = [
    { key: "companyDetails", label: t("settings.tabs.company") },
    { key: "companyStructure", label: t("settings.tabs.structure") },
    { key: "paymentStructure", label: t("settings.tabs.payment") },
    { key: "timeOffPolicies", label: t("settings.tabs.timeOff") },
    { key: "payrollConfig", label: t("settings.tabs.payroll") },
  ];

  const completed = Object.values(progress).filter(Boolean).length;
  const total = steps.length;

  return (
    <Card className="mb-6">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">{t("settings.setupProgress")}</span>
          <Badge variant={completed === total ? "default" : "secondary"}>
            {t("settings.progressComplete", { completed, total })}
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
  const { t } = useI18n();

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
        title: t("settings.notifications.errorTitle"),
        description: t("settings.notifications.loadFailed"),
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
      toast({
        title: t("settings.notifications.savedTitle"),
        description: t("settings.notifications.companySaved"),
      });
      loadSettings();
    } catch (error) {
      toast({
        title: t("settings.notifications.errorTitle"),
        description: t("settings.notifications.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveCompanyStructure = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await settingsService.updateCompanyStructure(tenantId, companyStructure);
      toast({
        title: t("settings.notifications.savedTitle"),
        description: t("settings.notifications.structureSaved"),
      });
      loadSettings();
    } catch (error) {
      toast({
        title: t("settings.notifications.errorTitle"),
        description: t("settings.notifications.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const savePaymentStructure = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await settingsService.updatePaymentStructure(tenantId, paymentStructure);
      toast({
        title: t("settings.notifications.savedTitle"),
        description: t("settings.notifications.paymentSaved"),
      });
      loadSettings();
    } catch (error) {
      toast({
        title: t("settings.notifications.errorTitle"),
        description: t("settings.notifications.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveTimeOffPolicies = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await settingsService.updateTimeOffPolicies(tenantId, timeOffPolicies);
      toast({
        title: t("settings.notifications.savedTitle"),
        description: t("settings.notifications.timeOffSaved"),
      });
      loadSettings();
    } catch (error) {
      toast({
        title: t("settings.notifications.errorTitle"),
        description: t("settings.notifications.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const savePayrollConfig = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await settingsService.updatePayrollConfig(tenantId, payrollConfig);
      toast({
        title: t("settings.notifications.savedTitle"),
        description: t("settings.notifications.payrollSaved"),
      });
      loadSettings();
    } catch (error) {
      toast({
        title: t("settings.notifications.errorTitle"),
        description: t("settings.notifications.saveFailed"),
        variant: "destructive",
      });
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
        <AutoBreadcrumb className="mb-6" />
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("settings.headerTitle")}</h1>
            <p className="text-muted-foreground">{t("settings.headerSubtitle")}</p>
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
              <span className="hidden sm:inline">{t("settings.tabs.company")}</span>
            </TabsTrigger>
            <TabsTrigger value="structure" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t("settings.tabs.structure")}</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">{t("settings.tabs.payment")}</span>
            </TabsTrigger>
            <TabsTrigger value="timeoff" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">{t("settings.tabs.timeOff")}</span>
            </TabsTrigger>
            <TabsTrigger value="payroll" className="gap-2">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">{t("settings.tabs.payroll")}</span>
            </TabsTrigger>
          </TabsList>

          {/* ================================ */}
          {/* Company Details Tab */}
          {/* ================================ */}
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.company.title")}</CardTitle>
                <CardDescription>
                  {t("settings.company.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="legalName">{t("settings.company.legalName")}</Label>
                    <Input
                      id="legalName"
                      value={companyDetails.legalName}
                      onChange={(e) =>
                        setCompanyDetails({ ...companyDetails, legalName: e.target.value })
                      }
                      placeholder={t("settings.company.legalNamePlaceholder")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tradingName">{t("settings.company.tradingName")}</Label>
                    <Input
                      id="tradingName"
                      value={companyDetails.tradingName || ""}
                      onChange={(e) =>
                        setCompanyDetails({ ...companyDetails, tradingName: e.target.value })
                      }
                      placeholder={t("settings.company.tradingNamePlaceholder")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessType">{t("settings.company.businessType")}</Label>
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
                        <SelectItem value="SA">{t("settings.company.businessTypes.sa")}</SelectItem>
                        <SelectItem value="Lda">{t("settings.company.businessTypes.lda")}</SelectItem>
                        <SelectItem value="Unipessoal">{t("settings.company.businessTypes.unipessoal")}</SelectItem>
                        <SelectItem value="ENIN">{t("settings.company.businessTypes.enin")}</SelectItem>
                        <SelectItem value="NGO">{t("settings.company.businessTypes.ngo")}</SelectItem>
                        <SelectItem value="Government">{t("settings.company.businessTypes.government")}</SelectItem>
                        <SelectItem value="Other">{t("settings.company.businessTypes.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tinNumber">{t("settings.company.tinNumber")}</Label>
                    <Input
                      id="tinNumber"
                      value={companyDetails.tinNumber}
                      onChange={(e) =>
                        setCompanyDetails({ ...companyDetails, tinNumber: e.target.value })
                      }
                      placeholder={t("settings.company.tinPlaceholder")}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">{t("settings.company.addressTitle")}</h3>
                  <div className="space-y-2">
                    <Label htmlFor="address">{t("settings.company.registeredAddress")}</Label>
                    <Textarea
                      id="address"
                      value={companyDetails.registeredAddress}
                      onChange={(e) =>
                        setCompanyDetails({
                          ...companyDetails,
                          registeredAddress: e.target.value,
                        })
                      }
                      placeholder={t("settings.company.registeredAddressPlaceholder")}
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="city">{t("settings.company.city")}</Label>
                      <Input
                        id="city"
                        value={companyDetails.city}
                        onChange={(e) =>
                          setCompanyDetails({ ...companyDetails, city: e.target.value })
                        }
                        placeholder={t("settings.company.cityPlaceholder")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">{t("settings.company.country")}</Label>
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
                    <Label htmlFor="phone">{t("settings.company.phone")}</Label>
                    <Input
                      id="phone"
                      value={companyDetails.phone || ""}
                      onChange={(e) =>
                        setCompanyDetails({ ...companyDetails, phone: e.target.value })
                      }
                      placeholder={t("settings.company.phonePlaceholder")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{t("settings.company.email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={companyDetails.email || ""}
                      onChange={(e) =>
                        setCompanyDetails({ ...companyDetails, email: e.target.value })
                      }
                      placeholder={t("settings.company.emailPlaceholder")}
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
                    {t("settings.company.save")}
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
                <CardTitle>{t("settings.structure.title")}</CardTitle>
                <CardDescription>
                  {t("settings.structure.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Business Sector */}
                <div className="space-y-2">
                  <Label>{t("settings.structure.businessSector")}</Label>
                  <Select
                    value={companyStructure.businessSector}
                    onValueChange={(value: BusinessSector) => loadSectorDepartments(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="security">{t("settings.structure.sectors.security")}</SelectItem>
                      <SelectItem value="hotel">{t("settings.structure.sectors.hotel")}</SelectItem>
                      <SelectItem value="restaurant">{t("settings.structure.sectors.restaurant")}</SelectItem>
                      <SelectItem value="trading">{t("settings.structure.sectors.trading")}</SelectItem>
                      <SelectItem value="manufacturing">{t("settings.structure.sectors.manufacturing")}</SelectItem>
                      <SelectItem value="construction">{t("settings.structure.sectors.construction")}</SelectItem>
                      <SelectItem value="retail">{t("settings.structure.sectors.retail")}</SelectItem>
                      <SelectItem value="healthcare">{t("settings.structure.sectors.healthcare")}</SelectItem>
                      <SelectItem value="education">{t("settings.structure.sectors.education")}</SelectItem>
                      <SelectItem value="finance">{t("settings.structure.sectors.finance")}</SelectItem>
                      <SelectItem value="technology">{t("settings.structure.sectors.technology")}</SelectItem>
                      <SelectItem value="ngo">{t("settings.structure.sectors.ngo")}</SelectItem>
                      <SelectItem value="government">{t("settings.structure.sectors.government")}</SelectItem>
                      <SelectItem value="other">{t("settings.structure.sectors.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.structure.sectorHint")}
                  </p>
                </div>

                <Separator />

                {/* Work Locations */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{t("settings.structure.workLocations")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.structure.workLocationsHint")}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={addWorkLocation}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t("settings.structure.addLocation")}
                    </Button>
                  </div>

                  {companyStructure.workLocations.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">{t("settings.structure.noLocations")}</p>
                      <Button variant="link" onClick={addWorkLocation}>
                        {t("settings.structure.addFirstLocation")}
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
                              placeholder={t("settings.structure.locationName")}
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
                              placeholder={t("settings.structure.address")}
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
                              placeholder={t("settings.company.cityPlaceholder")}
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
                              <Badge variant="secondary">{t("settings.structure.hq")}</Badge>
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
                      <h3 className="font-medium">{t("settings.structure.departments")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.structure.departmentsHint")}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={addDepartment}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t("settings.structure.addDepartment")}
                    </Button>
                  </div>

                  {companyStructure.departments.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <Briefcase className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">{t("settings.structure.noDepartments")}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.structure.autoPopulateHint")}
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
                            placeholder={t("settings.structure.departmentName")}
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
                    {t("settings.structure.save")}
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
                <CardTitle>{t("settings.payment.title")}</CardTitle>
                <CardDescription>
                  {t("settings.payment.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Payment Methods */}
                <div className="space-y-4">
                  <h3 className="font-medium">{t("settings.payment.methods")}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { value: "bank_transfer", label: t("settings.payment.methodLabels.bankTransfer") },
                      { value: "cash", label: t("settings.payment.methodLabels.cash") },
                      { value: "cheque", label: t("settings.payment.methodLabels.cheque") },
                      { value: "other", label: t("settings.payment.methodLabels.other") },
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
                      <h3 className="font-medium">{t("settings.payment.bankAccounts")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.payment.bankAccountsHint")}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={addBankAccount}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t("settings.payment.addAccount")}
                    </Button>
                  </div>

                  {paymentStructure.bankAccounts.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <CreditCard className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">{t("settings.payment.noAccounts")}</p>
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
                                <SelectItem value="payroll">{t("settings.payment.accountPurpose.payroll")}</SelectItem>
                                <SelectItem value="tax">{t("settings.payment.accountPurpose.tax")}</SelectItem>
                                <SelectItem value="social_security">{t("settings.payment.accountPurpose.socialSecurity")}</SelectItem>
                                <SelectItem value="general">{t("settings.payment.accountPurpose.general")}</SelectItem>
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
                              placeholder={t("settings.payment.bankName")}
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
                              placeholder={t("settings.payment.accountName")}
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
                              placeholder={t("settings.payment.accountNumber")}
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
                              placeholder={t("settings.payment.branchCode")}
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
                  <h3 className="font-medium">{t("settings.payment.payrollFrequency")}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { value: "hourly", label: t("settings.payment.frequencyLabels.hourly") },
                      { value: "daily", label: t("settings.payment.frequencyLabels.daily") },
                      { value: "weekly", label: t("settings.payment.frequencyLabels.weekly") },
                      { value: "bi_weekly", label: t("settings.payment.frequencyLabels.biWeekly") },
                      { value: "monthly", label: t("settings.payment.frequencyLabels.monthly") },
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
                    {t("settings.payment.save")}
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
                <CardTitle>{t("settings.timeOff.title")}</CardTitle>
                <CardDescription>
                  {t("settings.timeOff.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        {t("settings.timeOff.laborCodeTitle")}
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {t("settings.timeOff.laborCodeHint")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Probation Period */}
                <div className="space-y-2">
                  <Label>{t("settings.timeOff.probationLabel")}</Label>
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
                    <span className="text-muted-foreground">{t("settings.timeOff.months")}</span>
                  </div>
                </div>

                <Separator />

                {/* Leave Types */}
                <div className="space-y-4">
                  <h3 className="font-medium">{t("settings.timeOff.entitlements")}</h3>

                  {/* Annual Leave */}
                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        <span className="font-medium">{t("settings.timeOff.annualLeave")}</span>
                      </div>
                      <Badge variant="secondary">
                        {timeOffPolicies.annualLeave.daysPerYear} {t("settings.timeOff.days")}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>{t("settings.timeOff.daysPerYear")}</Label>
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
                        <Label>{t("settings.timeOff.carryOverDays")}</Label>
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
                        <Label>{t("settings.timeOff.allowCarryOver")}</Label>
                      </div>
                    </div>
                  </div>

                  {/* Sick Leave */}
                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-orange-500" />
                        <span className="font-medium">{t("settings.timeOff.sickLeave")}</span>
                      </div>
                      <Badge variant="secondary">
                        {timeOffPolicies.sickLeave.daysPerYear} {t("settings.timeOff.days")}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>{t("settings.timeOff.daysPerYear")}</Label>
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
                        <Label>{t("settings.timeOff.paidPercentage")}</Label>
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
                        <Label>{t("settings.timeOff.requiresMedicalCert")}</Label>
                      </div>
                    </div>
                  </div>

                  {/* Maternity Leave */}
                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-pink-500" />
                        <span className="font-medium">{t("settings.timeOff.maternityLeave")}</span>
                      </div>
                      <Badge variant="secondary">
                        {Math.round(timeOffPolicies.maternityLeave.daysPerYear / 7)} {t("settings.timeOff.weeks")}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("settings.timeOff.maternityDaysHint")}</Label>
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
                        <Label>{t("settings.timeOff.paidPercentage")}</Label>
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
                        <span className="font-medium">{t("settings.timeOff.paternityLeave")}</span>
                      </div>
                      <Badge variant="secondary">
                        {timeOffPolicies.paternityLeave.daysPerYear} {t("settings.timeOff.days")}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("settings.timeOff.days")}</Label>
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
                        <Label>{t("settings.timeOff.paidPercentage")}</Label>
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
                    {t("settings.timeOff.save")}
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
                <CardTitle>{t("settings.payroll.title")}</CardTitle>
                <CardDescription>
                  {t("settings.payroll.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tax Settings */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    {t("settings.payroll.wit")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{t("settings.payroll.residentThreshold")}</Label>
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
                        {t("settings.payroll.residentThresholdHint", {
                          amount: payrollConfig.tax.residentThreshold,
                        })}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("settings.payroll.residentRate")}</Label>
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
                      <Label>{t("settings.payroll.nonResidentRate")}</Label>
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
                      <p className="text-xs text-muted-foreground">{t("settings.payroll.flatRateHint")}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Social Security */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {t("settings.payroll.socialSecurity")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("settings.payroll.employeeContribution")}</Label>
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
                      <Label>{t("settings.payroll.employerContribution")}</Label>
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
                      <Label>{t("settings.payroll.excludeFoodAllowance")}</Label>
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
                      <Label>{t("settings.payroll.excludePerDiem")}</Label>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Overtime */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {t("settings.payroll.overtime")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>{t("settings.payroll.maxHoursWeek")}</Label>
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
                      <Label>{t("settings.payroll.first2HoursRate")}</Label>
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
                      <p className="text-xs text-muted-foreground">{t("settings.payroll.first2HoursHint")}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("settings.payroll.beyond2HoursRate")}</Label>
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
                      <p className="text-xs text-muted-foreground">{t("settings.payroll.beyond2HoursHint")}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("settings.payroll.sundayHolidayRate")}</Label>
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
                    {t("settings.payroll.thirteenthMonth")}
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
                    <Label>{t("settings.payroll.enable13th")}</Label>
                  </div>
                  {payrollConfig.subsidioAnual.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label>{t("settings.payroll.paymentDeadline")}</Label>
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
                          placeholder={t("settings.payroll.paymentDeadlinePlaceholder")}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("settings.payroll.paymentDeadlineHint")}
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
                        <Label>{t("settings.payroll.prorataHint")}</Label>
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
                    {t("settings.payroll.save")}
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
