/**
 * Ekipa — Payslips Tab
 * Month list with gross/net, tap for detail
 */
import { useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { useTenantStore } from '../../stores/tenantStore';
import { usePayslipStore } from '../../stores/payslipStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { PayslipRow } from '../../components/PayslipRow';
import { EmptyState } from '../../components/EmptyState';
import type { Payslip } from '../../types/payslip';

export default function PayslipsScreen() {
  const t = useT();
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const payslips = usePayslipStore((s) => s.payslips);
  const loading = usePayslipStore((s) => s.loading);
  const fetchPayslips = usePayslipStore((s) => s.fetchPayslips);
  const selectPayslip = usePayslipStore((s) => s.selectPayslip);

  useEffect(() => {
    if (tenantId && employeeId) {
      fetchPayslips(tenantId, employeeId);
    }
  }, [tenantId, employeeId, fetchPayslips]);

  const handlePress = useCallback((payslip: Payslip) => {
    selectPayslip(payslip);
    router.push('/screens/PayslipDetail');
  }, [selectPayslip]);

  if (loading && payslips.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={payslips}
      keyExtractor={(item) => item.period}
      renderItem={({ item }) => (
        <PayslipRow payslip={item} onPress={() => handlePress(item)} />
      )}
      contentContainerStyle={payslips.length === 0 ? styles.emptyContainer : styles.list}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        payslips.length > 0 ? (
          <View style={styles.listHeader}>
            <FileText size={14} color={colors.primary} strokeWidth={2} />
            <Text style={styles.listHeaderText}>
              {payslips.length} {payslips.length === 1 ? 'payslip' : 'payslips'}
            </Text>
          </View>
        ) : null
      }
      ListEmptyComponent={<EmptyState title={t('payslips.empty')} />}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
  },
  separator: {
    height: 10,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  listHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
