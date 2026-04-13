/**
 * Company Details Settings Tab
 * Legal name, business type, address, contact info
 */
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { settingsService } from '@/services/settingsService';
import { fileUploadService } from '@/services/fileUploadService';
import { Save, Loader2, ImagePlus, Trash2, Building2 } from 'lucide-react';
import type { SettingsTabProps, CompanyDetailsFormData, CompanyDetails } from './types';
import { companyDetailsFormSchema } from './types';

interface CompanyDetailsTabProps extends SettingsTabProps {
  initialData: CompanyDetails;
}

export function CompanyDetailsTab({
  tenantId,
  saving,
  setSaving,
  onReload,
  t,
  initialData,
}: CompanyDetailsTabProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(initialData.logoUrl || null);
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
  const [logoMarkedForRemoval, setLogoMarkedForRemoval] = useState(false);

  const form = useForm<CompanyDetailsFormData>({
    resolver: zodResolver(companyDetailsFormSchema),
    defaultValues: {
      legalName: initialData.legalName || '',
      tradingName: initialData.tradingName || '',
      businessType: initialData.businessType || 'Lda',
      tinNumber: initialData.tinNumber || '',
      registeredAddress: initialData.registeredAddress || '',
      city: initialData.city || 'Dili',
      country: initialData.country || 'Timor-Leste',
      phone: initialData.phone || '',
      email: initialData.email || '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    form.reset({
      legalName: initialData.legalName || '',
      tradingName: initialData.tradingName || '',
      businessType: initialData.businessType || 'Lda',
      tinNumber: initialData.tinNumber || '',
      registeredAddress: initialData.registeredAddress || '',
      city: initialData.city || 'Dili',
      country: initialData.country || 'Timor-Leste',
      phone: initialData.phone || '',
      email: initialData.email || '',
    });

    setLogoObjectUrl(null);
    setLogoFile(null);
    setLogoMarkedForRemoval(false);
    setLogoPreviewUrl(initialData.logoUrl || null);
  }, [form, initialData]);

  useEffect(() => {
    return () => {
      if (logoObjectUrl) {
        URL.revokeObjectURL(logoObjectUrl);
      }
    };
  }, [logoObjectUrl]);

  const handleLogoSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = fileUploadService.validateImageFile(file);
    if (!validation.valid) {
      toast({
        title: 'Invalid logo file',
        description: validation.error || 'Please choose a valid image file.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }

    if (logoObjectUrl) {
      URL.revokeObjectURL(logoObjectUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setLogoObjectUrl(objectUrl);
    setLogoFile(file);
    setLogoMarkedForRemoval(false);
    setLogoPreviewUrl(objectUrl);
    event.target.value = '';
  }, [logoObjectUrl, toast]);

  const handleRemoveLogo = useCallback(() => {
    if (logoObjectUrl) {
      URL.revokeObjectURL(logoObjectUrl);
      setLogoObjectUrl(null);
    }

    setLogoFile(null);
    setLogoPreviewUrl(null);
    setLogoMarkedForRemoval(Boolean(initialData.logoUrl));

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [initialData.logoUrl, logoObjectUrl]);

  const onSave = useCallback(
    async (data: CompanyDetailsFormData) => {
      if (!tenantId) return;
      setSaving(true);
      const previousLogoUrl = initialData.logoUrl || '';
      let uploadedLogoUrl: string | null = null;
      try {
        let nextLogoUrl = logoMarkedForRemoval ? '' : previousLogoUrl;

        if (logoFile) {
          uploadedLogoUrl = await fileUploadService.uploadCompanyLogo(logoFile, tenantId);
          nextLogoUrl = uploadedLogoUrl;
        }

        const companyDetails: CompanyDetails = {
          legalName: data.legalName,
          tradingName: data.tradingName || "",
          businessType: data.businessType,
          tinNumber: data.tinNumber || '',
          registeredAddress: data.registeredAddress || '',
          city: data.city,
          country: data.country,
          phone: data.phone || "",
          email: data.email || "",
          logoUrl: nextLogoUrl || undefined,
        };
        await settingsService.updateCompanyDetails(tenantId, companyDetails);

        if (logoMarkedForRemoval && previousLogoUrl && !logoFile) {
          await fileUploadService.deleteFile(previousLogoUrl).catch((error) => {
            console.error('Failed to delete previous company logo:', error);
          });
        }

        if (uploadedLogoUrl && previousLogoUrl && previousLogoUrl !== uploadedLogoUrl) {
          await fileUploadService.deleteFile(previousLogoUrl).catch((error) => {
            console.error('Failed to delete replaced company logo:', error);
          });
        }

        if (logoObjectUrl) {
          URL.revokeObjectURL(logoObjectUrl);
          setLogoObjectUrl(null);
        }

        setLogoFile(null);
        setLogoMarkedForRemoval(false);
        setLogoPreviewUrl(nextLogoUrl || null);

        toast({
          title: t('settings.notifications.savedTitle'),
          description: t('settings.notifications.companySaved'),
        });
        onReload();
      } catch {
        if (uploadedLogoUrl) {
          await fileUploadService.deleteFile(uploadedLogoUrl).catch((error) => {
            console.error('Failed to clean up uploaded company logo after save error:', error);
          });
        }
        toast({
          title: t('settings.notifications.errorTitle'),
          description: t('settings.notifications.saveFailed'),
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
    },
    [tenantId, setSaving, initialData.logoUrl, logoMarkedForRemoval, logoFile, logoObjectUrl, onReload, toast, t]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.company.title')}</CardTitle>
        <CardDescription>{t('settings.company.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={form.handleSubmit(onSave, () => {
          toast({
            title: t('settings.notifications.errorTitle') || 'Validation Error',
            description: 'Please fill in all required fields.',
            variant: 'destructive',
          });
        })}>
          <div className="space-y-3">
            <Label>Company Logo</Label>
            <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background">
                  {logoPreviewUrl ? (
                    <img src={logoPreviewUrl} alt="Company logo preview" className="h-full w-full object-contain p-2" />
                  ) : (
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {logoFile ? logoFile.name : logoPreviewUrl ? 'Current company logo' : 'No logo uploaded yet'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Upload a PNG, JPG, WebP, or SVG. If no logo is saved, the app will use the legal company name instead.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {logoPreviewUrl ? 'Replace Logo' : 'Upload Logo'}
                </Button>
                {(logoPreviewUrl || logoFile) && (
                  <Button type="button" variant="ghost" onClick={handleRemoveLogo}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="legalName">{t('settings.company.legalName')}</Label>
              <Input
                id="legalName"
                {...form.register('legalName')}
                placeholder={t('settings.company.legalNamePlaceholder')}
              />
              {form.formState.errors.legalName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.legalName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tradingName">{t('settings.company.tradingName')}</Label>
              <Input
                id="tradingName"
                {...form.register('tradingName')}
                placeholder={t('settings.company.tradingNamePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessType">{t('settings.company.businessType')}</Label>
              <Controller
                name="businessType"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SA">{t('settings.company.businessTypes.sa')}</SelectItem>
                      <SelectItem value="Lda">{t('settings.company.businessTypes.lda')}</SelectItem>
                      <SelectItem value="Unipessoal">{t('settings.company.businessTypes.unipessoal')}</SelectItem>
                      <SelectItem value="ENIN">{t('settings.company.businessTypes.enin')}</SelectItem>
                      <SelectItem value="NGO">{t('settings.company.businessTypes.ngo')}</SelectItem>
                      <SelectItem value="Government">{t('settings.company.businessTypes.government')}</SelectItem>
                      <SelectItem value="Other">{t('settings.company.businessTypes.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tinNumber">{t('settings.company.tinNumber')}</Label>
              <Input
                id="tinNumber"
                {...form.register('tinNumber')}
                placeholder={t('settings.company.tinPlaceholder')}
              />
            </div>
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <h3 className="font-medium">{t('settings.company.addressTitle')}</h3>
            <div className="space-y-2">
              <Label htmlFor="address">{t('settings.company.registeredAddress')}</Label>
              <Textarea
                id="address"
                {...form.register('registeredAddress')}
                placeholder={t('settings.company.registeredAddressPlaceholder')}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="city">{t('settings.company.city')}</Label>
                <Input
                  id="city"
                  {...form.register('city')}
                  placeholder={t('settings.company.cityPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">{t('settings.company.country')}</Label>
                <Input
                  id="country"
                  {...form.register('country')}
                  disabled
                />
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="phone">{t('settings.company.phone')}</Label>
              <Input
                id="phone"
                {...form.register('phone')}
                placeholder={t('settings.company.phonePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('settings.company.email')}</Label>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                placeholder={t('settings.company.emailPlaceholder')}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
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
              {t('settings.company.save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
