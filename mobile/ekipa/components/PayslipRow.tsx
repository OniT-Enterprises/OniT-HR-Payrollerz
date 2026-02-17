/**
 * PayslipRow — single row in the payslip list
 */
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors } from '../lib/colors';
import type { Payslip } from '../types/payslip';

interface PayslipRowProps {
  payslip: Payslip;
  onPress: () => void;
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function PayslipRow({ payslip, onPress }: PayslipRowProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.row}>
      {/* Teal accent bar */}
      <View style={styles.accent} />

      <View style={styles.body}>
        <View style={styles.left}>
          <Text style={styles.period}>{payslip.periodLabel}</Text>
          <View style={styles.amounts}>
            <Text style={styles.grossLabel}>Gross </Text>
            <Text style={styles.grossValue}>{formatMoney(payslip.grossPay)}</Text>
          </View>
        </View>
        <View style={styles.right}>
          <Text style={styles.netValue}>{formatMoney(payslip.netPay)}</Text>
          <Text style={styles.netLabel}>Net Pay</Text>
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
  accent: {
    width: 4,
    backgroundColor: colors.primary,
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
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
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
    color: colors.textSecondary,
    fontWeight: '500',
  },
  right: {
    alignItems: 'flex-end',
    marginRight: 10,
  },
  netValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  netLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 1,
    fontWeight: '500',
  },
});
