/**
 * Vendors Page
 * List, search, and manage vendors (suppliers)
 */

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import MainNavigation from '@/components/layout/MainNavigation';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import DashboardLoadError from '@/components/dashboard/DashboardLoadError';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { SEO } from '@/components/SEO';
import { useAdvancedTax, useTenant, useTenantId } from '@/contexts/TenantContext';
import { vendorService } from '@/services/vendorService';
import { useAllVendors, vendorKeys } from '@/hooks/useVendors';
import MoreDetailsSection from '@/components/MoreDetailsSection';
import {
  normalizeTLVendorTaxProfile,
  type TLVendorTaxProfile,
} from '@/lib/tax/bill-withholding';

import type { Vendor, VendorFormData } from '@/types/money';
import {
  Truck,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Building2,
  User,
  FileText,
  Receipt,
} from 'lucide-react';

export default function Vendors() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { session, canManage } = useTenant();
  const canManageTenant = canManage();
  const showAdvancedTax = useAdvancedTax();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [saving, setSaving] = useState(false);
  const [taxResidence, setTaxResidence] = useState<'' | 'resident' | 'non_resident'>('');
  const [taxRegime, setTaxRegime] = useState<'' | 'domestic' | 'petroleum'>('');
  const [permanentEstablishment, setPermanentEstablishment] = useState<'' | 'yes' | 'no'>('');
  const [treatyRatePercent, setTreatyRatePercent] = useState('');
  const [treatyReference, setTreatyReference] = useState('');
  const saveInFlight = useRef(false);
  const deleteInFlight = useRef(false);
  const [formData, setFormData] = useState<VendorFormData>({
    name: '',
    type: 'business',
    email: '',
    phone: '',
    address: '',
    city: '',
    tin: '',
    notes: '',
  });

  // Use React Query for data fetching
  const {
    data: vendors = [],
    isLoading: loading,
    isError: loadError,
    isFetching,
    refetch,
  } = useAllVendors();

  const filteredVendors = vendors.filter((vendor) => {
    const term = searchTerm.toLowerCase();
    return (
      vendor.name.toLowerCase().includes(term) ||
      vendor.email?.toLowerCase().includes(term) ||
      vendor.phone?.includes(term)
    );
  });

  const handleSubmit = async () => {
    if (!session?.tid || !canManageTenant || saveInFlight.current) return;
    if (!formData.name.trim()) {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.vendors.nameRequired') || 'Vendor name is required',
        variant: 'destructive',
      });
      return;
    }

    saveInFlight.current = true;
    setSaving(true);
    try {
      if (!showAdvancedTax) {
        // Simple flow: the tax section is hidden, so never rebuild (or
        // re-validate) the profile — new vendors get none, existing vendors
        // keep whatever their accountant saved, even an imperfect one.
        const vendorData: VendorFormData = {
          ...formData,
          taxProfile: editingVendor?.taxProfile ?? null,
        };
        if (editingVendor) {
          await vendorService.updateVendor(session.tid, editingVendor.id, vendorData);
          toast({
            title: t('common.success') || 'Success',
            description: t('money.vendors.updated') || 'Vendor updated successfully',
          });
        } else {
          await vendorService.createVendor(session.tid, vendorData);
          toast({
            title: t('common.success') || 'Success',
            description: t('money.vendors.created') || 'Vendor created successfully',
          });
        }
        setShowAddDialog(false);
        setEditingVendor(null);
        resetForm();
        queryClient.invalidateQueries({ queryKey: vendorKeys.all(tenantId) });
        return;
      }
      const hasTaxDetails = Boolean(
        taxResidence
        || taxRegime
        || permanentEstablishment
        || treatyRatePercent.trim()
        || treatyReference.trim(),
      );
      let taxProfile: TLVendorTaxProfile | null = null;
      if (hasTaxDetails) {
        if (!taxResidence) throw new Error('Select the vendor\'s tax residence.');
        if (!taxRegime) throw new Error('Select the vendor\'s tax regime.');
        if (taxResidence === 'non_resident' && !permanentEstablishment) {
          throw new Error(
            'Confirm whether the non-resident vendor has a permanent establishment in Timor-Leste.',
          );
        }
        const parsedTreatyRate = treatyRatePercent.trim() === ''
          ? undefined
          : Number(treatyRatePercent);
        taxProfile = normalizeTLVendorTaxProfile({
          recipientResidence: taxResidence,
          taxRegime,
          ...(taxResidence === 'non_resident'
            ? { recipientHasTimorLestePermanentEstablishment: permanentEstablishment === 'yes' }
            : {}),
          ...(parsedTreatyRate === undefined ? {} : { treatyRatePercent: parsedTreatyRate }),
          ...(treatyReference.trim() ? { treatyReference: treatyReference.trim() } : {}),
        });
      }
      const vendorData: VendorFormData = { ...formData, taxProfile };
      if (editingVendor) {
        await vendorService.updateVendor(session.tid, editingVendor.id, vendorData);
        toast({
          title: t('common.success') || 'Success',
          description: t('money.vendors.updated') || 'Vendor updated successfully',
        });
      } else {
        await vendorService.createVendor(session.tid, vendorData);
        toast({
          title: t('common.success') || 'Success',
          description: t('money.vendors.created') || 'Vendor created successfully',
        });
      }
      setShowAddDialog(false);
      setEditingVendor(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: vendorKeys.all(tenantId) });
    } catch (error) {
      console.error('Error saving vendor:', error);
      toast({
        title: t('common.error') || 'Error',
        description: error instanceof Error
          ? error.message
          : t('money.vendors.saveError') || 'Failed to save vendor',
        variant: 'destructive',
      });
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  const handleEdit = (vendor: Vendor) => {
    if (!canManageTenant) return;
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      type: vendor.type,
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      city: vendor.city || '',
      tin: vendor.tin || '',
      notes: vendor.notes || '',
    });
    setTaxResidence(vendor.taxProfile?.recipientResidence || '');
    setTaxRegime(vendor.taxProfile?.taxRegime || '');
    setPermanentEstablishment(
      vendor.taxProfile?.recipientResidence === 'non_resident'
        && typeof vendor.taxProfile.recipientHasTimorLestePermanentEstablishment === 'boolean'
        ? vendor.taxProfile.recipientHasTimorLestePermanentEstablishment ? 'yes' : 'no'
        : '',
    );
    setTreatyRatePercent(
      vendor.taxProfile?.treatyRatePercent === undefined
        ? ''
        : String(vendor.taxProfile.treatyRatePercent),
    );
    setTreatyReference(vendor.taxProfile?.treatyReference || '');
    setShowAddDialog(true);
  };

  const handleDelete = async (vendor: Vendor) => {
    if (!session?.tid || !canManageTenant || deleteInFlight.current) return;
    if (!confirm(t('money.vendors.confirmDelete') || `Delete vendor "${vendor.name}"?`)) {
      return;
    }

    deleteInFlight.current = true;
    try {
      await vendorService.deactivateVendor(session.tid, vendor.id);
      toast({
        title: t('common.success') || 'Success',
        description: t('money.vendors.deleted') || 'Vendor deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: vendorKeys.all(tenantId) });
    } catch (error) {
      console.error('Error deleting vendor:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.vendors.deleteError') || 'Failed to delete vendor',
        variant: 'destructive',
      });
    } finally {
      deleteInFlight.current = false;
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'business',
      email: '',
      phone: '',
      address: '',
      city: '',
      tin: '',
      notes: '',
    });
    setTaxResidence('');
    setTaxRegime('');
    setPermanentEstablishment('');
    setTreatyRatePercent('');
    setTreatyReference('');
  };

  const openAddDialog = () => {
    if (!canManageTenant) return;
    setEditingVendor(null);
    resetForm();
    setShowAddDialog(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <Skeleton className="h-10 w-32" />
          </div>

          <div className="mb-6">
            <Skeleton className="h-10 w-full max-w-md" />
          </div>

          <div className="grid gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-16 rounded-full" />
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <Skeleton className="h-3 w-32" />
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </div>
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError && vendors.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <DashboardLoadError isRetrying={isFetching} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Vendors - Xefe" description="Manage your vendors and suppliers" />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={t('money.vendors.title') || 'Vendors'}
          subtitle={t('money.vendors.subtitle') || 'Manage your suppliers'}
          icon={Truck}
          iconColor="text-indigo-500"
          actions={canManageTenant ? (
            <Button onClick={openAddDialog} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4 mr-2" />
              {t('money.vendors.add') || 'Add Vendor'}
            </Button>
          ) : undefined}
        />

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('money.vendors.searchPlaceholder') || 'Search vendors...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Vendor List */}
        {filteredVendors.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <img src="/images/illustrations/xefe-empty.webp" alt="No vendors yet" className="h-28 w-auto mx-auto mb-4 object-contain drop-shadow-lg" />
              <p className="text-muted-foreground mb-4">
                {searchTerm
                  ? t('money.vendors.noResults') || 'No vendors found'
                  : t('money.vendors.empty') || 'No vendors yet'}
              </p>
              {!searchTerm && canManageTenant && (
                <Button onClick={openAddDialog} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('money.vendors.addFirst') || 'Add your first vendor'}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredVendors.map((vendor) => (
              <Card
                key={vendor.id}
                className="hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        {vendor.type === 'business' ? (
                          <Building2 className="h-6 w-6 text-muted-foreground" />
                        ) : (
                          <User className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{vendor.name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {vendor.type === 'business'
                              ? t('money.vendors.business') || 'Business'
                              : t('money.vendors.individual') || 'Individual'}
                          </Badge>
                          {!vendor.isActive && (
                            <Badge variant="outline" className="text-xs text-red-500">
                              {t('common.inactive') || 'Inactive'}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {vendor.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {vendor.email}
                            </span>
                          )}
                          {vendor.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {vendor.phone}
                            </span>
                          )}
                          {vendor.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {vendor.city}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {canManageTenant && <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t('common.moreActions')}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/money/bills/new?vendor=${vendor.id}`)}>
                          <Receipt className="h-4 w-4 mr-2" />
                          {t('money.vendors.newBill') || 'New Bill'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/money/expenses?vendor=${vendor.id}`)}>
                          <FileText className="h-4 w-4 mr-2" />
                          {t('money.vendors.newExpense') || 'New Expense'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(vendor)}>
                          <Edit className="h-4 w-4 mr-2" />
                          {t('common.edit') || 'Edit'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(vendor)}
                          className="text-red-500"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('common.delete') || 'Delete'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Vendor count */}
        {filteredVendors.length > 0 && (
          <p className="text-sm text-muted-foreground mt-4">
            {t('money.vendors.showing') || 'Showing'} {filteredVendors.length}{' '}
            {filteredVendors.length === 1
              ? t('money.vendors.vendor') || 'vendor'
              : t('money.vendors.vendors') || 'vendors'}
          </p>
        )}
      </div>

      {/* Add/Edit Vendor Dialog */}
      <Dialog open={canManageTenant && showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingVendor
                ? t('money.vendors.editVendor') || 'Edit Vendor'
                : t('money.vendors.addVendor') || 'Add Vendor'}
            </DialogTitle>
            <DialogDescription>
              {t('money.vendors.formDescription') || 'Enter vendor details'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('money.vendors.name') || 'Name'} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('money.vendors.namePlaceholder') || 'Company or person name'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">{t('money.vendors.type') || 'Type'}</Label>
              <Select
                value={formData.type}
                onValueChange={(value: 'business' | 'individual') =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">
                    {t('money.vendors.business') || 'Business'}
                  </SelectItem>
                  <SelectItem value="individual">
                    {t('money.vendors.individual') || 'Individual'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('common.email') || 'Email'}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t('common.phone') || 'Phone'}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+670 7777 7777"
                />
              </div>
            </div>

            {/* Residence/regime/treaty facts are accountant classifications. The
                simple flow leaves taxProfile unset ("not configured") — which the
                bill calculator treats as no supplier withholding. A profile saved
                by an accountant survives normalo edits: handleEdit populates the
                state above regardless of this gate. */}
            {showAdvancedTax && (
            <MoreDetailsSection
              title={t('money.vendors.supplierTaxDetails') || 'Supplier tax details'}
            >
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('money.vendors.supplierTaxHelp')
                    || 'Required only when a bill may be subject to supplier withholding tax.'}
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('money.vendors.taxResidence') || 'Tax residence'}</Label>
                    <Select
                      value={taxResidence || 'not_set'}
                      onValueChange={(value) => {
                        const residence = value === 'not_set'
                          ? ''
                          : value as 'resident' | 'non_resident';
                        setTaxResidence(residence);
                        if (residence !== 'non_resident') {
                          setPermanentEstablishment('');
                          setTreatyRatePercent('');
                          setTreatyReference('');
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_set">
                          {t('money.vendors.notConfigured') || 'Not configured'}
                        </SelectItem>
                        <SelectItem value="resident">
                          {t('money.vendors.resident') || 'Timor-Leste resident'}
                        </SelectItem>
                        <SelectItem value="non_resident">
                          {t('money.vendors.nonResident') || 'Non-resident'}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('money.vendors.taxRegime') || 'Tax regime'}</Label>
                    <Select
                      value={taxRegime || 'not_set'}
                      onValueChange={(value) => {
                        const regime = value === 'not_set'
                          ? ''
                          : value as 'domestic' | 'petroleum';
                        setTaxRegime(regime);
                        if (regime !== 'domestic') {
                          setTreatyRatePercent('');
                          setTreatyReference('');
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_set">
                          {t('money.vendors.notConfigured') || 'Not configured'}
                        </SelectItem>
                        <SelectItem value="domestic">
                          {t('money.vendors.domesticRegime') || 'Domestic tax regime'}
                        </SelectItem>
                        <SelectItem value="petroleum">
                          {t('money.vendors.petroleumRegime') || 'Petroleum tax regime'}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {taxResidence === 'non_resident' && (
                  <div className="space-y-2">
                    <Label>
                      {t('money.vendors.permanentEstablishment')
                        || 'Permanent establishment in Timor-Leste?'}
                    </Label>
                    <Select
                      value={permanentEstablishment || 'not_set'}
                      onValueChange={(value) => setPermanentEstablishment(
                        value === 'not_set' ? '' : value as 'yes' | 'no',
                      )}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_set">
                          {t('money.vendors.selectAnswer') || 'Select an answer'}
                        </SelectItem>
                        <SelectItem value="yes">{t('common.yes') || 'Yes'}</SelectItem>
                        <SelectItem value="no">{t('common.no') || 'No'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {taxResidence === 'non_resident'
                  && permanentEstablishment === 'no'
                  && taxRegime === 'domestic' && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t('money.vendors.treatyRate') || 'Treaty rate'} (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={treatyRatePercent}
                          onChange={(event) => setTreatyRatePercent(event.target.value)}
                          placeholder={t('common.optional') || 'Optional'}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('money.vendors.treatyReference') || 'Treaty evidence'}</Label>
                        <Input
                          value={treatyReference}
                          onChange={(event) => setTreatyReference(event.target.value)}
                          placeholder={t('money.vendors.treatyReferencePlaceholder')
                            || 'Treaty and article'}
                        />
                      </div>
                    </div>
                  )}
              </div>
            </MoreDetailsSection>
            )}

            <div className="space-y-2">
              <Label htmlFor="address">{t('common.address') || 'Address'}</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder={t('money.vendors.addressPlaceholder') || 'Street address'}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">{t('common.city') || 'City'}</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Dili"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tin">{t('money.vendors.tin') || 'TIN (Tax ID)'}</Label>
                <Input
                  id="tin"
                  value={formData.tin}
                  onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                  placeholder={t('money.vendors.tinPlaceholder') || 'Tax identification number'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('common.notes') || 'Notes'}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('money.vendors.notesPlaceholder') || 'Internal notes about this vendor'}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving
                ? (t('common.saving') || 'Saving...')
                : editingVendor
                  ? t('common.save') || 'Save'
                  : t('money.vendors.add') || 'Add Vendor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
