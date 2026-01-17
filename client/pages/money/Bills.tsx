/**
 * Bills Page
 * List, filter, and manage bills (accounts payable)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { SEO } from '@/components/SEO';
import { billService } from '@/services/billService';
import type { Bill, BillStatus } from '@/types/money';
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  Filter,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

const STATUS_STYLES: Record<BillStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  partial: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export default function Bills() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<Bill[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    try {
      setLoading(true);
      const data = await billService.getAllBills();
      setBills(data);
    } catch (error) {
      console.error('Error loading bills:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.bills.loadError') || 'Failed to load bills',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredBills = bills.filter((bill) => {
    const matchesSearch =
      bill.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.billNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate stats
  const totalPayables = bills
    .filter((b) => ['pending', 'partial', 'overdue'].includes(b.status))
    .reduce((sum, b) => sum + b.balanceDue, 0);
  const overdueBills = bills.filter((b) => b.status === 'overdue');
  const overdueAmount = overdueBills.reduce((sum, b) => sum + b.balanceDue, 0);

  const handleDelete = async (bill: Bill) => {
    if (
      !confirm(
        t('money.bills.confirmDelete') || `Delete bill from ${bill.vendorName}?`
      )
    ) {
      return;
    }

    try {
      await billService.deleteBill(bill.id);
      toast({
        title: t('common.success') || 'Success',
        description: t('money.bills.deleted') || 'Bill deleted',
      });
      loadBills();
    } catch (error) {
      console.error('Error deleting bill:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.bills.deleteError') || 'Failed to delete bill',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-7xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
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
      <SEO title="Bills - OniT" description="Manage your bills and accounts payable" />
      <MainNavigation />

      <div className="p-6 max-w-7xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-teal-100 dark:bg-teal-900 flex items-center justify-center">
              <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('money.bills.title') || 'Bills'}</h1>
              <p className="text-muted-foreground">
                {t('money.bills.subtitle') || 'Manage accounts payable'}
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/money/bills/new')}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('money.bills.new') || 'New Bill'}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('money.bills.totalPayables') || 'Total Payables'}
                  </p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalPayables)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {bills.filter((b) => ['pending', 'partial', 'overdue'].includes(b.status)).length}{' '}
                    {t('money.bills.unpaidBills') || 'unpaid bills'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('money.bills.overdue') || 'Overdue'}
                  </p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(overdueAmount)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {overdueBills.length}{' '}
                    {overdueBills.length === 1
                      ? t('money.bills.bill') || 'bill'
                      : t('money.bills.bills') || 'bills'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('money.bills.searchPlaceholder') || 'Search bills...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('money.bills.status') || 'Status'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all') || 'All'}</SelectItem>
              <SelectItem value="pending">{t('money.billStatus.pending') || 'Pending'}</SelectItem>
              <SelectItem value="partial">{t('money.billStatus.partial') || 'Partial'}</SelectItem>
              <SelectItem value="paid">{t('money.billStatus.paid') || 'Paid'}</SelectItem>
              <SelectItem value="overdue">{t('money.billStatus.overdue') || 'Overdue'}</SelectItem>
              <SelectItem value="cancelled">{t('money.billStatus.cancelled') || 'Cancelled'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bill List */}
        {filteredBills.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? t('money.bills.noResults') || 'No bills found'
                  : t('money.bills.empty') || 'No bills yet'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button onClick={() => navigate('/money/bills/new')} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('money.bills.createFirst') || 'Add your first bill'}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredBills.map((bill) => (
              <Card
                key={bill.id}
                className="hover:border-teal-300 dark:hover:border-teal-800 transition-colors cursor-pointer"
                onClick={() => navigate(`/money/bills/${bill.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{bill.vendorName}</p>
                          <Badge className={STATUS_STYLES[bill.status]}>
                            {t(`money.billStatus.${bill.status}`) || bill.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {bill.description}
                          {bill.billNumber && ` - ${bill.billNumber}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="font-semibold">{formatCurrency(bill.total)}</p>
                        {bill.balanceDue > 0 && bill.balanceDue !== bill.total && (
                          <p className="text-xs text-muted-foreground">
                            {t('money.bills.due') || 'Due'}: {formatCurrency(bill.balanceDue)}
                          </p>
                        )}
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(bill.dueDate)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onClick={() => navigate(`/money/bills/${bill.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t('common.view') || 'View'}
                          </DropdownMenuItem>
                          {bill.status === 'pending' && (
                            <DropdownMenuItem
                              onClick={() => navigate(`/money/bills/${bill.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              {t('common.edit') || 'Edit'}
                            </DropdownMenuItem>
                          )}
                          {['pending', 'partial', 'overdue'].includes(bill.status) && (
                            <DropdownMenuItem
                              onClick={() => navigate(`/money/bills/${bill.id}?record=payment`)}
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              {t('money.bills.recordPayment') || 'Record Payment'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(bill)}
                            className="text-red-500"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('common.delete') || 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Bill count */}
        {filteredBills.length > 0 && (
          <p className="text-sm text-muted-foreground mt-4">
            {t('money.bills.showing') || 'Showing'} {filteredBills.length}{' '}
            {filteredBills.length === 1
              ? t('money.bills.bill') || 'bill'
              : t('money.bills.bills') || 'bills'}
          </p>
        )}
      </div>
    </div>
  );
}
