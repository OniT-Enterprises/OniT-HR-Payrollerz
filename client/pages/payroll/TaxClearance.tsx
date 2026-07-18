import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ClipboardCheck,
  FileText,
  Loader2,
  Plus,
  Upload,
  XCircle,
} from 'lucide-react';
import MainNavigation from '@/components/layout/MainNavigation';
import PageHeader from '@/components/layout/PageHeader';
import { SEO } from '@/components/SEO';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { formatDateTL, getTodayTL, parseDateISO } from '@/lib/dateUtils';
import {
  ATTL_ETAX_URL,
  ATTL_TAX_CLEARANCE_GUIDE_URL,
  getTaxClearanceDisplayStatus,
  needsTaxClearanceOneMonthCoordination,
  type TaxClearancePurpose,
  type TaxClearanceRequest,
} from '@/lib/tax/tax-clearance-tl';
import { fileUploadService } from '@/services/fileUploadService';
import { taxClearanceService } from '@/services/taxClearanceService';

type ResultOutcome = 'issued' | 'rejected';

export default function TaxClearance() {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const queryKey = ['tax-clearance', tenantId] as const;
  const { data: requests = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: () => taxClearanceService.getAll(tenantId),
    enabled: Boolean(tenantId),
  });

  const [requestOpen, setRequestOpen] = useState(false);
  const [purpose, setPurpose] = useState<TaxClearancePurpose>('commercial_3_months');
  const [requestedDate, setRequestedDate] = useState(getTodayTL());
  const [notes, setNotes] = useState('');
  const [resultRequest, setResultRequest] = useState<TaxClearanceRequest | null>(null);
  const [outcome, setOutcome] = useState<ResultOutcome>('issued');
  const [issuedDate, setIssuedDate] = useState(getTodayTL());
  const [expiryDate, setExpiryDate] = useState('');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);

  const purposeLabel = (value: TaxClearancePurpose) => ({
    commercial_3_months: t('taxClearance.purpose.commercial3') || 'All commercial activities — 3 months',
    commercial_1_month: t('taxClearance.purpose.commercial1') || 'All commercial activities — 1 month',
    visa_3_months: t('taxClearance.purpose.visa3') || 'Visa extension — 3 months',
    visa_1_month: t('taxClearance.purpose.visa1') || 'Visa extension — 1 month',
  }[value]);

  const statusBadge = (request: TaxClearanceRequest) => {
    const status = getTaxClearanceDisplayStatus(request, getTodayTL());
    const config = {
      requested: { label: t('taxClearance.status.requested') || 'Requested', icon: FileText, className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
      issued: { label: t('taxClearance.status.issued') || 'Issued', icon: CheckCircle, className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
      rejected: { label: t('taxClearance.status.rejected') || 'Rejected / failed', icon: XCircle, className: 'bg-red-500/10 text-red-700 dark:text-red-400' },
      expired: { label: t('taxClearance.status.expired') || 'Expired', icon: AlertTriangle, className: 'bg-muted text-muted-foreground' },
    }[status];
    const Icon = config.icon;
    return <Badge className={config.className}><Icon className="mr-1 h-3 w-3" />{config.label}</Badge>;
  };

  const createRequest = async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      await taxClearanceService.create(tenantId, { purpose, requestedDate, notes }, user.uid);
      await queryClient.invalidateQueries({ queryKey });
      setRequestOpen(false);
      setPurpose('commercial_3_months');
      setRequestedDate(getTodayTL());
      setNotes('');
      toast({ title: t('taxClearance.savedTitle') || 'Request tracked', description: t('taxClearance.savedDescription') || 'Submit it in ATTL e-Tax; Xefe does not submit it for you.' });
    } catch (caught) {
      toast({ title: t('taxClearance.errorTitle') || 'Could not save request', description: caught instanceof Error ? caught.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openResult = (request: TaxClearanceRequest) => {
    setResultRequest(request);
    setOutcome('issued');
    setIssuedDate(getTodayTL());
    setExpiryDate('');
    setCertificateNumber('');
    setCertificateFile(null);
    setRejectionReason('');
  };

  const saveResult = async () => {
    if (!resultRequest || !user?.uid) return;
    setSaving(true);
    try {
      if (outcome === 'rejected') {
        await taxClearanceService.markRejected(
          tenantId,
          resultRequest.id,
          rejectionReason,
          user.uid,
        );
      } else {
        if (!certificateFile) throw new Error('Select the ATTL certificate PDF.');
        const validation = fileUploadService.validateDocumentFile(
          certificateFile,
          ['application/pdf'],
          10,
        );
        if (!validation.valid) throw new Error(validation.error);
        const certificateUrl = await fileUploadService.uploadTaxClearanceCertificate(
          certificateFile,
          tenantId,
          resultRequest.id,
        );
        await taxClearanceService.markIssued(
          tenantId,
          resultRequest.id,
          { issuedDate, expiryDate, certificateNumber, certificateUrl },
          user.uid,
        );
      }
      await queryClient.invalidateQueries({ queryKey });
      setResultRequest(null);
      toast({ title: t('taxClearance.resultSaved') || 'Result saved' });
    } catch (caught) {
      toast({ title: t('taxClearance.errorTitle') || 'Could not save result', description: caught instanceof Error ? caught.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title={t('taxClearance.title') || 'Tax clearance'} description={t('taxClearance.subtitle') || 'Track ATTL tax-clearance certificate requests.'} />
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader title={t('taxClearance.title') || 'Tax clearance'} subtitle={t('taxClearance.subtitle') || 'Request in ATTL e-Tax, then track the official result and PDF here.'} icon={ClipboardCheck} iconColor="text-primary" />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('taxClearance.howTitle') || 'How the official request works'}</CardTitle>
            <CardDescription>{t('taxClearance.howDescription') || 'Xefe guides and records the process; it is not connected to ATTL and cannot submit the request.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-2 text-sm">
              <li><span className="font-medium">1.</span> {t('taxClearance.step1') || 'Open ATTL e-Tax and choose Certificate → Clearance Request.'}</li>
              <li><span className="font-medium">2.</span> {t('taxClearance.step2') || 'Choose Tax Clearance Certificate and the exact document type needed.'}</li>
              <li><span className="font-medium">3.</span> {t('taxClearance.step3') || 'Save the request in e-Tax, then track it in Xefe.'}</li>
              <li><span className="font-medium">4.</span> {t('taxClearance.step4') || 'When ATTL issues it, download the PDF and save its issued and expiry dates here.'}</li>
            </ol>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild><a href={ATTL_ETAX_URL} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />{t('taxClearance.openEtax') || 'Open ATTL e-Tax'}</a></Button>
              <Button variant="outline" asChild><a href={ATTL_TAX_CLEARANCE_GUIDE_URL} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />{t('taxClearance.officialGuide') || 'Official ATTL guide'}</a></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><CardTitle className="text-base">{t('taxClearance.requestsTitle') || 'Certificate requests'}</CardTitle><CardDescription>{t('taxClearance.requestsDescription') || 'Dates and PDFs are entered from ATTL evidence; Xefe does not guess validity.'}</CardDescription></div>
              <Button onClick={() => setRequestOpen(true)} className="min-h-11"><Plus className="mr-2 h-4 w-4" />{t('taxClearance.newRequest') || 'Track a request'}</Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('common.loading') || 'Loading...'}</div>
              : error ? <p className="py-4 text-sm text-destructive">{error instanceof Error ? error.message : (t('taxClearance.loadError') || 'Could not load tax-clearance requests.')}</p>
                : requests.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{t('taxClearance.empty') || 'No tax-clearance requests tracked yet.'}</p>
                  : <div className="space-y-3">{requests.map((request) => (
                    <div key={request.id} className="rounded-lg border border-border/70 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="font-medium">{purposeLabel(request.purpose)}</p>
                          <p className="text-xs text-muted-foreground">{t('taxClearance.requestedOn') || 'Requested'} {formatDateTL(parseDateISO(request.requestedDate))}</p>
                          {request.issuedDate && request.expiryDate && <p className="text-xs text-muted-foreground">{t('taxClearance.issuedOn') || 'Issued'} {formatDateTL(parseDateISO(request.issuedDate))} · {t('taxClearance.expiresOn') || 'Expires'} {formatDateTL(parseDateISO(request.expiryDate))}</p>}
                          {request.rejectionReason && <p className="text-xs text-destructive">{request.rejectionReason}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {statusBadge(request)}
                          {request.certificateUrl && <Button variant="ghost" size="sm" asChild><a href={request.certificateUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />PDF</a></Button>}
                          {request.status === 'requested' && <Button variant="outline" size="sm" onClick={() => openResult(request)}>{t('taxClearance.recordResult') || 'Record result'}</Button>}
                        </div>
                      </div>
                    </div>
                  ))}</div>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={requestOpen} onOpenChange={(next) => !saving && setRequestOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t('taxClearance.newRequest') || 'Track a request'}</DialogTitle><DialogDescription>{t('taxClearance.newDescription') || 'First submit this in ATTL e-Tax. This record is a tracker only.'}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>{t('taxClearance.documentType') || 'Official document type'}</Label><Select value={purpose} onValueChange={(value) => setPurpose(value as TaxClearancePurpose)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="commercial_3_months">{purposeLabel('commercial_3_months')}</SelectItem><SelectItem value="commercial_1_month">{purposeLabel('commercial_1_month')}</SelectItem><SelectItem value="visa_3_months">{purposeLabel('visa_3_months')}</SelectItem><SelectItem value="visa_1_month">{purposeLabel('visa_1_month')}</SelectItem></SelectContent></Select></div>
            {needsTaxClearanceOneMonthCoordination(purpose) && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">{t('taxClearance.oneMonthWarning') || 'ATTL says one-month certificates require coordination with an ATTL officer and reasonable justification.'}</p>}
            <div className="space-y-2"><Label htmlFor="clearance-request-date">{t('taxClearance.requestDate') || 'Date submitted in e-Tax'}</Label><Input id="clearance-request-date" type="date" value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="clearance-notes">{t('common.notes') || 'Notes'} ({t('common.optional') || 'optional'})</Label><Textarea id="clearance-notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRequestOpen(false)} disabled={saving}>{t('common.cancel') || 'Cancel'}</Button><Button onClick={createRequest} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('common.save') || 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resultRequest)} onOpenChange={(next) => !next && !saving && setResultRequest(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{t('taxClearance.recordResult') || 'Record ATTL result'}</DialogTitle><DialogDescription>{resultRequest ? purposeLabel(resultRequest.purpose) : ''}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>{t('taxClearance.outcome') || 'Outcome'}</Label><Select value={outcome} onValueChange={(value) => setOutcome(value as ResultOutcome)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="issued">{t('taxClearance.status.issued') || 'Issued'}</SelectItem><SelectItem value="rejected">{t('taxClearance.status.rejected') || 'Rejected / failed'}</SelectItem></SelectContent></Select></div>
            {outcome === 'issued' ? <>
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="clearance-issued">{t('taxClearance.issueDate') || 'Issue date'}</Label><Input id="clearance-issued" type="date" value={issuedDate} onChange={(event) => setIssuedDate(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="clearance-expiry">{t('taxClearance.expiryDate') || 'Expiry date'}</Label><Input id="clearance-expiry" type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /></div></div>
              <div className="space-y-2"><Label htmlFor="clearance-number">{t('taxClearance.certificateNumber') || 'Certificate number'} ({t('common.optional') || 'optional'})</Label><Input id="clearance-number" value={certificateNumber} onChange={(event) => setCertificateNumber(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="clearance-pdf">{t('taxClearance.certificatePdf') || 'ATTL certificate PDF'}</Label><Input id="clearance-pdf" type="file" accept="application/pdf" onChange={(event) => setCertificateFile(event.target.files?.[0] || null)} /></div>
            </> : <div className="space-y-2"><Label htmlFor="clearance-rejection">{t('taxClearance.rejectionReason') || 'Failure or rejection reason'}</Label><Textarea id="clearance-rejection" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} /></div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setResultRequest(null)} disabled={saving}>{t('common.cancel') || 'Cancel'}</Button><Button onClick={saveResult} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{t('common.save') || 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
