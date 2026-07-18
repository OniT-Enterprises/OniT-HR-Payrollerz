/**
 * Public hosted invoice page — /i/:token (no auth).
 *
 * Renders the sanitized snapshot from invoice_links/{token} so a customer
 * can view, download, and know how to pay. Deliberately minimal: status,
 * one download button, the invoice paper, a powered-by footer.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InvoicePaper } from '@/components/money/InvoicePaper';
import { formatInvoiceDate, formatInvoiceMoney } from '@/lib/invoiceTemplates';
import { getEffectiveInvoiceStatus } from '@/lib/invoiceStatus';
import type { Invoice, InvoiceSettings } from '@/types/money';
import { Download, FileText, Loader2 } from 'lucide-react';

interface PublicLinkData {
  invoice: Invoice;
  settings: Partial<InvoiceSettings>;
  pdfUrl?: string | null;
  viewedAt?: unknown;
}

export default function PublicInvoice() {
  const { token = '' } = useParams();
  const [link, setLink] = useState<PublicLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const viewStamped = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      try {
        const { doc, getDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const snap = await getDoc(doc(db, 'invoice_links', token));
        if (cancelled) return;
        if (!snap.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const data = snap.data() as PublicLinkData;
        setLink(data);
        setLoading(false);

        // Tell the sender their customer opened it (once, best-effort —
        // rules only allow stamping a null viewedAt with server time).
        if (!data.viewedAt && !viewStamped.current) {
          viewStamped.current = true;
          updateDoc(snap.ref, { viewedAt: serverTimestamp() }).catch(() => undefined);
        }
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    document.title = link
      ? `Invoice ${link.invoice.invoiceNumber} — ${link.settings.companyName || 'Xefe'}`
      : 'Invoice — Xefe';
  }, [link]);

  const handleDownload = async () => {
    if (!link) return;
    const displayInvoice = withEffectiveStatus(link.invoice);
    // The frozen as-sent PDF is the canonical document; once paid, render
    // fresh so the customer's copy carries the PAID stamp.
    if (link.pdfUrl && displayInvoice.status !== 'paid') {
      window.open(link.pdfUrl, '_blank', 'noopener');
      return;
    }
    try {
      setDownloading(true);
      const { downloadInvoicePDF } = await import('@/components/money/InvoicePDF');
      await downloadInvoicePDF(displayInvoice, link.settings);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      if (link.pdfUrl) window.open(link.pdfUrl, '_blank', 'noopener');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <PublicShell>
        <div className="space-y-2 rounded-xl border bg-card p-5 text-center">
          <Skeleton className="mx-auto h-4 w-40" />
          <Skeleton className="mx-auto h-8 w-32" />
          <Skeleton className="mx-auto h-4 w-48" />
        </div>

        <div className="my-4 flex justify-end">
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>

        <Skeleton className="h-[480px] w-full rounded-xl" />
      </PublicShell>
    );
  }

  if (notFound || !link) {
    return (
      <PublicShell>
        <div className="rounded-xl border bg-card p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Link fatura ida-ne'e la disponivel</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            This invoice link isn't available
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Karik link ne'e troka tiha ona ka hamoos tiha ona. Favór husu link foun ba negósiu
            ne'ebé haruka fatura ba Ita.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The link may have been reset or removed. Please ask the business that sent it for a new
            one.
          </p>
        </div>
      </PublicShell>
    );
  }

  const invoice = withEffectiveStatus(link.invoice);
  const companyName = link.settings.companyName || '';

  return (
    <PublicShell>
      <StatusBanner invoice={invoice} companyName={companyName} />

      <div className="my-4 flex justify-end">
        <Button onClick={handleDownload} disabled={downloading} variant="outline">
          {downloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download PDF
        </Button>
      </div>

      <InvoicePaper invoice={invoice} settings={link.settings} />
    </PublicShell>
  );
}

function withEffectiveStatus(invoice: Invoice): Invoice {
  const status = getEffectiveInvoiceStatus(invoice);
  return status === invoice.status ? invoice : { ...invoice, status };
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-6 sm:py-10">
        {children}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Powered by{' '}
          <a
            href="https://xefe.tl"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Xefe
          </a>{' '}
          — fatura simples ba negósiu sira iha Timor-Leste
        </p>
      </div>
    </div>
  );
}

function StatusBanner({ invoice, companyName }: { invoice: Invoice; companyName: string }) {
  const fromLine = `Fatura ${invoice.invoiceNumber}${companyName ? ` husi ${companyName}` : ''}`;

  if (invoice.status === 'cancelled') {
    return (
      <div className="rounded-xl border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">{fromLine}</p>
        <p className="mt-1 text-lg font-semibold text-muted-foreground">
          Fatura ida-ne'e kansela tiha ona
        </p>
        <p className="text-xs text-muted-foreground">This invoice was cancelled</p>
      </div>
    );
  }

  if (invoice.status === 'paid') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center dark:border-green-900 dark:bg-green-950">
        <p className="text-sm text-green-700 dark:text-green-300">{fromLine}</p>
        <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300">
          Selu tiha ona — Obrigadu!
        </p>
        <p className="mt-1 text-sm text-green-700/80 dark:text-green-300/80">
          Paid — thank you! {formatInvoiceMoney(invoice.total)} received in full.
        </p>
      </div>
    );
  }

  const overdue = invoice.status === 'overdue';
  const dueDate = formatInvoiceDate(invoice.dueDate);
  return (
    <div className="rounded-xl border bg-card p-5 text-center">
      <p className="text-sm text-muted-foreground">{fromLine}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">
        {formatInvoiceMoney(invoice.balanceDue ?? invoice.total)}
      </p>
      <p className={`mt-1 text-sm ${overdue ? 'font-medium text-red-600' : 'text-muted-foreground'}`}>
        {overdue ? 'Prazu liu tiha ona — favór selu lalais' : `Favór selu to'o ${dueDate}`}
      </p>
      <p className={`text-xs ${overdue ? 'text-red-600/80' : 'text-muted-foreground'}`}>
        {overdue ? 'was due' : 'due'} {dueDate}
        {invoice.status === 'partial'
          ? ` · ${formatInvoiceMoney(invoice.amountPaid || 0)} simu tiha ona (already received)`
          : ''}
      </p>
    </div>
  );
}
