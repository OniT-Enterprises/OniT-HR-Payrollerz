/**
 * Ekipa — Time Tab (dual-mode)
 * Regular staff: personal time tracking, attendance summary, upcoming shifts.
 * Supervisors: + crew batch clock in/out and recent activity.
 * Stripe-style landing page layout.
 */
import { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Clock,
  Users,
  CloudOff,
  ChevronRight,
  History,
  ArrowUpRight,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react-native';
import { colors } from '../../lib/colors';
import { useT } from '../../lib/i18n';
import { useTenantStore } from '../../stores/tenantStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { useAttendanceStore } from '../../stores/attendanceStore';
import { useShiftStore } from '../../stores/shiftStore';
import { useCrewStore } from '../../stores/crewStore';
import { useSyncStore } from '../../stores/syncStore';
import { CrewSummaryCard } from '../../components/CrewSummaryCard';
import { startAutoSync } from '../../lib/syncEngine';

const SCREEN_W = Dimensions.get('window').width;
const PAIR_GAP = 12;
const PAIR_W = (SCREEN_W - 40 - PAIR_GAP) / 2;

const SUPERVISOR_ROLES = ['owner', 'hr-admin', 'manager'];

function todayFormatted(t: (key: string) => string): string {
  const d = new Date();
  return `${d.getDate()} ${t(`month.${d.getMonth() + 1}`)} ${d.getFullYear()}`;
}

export default function TimeScreen() {
  const t = useT();
  const router = useRouter();
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const role = useTenantStore((s) => s.role);
  const employee = useEmployeeStore((s) => s.employee);
  const isSupervisor = SUPERVISOR_ROLES.includes(role || '');

  // Personal attendance
  const summary = useAttendanceStore((s) => s.summary);
  const records = useAttendanceStore((s) => s.records);
  const fetchAttendance = useAttendanceStore((s) => s.fetchAttendance);

  // Shifts
  const shifts = useShiftStore((s) => s.shifts);
  const fetchShifts = useShiftStore((s) => s.fetchShifts);

  // Supervisor crew
  const recentBatches = useCrewStore((s) => s.recentBatches);
  const loadRecentBatches = useCrewStore((s) => s.loadRecentBatches);
  const setMode = useCrewStore((s) => s.setMode);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const refreshCounts = useSyncStore((s) => s.refreshCounts);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (tenantId && employeeId) {
      fetchAttendance(tenantId, employeeId);
      fetchShifts(tenantId, employeeId);
    }
    if (isSupervisor) {
      loadRecentBatches();
      refreshCounts();
      startAutoSync();
    }
  }, [tenantId, employeeId, isSupervisor, fetchAttendance, fetchShifts, loadRecentBatches, refreshCounts]);

  const onRefresh = useCallback(async () => {
    if (!tenantId || !employeeId) return;
    setRefreshing(true);
    await Promise.all([
      fetchAttendance(tenantId, employeeId),
      fetchShifts(tenantId, employeeId),
    ]);
    if (isSupervisor) {
      loadRecentBatches();
      refreshCounts();
    }
    setRefreshing(false);
  }, [tenantId, employeeId, isSupervisor, fetchAttendance, fetchShifts, loadRecentBatches, refreshCounts]);

  // Today's record
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const todayRecord = records.find((r) => r.date === todayStr);
  const nextShift = shifts[0]; // sorted asc, first is next

  // Supervisor stats
  const todayClockedIn = useMemo(() => {
    if (!isSupervisor) return 0;
    return recentBatches
      .filter((b) => b.recordType === 'clock_in' && b.date === todayStr)
      .reduce((sum, b) => sum + b.workerCount, 0);
  }, [isSupervisor, recentBatches, todayStr]);

  const handleClockIn = useCallback(() => {
    setMode('clock_in');
    router.push('/screens/CrewClockIn');
  }, [setMode, router]);

  const handleClockOut = useCallback(() => {
    setMode('clock_out');
    router.push('/screens/CrewClockOut');
  }, [setMode, router]);

  const displayName = employee
    ? employee.firstName
    : '';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* ══ Hero ═══════════════════════════════════ */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{t('time.hero')}</Text>
        <Text style={styles.heroSub}>{todayFormatted(t)}</Text>
      </View>

      {/* ══ Today's Status — featured card ═════════ */}
      <View style={styles.todayCard}>
        <View style={styles.todayTop}>
          <View style={[styles.todayIcon, {
            backgroundColor: todayRecord?.clockIn ? colors.emeraldBg : colors.orangeBg,
          }]}>
            <Clock
              size={22}
              color={todayRecord?.clockIn ? colors.emerald : colors.orange}
              strokeWidth={1.8}
            />
          </View>
          <View style={styles.todayTextCol}>
            <Text style={styles.todayLabel}>{t('time.today')}</Text>
            <Text style={[styles.todayStatus, {
              color: todayRecord?.clockIn ? colors.emerald : colors.textTertiary,
            }]}>
              {todayRecord?.clockIn
                ? todayRecord.clockOut
                  ? t('time.completed')
                  : t('time.clockedIn')
                : t('time.notClockedIn')}
            </Text>
          </View>
        </View>

        {todayRecord && (
          <View style={styles.todayTimes}>
            {todayRecord.clockIn && (
              <View style={styles.timeChip}>
                <Text style={styles.timeChipLabel}>{t('time.in')}</Text>
                <Text style={styles.timeChipValue}>{todayRecord.clockIn}</Text>
              </View>
            )}
            {todayRecord.clockOut && (
              <View style={styles.timeChip}>
                <Text style={styles.timeChipLabel}>{t('time.out')}</Text>
                <Text style={styles.timeChipValue}>{todayRecord.clockOut}</Text>
              </View>
            )}
            {todayRecord.totalHours > 0 && (
              <View style={styles.timeChip}>
                <Text style={styles.timeChipLabel}>{t('time.hours')}</Text>
                <Text style={styles.timeChipValue}>{todayRecord.totalHours.toFixed(1)}h</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ══ This Month — stat cards ════════════════ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('time.monthTitle')}</Text>
        <Text style={styles.sectionSub}>{t('time.monthSub')}</Text>

        <View style={styles.pair}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/screens/AttendanceHistory')}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: colors.emeraldBg }]}>
              <CheckCircle2 size={18} color={colors.emerald} strokeWidth={2} />
            </View>
            <Text style={styles.statValue}>{summary?.daysPresent ?? '--'}</Text>
            <Text style={styles.statLabel}>{t('time.daysPresent')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/screens/AttendanceHistory')}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: colors.cyanBg }]}>
              <Clock size={18} color={colors.cyan} strokeWidth={2} />
            </View>
            <Text style={styles.statValue}>
              {summary ? `${(summary.totalRegularHours + summary.totalOvertimeHours).toFixed(0)}` : '--'}
            </Text>
            <Text style={styles.statLabel}>{t('time.totalHours')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pair}>
          <View style={styles.miniStat}>
            <View style={[styles.miniDot, { backgroundColor: colors.warning }]} />
            <Text style={styles.miniLabel}>{t('time.late')}</Text>
            <Text style={styles.miniValue}>{summary?.daysLate ?? 0}</Text>
          </View>
          <View style={styles.miniStat}>
            <View style={[styles.miniDot, { backgroundColor: colors.error }]} />
            <Text style={styles.miniLabel}>{t('time.absent')}</Text>
            <Text style={styles.miniValue}>{summary?.daysAbsent ?? 0}</Text>
          </View>
          <View style={styles.miniStat}>
            <View style={[styles.miniDot, { backgroundColor: colors.orange }]} />
            <Text style={styles.miniLabel}>{t('time.overtime')}</Text>
            <Text style={styles.miniValue}>{summary?.totalOvertimeHours?.toFixed(0) ?? 0}h</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push('/screens/AttendanceHistory')}
          activeOpacity={0.7}
        >
          <Text style={styles.linkText}>{t('time.viewAttendance')}</Text>
          <ArrowRight size={14} color={colors.cyan} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* ══ Next Shift — compact card ══════════════ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('time.shiftTitle')}</Text>
        <Text style={styles.sectionSub}>{t('time.shiftSub')}</Text>

        <TouchableOpacity
          style={styles.shiftCard}
          onPress={() => router.push('/screens/ShiftSchedule')}
          activeOpacity={0.7}
        >
          <View style={[styles.shiftIcon, { backgroundColor: colors.orangeBg }]}>
            <CalendarClock size={20} color={colors.orange} strokeWidth={1.8} />
          </View>
          <View style={styles.shiftText}>
            {nextShift ? (
              <>
                <Text style={styles.shiftDate}>{nextShift.date}</Text>
                <Text style={styles.shiftTime}>
                  {nextShift.startTime} – {nextShift.endTime}
                  {nextShift.location ? `  ·  ${nextShift.location}` : ''}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.shiftDate}>{t('time.noShift')}</Text>
                <Text style={styles.shiftTime}>{t('time.noShiftSub')}</Text>
              </>
            )}
          </View>
          <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* ══ Supervisor: Crew Management ════════════ */}
      {isSupervisor && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('time.crewTitle')}</Text>
          <Text style={styles.sectionSub}>{t('time.crewSub')}</Text>

          {/* Crew stat row */}
          <View style={styles.crewStats}>
            <View style={styles.crewStatItem}>
              <View style={[styles.crewStatIcon, { backgroundColor: colors.emeraldBg }]}>
                <Users size={16} color={colors.emerald} strokeWidth={2.5} />
              </View>
              <Text style={styles.crewStatValue}>{todayClockedIn}</Text>
              <Text style={styles.crewStatLabel}>{t('crew.clockedInToday')}</Text>
            </View>
            <View style={styles.crewStatDivider} />
            <View style={styles.crewStatItem}>
              <View style={[styles.crewStatIcon, {
                backgroundColor: pendingCount > 0 ? colors.warningBg : 'rgba(100,116,139,0.10)',
              }]}>
                <CloudOff
                  size={16}
                  color={pendingCount > 0 ? colors.warning : colors.textTertiary}
                  strokeWidth={2.5}
                />
              </View>
              <Text style={[styles.crewStatValue, pendingCount > 0 && { color: colors.warning }]}>
                {pendingCount}
              </Text>
              <Text style={styles.crewStatLabel}>{t('crew.pendingSync')}</Text>
            </View>
          </View>

          {/* Clock In / Clock Out buttons */}
          <TouchableOpacity
            style={styles.clockInBtn}
            onPress={handleClockIn}
            activeOpacity={0.85}
          >
            <View style={styles.clockInIconWrap}>
              <Clock size={18} color={colors.white} strokeWidth={2.5} />
            </View>
            <View style={styles.btnTextCol}>
              <Text style={styles.clockInText}>{t('crew.clockIn')}</Text>
              <Text style={styles.clockInSub}>{t('crew.selectWorkers')}</Text>
            </View>
            <ArrowUpRight size={18} color="rgba(255,255,255,0.5)" strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.clockOutBtn}
            onPress={handleClockOut}
            activeOpacity={0.85}
          >
            <View style={styles.clockOutIconWrap}>
              <Clock size={18} color={colors.orange} strokeWidth={2.5} />
            </View>
            <View style={styles.btnTextCol}>
              <Text style={styles.clockOutText}>{t('crew.clockOut')}</Text>
              <Text style={styles.clockOutSub}>{t('crew.selectWorkersClockOut')}</Text>
            </View>
            <ArrowUpRight size={18} color="rgba(249,115,22,0.4)" strokeWidth={2} />
          </TouchableOpacity>

          {/* Recent crew activity */}
          {recentBatches.length > 0 && (
            <>
              <Text style={styles.crewActivityLabel}>{t('crew.recentActivity')}</Text>
              {recentBatches.slice(0, 3).map((batch) => (
                <View key={batch.id} style={styles.batchItem}>
                  <CrewSummaryCard batch={batch} />
                </View>
              ))}
            </>
          )}

          {/* Crew footer links */}
          <View style={styles.crewLinks}>
            <TouchableOpacity
              style={styles.crewLinkRow}
              onPress={() => router.push('/screens/CrewHistory')}
              activeOpacity={0.7}
            >
              <View style={[styles.crewLinkIcon, { backgroundColor: colors.orangeBg }]}>
                <History size={16} color={colors.orange} strokeWidth={2.5} />
              </View>
              <Text style={styles.crewLinkText}>{t('crew.viewHistory')}</Text>
              <ChevronRight size={14} color={colors.textTertiary} strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.crewLinkDivider} />

            <TouchableOpacity
              style={styles.crewLinkRow}
              onPress={() => router.push('/screens/SyncQueue')}
              activeOpacity={0.7}
            >
              <View style={[styles.crewLinkIcon, {
                backgroundColor: pendingCount > 0 ? colors.warningBg : 'rgba(100,116,139,0.10)',
              }]}>
                <CloudOff
                  size={16}
                  color={pendingCount > 0 ? colors.warning : colors.textTertiary}
                  strokeWidth={2.5}
                />
              </View>
              <Text style={styles.crewLinkText}>{t('crew.syncQueue')}</Text>
              {pendingCount > 0 && (
                <View style={styles.syncBadge}>
                  <Text style={styles.syncBadgeText}>{pendingCount}</Text>
                </View>
              )}
              <ChevronRight size={14} color={colors.textTertiary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 48 },

  /* ── Hero ─────────────────────────────────── */
  hero: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 22,
  },

  /* ── Today card ───────────────────────────── */
  todayCard: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 32,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  todayTextCol: { flex: 1 },
  todayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    marginBottom: 2,
  },
  todayStatus: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  todayTimes: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  timeChip: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  timeChipLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  timeChipValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
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

  /* ── Mini stats (3-up compact) ───────────── */
  miniStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  miniLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  miniValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },

  /* ── Link row ────────────────────────────── */
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 6,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.cyan,
  },

  /* ── Shift card ──────────────────────────── */
  shiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shiftIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  shiftText: { flex: 1 },
  shiftDate: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  shiftTime: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textTertiary,
  },

  /* ── Supervisor: Crew section ────────────── */
  crewStats: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  crewStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  crewStatDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  crewStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crewStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  crewStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  /* Clock buttons */
  clockInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.orange,
    borderRadius: 16,
    padding: 18,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: colors.orange,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  clockInIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTextCol: {
    flex: 1,
    gap: 2,
  },
  clockInText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  clockInSub: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  clockOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  clockOutIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.orangeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockOutText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.orange,
  },
  clockOutSub: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
  },

  /* Crew activity */
  crewActivityLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  batchItem: {
    marginBottom: 8,
  },

  /* Crew footer links */
  crewLinks: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: 8,
  },
  crewLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  crewLinkDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },
  crewLinkIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crewLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  syncBadge: {
    backgroundColor: colors.warningBg,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
  },
});
