/**
 * A/P Aging Report
 * Shows outstanding bills grouped by age (current, 30, 60, 90+ days)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { useTenantId } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { billService } from '@/services/billService';
import { vendorService } from '@/services/vendorService';
import { InfoTooltip, MoneyTooltips } from '@/components/ui/info-tooltip';
import type { Bill, Vendor } from '@/types/money';
import {
  Clock,
  AlertTriangle,
  Truck,
  ChevronRight,
  FileText,
} from 'lucide-react';

interface AgingBucket {
  label: string;
  days: string;
  bills: Bill[];
  total: number;
}

interface VendorAging {
  vendorId: string;
  vendorName: string;
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
  total: number;
}

export default function APAgingReport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [buckets, setBuckets] = useState<AgingBucket[]>([]);
  const [vendorAging, setVendorAging] = useState<VendorAging[]>([]);
  const [totalPayable, setTotalPayable] = useState(0);

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const loadData = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const [bills, vendors] = await Promise.all([
        billService.getAllBills(tenantId),
        vendorService.getAllVendors(tenantId),
      ]);

      // Create vendor lookup
      const vendorMap = new Map<string, Vendor>();
      vendors.forEach(v => vendorMap.set(v.id, v));

      // Filter to only unpaid bills
      const unpaidBills = bills.filter(
        bill => bill.status !== 'paid' && bill.status !== 'cancelled'
      );

      const now = new Date();

      // Calculate days overdue for each bill
      const billsWithAge = unpaidBills.map(bill => {
        const dueDate = new Date(bill.dueDate);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const vendor = vendorMap.get(bill.vendorId);
        return { ...bill, daysOverdue, vendorName: vendor?.name || 'Unknown Vendor' };
      });

      // Group into aging buckets
      const current = billsWithAge.filter(bill => bill.daysOverdue <= 0);
      const days1to30 = billsWithAge.filter(bill => bill.daysOverdue > 0 && bill.daysOverdue <= 30);
      const days31to60 = billsWithAge.filter(bill => bill.daysOverdue > 30 && bill.daysOverdue <= 60);
      const days61to90 = billsWithAge.filter(bill => bill.daysOverdue > 60 && bill.daysOverdue <= 90);
      const days90Plus = billsWithAge.filter(bill => bill.daysOverdue > 90);

      const calcTotal = (bills: Bill[]) => bills.reduce((sum, bill) => sum + (bill.amount - (bill.amountPaid || 0)), 0);

      setBuckets([
        { label: t('money.apAging.current') || 'Current', days: '0 days', bills: current, total: calcTotal(current) },
        { label: t('money.apAging.days1to30') || '1-30 Days', days: '1-30', bills: days1to30, total: calcTotal(days1to30) },
        { label: t('money.apAging.days31to60') || '31-60 Days', days: '31-60', bills: days31to60, total: calcTotal(days31to60) },
        { label: t('money.apAging.days61to90') || '61-90 Days', days: '61-90', bills: days61to90, total: calcTotal(days61to90) },
        { label: t('money.apAging.days90Plus') || '90+ Days', days: '90+', bills: days90Plus, total: calcTotal(days90Plus) },
      ]);

      // Group by vendor
      const vendorAgingMap = new Map<string, VendorAging>();

      billsWithAge.forEach(bill => {
        const balance = bill.amount - (bill.amountPaid || 0);
        if (!vendorAgingMap.has(bill.vendorId)) {
          vendorAgingMap.set(bill.vendorId, {
            vendorId: bill.vendorId,
            vendorName: bill.vendorName,
            current: 0,
            days30: 0,
            days60: 0,
            days90Plus: 0,
            total: 0,
          });
        }

        const vendor = vendorAgingMap.get(bill.vendorId)!;
        vendor.total += balance;

        if (bill.daysOverdue <= 0) {
          vendor.current += balance;
        } else if (bill.daysOverdue <= 30) {
          vendor.days30 += balance;
        } else if (bill.daysOverdue <= 60) {
          vendor.days60 += balance;
        } else {
          vendor.days90Plus += balance;
        }
      });

      const sortedVendors = Array.from(vendorAgingMap.values()).sort((a, b) => b.total - a.total);
      setVendorAging(sortedVendors);
      setTotalPayable(calcTotal(unpaidBills));
    } catch (error) {
      console.error('Error loading A/P aging:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.apAging.loadError') || 'Failed to load report',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-6xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <div className="grid grid-cols-5 gap-4 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="A/P Aging - Meza" description="Accounts payable aging report" />
      <MainNavigation />

      <div className="p-6 max-w-6xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
              <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {t('money.apAging.title') || 'A/P Aging Report'}
                <InfoTooltip
                  title={t('money.apAging.tooltipTitle') || 'Accounts Payable Aging'}
                  content={MoneyTooltips.terms.apAging}
                />
              </h1>
              <p className="text-muted-foreground">
                {t('money.apAging.subtitle') || 'Outstanding bills by age'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{t('money.apAging.totalPayable') || 'Total Payable'}</p>
            <p className="text-2xl font-bold">{formatCurrency(totalPayable)}</p>
          </div>
        </div>

        {/* Aging Buckets */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {buckets.map((bucket, index) => (
            <Card key={bucket.label} className={index >= 3 ? 'border-red-200 dark:border-red-800' : ''}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{bucket.label}</p>
                <p className={`text-xl font-bold ${index >= 3 ? 'text-red-600' : ''}`}>
                  {formatCurrency(bucket.total)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {bucket.bills.length} {bucket.bills.length === 1
                    ? (t('money.apAging.bill') || 'bill')
                    : (t('money.apAging.bills') || 'bills')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Vendor Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {t('money.apAging.byVendor') || 'Aging by Vendor'}
            </CardTitle>
            <CardDescription>
              {t('money.apAging.byVendorDesc') || 'Outstanding balances grouped by vendor'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vendorAging.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {t('money.apAging.noOutstanding') || 'No outstanding bills'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-sm">
                      <th className="text-left py-3 font-medium">{t('money.apAging.vendor') || 'Vendor'}</th>
                      <th className="text-right py-3 font-medium">{t('money.apAging.current') || 'Current'}</th>
                      <th className="text-right py-3 font-medium">1-30</th>
                      <th className="text-right py-3 font-medium">31-60</th>
                      <th className="text-right py-3 font-medium">90+</th>
                      <th className="text-right py-3 font-medium">{t('money.apAging.total') || 'Total'}</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorAging.map((vendor) => (
                      <tr key={vendor.vendorId} className="border-b hover:bg-muted/50">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {vendor.days90Plus > 0 && (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="font-medium">{vendor.vendorName}</span>
                          </div>
                        </td>
                        <td className="text-right py-3 tabular-nums">{formatCurrency(vendor.current)}</td>
                        <td className="text-right py-3 tabular-nums">{formatCurrency(vendor.days30)}</td>
                        <td className="text-right py-3 tabular-nums">{formatCurrency(vendor.days60)}</td>
                        <td className="text-right py-3 text-red-600 tabular-nums">{formatCurrency(vendor.days90Plus)}</td>
                        <td className="text-right py-3 font-semibold tabular-nums">{formatCurrency(vendor.total)}</td>
                        <td className="py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/money/vendors`)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted font-semibold">
                      <td className="py-3">{t('money.apAging.total') || 'Total'}</td>
                      <td className="text-right py-3 tabular-nums">{formatCurrency(buckets[0]?.total || 0)}</td>
                      <td className="text-right py-3 tabular-nums">{formatCurrency(buckets[1]?.total || 0)}</td>
                      <td className="text-right py-3 tabular-nums">{formatCurrency(buckets[2]?.total || 0)}</td>
                      <td className="text-right py-3 text-red-600 tabular-nums">
                        {formatCurrency((buckets[3]?.total || 0) + (buckets[4]?.total || 0))}
                      </td>
                      <td className="text-right py-3 tabular-nums">{formatCurrency(totalPayable)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
