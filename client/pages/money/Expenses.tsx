/**
 * Expenses Page
 * Track and manage business expenses
 */

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { collection, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import MainNavigation from '@/components/layout/MainNavigation';
import PageHeader from '@/components/layout/PageHeader';
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
import { useTenant, useTenantId } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { expenseService } from '@/services/expenseService';
import { fileUploadService } from '@/services/fileUploadService';
import { canExtractFile, extractDocument } from '@/lib/aiExtract';
import { useSmartExpenses, expenseKeys } from '@/hooks/useExpenses';
import DashboardLoadError from '@/components/dashboard/DashboardLoadError';
import { useDebounce } from '@/hooks/useDebounce';
import { useActiveVendors } from '@/hooks/useVendors';
import { InfiniteScrollTrigger } from '@/components/ui/InfiniteScrollTrigger';

import type { Expense, ExpenseFormData, ExpenseCategory, PaymentMethod } from '@/types/money';
import { getTodayTL, formatDateTL } from '@/lib/dateUtils';
import { sumMoney } from '@/lib/currency';
import {
  Receipt,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Calendar,
  Filter,
  TrendingDown,
  DollarSign,
  Camera,
  Upload,
  Loader2,
  Sparkles,
  X,
  FileText,
  Image,
  ExternalLink,
} from 'lucide-react';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'transport', label: 'Transport' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'meals', label: 'Meals' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'taxes_licenses', label: 'Taxes & Licenses' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'communication', label: 'Communication' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
];

