import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  companyDetailsFormSchema,
  holidayOverrideFormSchema,
  type CompanyDetailsFormData,
  type HolidayOverrideFormData,
} from "@/lib/validations";
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
import { holidayService, type HolidayOverride } from "@/services/holidayService";
import { useI18n } from "@/i18n/I18nProvider";
import { getTLPublicHolidays } from "@/lib/payroll/tl-holidays";
import { SEO, seoConfig } from "@/components/SEO";
import {
  TenantSettings,
  CompanyDetails,
  CompanyStructure,
  PaymentStructure,
  TimeOffPolicies,
  PayrollConfig,
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
  Plug,
} from "lucide-react";
import { QuickBooksSettings, SettingsSkeleton, SetupProgress } from "@/components/settings";

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

  // Company Details form (react-hook-form)
  const companyDetailsForm = useForm<CompanyDetailsFormData>({
    resolver: zodResolver(companyDetailsFormSchema),
    defaultValues: {
      legalName: "",
      tradingName: "",
      businessType: "Lda",
      tinNumber: "",
      registeredAddress: "",
      city: "Dili",
      country: "Timor-Leste",
      phone: "",
      email: "",
    },
    mode: "onChange",
  });

  // Other form states (kept as useState for complex nested structures)

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

  // Holiday overrides (tenant-scoped)
  const [holidayYear, setHolidayYear] = useState<number>(new Date().getFullYear());
  const [holidayOverridesLoading, setHolidayOverridesLoading] = useState(false);
  const [holidayOverrides, setHolidayOverrides] = useState<HolidayOverride[]>([]);
  const [holidayOverrideSaving, setHolidayOverrideSaving] = useState(false);

  // Holiday Override form (react-hook-form)
  const holidayOverrideForm = useForm<HolidayOverrideFormData>({
    resolver: zodResolver(holidayOverrideFormSchema),
    defaultValues: {
      date: "",
      name: "",
      nameTetun: "",
      isHoliday: true,
      notes: "",
    },
    mode: "onChange",
  });
  const holidayFormValues = holidayOverrideForm.watch();

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
      // Reset company details form with loaded data
      companyDetailsForm.reset({
        legalName: existingSettings.companyDetails.legalName || "",
        tradingName: existingSettings.companyDetails.tradingName || "",
        businessType: existingSettings.companyDetails.businessType || "Lda",
        tinNumber: existingSettings.companyDetails.tinNumber || "",
        registeredAddress: existingSettings.companyDetails.registeredAddress || "",
        city: existingSettings.companyDetails.city || "Dili",
        country: existingSettings.companyDetails.country || "Timor-Leste",
        phone: existingSettings.companyDetails.phone || "",
        email: existingSettings.companyDetails.email || "",
      });
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

  // Holiday overrides (tenant-scoped, used for variable holidays and government decrees)
  const loadHolidayOverrides = async () => {
    if (!tenantId) return;
    try {
      setHolidayOverridesLoading(true);
      const overrides = await holidayService.listTenantHolidayOverrides(tenantId, holidayYear);
      setHolidayOverrides(overrides);
    } catch (error) {
      console.error("Error loading holiday overrides:", error);
      toast({
        title: t("settings.notifications.errorTitle"),
        description: t("settings.notifications.holidayLoadFailed"),
        variant: "destructive",
      });
    } finally {
      setHolidayOverridesLoading(false);
    }
  };

  useEffect(() => {
    loadHolidayOverrides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, holidayYear]);

  const holidayOverrideByDate = useMemo(() => {
    const map = new Map<string, HolidayOverride>();
    holidayOverrides.forEach((o) => map.set(o.date, o));
    return map;
  }, [holidayOverrides]);

  const mergedHolidays = useMemo(() => {
    const base = getTLPublicHolidays(holidayYear);
    const map = new Map<string, { date: string; name: string; nameTetun?: string; source: "built_in" | "override" }>();

    base.forEach((h) => {
      map.set(h.date, { date: h.date, name: h.name, nameTetun: h.nameTetun, source: "built_in" });
    });

    holidayOverrides.forEach((o) => {
      if (!o.date?.startsWith(`${holidayYear}-`)) return;
      if (o.isHoliday === false) {
        map.delete(o.date);
        return;
      }
      map.set(o.date, {
        date: o.date,
        name: o.name || t("settings.notifications.holidayName"),
        nameTetun: o.nameTetun || undefined,
        source: "override",
      });
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [holidayYear, holidayOverrides]);

  const onSaveHolidayOverride = useCallback(
    async (data: HolidayOverrideFormData) => {
      if (!tenantId) return;

      try {
        setHolidayOverrideSaving(true);
        await holidayService.upsertTenantHolidayOverride(
          tenantId,
          {
            date: data.date,
            name: data.name?.trim() || "",
            nameTetun: data.nameTetun?.trim() || "",
            isHoliday: data.isHoliday,
            notes: data.notes?.trim() || "",
          },
          user?.uid
        );

        // Keep the list year in sync with the saved date
        const savedYear = parseInt(data.date.slice(0, 4), 10);
        if (!Number.isNaN(savedYear) && savedYear !== holidayYear) {
          setHolidayYear(savedYear);
        } else {
          await loadHolidayOverrides();
        }

        // Reset form
        holidayOverrideForm.reset({
          date: "",
          name: "",
          nameTetun: "",
          isHoliday: true,
          notes: "",
        });

        toast({
          title: t("settings.notifications.savedTitle"),
          description: t("settings.notifications.holidaySaved"),
        });
      } catch (error) {
        console.error("Error saving holiday override:", error);
        toast({
          title: t("settings.notifications.errorTitle"),
          description: t("settings.notifications.holidaySaveFailed"),
          variant: "destructive",
        });
      } finally {
        setHolidayOverrideSaving(false);
      }
    },
    [tenantId, user?.uid, holidayYear, holidayOverrideForm, toast, t]
  );

  const removeHolidayOverride = async (date: string) => {
    if (!tenantId) return;
    try {
      await holidayService.deleteTenantHolidayOverride(tenantId, date);
      await loadHolidayOverrides();
      toast({
        title: t("settings.notifications.savedTitle"),
        description: t("settings.notifications.holidayRemoved"),
      });
    } catch (error) {
      console.error("Error removing holiday override:", error);
      toast({
        title: t("settings.notifications.errorTitle"),
        description: t("settings.notifications.holidayRemoveFailed"),
        variant: "destructive",
      });
    }
  };

  // Save handlers
  const onSaveCompanyDetails = useCallback(
    async (data: CompanyDetailsFormData) => {
      if (!tenantId) return;
      setSaving(true);
      try {
        // Convert form data to CompanyDetails type
        const companyDetails: CompanyDetails = {
          legalName: data.legalName,
          tradingName: data.tradingName || undefined,
          businessType: data.businessType,
          tinNumber: data.tinNumber || "",
          registeredAddress: data.registeredAddress || "",
          city: data.city,
          country: data.country,
          phone: data.phone || undefined,
          email: data.email || undefined,
        };
        await settingsService.updateCompanyDetails(tenantId, companyDetails);
        toast({
          title: t("settings.notifications.savedTitle"),
          description: t("settings.notifications.companySaved"),
        });
        loadSettings();
      } catch {
        toast({
          title: t("settings.notifications.errorTitle"),
          description: t("settings.notifications.saveFailed"),
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    },
    [tenantId, toast, t]
  );

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
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
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
      <SEO {...seoConfig.settings} />
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
          <TabsList className="grid w-full grid-cols-6 mb-6">
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
            <TabsTrigger value="integrations" className="gap-2">
              <Plug className="h-4 w-4" />
              <span className="hidden sm:inline">{t("settings.tabs.integrations")}</span>
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
                <form onSubmit={companyDetailsForm.handleSubmit(onSaveCompanyDetails)}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="legalName">{t("settings.company.legalName")}</Label>
                      <Input
                        id="legalName"
                        {...companyDetailsForm.register("legalName")}
                        placeholder={t("settings.company.legalNamePlaceholder")}
                      />
                      {companyDetailsForm.formState.errors.legalName && (
                        <p className="text-sm text-destructive">
                          {companyDetailsForm.formState.errors.legalName.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tradingName">{t("settings.company.tradingName")}</Label>
                      <Input
                        id="tradingName"
                        {...companyDetailsForm.register("tradingName")}
                        placeholder={t("settings.company.tradingNamePlaceholder")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="businessType">{t("settings.company.businessType")}</Label>
                      <Controller
                        name="businessType"
                        control={companyDetailsForm.control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
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
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tinNumber">{t("settings.company.tinNumber")}</Label>
                      <Input
                        id="tinNumber"
                        {...companyDetailsForm.register("tinNumber")}
                        placeholder={t("settings.company.tinPlaceholder")}
                      />
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <div className="space-y-4">
                    <h3 className="font-medium">{t("settings.company.addressTitle")}</h3>
                    <div className="space-y-2">
                      <Label htmlFor="address">{t("settings.company.registeredAddress")}</Label>
                      <Textarea
                        id="address"
                        {...companyDetailsForm.register("registeredAddress")}
                        placeholder={t("settings.company.registeredAddressPlaceholder")}
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="city">{t("settings.company.city")}</Label>
                        <Input
                          id="city"
                          {...companyDetailsForm.register("city")}
                          placeholder={t("settings.company.cityPlaceholder")}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="country">{t("settings.company.country")}</Label>
                        <Input
                          id="country"
                          {...companyDetailsForm.register("country")}
                          disabled
                        />
                      </div>
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t("settings.company.phone")}</Label>
                      <Input
                        id="phone"
                        {...companyDetailsForm.register("phone")}
                        placeholder={t("settings.company.phonePlaceholder")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">{t("settings.company.email")}</Label>
                      <Input
                        id="email"
                        type="email"
                        {...companyDetailsForm.register("email")}
                        placeholder={t("settings.company.emailPlaceholder")}
                      />
                      {companyDetailsForm.formState.errors.email && (
                        <p className="text-sm text-destructive">
                          {companyDetailsForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-6">
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {t("settings.company.save")}
                    </Button>
                  </div>
                </form>
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

                <Separator />

                {/* Public Holidays (Timor-Leste) + tenant overrides */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-medium flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Public Holidays (Timor-Leste)
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Built-in holidays include fixed dates plus Easter-based holidays (Good Friday, Corpus Christi).
                        Add overrides for variable holidays (e.g., Eid) and government-declared days.
                      </p>
                    </div>
                    <div className="w-32 space-y-2">
                      <Label>Year</Label>
                      <Input
                        type="number"
                        min={2000}
                        max={2100}
                        value={holidayYear}
                        onChange={(e) => setHolidayYear(parseInt(e.target.value) || new Date().getFullYear())}
                      />
                    </div>
                  </div>

                  <div className="border rounded-lg divide-y">
                    {holidayOverridesLoading ? (
                      <div className="p-4">
                        <Skeleton className="h-6 w-64" />
                        <Skeleton className="h-6 w-72 mt-2" />
                      </div>
                    ) : mergedHolidays.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">
                        {t("settings.notifications.noHolidaysFound", { year: String(holidayYear) })}
                      </div>
                    ) : (
                      mergedHolidays.map((h) => {
                        const override = holidayOverrideByDate.get(h.date);
                        return (
                          <div key={h.date} className="p-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">{h.date}</span>
                                <Badge variant={h.source === "override" ? "default" : "secondary"}>
                                  {h.source === "override" ? t("settings.notifications.override") : t("settings.notifications.builtIn")}
                                </Badge>
                              </div>
                              <div className="text-sm font-medium truncate">{h.name}</div>
                              {h.nameTetun ? (
                                <div className="text-xs text-muted-foreground truncate">{h.nameTetun}</div>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  holidayOverrideForm.reset({
                                    date: h.date,
                                    name: override?.name ?? h.name,
                                    nameTetun: override?.nameTetun ?? (h.nameTetun ?? ""),
                                    isHoliday: override?.isHoliday ?? true,
                                    notes: override?.notes ?? "",
                                  })
                                }
                              >
                                {override ? t("settings.notifications.edit") : t("settings.notifications.override")}
                              </Button>
                              {override ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeHolidayOverride(h.date)}
                                  title={t("settings.notifications.removeOverride")}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form
                    className="p-4 border rounded-lg space-y-4"
                    onSubmit={holidayOverrideForm.handleSubmit(onSaveHolidayOverride)}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{t("settings.notifications.addOverrideHoliday")}</h4>
                      <div className="flex items-center gap-2">
                        <Controller
                          name="isHoliday"
                          control={holidayOverrideForm.control}
                          render={({ field }) => (
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          )}
                        />
                        <Label>{t("settings.notifications.holidayName")}</Label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>{t("common.date")}</Label>
                        <Input
                          type="date"
                          {...holidayOverrideForm.register("date")}
                        />
                        {holidayOverrideForm.formState.errors.date && (
                          <p className="text-sm text-destructive">
                            {holidayOverrideForm.formState.errors.date.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("common.name")}</Label>
                        <Input
                          {...holidayOverrideForm.register("name")}
                          disabled={!holidayFormValues.isHoliday}
                          placeholder={holidayFormValues.isHoliday ? t("settings.notifications.holidayNamePlaceholder") : t("settings.notifications.optional")}
                        />
                        {holidayOverrideForm.formState.errors.name && (
                          <p className="text-sm text-destructive">
                            {holidayOverrideForm.formState.errors.name.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("settings.notifications.nameTetun")}</Label>
                        <Input
                          {...holidayOverrideForm.register("nameTetun")}
                          disabled={!holidayFormValues.isHoliday}
                          placeholder={t("settings.notifications.optional")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{t("settings.notifications.notes")}</Label>
                      <Textarea
                        {...holidayOverrideForm.register("notes")}
                        placeholder={t("settings.notifications.notesPlaceholder")}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          holidayOverrideForm.reset({ date: "", name: "", nameTetun: "", isHoliday: true, notes: "" })
                        }
                      >
                        {t("settings.notifications.clear")}
                      </Button>
                      <Button type="submit" disabled={holidayOverrideSaving}>
                        {holidayOverrideSaving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        {t("settings.notifications.saveOverride")}
                      </Button>
                    </div>
                  </form>
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

          {/* ================================ */}
          {/* Integrations Tab */}
          {/* ================================ */}
          <TabsContent value="integrations">
            {tenantId && <QuickBooksSettings tenantId={tenantId} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
