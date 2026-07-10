/**
 * Ekipa — Leave Tab
 * Xefe · Ekipa design language: one olive accent, editorial section labels.
 * Balance cards with progress bars, request history with status badges.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useTenantStore } from '../../stores/tenantStore';
import { useLeaveStore } from '../../stores/leaveStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { LeaveBalanceCard } from '../../components/LeaveBalanceCard';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/EmptyState';
import { SectionLabel } from '../../components/ui';


export default function LeaveScreen() {
  const t = useT();
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const balance = useLeaveStore((s) => s.balance);
  const requests = useLeaveStore((s) => s.requests);
  const loading = useLeaveStore((s) => s.loading);
  const fetchBalance = useLeaveStore((s) => s.fetchBalance);
  const fetchRequests = useLeaveStore((s) => s.fetchRequests);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (tenantId && employeeId) {
      fetchBalance(tenantId, employeeId);
      fetchRequests(tenantId, employeeId);
    }
  }, [tenantId, employeeId, fetchBalance, fetchRequests]);

  const onRefresh = useCallback(async () => {
    if (!tenantId || !employeeId) return;
    setRefreshing(true);
    await Promise.all([
      fetchBalance(tenantId, employeeId),
      fetchRequests(tenantId, employeeId),
    ]);
    setRefreshing(false);
  }, [tenantId, employeeId, fetchBalance, fetchRequests]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* ── Balance section ── */}
      <SectionLabel>{t('leave.balance')}</SectionLabel>

      {balance ? (
        <View style={styles.balanceGrid}>
          <LeaveBalanceCard
            label={t('leave.annual')}
            balance={balance.annual}
            color={colors.primary}
          />
          <LeaveBalanceCard
            label={t('leave.sick')}
            balance={balance.sick}
            color={colors.primary}
          />
          {balance.maternity && (
            <LeaveBalanceCard
              label={t('leave.maternity')}
              balance={balance.maternity}
              color={colors.primary}
            />
          )}
          {balance.paternity && (
            <LeaveBalanceCard
              label={t('leave.paternity')}
              balance={balance.paternity}
              color={colors.primary}
            />
          )}
        </View>
      ) : (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {/* ── Request button ── */}
      <TouchableOpacity
        style={styles.requestBtn}
        onPress={() => router.push('/screens/LeaveRequestForm')}
        activeOpacity={0.85}
      >
        <Plus size={18} color={colors.white} strokeWidth={2.5} />
        <Text style={styles.requestBtnText}>{t('leave.request')}</Text>
      </TouchableOpacity>

      {/* ── History section ── */}
      <SectionLabel>{t('leave.history')}</SectionLabel>

      {loading && requests.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : requests.length === 0 ? (
        <EmptyState title={t('leave.empty')} />
      ) : (
        <View style={styles.requestsList}>
          {requests.map((req) => (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.requestLeft}>
                <Text style={styles.requestType}>{req.leaveTypeLabel}</Text>
                <Text style={styles.requestDates}>
                  {req.startDate} — {req.endDate}
                </Text>
                <Text style={styles.requestDuration}>
                  {req.duration} {t('leave.days')}
                </Text>
              </View>
              <StatusBadge
                status={req.status}
                label={t(`leave.${req.status}`)}
              />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },

  // ── Loading ──
  loadingWrap: {
    padding: 24,
    alignItems: 'center',
  },

  // ── Balance grid ──
  balanceGrid: {
    gap: 10,
    marginBottom: 16,
  },
  // ── Request button ──
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    marginBottom: 28,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.20,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  requestBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Request history cards ──
  requestsList: {
    gap: 10,
  },
  requestCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestLeft: {
    flex: 1,
    marginRight: 12,
  },
  requestType: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  requestDates: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 4,
  },
  requestDuration: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
    marginTop: 2,
  },
});
