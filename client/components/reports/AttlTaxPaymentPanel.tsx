/**
 * The payment half of an ATTL business-tax obligation.
 *
 * Filing and paying are separate acts in Timor-Leste and only one of them was
 * ever recorded here: the e-Tax declaration. ATTL then issues an
 * "Aviso de Avaliação" per tax account per period, which names the collection
 * account, the amount and any penalties, and the money moves by bank transfer
 * (BNU corporate transfers need a second signature, so the order below is a
 * signed instruction, not a file upload — docs/BANK_PAYMENTS.md).
 *
 * This panel does three things and no more: names the destination account and
 * the credit description ATTL reconciles by, generates the signed payment
 * order, and records the remittance so it posts to the ledger exactly once.
 * Penalties and interest are ENTERED from the notice — the assessment is the
 * only authority for what is owed, and Reg. 2000/18 Sec. 71.4 lets the
 * Commissioner forgive some or all of it. What the panel does do, when the due
 * date has passed, is show what Secs. 72.1/73.1 would come to, so the figure
 * on the notice can be checked rather than just retyped.
 */

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/contexts/TenantContext";
import { useCompanyPaymentProfile } from "@/hooks/useCompanyPaymentProfile";
import { useRecordTaxFilingPayment } from "@/hooks/useTaxFiling";
import {
  ATTL_TAX_ACCOUNTS,
  ATTL_TAX_ACCOUNT_DETAILS,
  attlBeneficiaryAccountLine,
  formatAttlCreditDescription,
  type ATTLTaxAccountKey,
} from "@/lib/tlBanking";
import { getTodayTL } from "@/lib/dateUtils";
import { estimateATTLLateCharges } from "@/lib/tax/attl-late-charges";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import type { TaxFiling } from "@/types/tax-filing";
import { Banknote, CheckCircle2, Download, Loader2 } from "lucide-react";

export interface AttlTaxPaymentPanelProps {
  filing: TaxFiling;
  /** Which ATTL collection account this obligation is paid into. */
  accountKey: ATTLTaxAccountKey;
  /** Short tax label for the bank credit description, e.g. "AITI". */
  taxLabel: string;
  /** Portuguese purpose clause for the payment order. */
  purposePt: string;
  amount: number;
}

