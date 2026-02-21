/**
 * Ekipa — Holiday Calendar Screen
 * Premium dark theme with violet (#8B5CF6) module accent.
 * TL public holidays + remaining count in hero header.
 */
import { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { ArrowLeft, Calendar, CalendarDays } from 'lucide-react-native';
import { useI18nStore, useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { getHolidays } from '../../lib/holidays';
import type { Holiday } from '../../lib/holidays';

/** Format YYYY-MM-DD to readable date (e.g. "Jan 1" or "1 Jan") */
const LOCALE_MAP: Record<string, string> = { tet: 'pt-PT', en: 'en-US', pt: 'pt-PT', id: 'id-ID' };
function formatHolidayDate(isoDate: string, language: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  try {
    return date.toLocaleDateString(LOCALE_MAP[language] || 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return `${d}/${m}`;
  }
}

/** Get day of week label */
function getDayOfWeek(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Check if a holiday date is in the past */
function isPastDate(isoDate: string): boolean {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return isoDate < todayStr;
}

/** Check if this is the next upcoming holiday */
function isNextUpcoming(isoDate: string, holidays: Holiday[]): boolean {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const upcoming = holidays.find((h) => h.date >= todayStr);
  return upcoming?.date === isoDate;
}

export default function HolidayCalendar() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const language = useI18nStore((s) => s.language);

  const year = new Date().getFullYear();
  const holidays = useMemo(() => getHolidays(year), [year]);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const remainingCount = useMemo(
    () => holidays.filter((h) => h.date >= todayStr).length,
    [holidays, todayStr]
  );

  return (
    <View style={styles.container}>
      {/* ── Violet hero header ─────────────────────────── */}
      <View style={styles.heroHeader}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.heroDecor3} />

        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{t('holidays.title')}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.heroContent}>
          <Text style={styles.heroYear}>{year}</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroNumber}>{remainingCount}</Text>
            <Text style={styles.heroUnit}>{t('holidays.remaining')}</Text>
          </View>
          <Text style={styles.heroSubtext}>
            {holidays.length} {t('holidays.totalHolidays')}
          </Text>
        </View>
      </View>

      {/* ── Holiday list ───────────────────────────────── */}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sectionHeader}>
          <View style={styles.iconBadge}>
            <CalendarDays size={14} color={colors.violet} strokeWidth={2.5} />
          </View>
          <Text style={styles.sectionTitle}>{t('holidays.allHolidays')}</Text>
        </View>

        <View style={styles.list}>
          {holidays.map((holiday) => {
            const past = isPastDate(holiday.date);
            const isNext = isNextUpcoming(holiday.date, holidays);
            const dayIndex = getDayOfWeek(holiday.date);
            const dayLabel = t(`weekday.${dayIndex}`);
            const formattedDate = formatHolidayDate(holiday.date, language);
            const holidayName = language === 'tet' ? holiday.nameTetun : holiday.name;

            return (
              <View
                key={holiday.date}
                style={[
                  styles.holidayCard,
                  past && styles.holidayCardPast,
                  isNext && styles.holidayCardNext,
                ]}
              >
                {/* Date column */}
                <View style={[styles.dateCol, isNext && styles.dateColNext]}>
                  <Calendar
                    size={16}
                    color={past ? colors.textTertiary : isNext ? colors.white : colors.violet}
                    strokeWidth={2}
                  />
                  <Text
                    style={[
                      styles.dateText,
                      past && styles.textDimmed,
                      isNext && styles.dateTextNext,
                    ]}
                  >
                    {formattedDate}
                  </Text>
                </View>

                {/* Name + day of week */}
                <View style={styles.infoCol}>
                  <Text
                    style={[
                      styles.holidayName,
                      past && styles.textDimmed,
                    ]}
                    numberOfLines={2}
                  >
                    {holidayName}
                  </Text>
                  <Text
                    style={[
                      styles.dayOfWeek,
                      past && styles.textDimmedLight,
                    ]}
                  >
                    {dayLabel}
                  </Text>
                </View>

                {/* Next badge */}
                {isNext && (
                  <View style={styles.nextBadge}>
                    <Text style={styles.nextBadgeText}>{t('holidays.next')}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // ── Violet hero header ──────────────────────────────
  heroHeader: {
    backgroundColor: colors.violet,
    paddingBottom: 28,
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
  heroYear: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 4,
  },
  heroNumber: {
    fontSize: 52,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -2,
  },
  heroUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  heroSubtext: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
  },

  // ── Content ─────────────────────────────────────────
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    marginTop: 4,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.violetBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Holiday list ────────────────────────────────────
  list: {
    gap: 10,
  },
  holidayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  holidayCardPast: {
    opacity: 0.5,
  },
  holidayCardNext: {
    borderColor: colors.violet,
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: colors.violet,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  // ── Date column ─────────────────────────────────────
  dateCol: {
    width: 72,
    alignItems: 'center',
    gap: 4,
    paddingRight: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  dateColNext: {
    borderRightColor: 'rgba(139, 92, 246, 0.3)',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  dateTextNext: {
    color: colors.violet,
  },

  // ── Info column ─────────────────────────────────────
  infoCol: {
    flex: 1,
    marginLeft: 14,
    gap: 2,
  },
  holidayName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
  },
  dayOfWeek: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
  },

  // ── Dimmed text for past holidays ───────────────────
  textDimmed: {
    color: colors.textTertiary,
  },
  textDimmedLight: {
    color: colors.textTertiary,
    opacity: 0.7,
  },

  // ── Next badge ──────────────────────────────────────
  nextBadge: {
    backgroundColor: colors.violetBg,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  nextBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.violet,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
