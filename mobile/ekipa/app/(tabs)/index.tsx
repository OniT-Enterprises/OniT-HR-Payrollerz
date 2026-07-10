/**
 * Ekipa — Home Dashboard
 * Xefe · Ekipa design language: olive hero card (greeting + payday countdown,
 * Xefe mark watermark), editorial section labels, one accent, quiet empties.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import {
  FileText,
  Calendar,
  Clock,
  CalendarClock,
  ChevronRight,
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
import { SectionLabel, ChipIcon, EmptyCard } from '../../components/ui';

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
  const annualRemaining = balance?.annual?.remaining;
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
      {/* ══ Hero — olive brand card: greeting + payday ══ */}
      <View style={styles.hero}>
        {/* Decorative pattern (same language as the login hero) */}
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.heroCircle1} />
          <View style={styles.heroCircle2} />
        </View>
        <Image
          source={require('../../assets/xefe-mark.webp')}
          style={styles.heroMark}
          resizeMode="contain"
        />

        <Text style={styles.greeting}>{getGreeting(t)}</Text>
        <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
        {companyName ? (
          <View style={styles.companyPill}>
            <Text style={styles.companyPillText} numberOfLines={1}>{companyName}</Text>
          </View>
        ) : null}

        <View style={styles.heroDivider} />

        <View style={styles.paydayRow}>
          <View style={styles.paydayLeft}>
            <Text style={styles.paydayLabel}>{t('home.paydayTitle')}</Text>
            <Text style={styles.paydayDate}>
              {nextPayday.date.getDate()} {t(`month.${nextPayday.date.getMonth() + 1}`)}
            </Text>
          </View>
          <View style={styles.paydayBadge}>
            <Text style={styles.paydayNumber}>{nextPayday.daysAway}</Text>
            <Text style={styles.paydayBadgeLabel}>{t('home.days')}</Text>
          </View>
        </View>
      </View>

      {/* ══ Your pay ══ */}
      <View style={styles.section}>
        <SectionLabel>{t('home.payTitle')}</SectionLabel>

        {latestPayslip ? (
          <TouchableOpacity
            style={styles.payCard}
            onPress={() => router.push('/(tabs)/payslips')}
            activeOpacity={0.7}
          >
            <View style={styles.payTop}>
              <ChipIcon icon={FileText} />
              <Text style={styles.payPeriod}>{latestPayslip.periodLabel}</Text>
              <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
            </View>
            <Text style={styles.payAmount} numberOfLines={1}>
              {formatCurrency(latestPayslip.netPay, language, employee?.currency || 'USD')}
            </Text>
            <Text style={styles.payLabel}>{t('payslips.netPay')}</Text>
          </TouchableOpacity>
        ) : (
          <EmptyCard title={t('home.noPayslip')} subtitle={t('home.noPayslipSub')} />
        )}
      </View>

      {/* ══ At a glance ══ */}
      <View style={styles.section}>
        <SectionLabel>{t('home.statusTitle')}</SectionLabel>

        {/* Leave + Attendance pair */}
        <View style={styles.pair}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/(tabs)/leave')}
            activeOpacity={0.7}
          >
            <ChipIcon icon={Calendar} />
            <Text style={[styles.statValue, annualRemaining == null && styles.statValueEmpty]}>
              {annualRemaining ?? '—'}
            </Text>
            <Text style={styles.statLabel}>{t('home.daysLeft')}</Text>
            <Text style={styles.statCaption}>{t('home.leaveBalance')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/screens/AttendanceHistory')}
            activeOpacity={0.7}
          >
            <ChipIcon icon={Clock} />
            <Text style={[styles.statValue, hoursThisMonth === null && styles.statValueEmpty]}>
              {hoursThisMonth === null ? '—' : `${hoursThisMonth.toFixed(0)}h`}
            </Text>
            <Text style={styles.statLabel}>{t('home.hoursThisMonth')}</Text>
            <Text style={styles.statCaption}>{t('home.attendance')}</Text>
          </TouchableOpacity>
        </View>

        {/* Next shift */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/screens/ShiftSchedule')}
          activeOpacity={0.7}
        >
          <ChipIcon icon={CalendarClock} />
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{t('home.nextShift')}</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
              {nextShift
                ? `${formatShiftDate(nextShift.date, t)} · ${nextShift.startTime}–${nextShift.endTime}`
                : t('time.noShift')}
            </Text>
            {nextShift?.location ? (
              <Text style={styles.rowMeta} numberOfLines={1}>{nextShift.location}</Text>
            ) : null}
          </View>
          <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
        </TouchableOpacity>

        {/* Announcements */}
        <TouchableOpacity
          style={[styles.row, styles.rowSpaced]}
          onPress={() => router.push('/screens/Announcements')}
          activeOpacity={0.7}
        >
          <ChipIcon icon={Megaphone} />
          <View style={styles.rowText}>
            <View style={styles.rowTitleGroup}>
              <Text style={styles.rowLabel}>{t('home.announcements')}</Text>
              {unreadAnnouncements > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadAnnouncements > 99 ? '99+' : unreadAnnouncements}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.rowValue} numberOfLines={1}>
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
  content: { paddingBottom: 120 },

  /* ── Hero card ─────────────────────────────── */
  hero: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 28,
    borderRadius: 24,
    backgroundColor: colors.primary,
    padding: 22,
    overflow: 'hidden',
  },
  heroCircle1: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroCircle2: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroMark: {
    position: 'absolute',
    right: 14,
    top: 16,
    width: 64,
    height: 72,
    opacity: 0.9,
  },
  greeting: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  name: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: -0.8,
    paddingRight: 76, // clear the mark
  },
  companyPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  companyPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.2,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 18,
    marginBottom: 14,
  },
  paydayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paydayLeft: { flex: 1 },
  paydayLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
  },
  paydayDate: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
  },
  paydayBadge: {
    minWidth: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  paydayNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: -0.5,
  },
  paydayBadgeLabel: {
    marginTop: -2,
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  /* ── Sections ──────────────────────────────── */
  section: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },

  /* ── Pay card ──────────────────────────────── */
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
    gap: 12,
    marginBottom: 16,
  },
  payPeriod: {
    flex: 1,
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
  },

  /* ── Stat cards (2-up) ─────────────────────── */
  pair: {
    flexDirection: 'row',
    gap: PAIR_GAP,
    marginBottom: 10,
  },
  statCard: {
    width: PAIR_W,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
    marginTop: 14,
    marginBottom: 1,
  },
  statValueEmpty: {
    color: colors.textTertiary,
    fontWeight: '600',
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

  /* ── Rows ──────────────────────────────────── */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  rowSpaced: { marginTop: 10 },
  rowText: { flex: 1 },
  rowTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 1,
  },
  rowValue: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  rowMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '500',
    color: colors.textTertiary,
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
    color: colors.white,
  },
});
