/**
 * Kaixa — Tax Filing Screen (Deklarasaun VAT)
 *
 * Three capabilities:
 * 1. Generate & share a VAT Return document (DGFI format)
 * 2. Export SAFT-TL XML for audit compliance
 * 3. Mock e-filing submission to DGFI
 *
 * Accessible from Home screen VAT card and Profile.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Share,
  Modal,
} from 'react-native';
import {
  FileText,
  FileCode,
  Send,
  ChevronLeft,
  ChevronRight,
  Check,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  Printer,
} from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { colors } from '../lib/colors';
import { useTenantStore } from '../stores/tenantStore';
import { useVATStore } from '../stores/vatStore';
import { useBusinessProfileStore } from '../stores/businessProfileStore';
import { generateVATReturn, type VATReturnData } from '../lib/vatReturn';
import { generateSAFT } from '../lib/saftExport';
import { generateAndShareVATReturnPDF, printVATReturn } from '../lib/vatReturnPdf';

// ============================================
// Types
// ============================================

type FilingFrequency = 'monthly' | 'quarterly';
type SubmissionStep = 'review' | 'confirm' | 'submitting' | 'success';

const TETUM_MONTHS = [
  'Janeiru', 'Fevereiru', 'Marsu', 'Abril',
  'Maiu', 'Juñu', 'Jullu', 'Agostu',
  'Setembru', 'Outubru', 'Novembru', 'Dezembru',
];

// ============================================
// Component
// ============================================

export default function TaxFilingScreen() {
  const { tenantId } = useTenantStore();
  const { isVATActive, effectiveRate, tenantSettings } = useVATStore();
  const bizProfile = useBusinessProfileStore((s) => s.profile);

  // Period selection
  const now = new Date();
  const diliDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Dili' });
  const [diliYear, diliMonth] = diliDate.split('-').map(Number);

  const [frequency, setFrequency] = useState<FilingFrequency>(
    tenantSettings.filingFrequency === 'quarterly' ? 'quarterly' : 'monthly'
  );
  const [selectedYear, setSelectedYear] = useState(diliYear);
  const [selectedMonth, setSelectedMonth] = useState(diliMonth);
  const [selectedQuarter, setSelectedQuarter] = useState(
    Math.ceil(diliMonth / 3)
  );

  // Data
  const [returnData, setReturnData] = useState<VATReturnData | null>(null);
  const [returnText, setReturnText] = useState('');
  const [loading, setLoading] = useState(false);

  // Submission flow
  const [submitModal, setSubmitModal] = useState(false);
  const [submitStep, setSubmitStep] = useState<SubmissionStep>('review');

  const vatActive = isVATActive();
  const vatRate = effectiveRate();

  // ── Load VAT Return data ──────────────────

  const loadReturn = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const period =
        frequency === 'monthly'
          ? { type: 'monthly' as const, year: selectedYear, month: selectedMonth }
          : { type: 'quarterly' as const, year: selectedYear, quarter: selectedQuarter };

      const result = await generateVATReturn(
        tenantId,
        {
          name: bizProfile.businessName || 'My Business',
          vatRegNumber: bizProfile.vatRegNumber || '',
          address: bizProfile.address || '',
          phone: bizProfile.phone || '',
        },
        period
      );
      setReturnData(result.data);
      setReturnText(result.text);
    } catch {
      Alert.alert('Error', 'Failed to load VAT return data');
    } finally {
      setLoading(false);
    }
  }, [tenantId, frequency, selectedYear, selectedMonth, selectedQuarter, bizProfile]);

  useEffect(() => {
    loadReturn();
  }, [loadReturn]);

  // ── Period navigation ─────────────────────

  const periodLabel = frequency === 'monthly'
    ? `${TETUM_MONTHS[selectedMonth - 1]} ${selectedYear}`
    : `Q${selectedQuarter} ${selectedYear}`;

  const navigatePeriod = (direction: -1 | 1) => {
    if (frequency === 'monthly') {
      let newMonth = selectedMonth + direction;
      let newYear = selectedYear;
      if (newMonth < 1) { newMonth = 12; newYear--; }
      if (newMonth > 12) { newMonth = 1; newYear++; }
      setSelectedMonth(newMonth);
      setSelectedYear(newYear);
    } else {
      let newQ = selectedQuarter + direction;
      let newYear = selectedYear;
      if (newQ < 1) { newQ = 4; newYear--; }
      if (newQ > 4) { newQ = 1; newYear++; }
      setSelectedQuarter(newQ);
      setSelectedYear(newYear);
    }
  };

  // ── Actions ───────────────────────────────

  const bizInfo = {
    name: bizProfile.businessName || 'My Business',
    vatRegNumber: bizProfile.vatRegNumber || '',
    address: bizProfile.address || '',
    phone: bizProfile.phone || '',
  };

  const shareVATReturnPDF = async () => {
    if (!returnData) {
      Alert.alert('Error', 'No data to share. Please wait for data to load.');
      return;
    }
    try {
      await generateAndShareVATReturnPDF(returnData, bizInfo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Error', `Failed to generate PDF: ${msg}`);
    }
  };

  const shareVATReturnText = async () => {
    if (!returnText) {
      Alert.alert('Error', 'No data to share. Please wait for data to load.');
      return;
    }
    try {
      await Share.share({ message: returnText });
    } catch {
      // User cancelled
    }
  };

  const handlePrint = async () => {
    if (!returnData) return;
    try {
      await printVATReturn(returnData, bizInfo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Error', `Failed to print: ${msg}`);
    }
  };

  const exportSAFT = async () => {
    if (!tenantId) return;

    Alert.alert(
      'Export SAFT-TL',
      `This will generate a SAFT XML export for fiscal year ${selectedYear}. Share via email or save.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            try {
              const xml = await generateSAFT(tenantId, bizInfo, selectedYear);

              // Save to a file for proper sharing (not clipboard text)
              const file = new File(Paths.cache, `SAFT-TL_${selectedYear}.xml`);
              file.write(xml);
              const fileUri = file.uri;

              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                  mimeType: 'application/xml',
                  dialogTitle: `SAFT-TL Export ${selectedYear}`,
                  UTI: 'public.xml',
                });
              } else {
                // Fallback to text share
                await Share.share({
                  message: xml,
                  title: `SAFT-TL_${selectedYear}.xml`,
                });
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unknown error';
              Alert.alert('Error', `Failed to generate SAFT export: ${msg}`);
            }
          },
        },
      ]
    );
  };

  const startSubmission = () => {
    if (!returnData || returnData.totalTransactions === 0) {
      Alert.alert(
        'Seidauk iha dadus',
        'No transaction data for this period. Record transactions first.'
      );
      return;
    }
    setSubmitStep('review');
    setSubmitModal(true);
  };

  const confirmSubmission = () => {
    setSubmitStep('submitting');

    // Simulate e-filing submission (3 seconds)
    setTimeout(() => {
      setSubmitStep('success');
    }, 3000);
  };

  // ── Render ────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* VAT Status Banner */}
      <View style={[styles.statusBanner, vatActive ? styles.statusActive : styles.statusInactive]}>
        <Shield
          size={16}
          color={vatActive ? colors.success : colors.textTertiary}
          strokeWidth={2}
        />
        <Text style={[styles.statusText, vatActive && { color: colors.success }]}>
          {vatActive
            ? `VAT Ativu — ${vatRate}%`
            : 'VAT seidauk ativu (demo mode)'}
        </Text>
      </View>

      {/* Frequency Toggle */}
      <View style={styles.freqRow}>
        <TouchableOpacity
          style={[styles.freqTab, frequency === 'monthly' && styles.freqTabActive]}
          onPress={() => setFrequency('monthly')}
        >
          <Text style={[styles.freqTabText, frequency === 'monthly' && styles.freqTabTextActive]}>
            Mensal
          </Text>
          <Text style={[styles.freqTabSub, frequency === 'monthly' && styles.freqTabSubActive]}>
            Monthly
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.freqTab, frequency === 'quarterly' && styles.freqTabActive]}
          onPress={() => setFrequency('quarterly')}
        >
          <Text style={[styles.freqTabText, frequency === 'quarterly' && styles.freqTabTextActive]}>
            Trimestral
          </Text>
          <Text style={[styles.freqTabSub, frequency === 'quarterly' && styles.freqTabSubActive]}>
            Quarterly
          </Text>
        </TouchableOpacity>
      </View>

      {/* Period Navigator */}
      <View style={styles.periodNav}>
        <TouchableOpacity
          onPress={() => navigatePeriod(-1)}
          style={styles.periodArrow}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.periodLabel}>{periodLabel}</Text>
        <TouchableOpacity
          onPress={() => navigatePeriod(1)}
          style={styles.periodArrow}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronRight size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading data...</Text>
        </View>
      ) : returnData ? (
        <>
          {/* Output VAT Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>BOX 1 — OUTPUT VAT</Text>
            <Text style={styles.cardSubtitle}>VAT iha Vendas</Text>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Taxable Sales (net)</Text>
              <Text style={styles.cardValue}>${returnData.totalTaxableSales.toFixed(2)}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Standard Rate VAT</Text>
              <Text style={[styles.cardValue, { color: colors.moneyOut }]}>
                ${returnData.totalOutputVAT.toFixed(2)}
              </Text>
            </View>
            {returnData.zeroRatedSales > 0 && (
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Zero-rated</Text>
                <Text style={styles.cardValue}>${returnData.zeroRatedSales.toFixed(2)}</Text>
              </View>
            )}
            {returnData.exemptSales > 0 && (
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Exempt</Text>
                <Text style={styles.cardValue}>${returnData.exemptSales.toFixed(2)}</Text>
              </View>
            )}
          </View>

          {/* Input VAT Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>BOX 2 — INPUT VAT</Text>
            <Text style={styles.cardSubtitle}>VAT iha Kompras</Text>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Taxable Purchases (net)</Text>
              <Text style={styles.cardValue}>${returnData.totalTaxablePurchases.toFixed(2)}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>VAT on Purchases</Text>
              <Text style={[styles.cardValue, { color: colors.moneyIn }]}>
                ${returnData.totalInputVAT.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Net VAT Card */}
          <View style={[styles.card, styles.netCard]}>
            <Text style={styles.cardTitle}>BOX 3 — NET VAT</Text>
            <Text style={styles.cardSubtitle}>VAT atu Selu</Text>
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>
                {returnData.netVATPayable >= 0 ? 'VAT Payable' : 'VAT Refundable'}
              </Text>
              <Text style={[
                styles.netAmount,
                { color: returnData.netVATPayable >= 0 ? colors.moneyOut : colors.moneyIn },
              ]}>
                ${Math.abs(returnData.netVATPayable).toFixed(2)}
              </Text>
            </View>
            <Text style={styles.netHint}>
              {returnData.totalTransactions} transasaun | Deadline: {returnData.filingDeadline}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {/* Generate VAT Return PDF */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={shareVATReturnPDF}
              activeOpacity={0.85}
            >
              <FileText size={20} color={colors.white} strokeWidth={2} />
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionBtnLabel}>Deklarasaun VAT (PDF)</Text>
                <Text style={styles.actionBtnSub}>Generate & share DGFI form</Text>
              </View>
            </TouchableOpacity>

            {/* Print / Share as text */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtnSmall, { backgroundColor: 'rgba(224, 141, 107, 0.08)', borderColor: 'rgba(224, 141, 107, 0.2)' }]}
                onPress={handlePrint}
                activeOpacity={0.85}
              >
                <Printer size={16} color={colors.primary} strokeWidth={2} />
                <Text style={[styles.actionBtnSmallLabel, { color: colors.primary }]}>Print</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtnSmall, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                onPress={shareVATReturnText}
                activeOpacity={0.85}
              >
                <FileText size={16} color={colors.textSecondary} strokeWidth={2} />
                <Text style={[styles.actionBtnSmallLabel, { color: colors.textSecondary }]}>Share Text</Text>
              </TouchableOpacity>
            </View>

            {/* Export SAFT */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={exportSAFT}
              activeOpacity={0.85}
            >
              <FileCode size={20} color={colors.info} strokeWidth={2} />
              <View style={styles.actionTextWrap}>
                <Text style={[styles.actionBtnLabel, { color: colors.info }]}>
                  SAFT-TL Export
                </Text>
                <Text style={styles.actionBtnSub}>XML audit file for {selectedYear}</Text>
              </View>
            </TouchableOpacity>

            {/* Submit to DGFI */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSubmit]}
              onPress={startSubmission}
              activeOpacity={0.85}
            >
              <Send size={20} color={colors.success} strokeWidth={2} />
              <View style={styles.actionTextWrap}>
                <Text style={[styles.actionBtnLabel, { color: colors.success }]}>
                  Submete ba DGFI
                </Text>
                <Text style={styles.actionBtnSub}>Submit electronically (demo)</Text>
              </View>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>No data available</Text>
        </View>
      )}

      {/* e-Filing Submission Modal */}
      <Modal
        visible={submitModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (submitStep !== 'submitting') setSubmitModal(false);
        }}
      >
        <View style={styles.submitContainer}>
          {submitStep === 'review' && (
            <>
              <View style={styles.submitHeader}>
                <Shield size={40} color={colors.primary} strokeWidth={1.5} />
                <Text style={styles.submitTitle}>Submete Deklarasaun VAT</Text>
                <Text style={styles.submitSubtitle}>
                  Submit VAT Return to DGFI
                </Text>
              </View>

              <View style={styles.submitBody}>
                <View style={styles.submitInfoRow}>
                  <Text style={styles.submitInfoLabel}>Period</Text>
                  <Text style={styles.submitInfoValue}>{periodLabel}</Text>
                </View>
                <View style={styles.submitInfoRow}>
                  <Text style={styles.submitInfoLabel}>Business</Text>
                  <Text style={styles.submitInfoValue}>
                    {bizProfile.businessName || 'Not set'}
                  </Text>
                </View>
                <View style={styles.submitInfoRow}>
                  <Text style={styles.submitInfoLabel}>VAT Reg. No.</Text>
                  <Text style={styles.submitInfoValue}>
                    {bizProfile.vatRegNumber || 'Not registered'}
                  </Text>
                </View>
                <View style={styles.submitInfoRow}>
                  <Text style={styles.submitInfoLabel}>Net VAT</Text>
                  <Text style={[styles.submitInfoValue, { fontWeight: '800' }]}>
                    ${returnData ? Math.abs(returnData.netVATPayable).toFixed(2) : '0.00'}
                    {returnData && returnData.netVATPayable < 0 ? ' (refund)' : ' payable'}
                  </Text>
                </View>
                <View style={styles.submitInfoRow}>
                  <Text style={styles.submitInfoLabel}>Transactions</Text>
                  <Text style={styles.submitInfoValue}>
                    {returnData?.totalTransactions || 0}
                  </Text>
                </View>

                <View style={styles.submitWarning}>
                  <AlertTriangle size={14} color={colors.warning} strokeWidth={2} />
                  <Text style={styles.submitWarningText}>
                    This is a demo. In production, this would submit directly to
                    the DGFI e-filing portal via secure API.
                  </Text>
                </View>
              </View>

              <View style={styles.submitActions}>
                <TouchableOpacity
                  style={styles.submitCancel}
                  onPress={() => setSubmitModal(false)}
                >
                  <Text style={styles.submitCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitConfirm}
                  onPress={confirmSubmission}
                  activeOpacity={0.85}
                >
                  <Send size={16} color={colors.white} strokeWidth={2} />
                  <Text style={styles.submitConfirmText}>Submete</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {submitStep === 'submitting' && (
            <View style={styles.submitProgress}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.submitProgressTitle}>Submitting...</Text>
              <Text style={styles.submitProgressSub}>
                Connecting to DGFI e-Filing Portal
              </Text>

              <View style={styles.progressSteps}>
                <ProgressStep label="Validating data" done />
                <ProgressStep label="Encrypting submission" done />
                <ProgressStep label="Connecting to DGFI" active />
                <ProgressStep label="Awaiting confirmation" />
              </View>
            </View>
          )}

          {submitStep === 'success' && (
            <View style={styles.submitSuccess}>
              <View style={styles.successIcon}>
                <CheckCircle size={56} color={colors.success} strokeWidth={1.5} />
              </View>
              <Text style={styles.successTitle}>Submisaun Susesu!</Text>
              <Text style={styles.successSubtitle}>
                Submission Successful
              </Text>

              <View style={styles.successDetails}>
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Reference No.</Text>
                  <Text style={styles.successValue}>
                    DGFI-{selectedYear}-{String(Math.floor(Math.random() * 900000) + 100000)}
                  </Text>
                </View>
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Filed On</Text>
                  <Text style={styles.successValue}>
                    {new Date().toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'Asia/Dili',
                    })}
                  </Text>
                </View>
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Period</Text>
                  <Text style={styles.successValue}>{periodLabel}</Text>
                </View>
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Amount</Text>
                  <Text style={styles.successValue}>
                    ${returnData ? Math.abs(returnData.netVATPayable).toFixed(2) : '0.00'}
                  </Text>
                </View>
              </View>

              <View style={styles.successNote}>
                <Clock size={14} color={colors.textTertiary} strokeWidth={2} />
                <Text style={styles.successNoteText}>
                  Keep this reference number for your records. Payment is due
                  within 15 days of filing.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.successBtn}
                onPress={() => {
                  setSubmitModal(false);
                  setSubmitStep('review');
                }}
                activeOpacity={0.85}
              >
                <Check size={18} color={colors.white} strokeWidth={2.5} />
                <Text style={styles.successBtnText}>Remata</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Progress Step Component ─────────────────

