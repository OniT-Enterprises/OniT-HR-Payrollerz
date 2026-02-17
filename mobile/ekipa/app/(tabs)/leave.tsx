/**
 * Ekipa — Leave Tab
 * Balance cards with progress bars, request history with status badges
 */
import { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Plus, Calendar } from 'lucide-react-native';
import { useTenantStore } from '../../stores/tenantStore';
import { useLeaveStore } from '../../stores/leaveStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { LeaveBalanceCard } from '../../components/LeaveBalanceCard';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/EmptyState';

export default function LeaveScreen() {
  const t = useT();
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const balance = useLeaveStore((s) => s.balance);
  const requests = useLeaveStore((s) => s.requests);
  const loading = useLeaveStore((s) => s.loading);
  const fetchBalance = useLeaveStore((s) => s.fetchBalance);
  const fetchRequests = useLeaveStore((s) => s.fetchRequests);

  useEffect(() => {
    if (tenantId && employeeId) {
      fetchBalance(tenantId, employeeId);
      fetchRequests(tenantId, employeeId);
    }
  }, [tenantId, employeeId, fetchBalance, fetchRequests]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Balance section */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Calendar size={14} color={colors.primary} strokeWidth={2} />
          <Text style={styles.sectionTitle}>{t('leave.balance')}</Text>
        </View>
      </View>

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
            color={colors.warning}
          />
          {balance.maternity && (
            <LeaveBalanceCard
              label={t('leave.maternity')}
              balance={balance.maternity}
              color={colors.info}
            />
          )}
          {balance.paternity && (
            <LeaveBalanceCard
              label={t('leave.paternity')}
              balance={balance.paternity}
              color={colors.info}
            />
          )}
        </View>
      ) : (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {/* Request button */}
      <TouchableOpacity
        style={styles.requestBtn}
        onPress={() => router.push('/screens/LeaveRequestForm')}
        activeOpacity={0.85}
      >
        <Plus size={18} color={colors.white} strokeWidth={2.5} />
        <Text style={styles.requestBtnText}>{t('leave.request')}</Text>
      </TouchableOpacity>

      {/* History section */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Calendar size={14} color={colors.primary} strokeWidth={2} />
          <Text style={styles.sectionTitle}>{t('leave.history')}</Text>
        </View>
      </View>

      {loading && requests.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : requests.length === 0 ? (
        <EmptyState title={t('leave.empty')} />
      ) : (
        <View style={styles.requestsList}>
          {requests.map((req) => (
            <View key={req.id} style={styles.requestRow}>
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
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  loadingWrap: {
    padding: 24,
    alignItems: 'center',
  },

  // Balance
  balanceGrid: {
    gap: 10,
    marginBottom: 16,
  },

  // Request button
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
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
  },

  // Request list
  requestsList: {
    gap: 10,
  },
  requestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  requestLeft: {
    flex: 1,
  },
  requestType: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  requestDates: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
    fontWeight: '500',
  },
  requestDuration: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
    fontWeight: '500',
  },
});
