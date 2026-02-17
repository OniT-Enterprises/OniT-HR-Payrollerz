/**
 * Ekipa — Payslip Detail Screen
 * Full earnings + deductions breakdown with PDF share
 */
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Share2, TrendingUp, TrendingDown } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { usePayslipStore } from '../../stores/payslipStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { Card } from '../../components/Card';

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default function PayslipDetail() {
  const t = useT();
  const payslip = usePayslipStore((s) => s.selectedPayslip);
  const clearSelection = usePayslipStore((s) => s.clearSelection);

  if (!payslip) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
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
            .net { color: #0D9488; }
          </style>
        </head>
        <body>
          <h1>${payslip.employeeName || 'Payslip'}</h1>
          <h2>${payslip.periodLabel}</h2>

          <div class="section">Earnings</div>
          <table>
            ${payslip.earnings.map((e) => `<tr><td>${e.label}</td><td>${formatMoney(e.amount)}</td></tr>`).join('')}
            <tr class="total"><td>Gross Pay</td><td>${formatMoney(payslip.grossPay)}</td></tr>
          </table>

          <div class="section">Deductions</div>
          <table>
            ${payslip.deductions.map((d) => `<tr><td>${d.label}</td><td>-${formatMoney(d.amount)}</td></tr>`).join('')}
            <tr class="total"><td>Total Deductions</td><td>-${formatMoney(payslip.totalDeductions)}</td></tr>
          </table>

          <table>
            <tr class="total net"><td>Net Pay</td><td>${formatMoney(payslip.netPay)}</td></tr>
          </table>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Payslip ${payslip.periodLabel}`,
      });
    } catch {
      Alert.alert('Error', 'Could not generate PDF');
    }
  };

  return (
    <View style={styles.container}>
      {/* Teal header with net pay hero */}
      <View style={styles.heroHeader}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{payslip.periodLabel}</Text>
          </View>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn} activeOpacity={0.7}>
            <Share2 size={20} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <View style={styles.heroContent}>
          <Text style={styles.heroLabel}>{t('payslips.net')}</Text>
          <Text style={styles.heroAmount}>{formatMoney(payslip.netPay)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Gross / Deductions summary row */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.successBg }]}>
            <TrendingUp size={14} color={colors.success} strokeWidth={2} />
            <Text style={styles.summaryCardLabel}>{t('payslips.gross')}</Text>
            <Text style={[styles.summaryCardValue, { color: colors.success }]}>
              {formatMoney(payslip.grossPay)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.errorBg }]}>
            <TrendingDown size={14} color={colors.error} strokeWidth={2} />
            <Text style={styles.summaryCardLabel}>{t('payslips.deductions')}</Text>
            <Text style={[styles.summaryCardValue, { color: colors.error }]}>
              -{formatMoney(payslip.totalDeductions)}
            </Text>
          </View>
        </View>

        {/* Earnings */}
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
              <Text style={styles.lineValue}>{formatMoney(e.amount)}</Text>
            </View>
          ))}
        </Card>

        {/* Deductions */}
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
                -{formatMoney(d.amount)}
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

  // Teal hero header
  heroHeader: {
    backgroundColor: colors.primary,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  heroDecor1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroDecor2: {
    position: 'absolute',
    bottom: -20,
    left: 20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: colors.primary,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  heroContent: {
    alignItems: 'center',
    paddingTop: 8,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroAmount: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1,
    marginTop: 4,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  // Summary row
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -8,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  summaryCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryCardValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  // Sections
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
    marginTop: 16,
  },

  // Line items
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
