/**
 * VAT Settings Page
 * Configure tenant VAT registration, rate, and preferences.
 * Only visible when platform VAT is active or when accessed directly.
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTenantId } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import {
  Receipt,
  Save,
  ArrowLeft,
  Loader2,
  Building2,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

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
  defaultRate: 10,
  pricesIncludeVAT: true,
  filingFrequency: 'monthly',
};

export default function VATSettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const tenantId = useTenantId();

  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<VATSettingsData>(DEFAULT_VAT_SETTINGS);

  // Load VAT settings via React Query
  const { data: loadedData, isLoading: loading } = useQuery({
    queryKey: ['tenants', tenantId, 'vatSettings'],
    queryFn: async () => {
      // Check platform VAT status
      const platformRef = doc(db, paths.vatConfig());
      const platformSnap = await getDoc(platformRef);
      const isPlatformActive = platformSnap.exists() && platformSnap.data().isActive === true;

      // Load tenant VAT settings
      const tenantRef = doc(db, paths.vatSettings(tenantId));
      const tenantSnap = await getDoc(tenantRef);
      let tenantSettings = DEFAULT_VAT_SETTINGS;
      if (tenantSnap.exists()) {
        const data = tenantSnap.data();
        tenantSettings = {
          isRegistered: data.isRegistered ?? false,
          vatRegistrationNumber: data.vatRegistrationNumber ?? '',
          defaultRate: data.defaultRate ?? 10,
          pricesIncludeVAT: data.pricesIncludeVAT ?? true,
          filingFrequency: data.filingFrequency ?? 'monthly',
          updatedAt: data.updatedAt?.toDate?.(),
        };
      }

      return { platformActive: isPlatformActive, settings: tenantSettings };
    },
    staleTime: 5 * 60 * 1000,
  });

  const platformActive = loadedData?.platformActive ?? false;

  // Sync loaded settings into local state for editing (render-time sync)
  const prevLoadedRef = useRef(loadedData);
  if (loadedData?.settings && loadedData !== prevLoadedRef.current) {
    prevLoadedRef.current = loadedData;
    setSettings(loadedData.settings);
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: VATSettingsData) => {
      const ref = doc(db, paths.vatSettings(tenantId));
      await setDoc(ref, { ...data, updatedAt: new Date() }, { merge: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants', tenantId, 'vatSettings'] });
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
    saveMutation.mutate(settings);
  };

  const updateField = <K extends keyof VATSettingsData>(
    key: K,
    value: VATSettingsData[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="VAT Settings - Meza" />
      <MainNavigation />
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <AutoBreadcrumb className="mb-2" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/money')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">VAT Settings</h1>
              <p className="text-sm text-muted-foreground">
                Configure VAT registration and preferences
              </p>
            </div>
          </div>
          <Button onClick={saveSettings} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        ) : (
          <>
            {/* Platform Status */}
            <Card
              className={
                platformActive
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-amber-500/30 bg-amber-500/5'
              }
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
                      {platformActive
                        ? 'VAT is active in Timor-Leste'
                        : 'VAT is not yet active in Timor-Leste'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {platformActive
                        ? 'All transactions will capture VAT data.'
                        : 'You can configure settings now. VAT will apply when the government activates it.'}
                    </p>
                  </div>
                  <Badge
                    variant={platformActive ? 'default' : 'secondary'}
                    className="ml-auto"
                  >
                    {platformActive ? 'Active' : 'Pending'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Registration */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">VAT Registration</CardTitle>
                </div>
                <CardDescription>
                  Register your business for VAT to collect and file returns.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">
                      VAT Registered
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Toggle if your business is registered for VAT
                    </p>
                  </div>
                  <Switch
                    checked={settings.isRegistered}
                    onCheckedChange={(checked) =>
                      updateField('isRegistered', checked)
                    }
                  />
                </div>

                {settings.isRegistered && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="vatRegNumber">
                        VAT Registration Number
                      </Label>
                      <Input
                        id="vatRegNumber"
                        placeholder="e.g. TL-VAT-000123"
                        value={settings.vatRegistrationNumber}
                        onChange={(e) =>
                          updateField(
                            'vatRegistrationNumber',
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Rate & Preferences */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">
                    Rate & Preferences
                  </CardTitle>
                </div>
                <CardDescription>
                  Set your default VAT rate and pricing preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default VAT Rate</Label>
                  <Select
                    value={String(settings.defaultRate)}
                    onValueChange={(val) =>
                      updateField('defaultRate', Number(val))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% (Exempt)</SelectItem>
                      <SelectItem value="2.5">2.5%</SelectItem>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="10">
                        10% (Standard TL Rate)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">
                      Prices Include VAT
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      When enabled, entered prices already include VAT
                    </p>
                  </div>
                  <Switch
                    checked={settings.pricesIncludeVAT}
                    onCheckedChange={(checked) =>
                      updateField('pricesIncludeVAT', checked)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Filing Frequency</Label>
                  <Select
                    value={settings.filingFrequency}
                    onValueChange={(val) =>
                      updateField(
                        'filingFrequency',
                        val as 'monthly' | 'quarterly'
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    How often you file VAT returns with tax authorities
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
