/**
 * Ekipa — Payslips Tab
 * Premium dark theme with blue (#3B82F6) module accent.
 * Month list with gross/net, tap for detail.
 */
import { useEffect, useCallback, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native';
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
        <ActivityIndicator size="large" color={colors.blue} />
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
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />
      }
      ListHeaderComponent={
        payslips.length > 0 ? (
          <View style={styles.listHeader}>
            <View style={styles.iconBadge}>
              <FileText size={13} color={colors.blue} strokeWidth={2.5} />
            </View>
            <Text style={styles.listHeaderText}>
              {payslips.length} {payslips.length === 1 ? t('payslips.countOne') : t('payslips.count')}
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
    gap: 8,
    marginBottom: 14,
    marginTop: 4,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
