/**
 * VAT Settings Page
 * Configure tenant VAT registration, rate, and preferences.
 * Only visible when platform VAT is active or when accessed directly.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainNavigation from '@/components/layout/MainNavigation';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTenantId } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { isVATConfigOperational, type VATConfig } from '@onit/shared';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { Receipt, Save, ArrowLeft, Loader2, Building2, AlertTriangle, CheckCircle } from 'lucide-react';

interface VATSettingsData {
  isRegistered: boolean;
  vatRegistrationNumber: string;
  defaultRate: number;
  pricesIncludeVAT: boolean;
  filingFrequency: 'monthly' | 'quarterly';
  updatedAt?: Date;
}

const DEFAULT_VAT_SETTINGS: VATSettingsData = {
  isRegistered: false,
  vatRegistrationNumber: '',
  defaultRate: 0,
  pricesIncludeVAT: false,
  filingFrequency: 'quarterly',
};

export default function VATSettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const tenantId = useTenantId();

  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<VATSettingsData>(DEFAULT_VAT_SETTINGS);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);

  // Load VAT settings via React Query
  const { data: loadedData, isLoading: loading } = useQuery({
    queryKey: ['tenants', tenantId, 'vatSettings'],
    queryFn: async () => {
      // Check platform VAT status
      const platformRef = doc(db, paths.vatConfig());
      const platformSnap = await getDoc(platformRef);
      const platformConfig = platformSnap.exists() ? (platformSnap.data() as Partial<VATConfig>) : null;
      const operationalPlatformConfig = isVATConfigOperational(platformConfig) ? platformConfig : null;
      const isPlatformActive = operationalPlatformConfig !== null;
      const platformDefaultRate = operationalPlatformConfig?.standardRate ?? 0;
      const platformFilingFrequency = operationalPlatformConfig
        ? operationalPlatformConfig.filingFrequency
        : 'quarterly';

      // Load tenant VAT settings
      const tenantRef = doc(db, paths.vatSettings(tenantId));
      const tenantSnap = await getDoc(tenantRef);
      let tenantSettings: VATSettingsData = {
        ...DEFAULT_VAT_SETTINGS,
        defaultRate: platformDefaultRate,
        filingFrequency: platformFilingFrequency,
      };
      if (tenantSnap.exists()) {
        const data = tenantSnap.data();
        tenantSettings = {
          isRegistered: data.vatRegistered === true,
          vatRegistrationNumber: typeof data.vatRegistrationNumber === 'string' ? data.vatRegistrationNumber : '',
          defaultRate: typeof data.defaultVATRate === 'number' ? data.defaultVATRate : platformDefaultRate,
          pricesIncludeVAT: data.pricesIncludeVAT === true,
          filingFrequency:
            data.filingFrequency === 'monthly' || data.filingFrequency === 'quarterly'
              ? data.filingFrequency
              : platformFilingFrequency,
          updatedAt: data.updatedAt?.toDate?.(),
        };
      }

      return {
        platformActive: isPlatformActive,
        platformConfig: operationalPlatformConfig,
        settings: tenantSettings,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const platformActive = loadedData?.platformActive ?? false;
  const configuredRates =
    platformActive && loadedData?.platformConfig
      ? Array.from(
          new Set([
            loadedData.platformConfig.standardRate,
            ...loadedData.platformConfig.reducedRates.map((entry) => entry.rate),
          ])
        )
      : [];

  useEffect(() => {
    if (!loadedData?.settings || hasLocalChanges) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing server state into local form state
    setSettings(loadedData.settings);
  }, [hasLocalChanges, loadedData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: VATSettingsData) => {
      if (!platformActive) {
        throw new Error('VAT settings are locked until an enacted configuration is effective.');
      }
      if (!configuredRates.includes(data.defaultRate)) {
        throw new Error('The selected VAT rate is not present in the enacted platform configuration.');
      }
      if (data.isRegistered && data.vatRegistrationNumber.trim().length === 0) {
        throw new Error('A VAT registration number is required for a registered business.');
      }
      const ref = doc(db, paths.vatSettings(tenantId));
      await setDoc(
        ref,
        {
          vatEnabled: data.isRegistered,
          vatRegistered: data.isRegistered,
          vatRegistrationNumber: data.vatRegistrationNumber.trim(),
          defaultVATRate: data.defaultRate,
          pricesIncludeVAT: data.pricesIncludeVAT,
          filingFrequency: data.filingFrequency,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    },
    onSuccess: () => {
      setHasLocalChanges(false);
      queryClient.invalidateQueries({
        queryKey: ['tenants', tenantId, 'vatSettings'],
      });
      toast({
        title: 'Saved',
        description: 'VAT settings updated successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save VAT settings',
        variant: 'destructive',
      });
    },
  });

  const saving = saveMutation.isPending;

  const saveSettings = () => {
    if (!platformActive) return;
    saveMutation.mutate(settings);
  };

  const updateField = <K extends keyof VATSettingsData>(key: K, value: VATSettingsData[K]) => {
    setHasLocalChanges(true);
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="VAT Settings - Xefe" />
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6 space-y-6">
        <PageHeader
          title="VAT Settings"
          subtitle="Configure VAT registration and preferences"
          icon={Receipt}
          iconColor="text-orange-500"
          actions={
            <>
              <Button variant="ghost" size="icon" onClick={() => navigate('/accounting')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {platformActive && (
                <Button onClick={saveSettings} disabled={saving || loading}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save
                </Button>
              )}
            </>
          }
        />

        {loading ? (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-3 w-72" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full ml-auto" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 w-40" />
                </div>
                <Skeleton className="h-4 w-72" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-6 w-11 rounded-full" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 w-44" />
                </div>
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-6 w-11 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-3 w-72" />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {/* Platform Status */}
            <Card
              className={platformActive ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {platformActive ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                  <div>
                    <p className="font-medium">
                      {platformActive ? 'VAT is active in Timor-Leste' : 'VAT is not yet active in Timor-Leste'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {platformActive
                        ? 'All transactions will capture VAT data.'
                        : 'Settings stay locked until an enacted VAT law, effective date, and complete rate configuration are published.'}
                    </p>
                  </div>
                  <Badge variant={platformActive ? 'default' : 'secondary'} className="ml-auto">
                    {platformActive ? 'Active' : 'Pending'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Registration */}
            <Card className={platformActive ? undefined : 'hidden'}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">VAT Registration</CardTitle>
                </div>
                <CardDescription>Register your business for VAT to collect and file returns.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">VAT Registered</Label>
                    <p className="text-sm text-muted-foreground">Toggle if your business is registered for VAT</p>
                  </div>
                  <Switch
                    checked={settings.isRegistered}
                    onCheckedChange={(checked) => updateField('isRegistered', checked)}
                  />
                </div>

                {settings.isRegistered && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="vatRegNumber">VAT Registration Number</Label>
                      <Input
                        id="vatRegNumber"
                        placeholder="e.g. TL-VAT-000123"
                        value={settings.vatRegistrationNumber}
                        onChange={(e) => updateField('vatRegistrationNumber', e.target.value)}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Rate & Preferences */}
            <Card className={platformActive ? undefined : 'hidden'}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Rate & Preferences</CardTitle>
                </div>
                <CardDescription>Set your default VAT rate and pricing preferences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default VAT Rate</Label>
                  <Select
                    value={String(settings.defaultRate)}
                    onValueChange={(val) => updateField('defaultRate', Number(val))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {configuredRates.map((rate) => (
                        <SelectItem key={rate} value={String(rate)}>
                          {rate}%{rate === loadedData?.platformConfig?.standardRate ? ' (Standard)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Prices Include VAT</Label>
                    <p className="text-sm text-muted-foreground">When enabled, entered prices already include VAT</p>
                  </div>
                  <Switch
                    checked={settings.pricesIncludeVAT}
                    onCheckedChange={(checked) => updateField('pricesIncludeVAT', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Filing Frequency</Label>
                  <Select
                    value={settings.filingFrequency}
                    onValueChange={(val) => updateField('filingFrequency', val as 'monthly' | 'quarterly')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">How often you file VAT returns with tax authorities</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