export function AttlTaxPaymentPanel({
  filing,
  accountKey,
  taxLabel,
  purposePt,
  amount,
}: AttlTaxPaymentPanelProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const tenantId = useTenantId();
  const profile = useCompanyPaymentProfile();
  const recordPayment = useRecordTaxFilingPayment();

  const [paymentDate, setPaymentDate] = useState(getTodayTL());
  const [reference, setReference] = useState("");
  const [assessmentNumber, setAssessmentNumber] = useState("");
  const [penalty, setPenalty] = useState("");
  const [interest, setInterest] = useState("");

  const account = ATTL_TAX_ACCOUNT_DETAILS[accountKey];
  const periodRef = `${filing.period.slice(5, 7)}/${filing.period.slice(0, 4)}`;
  const creditDescription = formatAttlCreditDescription({
    tin: profile.tin,
    shortName: profile.shortName,
    taxLabel,
    periodRef,
  });
  const isPaid = !!filing.paymentRecordedDate;

  // Only worth showing once the deadline has actually passed. `formWasLate`
  // compares the recorded filing date against the same due date, so a return
  // filed on time whose payment slipped is not charged the Sec. 72.1 $100.
  const dueDate = filing.paymentDueDate || filing.dueDate;
  const lateCharges = useMemo(() => {
    if (!dueDate) return null;
    const estimate = estimateATTLLateCharges({
      taxUnpaid: amount,
      dueDate,
      asOf: paymentDate || getTodayTL(),
      formWasLate: !!filing.filedDate && filing.filedDate > dueDate,
    });
    return estimate.isLate && estimate.total > 0 ? estimate : null;
  }, [amount, dueDate, paymentDate, filing.filedDate]);

  /**
   * Empty means "none assessed". Anything else must parse — silently dropping a
   * money figure the user typed is how a penalty ends up unrecorded with the
   * screen showing success.
   */
  const parseOptionalAmount = (raw: string): number | undefined | "invalid" => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return "invalid";
    return parsed;
  };

  const handleDownloadOrder = async () => {
    try {
      const [
        { generateSinglePaymentOrderXlsx },
        { downloadBlob },
      ] = await Promise.all([
        import("@/lib/bank-transfers/payment-pack"),
        import("@/lib/downloadBlob"),
      ]);
      const pack = await generateSinglePaymentOrderXlsx({
        company: {
          name: profile.companyName || "________",
          accountNumber: profile.debitAccount || "____________",
        },
        bankDisplayName: ATTL_TAX_ACCOUNTS.bank,
        purpose: purposePt,
        beneficiaryName: ATTL_TAX_ACCOUNTS.beneficiary,
        beneficiaryAccount: attlBeneficiaryAccountLine(accountKey),
        reference: creditDescription,
        amount,
        valueDate: paymentDate || getTodayTL(),
        fileBaseName: `${taxLabel}_Pagamento_${filing.period}`,
        extraNote:
          'Nota: marcar o aviso de pagamento como "electronic payment" (requisito da ATTL).',
      });
      downloadBlob(pack.blob, pack.fileName);
      toast({
        title: t("paymentOrders.downloadedTitle"),
        description: t("paymentOrders.downloadedDescription"),
      });
    } catch (error) {
      console.error("Error generating ATTL payment order:", error);
      toast({
        title: t("common.error") || "Error",
        description: t("paymentOrders.failed"),
        variant: "destructive",
      });
    }
  };

  const handleRecord = async () => {
    if (!user) return;
    if (!reference.trim()) {
      toast({
        title: t("taxPayment.referenceRequired") ||
          "Enter the bank reference from the transfer",
        variant: "destructive",
      });
      return;
    }
    const parsedPenalty = parseOptionalAmount(penalty);
    const parsedInterest = parseOptionalAmount(interest);
    if (parsedPenalty === "invalid" || parsedInterest === "invalid") {
      toast({
        title:
          t("taxPayment.amountInvalid") ||
          "Penalty and interest must be amounts of zero or more",
        variant: "destructive",
      });
      return;
    }
    try {
      await recordPayment.mutateAsync({
        filingId: filing.id,
        payment: {
          paymentDate,
          paymentReference: reference.trim(),
          paymentMethod: "bank_transfer",
          paidBy: user.uid,
          submissionMethod: "etax",
          assessedPenalty: parsedPenalty,
          assessedInterest: parsedInterest,
          assessmentNumber: assessmentNumber.trim() || undefined,
          audit: {
            tenantId,
            userId: user.uid,
            userEmail: user.email || "",
            userName: user.displayName || undefined,
          },
        },
      });
      toast({
        title: t("taxPayment.recorded") || "Payment recorded",
        description:
          t("taxPayment.recordedDescription") ||
          "The remittance is posted to the ledger.",
      });
    } catch (error) {
      toast({
        title: t("common.error") || "Error",
        description:
          error instanceof Error ? error.message : "Could not record the payment",
        variant: "destructive",
      });
    }
  };

  const detailRow = (label: string, value: string) => (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-medium text-right break-all">{value}</span>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-base">
              {t("taxPayment.title") || "Pay it at the bank"}
            </CardTitle>
            <CardDescription>
              {t("taxPayment.description") ||
                "Filing and paying are separate. Transfer the amount to the ATTL collection account below, then record it here so it reaches the ledger."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4">
          {detailRow(t("taxPayment.beneficiary") || "Beneficiary", ATTL_TAX_ACCOUNTS.beneficiary)}
          {detailRow(t("taxPayment.bank") || "Bank", ATTL_TAX_ACCOUNTS.bank)}
          {detailRow(t("taxPayment.account") || "Account", `A/C ${account.local}`)}
          {account.iban && detailRow(t("taxPayment.iban") || "IBAN", account.iban)}
          {detailRow(
            t("taxPayment.creditDescription") || "Transfer description",
            creditDescription,
          )}
          {detailRow(t("taxPayment.amount") || "Amount", formatCurrencyTL(amount))}
        </div>

        {lateCharges && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {t("taxPayment.lateTitle") || "This payment is past its due date"}
            </p>
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              {t("taxPayment.lateBody", {
                total: formatCurrencyTL(lateCharges.total),
                initial: formatCurrencyTL(lateCharges.initialAdditionalTax),
                monthly: formatCurrencyTL(lateCharges.monthlyAdditionalTax),
                stamps: String(lateCharges.monthlyStamps),
                basis: lateCharges.legalBasis,
              }) ||
                `Additional tax of about ${formatCurrencyTL(lateCharges.total)} may apply: 5% of the unpaid tax (${formatCurrencyTL(lateCharges.initialAdditionalTax)}) plus 1% for each of the ${lateCharges.monthlyStamps} monthly charge dates since the deadline (${formatCurrencyTL(lateCharges.monthlyAdditionalTax)}). ${lateCharges.legalBasis}.`}
            </p>
            {lateCharges.formAdditionalTax > 0 && (
              <p className="mt-1 text-amber-700 dark:text-amber-300">
                {t("taxPayment.lateFormCharge", {
                  amount: formatCurrencyTL(lateCharges.formAdditionalTax),
                }) ||
                  `Includes ${formatCurrencyTL(lateCharges.formAdditionalTax)} because the return itself was filed after its due date.`}
              </p>
            )}
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              {t("taxPayment.lateDisclaimer") ||
                "An estimate to check the notice against, not a figure Xefe files. The tax office assesses the amount and may reduce it, and it can charge more where it finds carelessness or avoidance. Enter what your notice says."}
            </p>
          </div>
        )}

        <Button type="button" variant="outline" onClick={() => void handleDownloadOrder()}>
          <Download className="mr-2 h-4 w-4" />
          {t("taxPayment.downloadOrder") || "Download signed payment order"}
        </Button>

        {isPaid ? (
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {t("taxPayment.alreadyRecorded") || "Payment recorded"}
            {filing.paymentReference ? ` — ${filing.paymentReference}` : ""}
          </p>
        ) : (
          <div className="space-y-3 border-t pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="attl-payment-date">
                  {t("taxPayment.dateLabel") || "Payment date"}
                </Label>
                <DatePicker
                  id="attl-payment-date"
                  value={paymentDate}
                  onChange={setPaymentDate}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="attl-payment-reference">
                  {t("taxPayment.referenceLabel") || "Bank reference *"}
                </Label>
                <Input
                  id="attl-payment-reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="attl-assessment-number">
                  {t("taxPayment.assessmentNumberLabel") || "Assessment no. (from the notice)"}
                </Label>
                <Input
                  id="attl-assessment-number"
                  value={assessmentNumber}
                  onChange={(e) => setAssessmentNumber(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="attl-penalty">
                    {t("taxPayment.penaltyLabel") || "Penalty"}
                  </Label>
                  <Input
                    id="attl-penalty"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={penalty}
                    onChange={(e) => setPenalty(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="attl-interest">
                    {t("taxPayment.interestLabel") || "Interest"}
                  </Label>
                  <Input
                    id="attl-interest"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("taxPayment.penaltyHelp") ||
                "Enter penalty and interest only as ATTL assessed them on the notice — Xefe never estimates them."}
            </p>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => void handleRecord()}
                disabled={!user || recordPayment.isPending}
              >
                {recordPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("taxPayment.record") || "Record this payment"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
