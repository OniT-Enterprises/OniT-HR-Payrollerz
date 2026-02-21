/**
 * Ekipa — Payslip Detail Screen
 * Premium dark theme with blue (#3B82F6) module accent.
 * Full earnings + deductions breakdown with PDF share.
 */
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Share2, TrendingUp, TrendingDown } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { usePayslipStore } from '../../stores/payslipStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { useI18nStore, useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { formatCurrency } from '../../lib/currency';
import { Card } from '../../components/Card';
import { PayslipFunnel } from '../../components/PayslipFunnel';

export default function PayslipDetail() {
  const t = useT();
  const language = useI18nStore((s) => s.language);
  const currency = useEmployeeStore((s) => s.employee?.currency || 'USD');
  const insets = useSafeAreaInsets();
  const payslip = usePayslipStore((s) => s.selectedPayslip);
  const clearSelection = usePayslipStore((s) => s.clearSelection);

  if (!payslip) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{t('payslips.title')}</Text>
          </View>
          <View style={styles.shareBtn} />
        </View>
      </View>
    );
  }

  const handleBack = () => {
    clearSelection();
    router.back();
  };

  const handleShare = async () => {
    try {
      const html = `
        <html>
        <head>
          <style>
            body { font-family: sans-serif; padding: 24px; color: #0F172A; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            h2 { font-size: 14px; color: #475569; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            td { padding: 8px 0; border-bottom: 1px solid #E2E8F0; }
            td:last-child { text-align: right; font-weight: 600; }
            .section { font-weight: 700; font-size: 13px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; padding: 12px 0 4px; }
            .total { font-weight: 800; font-size: 16px; border-top: 2px solid #0F172A; }
            .net { color: #22C55E; }
          </style>
        </head>
        <body>
          <h1>${payslip.employeeName || t('payslips.title')}</h1>
          <h2>${payslip.periodLabel}</h2>

          <div class="section">${t('payslips.earnings')}</div>
          <table>
            ${payslip.earnings.map((e) => `<tr><td>${e.label}</td><td>${formatCurrency(e.amount, language, currency)}</td></tr>`).join('')}
            <tr class="total"><td>${t('payslips.grossPay')}</td><td>${formatCurrency(payslip.grossPay, language, currency)}</td></tr>
          </table>

          <div class="section">${t('payslips.deductions')}</div>
          <table>
            ${payslip.deductions.map((d) => `<tr><td>${d.label}</td><td>-${formatCurrency(d.amount, language, currency)}</td></tr>`).join('')}
            <tr class="total"><td>${t('payslips.totalDeductions')}</td><td>-${formatCurrency(payslip.totalDeductions, language, currency)}</td></tr>
          </table>

          <table>
            <tr class="total net"><td>${t('payslips.netPay')}</td><td>${formatCurrency(payslip.netPay, language, currency)}</td></tr>
          </table>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${t('payslips.title')} ${payslip.periodLabel}`,
      });
    } catch {
      Alert.alert(t('common.error'), t('payslips.pdfError'));
    }
  };

  return (
    <View style={styles.container}>
      {/* Blue hero header with decorative circles */}
      <View style={styles.heroHeader}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.heroDecor3} />
        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{payslip.periodLabel}</Text>
          </View>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtnActive} activeOpacity={0.7}>
            <Share2 size={20} color={colors.blue} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <View style={styles.heroContent}>
          <Text style={styles.heroLabel}>{t('payslips.net')}</Text>
          <Text style={styles.heroAmount}>{formatCurrency(payslip.netPay, language, currency)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Gross / Deductions summary row — dark cards with colored left borders */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryBorderLeft, { backgroundColor: colors.emerald }]} />
            <View style={styles.summaryCardInner}>
              <TrendingUp size={16} color={colors.emerald} strokeWidth={2} />
              <Text style={styles.summaryCardLabel}>{t('payslips.gross')}</Text>
              <Text style={[styles.summaryCardValue, { color: colors.emerald }]}>
                {formatCurrency(payslip.grossPay, language, currency)}
              </Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryBorderLeft, { backgroundColor: colors.error }]} />
            <View style={styles.summaryCardInner}>
              <TrendingDown size={16} color={colors.error} strokeWidth={2} />
              <Text style={styles.summaryCardLabel}>{t('payslips.deductions')}</Text>
              <Text style={[styles.summaryCardValue, { color: colors.error }]}>
                -{formatCurrency(payslip.totalDeductions, language, currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Visual funnel breakdown */}
        <PayslipFunnel payslip={payslip} language={language} currency={currency} />

        {/* Earnings line items */}
        <Text style={styles.sectionTitle}>{t('payslips.earnings')}</Text>
        <Card>
          {payslip.earnings.map((e, i) => (
            <View
              key={i}
              style={[
                styles.lineRow,
                i === payslip.earnings.length - 1 && styles.lineRowLast,
              ]}
            >
              <Text style={styles.lineLabel}>{e.label}</Text>
              <Text style={styles.lineValue}>{formatCurrency(e.amount, language, currency)}</Text>
            </View>
          ))}
        </Card>

        {/* Deductions line items */}
        <Text style={styles.sectionTitle}>{t('payslips.deductions')}</Text>
        <Card>
          {payslip.deductions.map((d, i) => (
            <View
              key={i}
              style={[
                styles.lineRow,
                i === payslip.deductions.length - 1 && styles.lineRowLast,
              ]}
            >
              <Text style={styles.lineLabel}>{d.label}</Text>
              <Text style={[styles.lineValue, { color: colors.error }]}>
                -{formatCurrency(d.amount, language, currency)}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // ── Blue hero header ──────────────────────────────
  heroHeader: {
    backgroundColor: colors.blue,
    paddingBottom: 32,
    overflow: 'hidden',
  },
  heroDecor1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroDecor2: {
    position: 'absolute',
    bottom: -24,
    left: 16,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroDecor3: {
    position: 'absolute',
    top: 30,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.blue,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleWhite: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.3,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnActive: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroContent: {
    alignItems: 'center',
    paddingTop: 12,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1.5,
    marginTop: 4,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  // ── Summary row — dark cards with colored left borders ──
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -8,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryBorderLeft: {
    width: 3,
  },
  summaryCardInner: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  summaryCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryCardValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  // ── Sections ──────────────────────────────────────
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 20,
  },

  // ── Line items ────────────────────────────────────
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lineRowLast: {
    borderBottomWidth: 0,
  },
  lineLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  lineValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
});
