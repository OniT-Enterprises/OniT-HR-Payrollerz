/**
 * Ekipa — Home Dashboard
 * Landing-page style: hero greeting, payday countdown, pay card, status section.
 */
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Dimensions } from 'react-native';
import { router } from 'expo-router';
import {
  FileText,
  Calendar,
  Clock,
  CalendarClock,
  ChevronRight,
  ArrowRight,
  Megaphone,
} from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { usePayslipStore } from '../../stores/payslipStore';
import { useLeaveStore } from '../../stores/leaveStore';
import { useAttendanceStore } from '../../stores/attendanceStore';
import { useShiftStore } from '../../stores/shiftStore';
import { useAnnouncementStore } from '../../stores/announcementStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useI18nStore, useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { formatCurrency } from '../../lib/currency';

const SCREEN_W = Dimensions.get('window').width;
const PAIR_GAP = 12;
const PAIR_W = (SCREEN_W - 40 - PAIR_GAP) / 2;

function getGreeting(t: (k: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return t('home.greeting');
  if (hour < 18) return t('home.greetingAfternoon');
  return t('home.greetingEvening');
}

function getNextPayday(payDay: number): { date: Date; daysAway: number } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const makePayday = (year: number, month: number) => {
    const finalDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(payDay, finalDay));
  };

  let date = makePayday(today.getFullYear(), today.getMonth());
  if (date.getTime() < today.getTime()) {
    date = makePayday(today.getFullYear(), today.getMonth() + 1);
  }

  return {
    date,
    daysAway: Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  };
}