function ProgressStep({
  label,
  done,
  active,
}: {
  label: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <View style={styles.progressStep}>
      <View
        style={[
          styles.progressDot,
          done && styles.progressDotDone,
          active && styles.progressDotActive,
        ]}
      >
        {done && <Check size={10} color={colors.white} strokeWidth={3} />}
      </View>
      <Text
        style={[
          styles.progressLabel,
          done && styles.progressLabelDone,
          active && styles.progressLabelActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },

  // Status Banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  statusInactive: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
  },

  // Frequency Toggle
  freqRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  freqTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  freqTabActive: {
    backgroundColor: colors.primaryGlow,
    borderColor: colors.primary,
  },
  freqTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  freqTabTextActive: {
    color: colors.primary,
  },
  freqTabSub: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 1,
  },
  freqTabSubActive: {
    color: colors.primaryMuted,
  },

  // Period Navigator
  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  periodArrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    minWidth: 160,
    textAlign: 'center',
  },

  // Loading
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textTertiary,
  },

  // Summary Cards
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 1,
  },
  cardSubtitle: {
    fontSize: 11,
    color: colors.textTertiary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  cardLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  netCard: {
    borderColor: colors.primaryMuted,
    backgroundColor: 'rgba(224, 141, 107, 0.04)',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  netLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  netAmount: {
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  netHint: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 4,
  },

  // Action Buttons
  actions: {
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  actionBtnSecondary: {
    backgroundColor: 'rgba(96, 165, 250, 0.06)',
    borderColor: 'rgba(96, 165, 250, 0.2)',
  },
  actionBtnSubmit: {
    backgroundColor: 'rgba(74, 222, 128, 0.06)',
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  actionTextWrap: {
    flex: 1,
  },
  actionBtnLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  actionBtnSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtnSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnSmallLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Submit Modal
  submitContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  submitHeader: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  submitTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
  },
  submitSubtitle: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  submitBody: {
    paddingHorizontal: 20,
    gap: 2,
  },
  submitInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  submitInfoLabel: {
    fontSize: 14,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  submitInfoValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  submitWarning: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(250, 204, 21, 0.06)',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.15)',
  },
  submitWarningText: {
    flex: 1,
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 18,
  },
  submitActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  submitCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  submitCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  submitConfirm: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.success,
  },
  submitConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textInverse,
  },

  // Submitting Progress
  submitProgress: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  submitProgressTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
  },
  submitProgressSub: {
    fontSize: 13,
    color: colors.textTertiary,
    marginBottom: 32,
  },
  progressSteps: {
    gap: 16,
    alignSelf: 'stretch',
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  progressLabel: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  progressLabelDone: {
    color: colors.textSecondary,
  },
  progressLabelActive: {
    color: colors.text,
    fontWeight: '600',
  },

  // Success
  submitSuccess: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.success,
  },
  successSubtitle: {
    fontSize: 14,
    color: colors.textTertiary,
    marginBottom: 24,
  },
  successDetails: {
    alignSelf: 'stretch',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  successLabel: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  successValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  successNote: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  successNoteText: {
    flex: 1,
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 18,
  },
  successBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.success,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 24,
  },
  successBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textInverse,
  },
});
