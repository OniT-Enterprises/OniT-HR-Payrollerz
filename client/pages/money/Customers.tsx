/**
 * Customers Page
 * List, search, and manage customers for invoicing
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useTenant } from '@/contexts/TenantContext';
import { customerService } from '@/services/customerService';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import type { Customer, CustomerFormData } from '@/types/money';
import {
  Users,
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
} from 'lucide-react';

export default function Customers() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { session } = useTenant();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    type: 'business',
    email: '',
    phone: '',
    address: '',
    city: '',
    tin: '',
    notes: '',
  });

  useEffect(() => {
    if (session?.tid) {
      loadCustomers();
    }
  }, [session?.tid]);

  const loadCustomers = async () => {
    if (!session?.tid) return;
    try {
      setLoading(true);
      const data = await customerService.getAllCustomers(session.tid);
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.customers.loadError') || 'Failed to load customers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const term = searchTerm.toLowerCase();
    return (
      customer.name.toLowerCase().includes(term) ||
      customer.email?.toLowerCase().includes(term) ||
      customer.phone?.includes(term)
    );
  });

  const handleSubmit = async () => {
    if (!session?.tid) return;
    if (!formData.name.trim()) {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.customers.nameRequired') || 'Customer name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingCustomer) {
        await customerService.updateCustomer(session.tid, editingCustomer.id, formData);
        toast({
          title: t('common.success') || 'Success',
          description: t('money.customers.updated') || 'Customer updated successfully',
        });
      } else {
        await customerService.createCustomer(session.tid, formData);
        toast({
          title: t('common.success') || 'Success',
          description: t('money.customers.created') || 'Customer created successfully',
        });
      }
      setShowAddDialog(false);
      setEditingCustomer(null);
      resetForm();
      loadCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.customers.saveError') || 'Failed to save customer',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      type: customer.type,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      tin: customer.tin || '',
      notes: customer.notes || '',
    });
    setShowAddDialog(true);
  };

  const handleDelete = async (customer: Customer) => {
    if (!session?.tid) return;
    if (!confirm(t('money.customers.confirmDelete') || `Delete customer "${customer.name}"?`)) {
      return;
    }

    try {
      await customerService.deactivateCustomer(session.tid, customer.id);
      toast({
        title: t('common.success') || 'Success',
        description: t('money.customers.deleted') || 'Customer deleted successfully',
      });
      loadCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.customers.deleteError') || 'Failed to delete customer',
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
    setEditingCustomer(null);
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
      <SEO title="Customers - OniT" description="Manage your customers for invoicing" />
      <MainNavigation />

      <div className="p-6 max-w-7xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
              <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {t('money.customers.title') || 'Customers'}
                <InfoTooltip
                  title="Customers"
                  content="People or businesses you invoice for goods or services. Customer records store contact info and are linked to invoices."
                />
              </h1>
              <p className="text-muted-foreground">
                {t('money.customers.subtitle') || 'Manage your customer list'}
              </p>
            </div>
          </div>
          <Button onClick={openAddDialog} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            {t('money.customers.add') || 'Add Customer'}
          </Button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('money.customers.searchPlaceholder') || 'Search customers...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Customer List */}
        {filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">
                {searchTerm
                  ? t('money.customers.noResults') || 'No customers found'
                  : t('money.customers.empty') || 'No customers yet'}
              </p>
              {!searchTerm && (
                <Button onClick={openAddDialog} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('money.customers.addFirst') || 'Add your first customer'}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredCustomers.map((customer) => (
              <Card
                key={customer.id}
                className="hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        {customer.type === 'business' ? (
                          <Building2 className="h-6 w-6 text-muted-foreground" />
                        ) : (
                          <User className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{customer.name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {customer.type === 'business'
                              ? t('money.customers.business') || 'Business'
                              : t('money.customers.individual') || 'Individual'}
                          </Badge>
                          {!customer.isActive && (
                            <Badge variant="outline" className="text-xs text-red-500">
                              {t('common.inactive') || 'Inactive'}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {customer.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </span>
                          )}
                          {customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </span>
                          )}
                          {customer.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {customer.city}
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
                        <DropdownMenuItem onClick={() => navigate(`/money/invoices/new?customer=${customer.id}`)}>
                          <FileText className="h-4 w-4 mr-2" />
                          {t('money.customers.newInvoice') || 'New Invoice'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(customer)}>
                          <Edit className="h-4 w-4 mr-2" />
                          {t('common.edit') || 'Edit'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(customer)}
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

        {/* Customer count */}
        {filteredCustomers.length > 0 && (
          <p className="text-sm text-muted-foreground mt-4">
            {t('money.customers.showing') || 'Showing'} {filteredCustomers.length}{' '}
            {filteredCustomers.length === 1
              ? t('money.customers.customer') || 'customer'
              : t('money.customers.customers') || 'customers'}
          </p>
        )}
      </div>

      {/* Add/Edit Customer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer
                ? t('money.customers.editCustomer') || 'Edit Customer'
                : t('money.customers.addCustomer') || 'Add Customer'}
            </DialogTitle>
            <DialogDescription>
              {t('money.customers.formDescription') || 'Enter customer details'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('money.customers.name') || 'Name'} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('money.customers.namePlaceholder') || 'Company or person name'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">{t('money.customers.type') || 'Type'}</Label>
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
                    {t('money.customers.business') || 'Business'}
                  </SelectItem>
                  <SelectItem value="individual">
                    {t('money.customers.individual') || 'Individual'}
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
                placeholder={t('money.customers.addressPlaceholder') || 'Street address'}
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
                <Label htmlFor="tin">{t('money.customers.tin') || 'TIN (Tax ID)'}</Label>
                <Input
                  id="tin"
                  value={formData.tin}
                  onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                  placeholder={t('money.customers.tinPlaceholder') || 'Tax identification number'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('common.notes') || 'Notes'}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('money.customers.notesPlaceholder') || 'Internal notes about this customer'}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700">
              {editingCustomer
                ? t('common.save') || 'Save'
                : t('money.customers.add') || 'Add Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
