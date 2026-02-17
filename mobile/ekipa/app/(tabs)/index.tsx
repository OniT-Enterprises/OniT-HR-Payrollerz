/**
 * Ekipa — Home Dashboard
 * Greeting, next payday hero, leave summary, quick actions
 */
import { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { FileText, Calendar, Clock, ArrowRight } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { usePayslipStore } from '../../stores/payslipStore';
import { useLeaveStore } from '../../stores/leaveStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';

function getGreeting(t: (k: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return t('home.greeting');
  if (hour < 18) return t('home.greetingAfternoon');
  return t('home.greetingEvening');
}

function getDaysUntilPayday(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  const diff = Math.ceil((lastDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export default function HomeScreen() {
  const t = useT();
  const profile = useAuthStore((s) => s.profile);
  const employee = useEmployeeStore((s) => s.employee);
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const payslips = usePayslipStore((s) => s.payslips);
  const fetchPayslips = usePayslipStore((s) => s.fetchPayslips);
  const balance = useLeaveStore((s) => s.balance);
  const fetchBalance = useLeaveStore((s) => s.fetchBalance);

  useEffect(() => {
    if (tenantId && employeeId) {
      fetchPayslips(tenantId, employeeId);
      fetchBalance(tenantId, employeeId);
    }
  }, [tenantId, employeeId, fetchPayslips, fetchBalance]);

  const displayName = employee
    ? employee.firstName
    : profile?.displayName?.split(' ')[0] || '';

  const daysUntilPayday = getDaysUntilPayday();
  const latestPayslip = payslips[0];
  const annualRemaining = balance?.annual?.remaining ?? '--';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Greeting */}
      <Text style={styles.greeting}>{getGreeting(t)}</Text>
      <Text style={styles.name}>{displayName}</Text>

      {/* Payday Hero Card */}
      <View style={styles.payDayCard}>
        <View style={styles.payDayDecor1} />
        <View style={styles.payDayDecor2} />
        <View style={styles.payDayInner}>
          <Text style={styles.payDayLabel}>{t('home.nextPayday')}</Text>
          <View style={styles.payDayRow}>
            <Text style={styles.payDayNumber}>{daysUntilPayday}</Text>
            <Text style={styles.payDayUnit}>{t('home.days')}</Text>
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {/* Leave balance */}
        <TouchableOpacity
          style={styles.statCard}
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/leave')}
        >
          <View style={[styles.statIconWrap, { backgroundColor: colors.primaryBg }]}>
            <Calendar size={16} color={colors.primary} strokeWidth={2} />
          </View>
          <Text style={styles.statLabel}>{t('home.leaveBalance')}</Text>
          <Text style={styles.statValue}>{annualRemaining}</Text>
          <Text style={styles.statUnit}>{t('home.daysRemaining')}</Text>
        </TouchableOpacity>

        {/* Latest payslip */}
        <TouchableOpacity
          style={styles.statCard}
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/payslips')}
        >
          <View style={[styles.statIconWrap, { backgroundColor: colors.successBg }]}>
            <FileText size={16} color={colors.success} strokeWidth={2} />
          </View>
          <Text style={styles.statLabel}>{t('home.recentPayslip')}</Text>
          <Text style={styles.statValue}>
            {latestPayslip ? `$${latestPayslip.netPay.toFixed(0)}` : '--'}
          </Text>
          <Text style={styles.statUnit}>
            {latestPayslip ? latestPayslip.periodLabel : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
      <View style={styles.actionsColumn}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => router.push('/(tabs)/payslips')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.primaryBg }]}>
            <FileText size={20} color={colors.primary} strokeWidth={1.8} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionLabel}>{t('home.viewPayslips')}</Text>
            <Text style={styles.actionSub}>View earnings & deductions</Text>
          </View>
          <ArrowRight size={16} color={colors.textTertiary} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => router.push('/screens/LeaveRequestForm')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.infoBg }]}>
            <Calendar size={20} color={colors.info} strokeWidth={1.8} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionLabel}>{t('home.requestLeave')}</Text>
            <Text style={styles.actionSub}>Submit a leave request</Text>
          </View>
          <ArrowRight size={16} color={colors.textTertiary} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.successBg }]}>
            <Clock size={20} color={colors.success} strokeWidth={1.8} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionLabel}>{t('profile.attendance')}</Text>
            <Text style={styles.actionSub}>Check your attendance record</Text>
          </View>
          <ArrowRight size={16} color={colors.textTertiary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  greeting: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    fontWeight: '500',
  },
  name: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.7,
    marginBottom: 24,
  },

  // Payday card
  payDayCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  payDayDecor1: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  payDayDecor2: {
    position: 'absolute',
    bottom: -30,
    left: -10,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  payDayInner: {
    padding: 20,
  },
  payDayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  payDayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 8,
  },
  payDayNumber: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1,
  },
  payDayUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
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
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  statUnit: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },

  // Quick actions — list style
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  actionsColumn: {
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
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
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
    marginLeft: 14,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  actionSub: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
    fontWeight: '500',
  },
});
