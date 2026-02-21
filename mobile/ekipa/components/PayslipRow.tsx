/**
 * PayslipRow — single row in the payslip list
 * Dark card with blue (#3B82F6) left accent bar, border only (no shadows).
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors } from '../lib/colors';
import { useI18nStore, useT } from '../lib/i18n';
import { formatCurrency } from '../lib/currency';
import { useEmployeeStore } from '../stores/employeeStore';
import type { Payslip } from '../types/payslip';

interface PayslipRowProps {
  payslip: Payslip;
  onPress: () => void;
}

export function PayslipRow({ payslip, onPress }: PayslipRowProps) {
  const t = useT();
  const language = useI18nStore((s) => s.language);
  const currency = useEmployeeStore((s) => s.employee?.currency || 'USD');

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.row}>
      {/* Blue accent bar */}
      <View style={styles.accent} />

      <View style={styles.body}>
        <View style={styles.left}>
          <Text style={styles.period}>{payslip.periodLabel}</Text>
          <View style={styles.amounts}>
            <Text style={styles.grossLabel}>{t('payslips.gross')} </Text>
            <Text style={styles.grossValue}>{formatCurrency(payslip.grossPay, language, currency)}</Text>
          </View>
        </View>
        <View style={styles.right}>
          <Text style={styles.netValue}>{formatCurrency(payslip.netPay, language, currency)}</Text>
          <Text style={styles.netLabel}>{t('payslips.netPay')}</Text>
        </View>
        <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  accent: {
    width: 4,
    backgroundColor: colors.blue,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  left: {
    flex: 1,
  },
  period: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  amounts: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grossLabel: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  grossValue: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  right: {
    alignItems: 'flex-end',
    marginRight: 10,
  },
  netValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.blue,
    letterSpacing: -0.3,
  },
  netLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 1,
    fontWeight: '500',
  },
});
