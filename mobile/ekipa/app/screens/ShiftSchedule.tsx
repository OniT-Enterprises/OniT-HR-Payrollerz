/**
 * Ekipa — Shift Schedule Screen
 * Premium dark theme with orange (#F97316) module accent.
 * Calendar week strip and daily shift list.
 */
import { useState, useEffect, useMemo } from 'react';
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
  CalendarDays,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Sunset,
} from 'lucide-react-native';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantStore } from '../../stores/tenantStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import type { Shift } from '../../types/shift';

const ACCENT = colors.orange;
const ACCENT_BG = colors.orangeBg;

function getWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((day + 6) % 7));
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatWeekRange(dates: Date[]): string {
  if (dates.length < 7) return '';
  const start = dates[0];
  const end = dates[6];
  const sMonth = start.toLocaleString('en', { month: 'short' });
  const eMonth = end.toLocaleString('en', { month: 'short' });
  if (sMonth === eMonth) {
    return `${start.getDate()} - ${end.getDate()} ${sMonth}`;
  }
  return `${start.getDate()} ${sMonth} - ${end.getDate()} ${eMonth}`;
}

const WEEKDAY_KEYS = ['weekday.1', 'weekday.2', 'weekday.3', 'weekday.4', 'weekday.5', 'weekday.6', 'weekday.0'];

const SHIFT_TYPE_CONFIG: Record<string, { color: string; bg: string; icon: typeof Sun }> = {
  morning: { color: colors.warning, bg: colors.warningBg, icon: Sun },
  afternoon: { color: colors.blue, bg: colors.blueBg, icon: Sunset },
  night: { color: colors.violet, bg: colors.violetBg, icon: Moon },
};

function getShiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60; // overnight
  return Math.round((diff / 60) * 10) / 10;
}