export default function Expenses() {
  const [searchParams] = useSearchParams();
  const preselectedVendorId = searchParams.get('vendor');
  const { toast } = useToast();
  const { t } = useI18n();
  const { session, canManage } = useTenant();
  const canManageTenant = canManage();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const isSearching = debouncedSearchTerm.length > 0;
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState<ExpenseFormData>({
    date: getTodayTL(),
    description: '',
    amount: 0,
    category: 'other',
    vendorId: '',
    paymentMethod: 'cash',
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const {
    expenses,
    totalLoaded,
    isLoading: expensesLoading,
    isError: expensesError,
    isFetching: expensesFetching,
    refetch: refetchExpenses,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSmartExpenses(isSearching);
  const {
    data: vendors = [],
    isLoading: vendorsLoading,
    isError: vendorsError,
    isFetching: vendorsFetching,
    refetch: refetchVendors,
  } = useActiveVendors();
  const loading = expensesLoading || vendorsLoading;

  useEffect(() => {
    // Open dialog if vendor preselected
    if (preselectedVendorId && vendors.length > 0) {
      setFormData((prev) => ({ ...prev, vendorId: preselectedVendorId }));
      setShowAddDialog(true);
    }
  }, [preselectedVendorId, vendors]);

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch =
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.vendorName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Calculate stats
  const totalExpenses = sumMoney(expenses.map((expense) => expense.amount));
  const currentMonth = getTodayTL().slice(0, 7);
  const thisMonthExpenses = expenses.filter((expense) => expense.date.startsWith(currentMonth));
  const thisMonthTotal = sumMoney(thisMonthExpenses.map((expense) => expense.amount));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return formatDateTL(dateStr, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getCategoryLabel = (category: ExpenseCategory) => {
    const found = EXPENSE_CATEGORIES.find((c) => c.value === category);
    return t(`money.expenses.categories.${category}`) || found?.label || category;
  };

  const handleReceiptSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = fileUploadService.validateReceiptFile(file);
    if (!validation.valid) {
      toast({
        title: t('common.error') || 'Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    setReceiptFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null);
    }
  };

  const clearReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setExistingReceiptUrl(null);
  };

  // ── Drop a receipt anywhere on the page: XefeBot reads it and pre-fills
  //    the add-expense form; the user reviews and confirms. ──
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  const dropInputRef = useRef<HTMLInputElement>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'reading' | 'done' | 'failed'>('idle');
  const [aiVendorName, setAiVendorName] = useState<string | null>(null);
  const aiRun = useRef(0);

  const handleDroppedReceipt = (incoming: File[]) => {
    if (!canManageTenant) return;
    const file = incoming[0];
    if (!file) return;

    const validation = fileUploadService.validateReceiptFile(file);
    if (!validation.valid) {
      toast({
        title: t('common.error') || 'Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    setEditingExpense(null);
    resetForm();
    setReceiptFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setReceiptPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
    setShowAddDialog(true);

    if (!canExtractFile(file)) {
      setAiStatus('idle');
      return;
    }
    const run = ++aiRun.current;
    setAiStatus('reading');
    setAiVendorName(null);
    extractDocument(file, tenantId, 'expense')
      .then((fields) => {
        if (aiRun.current !== run) return;
        if (fields.documentType === 'other' || fields.confidence < 0.3) {
          setAiStatus('failed');
          return;
        }
        setFormData((prev) => ({
          ...prev,
          date: fields.billDate || prev.date,
          description: fields.description || prev.description,
          amount: fields.amount ?? prev.amount,
          category: (fields.category as ExpenseFormData['category']) || prev.category,
        }));
        if (fields.vendorName) setAiVendorName(fields.vendorName);
        setAiStatus('done');
      })
      .catch(() => {
        if (aiRun.current === run) setAiStatus('failed');
      });
  };

  // Match the extracted vendor name against the vendor list once both exist.
  useEffect(() => {
    if (!aiVendorName || formData.vendorId || vendors.length === 0) return;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = norm(aiVendorName);
    if (!target) return;
    const match =
      vendors.find((v) => norm(v.name) === target) ??
      vendors.find((v) => target.includes(norm(v.name)) || norm(v.name).includes(target));
    if (match) {
      setFormData((prev) => ({ ...prev, vendorId: match.id }));
      setAiVendorName(null);
    }
  }, [aiVendorName, vendors, formData.vendorId]);

  const [addingVendor, setAddingVendor] = useState(false);
  const handleAddExtractedVendor = async () => {
    if (!aiVendorName || addingVendor || !canManageTenant) return;
    setAddingVendor(true);
    try {
      const { vendorService } = await import('@/services/vendorService');
      const { vendorKeys } = await import('@/hooks/useVendors');
      const newVendorId = await vendorService.createVendor(tenantId, {
        name: aiVendorName,
        type: 'business',
      });
      await queryClient.invalidateQueries({ queryKey: vendorKeys.all(tenantId) });
      setFormData((prev) => ({ ...prev, vendorId: newVendorId }));
      setAiVendorName(null);
      toast({
        title: t('common.success') || 'Success',
        description: (t('money.ai.vendorAdded') || 'Vendor "{{name}}" added').replace('{{name}}', aiVendorName),
      });
    } catch (error) {
      console.error('Error creating vendor from extraction:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.ai.vendorAddFailed') || 'Could not add the vendor',
        variant: 'destructive',
      });
    } finally {
      setAddingVendor(false);
    }
  };

  const isFileDrag = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
  const handlePageDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };
  const handlePageDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
  };
  const handlePageDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragActive(false);
    }
  };
  const handlePageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    handleDroppedReceipt(Array.from(e.dataTransfer.files));
  };

  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const deletesInFlight = useRef(new Set<string>());

  const handleSubmit = async () => {
    if (!session?.tid || saving || saveInFlight.current) return;
    if (!formData.description.trim()) {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.expenses.descriptionRequired') || 'Description is required',
        variant: 'destructive',
      });
      return;
    }

    if (formData.amount <= 0) {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.expenses.amountRequired') || 'Enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    saveInFlight.current = true;
    setSaving(true);
    try {
      // Pre-generate Firestore doc ID so receipt upload path matches the final document
      const preGeneratedExpenseId = editingExpense?.id || doc(collection(db, paths.expenses(tenantId))).id;
      let receiptUrl = existingReceiptUrl || undefined;

      // Upload receipt if a new file was selected
      if (receiptFile) {
        setUploadingReceipt(true);
        try {
          receiptUrl = await fileUploadService.uploadExpenseReceipt(receiptFile, tenantId, preGeneratedExpenseId);
        } catch (uploadError) {
          console.error('Error uploading receipt:', uploadError);
          toast({
            title: t('common.error') || 'Error',
            description: t('money.expenses.receiptUploadError') || 'Failed to upload receipt',
            variant: 'destructive',
          });
          setUploadingReceipt(false);
          return;
        }
        setUploadingReceipt(false);
      }

      const dataWithReceipt = {
        ...formData,
        receiptUrl,
      };

      if (editingExpense) {
        await expenseService.updateExpense(session.tid, editingExpense.id, dataWithReceipt);
        toast({
          title: t('common.success') || 'Success',
          description: t('money.expenses.updated') || 'Expense updated successfully',
        });
      } else {
        await expenseService.createExpense(session.tid, dataWithReceipt, undefined, preGeneratedExpenseId);
        toast({
          title: t('common.success') || 'Success',
          description: t('money.expenses.created') || 'Expense created successfully',
        });
      }
      setShowAddDialog(false);
      setEditingExpense(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: expenseKeys.all(tenantId) });
    } catch (error) {
      console.error('Error saving expense:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.expenses.saveError') || 'Failed to save expense',
        variant: 'destructive',
      });
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      date: expense.date,
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      vendorId: expense.vendorId || '',
      paymentMethod: expense.paymentMethod,
      notes: expense.notes || '',
    });
    setReceiptFile(null);
    setReceiptPreview(null);
    setExistingReceiptUrl(expense.receiptUrl || null);
    setShowAddDialog(true);
  };

  const handleDelete = async (expense: Expense) => {
    if (!session?.tid || !canManageTenant || deletesInFlight.current.has(expense.id)) return;
    if (!confirm(t('money.expenses.confirmDelete') || 'Delete this expense?')) {
      return;
    }

    deletesInFlight.current.add(expense.id);
    try {
      await expenseService.deleteExpense(session.tid, expense.id);
      toast({
        title: t('common.success') || 'Success',
        description: t('money.expenses.deleted') || 'Expense deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: expenseKeys.all(tenantId) });
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.expenses.deleteError') || 'Failed to delete expense',
        variant: 'destructive',
      });
    } finally {
      deletesInFlight.current.delete(expense.id);
    }
  };

  const resetForm = () => {
    setFormData({
      date: getTodayTL(),
      description: '',
      amount: 0,
      category: 'other',
      vendorId: '',
      paymentMethod: 'cash',
      notes: '',
    });
    setReceiptFile(null);
    setReceiptPreview(null);
    setExistingReceiptUrl(null);
  };

  const openAddDialog = () => {
    setEditingExpense(null);
    resetForm();
    setShowAddDialog(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 mx-auto max-w-screen-2xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <Skeleton className="h-8 w-40 mb-2" />
              <Skeleton className="h-5 w-64" />
            </div>
            <Skeleton className="h-10 w-36" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-7 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-12 w-12 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Skeleton className="h-10 flex-1 max-w-md" />
            <Skeleton className="h-10 w-[180px]" />
          </div>

          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-16 rounded-full" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="space-y-2 text-right">
                        <Skeleton className="h-4 w-16 ml-auto" />
                        <Skeleton className="h-3 w-20 ml-auto" />
                      </div>
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if ((expensesError && expenses.length === 0) || (vendorsError && vendors.length === 0)) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <DashboardLoadError
          isRetrying={expensesFetching || vendorsFetching}
          onRetry={() => Promise.all([refetchExpenses(), refetchVendors()])}
        />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-background ${dragActive ? 'ring-2 ring-inset ring-indigo-400/60' : ''}`}
      onDragEnter={canManageTenant ? handlePageDragEnter : undefined}
      onDragOver={canManageTenant ? handlePageDragOver : undefined}
      onDragLeave={canManageTenant ? handlePageDragLeave : undefined}
      onDrop={canManageTenant ? handlePageDrop : undefined}
    >
      <SEO title="Expenses - Xefe" description="Track and manage business expenses" />
      <MainNavigation />

      <div className="p-6 mx-auto max-w-screen-2xl">
        <PageHeader
          title={t('money.expenses.title') || 'Expenses'}
          subtitle={t('money.expenses.subtitle') || 'Track business expenses'}
          cardIcon="mn-expenses" icon={Receipt}
          iconColor="text-indigo-500"
          actions={
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t('money.expenses.add') || 'Add Expense'}
            </Button>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('money.expenses.thisMonth') || 'This Month'}
                  </p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(thisMonthTotal)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {thisMonthExpenses.length}{' '}
                    {thisMonthExpenses.length === 1
                      ? t('money.expenses.expense') || 'expense'
                      : t('money.expenses.expenses') || 'expenses'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('money.expenses.totalExpenses') || 'Total Expenses'}
                  </p>
                  <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {expenses.length}{' '}
                    {expenses.length === 1
                      ? t('money.expenses.expense') || 'expense'
                      : t('money.expenses.expenses') || 'expenses'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick-add dropzone */}
        {canManageTenant && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => dropInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dropInputRef.current?.click();
              }
            }}
            className="mb-6 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-4 py-3 border-2 border-dashed border-muted-foreground/25 rounded-lg text-sm text-muted-foreground hover:border-indigo-400 hover:text-foreground hover:bg-muted/50 cursor-pointer transition-colors"
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span className="text-center">
              {t('money.expenses.dropStrip') ||
                'Drag & drop a receipt here (PDF or photo) — XefeBot fills in the details'}
            </span>
          </div>
        )}
        <input
          ref={dropInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            handleDroppedReceipt(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('money.expenses.searchPlaceholder') || 'Search expenses...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('money.expenses.category') || 'Category'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all') || 'All Categories'}</SelectItem>
              {EXPENSE_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {t(`money.expenses.categories.${cat.value}`) || cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Expense List */}
        {filteredExpenses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <img src="/images/illustrations/xefe-card-money.webp" alt="No expenses yet" className="h-28 w-auto mx-auto mb-4 object-contain drop-shadow-lg" />
              <p className="text-muted-foreground mb-4">
                {searchTerm || categoryFilter !== 'all'
                  ? t('money.expenses.noResults') || 'No expenses found'
                  : t('money.expenses.empty') || 'No expenses recorded yet'}
              </p>
              {!searchTerm && categoryFilter === 'all' && (
                <Button onClick={openAddDialog} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('money.expenses.addFirst') || 'Record your first expense'}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredExpenses.map((expense) => (
              <Card
                key={expense.id}
                className="hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                        <Receipt className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium">{expense.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {getCategoryLabel(expense.category)}
                          </Badge>
                          {expense.vendorName && (
                            <span className="text-xs text-muted-foreground">
                              {expense.vendorName}
                            </span>
                          )}
                          {expense.receiptUrl && (
                            <a
                              href={expense.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Image className="h-3 w-3" />
                              {t('money.expenses.receipt') || 'Receipt'}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-red-600">
                          -{formatCurrency(expense.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(expense.date)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(expense)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('common.edit') || 'Edit'}
                          </DropdownMenuItem>
                          {canManageTenant && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(expense)}
                              className="text-red-500"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('common.delete') || 'Delete'}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Infinite scroll trigger */}
            <InfiniteScrollTrigger
              onLoadMore={() => fetchNextPage()}
              hasMore={hasNextPage ?? false}
              isLoading={isFetchingNextPage}
            />
          </div>
        )}

        {/* Expense count */}
        {filteredExpenses.length > 0 && (
          <p className="text-sm text-muted-foreground mt-4">
            {t('money.expenses.showing') || 'Showing'} {filteredExpenses.length}{' '}
            {filteredExpenses.length === 1
              ? t('money.expenses.expense') || 'expense'
              : t('money.expenses.expenses') || 'expenses'}
            {totalLoaded > filteredExpenses.length && (
              <span>
                {' '}({t('common.of') || 'of'} {totalLoaded} {t('common.loaded') || 'loaded'})
              </span>
            )}
          </p>
        )}
      </div>

      {/* Add/Edit Expense Dialog */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(next) => {
          setShowAddDialog(next);
          if (!next) {
            aiRun.current += 1;
            setAiStatus('idle');
            setAiVendorName(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingExpense
                ? t('money.expenses.editExpense') || 'Edit Expense'
                : t('money.expenses.addExpense') || 'Add Expense'}
            </DialogTitle>
            <DialogDescription>
              {t('money.expenses.formDescription') || 'Enter expense details'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!editingExpense && aiStatus === 'reading' && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/[0.06] p-3 text-sm text-foreground/80">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                {t('money.ai.reading') || 'XefeBot is reading your file\u2026'}
              </div>
            )}
            {!editingExpense && aiStatus === 'done' && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/[0.06] p-3 text-sm text-foreground/80">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                {t('money.ai.filled') || 'XefeBot filled in the details from your file \u2014 check them before saving.'}
              </div>
            )}
            {!editingExpense && aiStatus === 'failed' && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                {t('money.ai.failed') || "XefeBot couldn't read this file \u2014 fill in the details manually."}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">{t('common.date') || 'Date'} *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">{t('common.amount') || 'Amount'} *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('common.description') || 'Description'} *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('money.expenses.descriptionPlaceholder') || 'What was this expense for?'}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">{t('money.expenses.category') || 'Category'}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: ExpenseCategory) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {t(`money.expenses.categories.${cat.value}`) || cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">{t('money.expenses.paymentMethod') || 'Payment Method'}</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value: PaymentMethod) =>
                    setFormData({ ...formData, paymentMethod: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {t(`money.payments.${method.value}`) || method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor">{t('money.expenses.vendor') || 'Vendor (optional)'}</Label>
              <Select
                value={formData.vendorId || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, vendorId: value === 'none' ? '' : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('money.expenses.selectVendor') || 'Select vendor'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.none') || 'None'}</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editingExpense && aiVendorName && !formData.vendorId && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 p-2 pl-3">
                  <p className="text-xs text-muted-foreground">
                    {(t('money.ai.vendorOnFile') || 'On the document: {{name}} \u2014 not in your vendor list yet.').replace(
                      '{{name}}',
                      aiVendorName,
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving || addingVendor}
                    onClick={() => void handleAddExtractedVendor()}
                  >
                    {addingVendor && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {(t('money.ai.addVendor') || 'Add "{{name}}"').replace('{{name}}', aiVendorName)}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('common.notes') || 'Notes'}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('money.expenses.notesPlaceholder') || 'Additional notes'}
                rows={2}
              />
            </div>

            {/* Receipt Upload */}
            <div className="space-y-2">
              <Label>{t('money.expenses.receipt') || 'Receipt'}</Label>

              {/* Show preview if we have one */}
              {(receiptPreview || existingReceiptUrl) && (
                <div className="relative w-full max-w-xs border rounded-lg overflow-hidden bg-muted">
                  {receiptPreview ? (
                    <img
                      src={receiptPreview}
                      alt="Receipt preview"
                      className="w-full h-32 object-contain"
                    />
                  ) : existingReceiptUrl && existingReceiptUrl.includes('.pdf') ? (
                    <div className="w-full h-32 flex items-center justify-center">
                      <FileText className="h-12 w-12 text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">{t('money.expenses.pdfReceipt') || 'PDF Receipt'}</span>
                    </div>
                  ) : existingReceiptUrl ? (
                    <img
                      src={existingReceiptUrl}
                      alt="Existing receipt"
                      className="w-full h-32 object-contain"
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={clearReceipt}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  {existingReceiptUrl && (
                    <a
                      href={existingReceiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-2 right-2"
                    >
                      <Button type="button" variant="secondary" size="sm">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        {t('common.view') || 'View'}
                      </Button>
                    </a>
                  )}
                </div>
              )}

              {/* Upload buttons - shown when no preview */}
              {!receiptPreview && !existingReceiptUrl && (
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Camera button - mobile friendly */}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={handleReceiptSelect}
                    />
                    <div className="flex items-center justify-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors">
                      <Camera className="h-4 w-4" />
                      <span className="text-sm">{t('money.expenses.takePhoto') || 'Take Photo'}</span>
                    </div>
                  </label>

                  {/* File upload button */}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="sr-only"
                      onChange={handleReceiptSelect}
                    />
                    <div className="flex items-center justify-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">{t('money.expenses.uploadFile') || 'Upload File'}</span>
                    </div>
                  </label>
                </div>
              )}

              {receiptFile && (
                <p className="text-xs text-muted-foreground">
                  {receiptFile.name} ({(receiptFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={uploadingReceipt}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleSubmit} disabled={uploadingReceipt || saving}>
              {uploadingReceipt || saving ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  {uploadingReceipt ? (t('money.expenses.uploading') || 'Uploading...') : (t('common.saving') || 'Saving...')}
                </>
              ) : editingExpense ? (
                t('common.save') || 'Save'
              ) : (
                t('money.expenses.add') || 'Add Expense'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
