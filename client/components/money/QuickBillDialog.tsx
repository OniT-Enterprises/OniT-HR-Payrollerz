/**
 * Quick Bill Dialog
 * Fast-add a bill from dropped/picked files (vendor invoice PDFs or photos).
 * Files are staged, then uploaded to Storage and saved on the new bill.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useActiveVendors } from '@/hooks/useVendors';
import { useCreateBill } from '@/hooks/useBills';
import { fileUploadService } from '@/services/fileUploadService';
import BillAttachmentsInput from '@/components/money/BillAttachmentsInput';
import { getTodayTL, toDateStringTL } from '@/lib/dateUtils';
import type { ExpenseCategory } from '@/types/money';
import { Building2 } from 'lucide-react';

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
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

/** "electricity-invoice_march.pdf" -> "electricity invoice march" */
function fileNameToDescription(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function defaultDueDate(): string {
  return toDateStringTL(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
}

interface QuickBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Files dropped/picked before the dialog opened */
  initialFiles: File[];
}

export default function QuickBillDialog({ open, onOpenChange, initialFiles }: QuickBillDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { canManage } = useTenant();
  const tenantId = useTenantId();
  const {
    data: vendors = [],
    isLoading: vendorsLoading,
    isError: vendorsLoadError,
    refetch: retryVendors,
  } = useActiveVendors();
  const createBillMutation = useCreateBill();

  const [files, setFiles] = useState<File[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [amount, setAmount] = useState('');
  const [billDate, setBillDate] = useState(getTodayTL());
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [billNumber, setBillNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const submitInFlight = useRef(false);
  const vendorsUnavailable = vendorsLoadError && vendors.length === 0;

  // Seed state each time the dialog opens with a fresh batch of files
  useEffect(() => {
    if (open) {
      setFiles(initialFiles);
      setVendorId('');
      setAmount('');
      setBillDate(getTodayTL());
      setDueDate(defaultDueDate());
      setDescription(initialFiles[0] ? fileNameToDescription(initialFiles[0].name) : '');
      setCategory('other');
      setBillNumber('');
    }
  }, [open, initialFiles]);

  const reportInvalidFiles = (errors: string[]) => {
    toast({
      title: t('money.bills.invalidFiles') || 'Some files were skipped',
      description: errors.join('\n'),
      variant: 'destructive',
    });
  };

  const handleSave = async () => {
    if (!canManage() || submitInFlight.current) return;
    const parsedAmount = parseFloat(amount);
    if (!vendorId) {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.bills.vendorRequired') || 'Please select a vendor',
        variant: 'destructive',
      });
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.bills.amountRequired') || 'Enter a valid amount',
        variant: 'destructive',
      });
      return;
    }
    if (!description.trim()) {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.bills.descriptionRequired') || 'Description is required',
        variant: 'destructive',
      });
      return;
    }

    submitInFlight.current = true;
    setSaving(true);
    try {
      // Pre-generate the bill ID so attachment storage paths match the final document
      const billId = doc(collection(db, paths.bills(tenantId))).id;

      let attachmentUrls: string[] = [];
      if (files.length > 0) {
        try {
          attachmentUrls = await Promise.all(
            files.map((file, index) =>
              fileUploadService.uploadBillAttachment(file, tenantId, billId, index)
            )
          );
        } catch (uploadError) {
          console.error('Error uploading bill attachments:', uploadError);
          toast({
            title: t('common.error') || 'Error',
            description:
              t('money.bills.attachmentUploadError') ||
              'Failed to upload attachment. Bill was not created.',
            variant: 'destructive',
          });
          return;
        }
      }

      await createBillMutation.mutateAsync({
        data: {
          billNumber: billNumber.trim(),
          vendorId,
          billDate,
          dueDate,
          description: description.trim(),
          amount: parsedAmount,
          taxRate: 0,
          category,
          notes: '',
          attachmentUrls,
        },
        preGeneratedId: billId,
      });

      toast({
        title: t('common.success') || 'Success',
        description: t('money.bills.created') || 'Bill created',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating bill:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.bills.saveError') || 'Failed to save bill',
        variant: 'destructive',
      });
    } finally {
      submitInFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('money.bills.quickAddTitle') || 'Add Bill from File'}</DialogTitle>
          <DialogDescription>
            {t('money.bills.quickAddDescription') ||
              'Attach the bill and enter the basics — you can edit the details later.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <BillAttachmentsInput
            files={files}
            onFilesChange={setFiles}
            onInvalidFiles={reportInvalidFiles}
            disabled={saving}
          />

          <div className="space-y-2">
            <Label>{t('money.bills.vendor') || 'Vendor'} *</Label>
            {vendorsUnavailable ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                <p className="text-sm text-muted-foreground">
                  {t('common.connectionIssueDesc')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void retryVendors()}
                >
                  {t('common.retry')}
                </Button>
              </div>
            ) : vendorsLoading ? (
              <p className="rounded-md border p-3 text-sm text-muted-foreground">
                {t('common.loading')}
              </p>
            ) : vendors.length === 0 ? (
              <div className="flex items-center justify-between gap-2 p-3 border rounded-md">
                <p className="text-sm text-muted-foreground">
                  {t('money.bills.noVendors') || 'No vendors yet — add one first'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/money/vendors')}
                >
                  <Building2 className="h-4 w-4 mr-1.5" />
                  {t('money.bills.addVendor') || 'Add Vendor'}
                </Button>
              </div>
            ) : (
              <Select value={vendorId} onValueChange={setVendorId} disabled={saving}>
                <SelectTrigger>
                  <SelectValue placeholder={t('money.bills.selectVendor') || 'Select vendor'} />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('common.amount') || 'Amount'} *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('money.bills.dueDate') || 'Due Date'}</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('common.description') || 'Description'} *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('money.bills.descriptionPlaceholder') || 'What is this bill for?'}
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('money.bills.billDate') || 'Bill Date'}</Label>
              <Input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('money.bills.category') || 'Category'}</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ExpenseCategory)}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {t(`money.expenses.categories.${cat.value}`) || cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              {t('money.bills.billNumber') || 'Bill Number'}{' '}
              <span className="text-muted-foreground font-normal">
                ({t('common.optional') || 'optional'})
              </span>
            </Label>
            <Input
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              placeholder={t('money.bills.billNumberPlaceholder') || "Vendor's invoice number"}
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || vendorsLoading || vendorsUnavailable || vendors.length === 0}
          >
            {saving
              ? t('common.saving') || 'Saving...'
              : t('money.bills.saveBill') || 'Save Bill'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
