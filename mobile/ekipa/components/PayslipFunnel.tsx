/**
 * PayslipFunnel — Visual breakdown of earnings → deductions → net pay
 * Low-literacy-friendly "where my money went" graphic.
 */
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/colors';
import { useT } from '../lib/i18n';
import { formatCurrency } from '../lib/currency';
import type { Payslip } from '../types/payslip';

interface Props {
  payslip: Payslip;
  language: 'tet' | 'en' | 'pt' | 'id';
  currency: string;
}

export function PayslipFunnel({ payslip, language, currency }: Props) {
  const t = useT();
  const maxWidth = 100; // percentage base
  const grossPct = maxWidth;
  const netPct = payslip.grossPay > 0
    ? (payslip.netPay / payslip.grossPay) * maxWidth
    : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('payslips.visualBreakdown')}</Text>

      {/* Gross bar */}
      <View style={styles.barRow}>
        <View style={styles.barLabelWrap}>
          <Text style={styles.barLabel}>{t('payslips.gross')}</Text>
          <Text style={[styles.barAmount, { color: colors.emerald }]}>
            {formatCurrency(payslip.grossPay, language, currency)}
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${grossPct}%`, backgroundColor: colors.emerald }]} />
        </View>
      </View>

      {/* Deductions bars */}
      {payslip.deductions.map((d, i) => {
        const pct = payslip.grossPay > 0
          ? (d.amount / payslip.grossPay) * maxWidth
          : 0;
        return (
          <View key={i} style={styles.barRow}>
            <View style={styles.barLabelWrap}>
              <Text style={styles.barLabelSmall}>{d.label}</Text>
              <Text style={[styles.barAmountSmall, { color: colors.error }]}>
                -{formatCurrency(d.amount, language, currency)}
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.max(pct, 2)}%`, backgroundColor: colors.error }]} />
            </View>
          </View>
        );
      })}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Net bar */}
      <View style={styles.barRow}>
        <View style={styles.barLabelWrap}>
          <Text style={[styles.barLabel, { color: colors.primary }]}>{t('payslips.net')}</Text>
          <Text style={[styles.barAmount, { color: colors.primary }]}>
            {formatCurrency(payslip.netPay, language, currency)}
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${netPct}%`, backgroundColor: colors.primary }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  barRow: {
    marginBottom: 12,
  },
  barLabelWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  barLabelSmall: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  barAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  barAmountSmall: {
    fontSize: 13,
    fontWeight: '600',
  },
  barTrack: {
    height: 8,
    backgroundColor: 'rgba(55, 65, 81, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
});