function formatShiftDate(date: string, t: (key: string) => string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.getDate()} ${t(`month.${parsed.getMonth() + 1}`)}`;
}

export default function HomeScreen() {
  const t = useT();
  const language = useI18nStore((s) => s.language);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const employee = useEmployeeStore((s) => s.employee);
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const payslips = usePayslipStore((s) => s.payslips);
  const fetchPayslips = usePayslipStore((s) => s.fetchPayslips);
  const balance = useLeaveStore((s) => s.balance);
  const fetchBalance = useLeaveStore((s) => s.fetchBalance);
  const attendanceSummary = useAttendanceStore((s) => s.summary);
  const fetchAttendance = useAttendanceStore((s) => s.fetchAttendance);
  const shifts = useShiftStore((s) => s.shifts);
  const fetchShifts = useShiftStore((s) => s.fetchShifts);
  const announcements = useAnnouncementStore((s) => s.announcements);
  const fetchAnnouncements = useAnnouncementStore((s) => s.fetchAnnouncements);
  const getUnreadCount = useAnnouncementStore((s) => s.getUnreadCount);
  const payDay = useSettingsStore((s) => s.payDay);
  const companyName = useSettingsStore((s) => s.companyName);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (tenantId && employeeId) {
      fetchPayslips(tenantId, employeeId);
      fetchBalance(tenantId, employeeId);
      fetchAttendance(tenantId, employeeId);
      fetchShifts(tenantId, employeeId);
      fetchAnnouncements(tenantId);
      fetchSettings(tenantId);
    }
  }, [
    tenantId,
    employeeId,
    fetchPayslips,
    fetchBalance,
    fetchAttendance,
    fetchShifts,
    fetchAnnouncements,
    fetchSettings,
  ]);

  const onRefresh = useCallback(async () => {
    if (!tenantId || !employeeId) return;
    setRefreshing(true);
    await Promise.all([
      fetchPayslips(tenantId, employeeId),
      fetchBalance(tenantId, employeeId),
      fetchAttendance(tenantId, employeeId),
      fetchShifts(tenantId, employeeId),
      fetchAnnouncements(tenantId),
      fetchSettings(tenantId),
    ]);
    setRefreshing(false);
  }, [
    tenantId,
    employeeId,
    fetchPayslips,
    fetchBalance,
    fetchAttendance,
    fetchShifts,
    fetchAnnouncements,
    fetchSettings,
  ]);

  const displayName = employee
    ? employee.firstName
    : profile?.displayName?.split(' ')[0] || '';

  const nextPayday = getNextPayday(payDay);
  const latestPayslip = payslips[0];
  const annualRemaining = balance?.annual?.remaining ?? '--';
  const hoursThisMonth = attendanceSummary
    ? attendanceSummary.totalRegularHours + attendanceSummary.totalOvertimeHours
    : null;
  const nextShift = shifts[0];
  const latestAnnouncement = announcements[0];
  const unreadAnnouncements = user ? getUnreadCount(user.uid) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* ══ Hero — greeting ════════════════════════ */}
      <View style={styles.hero}>
        <Text style={styles.greeting}>{getGreeting(t)}</Text>
        <Text style={styles.name}>{displayName}</Text>
        {companyName ? (
          <Text style={styles.companyName} numberOfLines={1}>{companyName}</Text>
        ) : null}
      </View>

      {/* ══ Payday countdown — full-width block ═══ */}
      <View style={styles.paydayBlock}>
        <View style={styles.paydayLeft}>
          <Text style={styles.paydayLabel}>{t('home.paydayTitle')}</Text>
          <Text style={styles.paydaySub}>
            {nextPayday.date.getDate()} {t(`month.${nextPayday.date.getMonth() + 1}`)}
          </Text>
        </View>
        <View style={styles.paydayBadge}>
          <Text style={styles.paydayNumber}>{nextPayday.daysAway}</Text>
          <Text style={styles.paydayBadgeLabel}>{t('home.days')}</Text>
        </View>
      </View>

      {/* ══ Latest pay — featured card ════════════ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('home.payTitle')}</Text>
        <Text style={styles.sectionSub}>{t('home.paySub')}</Text>

        <TouchableOpacity
          style={styles.payCard}
          onPress={() => router.push('/(tabs)/payslips')}
          activeOpacity={0.7}
        >
          <View style={styles.payTop}>
            <View style={[styles.payIcon, { backgroundColor: colors.blueBg }]}>
              <FileText size={20} color={colors.blue} strokeWidth={1.8} />
            </View>
            <Text style={styles.payPeriod}>
              {latestPayslip
                ? latestPayslip.periodLabel
                : '--'}
            </Text>
          </View>
          <Text style={styles.payAmount} numberOfLines={1}>
            {latestPayslip
              ? formatCurrency(latestPayslip.netPay, language, employee?.currency || 'USD')
              : t('home.noPayslip')}
          </Text>
          <Text style={styles.payLabel}>{t('payslips.netPay')}</Text>

          <View style={styles.payBtn}>
            <Text style={styles.payBtnText}>{t('home.viewDetails')}</Text>
            <ArrowRight size={14} color={colors.blue} strokeWidth={2.5} />
          </View>
        </TouchableOpacity>
      </View>

      {/* ══ At a glance — status section ══════════ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('home.statusTitle')}</Text>

        {/* Leave + Attendance pair */}
        <View style={styles.pair}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/(tabs)/leave')}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: colors.violetBg }]}>
              <Calendar size={18} color={colors.violet} strokeWidth={2} />
            </View>
            <Text style={styles.statValue}>{annualRemaining}</Text>
            <Text style={styles.statLabel}>{t('home.daysLeft')}</Text>
            <Text style={styles.statCaption}>{t('home.leaveBalance')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/screens/AttendanceHistory')}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: colors.emeraldBg }]}>
              <Clock size={18} color={colors.emerald} strokeWidth={2} />
            </View>
            <Text style={styles.statValue}>
              {hoursThisMonth === null ? '--' : `${hoursThisMonth.toFixed(0)}h`}
            </Text>
            <Text style={styles.statLabel}>{t('home.hoursThisMonth')}</Text>
            <Text style={styles.statCaption}>{t('home.attendance')}</Text>
          </TouchableOpacity>
        </View>

        {/* Next shift — compact row */}
        <TouchableOpacity
          style={styles.shiftRow}
          onPress={() => router.push('/screens/ShiftSchedule')}
          activeOpacity={0.7}
        >
          <View style={[styles.shiftIcon, { backgroundColor: colors.orangeBg }]}>
            <CalendarClock size={18} color={colors.orange} strokeWidth={1.8} />
          </View>
          <View style={styles.shiftText}>
            <Text style={styles.shiftLabel}>{t('home.nextShift')}</Text>
            <Text style={styles.shiftValue} numberOfLines={1}>
              {nextShift
                ? `${formatShiftDate(nextShift.date, t)} · ${nextShift.startTime}–${nextShift.endTime}`
                : t('time.noShift')}
            </Text>
            {nextShift?.location ? (
              <Text style={styles.shiftMeta} numberOfLines={1}>{nextShift.location}</Text>
            ) : null}
          </View>
          <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.announcementRow}
          onPress={() => router.push('/screens/Announcements')}
          activeOpacity={0.7}
        >
          <View style={[styles.shiftIcon, { backgroundColor: colors.tealBg }]}> 
            <Megaphone size={18} color={colors.teal} strokeWidth={1.8} />
          </View>
          <View style={styles.shiftText}>
            <View style={styles.announcementTitleRow}>
              <Text style={styles.shiftLabel}>{t('home.announcements')}</Text>
              {unreadAnnouncements > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadAnnouncements > 99 ? '99+' : unreadAnnouncements}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.shiftValue} numberOfLines={1}>
              {latestAnnouncement?.title || t('announcements.emptySub')}
            </Text>
          </View>
          <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 48 },

  /* ── Hero ─────────────────────────────────── */
  hero: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  greeting: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  name: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.8,
  },
  companyName: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 0.2,
  },

  /* ── Payday countdown ────────────────────── */
  paydayBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 32,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paydayLeft: { flex: 1 },
  paydayLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  paydaySub: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  paydayBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: 'rgba(106, 156, 41, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paydayNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  paydayBadgeLabel: {
    marginTop: -2,
    fontSize: 8,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* ── Section ─────────────────────────────── */
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textTertiary,
    marginBottom: 14,
    lineHeight: 18,
  },

  /* ── Pay card ────────────────────────────── */
  payCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  payIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payPeriod: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  payAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
    marginBottom: 2,
  },
  payLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    marginBottom: 16,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  payBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.blue,
  },

  /* ── Stat cards (2-up) ───────────────────── */
  pair: {
    flexDirection: 'row',
    gap: PAIR_GAP,
    marginBottom: 10,
  },
  statCard: {
    width: PAIR_W,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
    marginBottom: 1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statCaption: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textTertiary,
    marginTop: 2,
  },

  /* ── Shift row ───────────────────────────── */
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shiftIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shiftText: { flex: 1 },
  shiftLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 1,
  },
  shiftValue: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  shiftMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  announcementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
  },
  announcementTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textInverse,
  },
});
