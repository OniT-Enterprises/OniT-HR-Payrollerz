/**
 * Vendors Page
 * List, search, and manage vendors (suppliers)
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useTenant, useTenantId } from '@/contexts/TenantContext';
import { vendorService } from '@/services/vendorService';
import { useAllVendors, vendorKeys } from '@/hooks/useVendors';
import { InfoTooltip, MoneyTooltips } from '@/components/ui/info-tooltip';
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
  const { session } = useTenant();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
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
  const { data: vendors = [], isLoading: loading } = useAllVendors();

  const filteredVendors = vendors.filter((vendor) => {
    const term = searchTerm.toLowerCase();
    return (
      vendor.name.toLowerCase().includes(term) ||
      vendor.email?.toLowerCase().includes(term) ||
      vendor.phone?.includes(term)
    );
  });

  const handleSubmit = async () => {
    if (!session?.tid) return;
    if (!formData.name.trim()) {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.vendors.nameRequired') || 'Vendor name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingVendor) {
        await vendorService.updateVendor(session.tid, editingVendor.id, formData);
        toast({
          title: t('common.success') || 'Success',
          description: t('money.vendors.updated') || 'Vendor updated successfully',
        });
      } else {
        await vendorService.createVendor(session.tid, formData);
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
        description: t('money.vendors.saveError') || 'Failed to save vendor',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (vendor: Vendor) => {
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
    setShowAddDialog(true);
  };

  const handleDelete = async (vendor: Vendor) => {
    if (!session?.tid) return;
    if (!confirm(t('money.vendors.confirmDelete') || `Delete vendor "${vendor.name}"?`)) {
      return;
    }

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
  };

  const openAddDialog = () => {
    setEditingVendor(null);
    resetForm();
    setShowAddDialog(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-7xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <div className="grid gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Vendors - OniT" description="Manage your vendors and suppliers" />
      <MainNavigation />

      <div className="p-6 max-w-7xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
              <Truck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {t('money.vendors.title') || 'Vendors'}
                <InfoTooltip
                  title="Vendors (Suppliers)"
                  content={MoneyTooltips.bills.vendor}
                />
              </h1>
              <p className="text-muted-foreground">
                {t('money.vendors.subtitle') || 'Manage your suppliers'}
              </p>
            </div>
          </div>
          <Button onClick={openAddDialog} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            {t('money.vendors.add') || 'Add Vendor'}
          </Button>
        </div>

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
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">
                {searchTerm
                  ? t('money.vendors.noResults') || 'No vendors found'
                  : t('money.vendors.empty') || 'No vendors yet'}
              </p>
              {!searchTerm && (
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/money/bills/new?vendor=${vendor.id}`)}>
                          <Receipt className="h-4 w-4 mr-2" />
                          {t('money.vendors.newBill') || 'New Bill'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/money/expenses/new?vendor=${vendor.id}`)}>
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
                    </DropdownMenu>
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
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
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
            <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700">
              {editingVendor
                ? t('common.save') || 'Save'
                : t('money.vendors.add') || 'Add Vendor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