export default function ShiftSchedule() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const baseDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);
  const weekRange = useMemo(() => formatWeekRange(weekDates), [weekDates]);

  // Fetch shifts for the visible week
  useEffect(() => {
    if (!tenantId || !employeeId || weekDates.length < 7) return;

    const fetchShifts = async () => {
      setLoading(true);
      try {
        const startStr = toISODate(weekDates[0]);
        const endStr = toISODate(weekDates[6]);
        const q = query(
          collection(db, `tenants/${tenantId}/shifts`),
          where('employeeId', '==', employeeId),
          where('date', '>=', startStr),
          where('date', '<=', endStr),
          orderBy('date', 'asc')
        );
        const snap = await getDocs(q);
        const items: Shift[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            tenantId: data.tenantId || tenantId,
            employeeId: data.employeeId || employeeId,
            employeeName: data.employeeName || '',
            date: data.date,
            startTime: data.startTime || '00:00',
            endTime: data.endTime || '00:00',
            location: data.location,
            department: data.department,
            shiftType: data.shiftType || 'morning',
            status: data.status || 'published',
            notes: data.notes,
          };
        });
        setShifts(items);
      } catch {
        setShifts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchShifts();
  }, [tenantId, employeeId, weekDates]);

  const selectedShifts = useMemo(
    () => shifts.filter((s) => s.date === selectedDate),
    [shifts, selectedDate]
  );

  const weeklyTotalHours = useMemo(() => {
    let total = 0;
    for (const s of shifts) {
      total += getShiftHours(s.startTime, s.endTime);
    }
    return total;
  }, [shifts]);

  const isToday = (d: Date): boolean => toISODate(d) === toISODate(new Date());

  return (
    <View style={styles.container}>
      {/* Orange hero header */}
      <View style={styles.heroHeader}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.heroDecor3} />
        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{t('shifts.title')}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.heroContent}>
          <Text style={styles.heroLabel}>{weekRange}</Text>
        </View>
      </View>

      {/* Week strip with navigation */}
      <View style={styles.weekNav}>
        <TouchableOpacity
          onPress={() => setWeekOffset((w) => w - 1)}
          style={styles.weekNavBtn}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStrip}>
          {weekDates.map((d, i) => {
            const dateStr = toISODate(d);
            const isSelected = dateStr === selectedDate;
            const today = isToday(d);
            const hasShift = shifts.some((s) => s.date === dateStr);

            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  today && !isSelected && styles.dayCellToday,
                ]}
                onPress={() => setSelectedDate(dateStr)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>
                  {t(WEEKDAY_KEYS[i])}
                </Text>
                <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>
                  {d.getDate()}
                </Text>
                {hasShift && <View style={[styles.dayDot, isSelected && styles.dayDotSelected]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          onPress={() => setWeekOffset((w) => w + 1)}
          style={styles.weekNavBtn}
          activeOpacity={0.7}
        >
          <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Shift list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={selectedShifts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const cfg = SHIFT_TYPE_CONFIG[item.shiftType || 'morning'] || SHIFT_TYPE_CONFIG.morning;
            const ShiftIcon = cfg.icon;
            const hours = getShiftHours(item.startTime, item.endTime);

            return (
              <Card style={styles.shiftCard}>
                <View style={styles.shiftHeader}>
                  <View style={[styles.shiftTypeBadge, { backgroundColor: cfg.bg }]}>
                    <ShiftIcon size={14} color={cfg.color} strokeWidth={2} />
                    <Text style={[styles.shiftTypeText, { color: cfg.color }]}>
                      {t(`shifts.${item.shiftType || 'morning'}`)}
                    </Text>
                  </View>
                  <Text style={styles.shiftHours}>{hours}h</Text>
                </View>

                <View style={styles.shiftTimeRow}>
                  <Clock size={16} color={ACCENT} strokeWidth={2} />
                  <Text style={styles.shiftTimeText}>
                    {item.startTime} \u2192 {item.endTime}
                  </Text>
                </View>

                {item.location && (
                  <View style={styles.shiftLocationRow}>
                    <MapPin size={16} color={colors.textTertiary} strokeWidth={2} />
                    <Text style={styles.shiftLocationText}>{item.location}</Text>
                  </View>
                )}

                {item.notes && (
                  <Text style={styles.shiftNotes}>{item.notes}</Text>
                )}
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              title={t('shifts.noShifts')}
              subtitle={t('shifts.noShiftsSub')}
            />
          }
          ListFooterComponent={
            shifts.length > 0 ? (
              <View style={styles.weeklySummary}>
                <CalendarDays size={16} color={ACCENT} strokeWidth={2} />
                <Text style={styles.weeklySummaryText}>
                  {t('shifts.weeklyTotal')}: {weeklyTotalHours.toFixed(1)}h
                </Text>
              </View>
            ) : null
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

  // -- Orange hero header --
  heroHeader: {
    backgroundColor: ACCENT,
    paddingBottom: 24,
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
    paddingTop: 8,
  },
  heroLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },

  // -- Week strip --
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: 12,
  },
  weekNavBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStrip: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 4,
  },
  dayCell: {
    width: 42,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  dayCellSelected: {
    backgroundColor: ACCENT,
  },
  dayCellToday: {
    backgroundColor: ACCENT_BG,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  dayLabelSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  dayNumberSelected: {
    color: colors.white,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: ACCENT,
  },
  dayDotSelected: {
    backgroundColor: colors.white,
  },

  // -- Shift cards --
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftCard: {
    gap: 12,
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  shiftTypeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  shiftHours: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  shiftTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shiftTimeText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  shiftLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shiftLocationText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  shiftNotes: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textTertiary,
    fontStyle: 'italic',
    lineHeight: 19,
  },

  // -- Weekly summary --
  weeklySummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT_BG,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: `${ACCENT}30`,
  },
  weeklySummaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: ACCENT,
  },
});

/*
 * i18n keys to add to lib/i18n.ts:
 *
 * 'shifts.title':        { tet: 'Oráriu Servisu', en: 'My Schedule' }
 * 'shifts.morning':      { tet: 'Dadeer', en: 'Morning' }
 * 'shifts.afternoon':    { tet: 'Lorokraik', en: 'Afternoon' }
 * 'shifts.night':        { tet: 'Kalan', en: 'Night' }
 * 'shifts.noShifts':     { tet: 'La iha turnu ba loron ida ne\'e', en: 'No shifts scheduled' }
 * 'shifts.noShiftsSub':  { tet: 'Hili loron seluk atu haree turnu', en: 'Select another day to see shifts' }
 * 'shifts.weeklyTotal':  { tet: 'Total semana', en: 'Weekly total' }
 */
