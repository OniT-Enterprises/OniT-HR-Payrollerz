/**
 * Ekipa — Payslips Tab
 * Xefe · Ekipa design language: one olive accent, editorial section labels.
 * Month list with gross/net, tap for detail.
 */
import { useEffect, useCallback, useState } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useTenantStore } from '../../stores/tenantStore';
import { usePayslipStore } from '../../stores/payslipStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { PayslipRow } from '../../components/PayslipRow';
import { EmptyState } from '../../components/EmptyState';
import { SectionLabel } from '../../components/ui';
import type { Payslip } from '../../types/payslip';

export default function PayslipsScreen() {
  const t = useT();
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const payslips = usePayslipStore((s) => s.payslips);
  const loading = usePayslipStore((s) => s.loading);
  const fetchPayslips = usePayslipStore((s) => s.fetchPayslips);
  const selectPayslip = usePayslipStore((s) => s.selectPayslip);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (tenantId && employeeId) {
      fetchPayslips(tenantId, employeeId);
    }
  }, [tenantId, employeeId, fetchPayslips]);

  const onRefresh = useCallback(async () => {
    if (!tenantId || !employeeId) return;
    setRefreshing(true);
    await fetchPayslips(tenantId, employeeId);
    setRefreshing(false);
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        payslips.length > 0 ? (
          <SectionLabel style={styles.listHeader}>
            {payslips.length} {payslips.length === 1 ? t('payslips.countOne') : t('payslips.count')}
          </SectionLabel>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  emptyContainer: {
    flex: 1,
  },
  separator: {
    height: 10,
  },
  listHeader: {
    marginTop: 4,
  },
});
