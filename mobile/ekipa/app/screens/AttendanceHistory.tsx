/**
 * Ekipa — Attendance History Screen
 * Premium dark theme with cyan (#06B6D4) module accent.
 * Month selector, summary card, grouped attendance records.
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Palmtree,
  CalendarCheck,
} from 'lucide-react-native';
import { useTenantStore } from '../../stores/tenantStore';
import { useAttendanceStore } from '../../stores/attendanceStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import type { AttendanceRecord, AttendanceStatus } from '../../types/attendance';

const ACCENT = colors.cyan;

function getMonthOptions(): { label: string; value: string }[] {
  const months: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    months.push({
      value: `${yyyy}-${mm}`,
      label: `${d.toLocaleString('en', { month: 'short' })} ${yyyy}`,
    });
  }
  return months;
}

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr);
  const dayOfMonth = d.getDate();
  return Math.ceil(dayOfMonth / 7);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const weekday = d.toLocaleString('en', { weekday: 'short' });
  const day = d.getDate();
  const month = d.toLocaleString('en', { month: 'short' });
  return `${weekday}, ${day} ${month}`;
}

const STATUS_CONFIG: Record<AttendanceStatus, { color: string; bg: string; icon: any }> = {
  present: { color: colors.emerald, bg: colors.successBg, icon: CheckCircle2 },
  late: { color: colors.warning, bg: colors.warningBg, icon: AlertTriangle },
  absent: { color: colors.error, bg: colors.errorBg, icon: XCircle },
  leave: { color: colors.violet, bg: colors.violetBg, icon: Palmtree },
  holiday: { color: colors.blue, bg: colors.blueBg, icon: CalendarCheck },
  half_day: { color: colors.orange, bg: colors.orangeBg, icon: Clock },
};

interface WeekGroup {
  weekLabel: string;
  records: AttendanceRecord[];
}

export default function AttendanceHistory() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const records = useAttendanceStore((s) => s.records);
  const summary = useAttendanceStore((s) => s.summary);
  const loading = useAttendanceStore((s) => s.loading);
  const fetchAttendance = useAttendanceStore((s) => s.fetchAttendance);

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);

  useEffect(() => {
    if (tenantId && employeeId) {
      fetchAttendance(tenantId, employeeId, selectedMonth);
    }
  }, [tenantId, employeeId, selectedMonth, fetchAttendance]);

  const weekGroups = useMemo<WeekGroup[]>(() => {
    if (!records.length) return [];
    const map = new Map<number, AttendanceRecord[]>();
    for (const r of records) {
      const week = getWeekNumber(r.date);
      if (!map.has(week)) map.set(week, []);
      map.get(week)!.push(r);
    }
    const groups: WeekGroup[] = [];
    const sortedKeys = Array.from(map.keys()).sort((a, b) => a - b);
    for (const week of sortedKeys) {
      groups.push({
        weekLabel: `${t('attendance.week')} ${week}`,
        records: map.get(week)!.sort((a, b) => a.date.localeCompare(b.date)),
      });
    }
    return groups;
  }, [records, t]);

  const totalHoursThisMonth = useMemo(() => {
    if (!summary) return 0;
    return summary.totalRegularHours + summary.totalOvertimeHours;
  }, [summary]);

  const renderRecord = useCallback(({ item }: { item: AttendanceRecord }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.present;
    const StatusIcon = cfg.icon;
    return (
      <View style={styles.recordRow}>
        <View style={styles.recordLeft}>
          <Text style={styles.recordDate}>{formatDate(item.date)}</Text>
          <View style={styles.recordTimes}>
            {item.clockIn && (
              <Text style={styles.recordTime}>{item.clockIn}</Text>
            )}
            {item.clockIn && item.clockOut && (
              <Text style={styles.recordTimeSep}>{' \u2192 '}</Text>
            )}
            {item.clockOut && (
              <Text style={styles.recordTime}>{item.clockOut}</Text>
            )}
          </View>
        </View>
        <View style={styles.recordRight}>
          <Text style={styles.recordHours}>
            {item.totalHours > 0 ? `${item.totalHours.toFixed(1)}h` : '\u2014'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <StatusIcon size={12} color={cfg.color} strokeWidth={2.5} />
            <Text style={[styles.statusText, { color: cfg.color }]}>
              {t(`attendance.${item.status}`)}
            </Text>
          </View>
        </View>
      </View>
    );
  }, [t]);

  const renderWeekGroup = ({ item }: { item: WeekGroup }) => (
    <View style={styles.weekGroup}>
      <Text style={styles.weekLabel}>{item.weekLabel}</Text>
      <Card>
        {item.records.map((r, i) => (
          <View key={r.id}>
            {renderRecord({ item: r })}
            {i < item.records.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </Card>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Cyan hero header with decorative circles */}
      <View style={styles.heroHeader}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.heroDecor3} />
        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{t('attendance.title')}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.heroContent}>
          <Text style={styles.heroLabel}>{t('attendance.totalHours')}</Text>
          <Text style={styles.heroAmount}>{totalHoursThisMonth.toFixed(1)}h</Text>
        </View>
      </View>

      {/* Month selector */}
      <View style={styles.monthSelectorContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthScroll}
        >
          {monthOptions.map((m) => (
            <TouchableOpacity
              key={m.value}
              style={[
                styles.monthPill,
                selectedMonth === m.value && styles.monthPillActive,
              ]}
              onPress={() => setSelectedMonth(m.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.monthPillText,
                  selectedMonth === m.value && styles.monthPillTextActive,
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={weekGroups}
          keyExtractor={(item) => item.weekLabel}
          renderItem={renderWeekGroup}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            summary && records.length > 0 ? (
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>
                    {summary.workingDays}
                  </Text>
                  <Text style={styles.summaryLabel}>{t('attendance.totalDays')}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={[styles.summaryValue, { color: colors.emerald }]}>
                    {summary.daysPresent}
                  </Text>
                  <Text style={styles.summaryLabel}>{t('attendance.present')}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={[styles.summaryValue, { color: colors.warning }]}>
                    {summary.daysLate}
                  </Text>
                  <Text style={styles.summaryLabel}>{t('attendance.late')}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={[styles.summaryValue, { color: colors.error }]}>
                    {summary.daysAbsent}
                  </Text>
                  <Text style={styles.summaryLabel}>{t('attendance.absent')}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={[styles.summaryValue, { color: ACCENT }]}>
                    {summary.totalRegularHours.toFixed(1)}
                  </Text>
                  <Text style={styles.summaryLabel}>{t('attendance.regularHours')}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={[styles.summaryValue, { color: colors.orange }]}>
                    {summary.totalOvertimeHours.toFixed(1)}
                  </Text>
                  <Text style={styles.summaryLabel}>{t('attendance.overtimeHours')}</Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title={t('attendance.empty')}
              subtitle={t('attendance.emptySub')}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // -- Cyan hero header --
  heroHeader: {
    backgroundColor: ACCENT,
    paddingBottom: 32,
    overflow: 'hidden',
  },
  heroDecor1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroDecor2: {
    position: 'absolute',
    bottom: -24,
    left: 16,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroDecor3: {
    position: 'absolute',
    top: 30,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleWhite: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.3,
  },
  heroContent: {
    alignItems: 'center',
    paddingTop: 12,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1.5,
    marginTop: 4,
  },

  // -- Month selector --
  monthSelectorContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  monthScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  monthPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  monthPillActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  monthPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  monthPillTextActive: {
    color: colors.white,
  },

  // -- Summary grid --
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 4,
    textAlign: 'center',
  },

  // -- Week groups --
  weekGroup: {
    marginBottom: 16,
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // -- Record row --
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  recordLeft: {
    flex: 1,
    gap: 4,
  },
  recordDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  recordTimes: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordTime: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  recordTimeSep: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  recordRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  recordHours: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },

  // -- Loading & list --
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
});

/*
 * i18n keys to add to lib/i18n.ts:
 *
 * 'attendance.title':        { tet: 'Istória Prezensia', en: 'Attendance History' }
 * 'attendance.totalHours':   { tet: 'Total oras', en: 'Total hours' }
 * 'attendance.totalDays':    { tet: 'Total loron', en: 'Total days' }
 * 'attendance.present':      { tet: 'Prezente', en: 'Present' }
 * 'attendance.late':         { tet: 'Tardi', en: 'Late' }
 * 'attendance.absent':       { tet: 'Auzente', en: 'Absent' }
 * 'attendance.leave':        { tet: 'Lisensa', en: 'Leave' }
 * 'attendance.holiday':      { tet: 'Feriadu', en: 'Holiday' }
 * 'attendance.half_day':     { tet: 'Meiu-loron', en: 'Half day' }
 * 'attendance.regularHours': { tet: 'Oras regulár', en: 'Regular hrs' }
 * 'attendance.overtimeHours':{ tet: 'Oras extra', en: 'Overtime hrs' }
 * 'attendance.week':         { tet: 'Semana', en: 'Week' }
 * 'attendance.empty':        { tet: 'Seidauk iha rejistru prezensia', en: 'No attendance records' }
 * 'attendance.emptySub':     { tet: 'Prezensia ba fulan ida ne\'e sei mosu iha ne\'e', en: 'Attendance for this month will appear here' }
 */
