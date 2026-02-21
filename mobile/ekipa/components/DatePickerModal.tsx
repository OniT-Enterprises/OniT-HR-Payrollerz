import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { colors } from '../lib/colors';
import { toISODateLocal } from '../lib/dateInput';
import { useT } from '../lib/i18n';

interface DatePickerModalProps {
  visible: boolean;
  value?: string | null;
  title?: string;
  accentColor?: string;
  minDate?: string;
  maxDate?: string;
  onClose: () => void;
  onSelect: (isoDate: string) => void;
}

function parseISODate(iso?: string | null): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildCalendarDays(displayMonth: Date): Array<Date | null> {
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<Date | null> = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DatePickerModal({
  visible,
  value,
  title,
  accentColor = colors.primary,
  minDate,
  maxDate,
  onClose,
  onSelect,
}: DatePickerModalProps) {
  const t = useT();

  const selectedDate = useMemo(() => parseISODate(value), [value]);
  const [displayMonth, setDisplayMonth] = useState(() => {
    const base = selectedDate || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const minDateObj = useMemo(() => parseISODate(minDate), [minDate]);
  const maxDateObj = useMemo(() => parseISODate(maxDate), [maxDate]);
  const today = atMidnight(new Date());

  useEffect(() => {
    if (!visible) return;
    // Use a microtask to avoid synchronous setState warning
    const id = requestAnimationFrame(() => {
      const base = selectedDate || new Date();
      setDisplayMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    });
    return () => cancelAnimationFrame(id);
  }, [visible, selectedDate]);

  const weekdayLabels = [
    t('weekday.0'),
    t('weekday.1'),
    t('weekday.2'),
    t('weekday.3'),
    t('weekday.4'),
    t('weekday.5'),
    t('weekday.6'),
  ];
  const monthLabel = `${t(`month.${displayMonth.getMonth() + 1}`)} ${displayMonth.getFullYear()}`;
  const days = buildCalendarDays(displayMonth);

  const isDateDisabled = (date: Date): boolean => {
    if (minDateObj && atMidnight(date).getTime() < atMidnight(minDateObj).getTime()) return true;
    if (maxDateObj && atMidnight(date).getTime() > atMidnight(maxDateObj).getTime()) return true;
    return false;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title || t('common.selectDate')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
              <X size={18} color={colors.textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={styles.monthNav}>
            <TouchableOpacity
              style={styles.monthNavBtn}
              onPress={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}
              activeOpacity={0.8}
            >
              <ChevronLeft size={18} color={colors.text} strokeWidth={2.4} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity
              style={styles.monthNavBtn}
              onPress={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}
              activeOpacity={0.8}
            >
              <ChevronRight size={18} color={colors.text} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {weekdayLabels.map((label) => (
              <Text key={label} style={styles.weekdayText}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {days.map((day, index) => {
              if (!day) {
                return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
              }

              const disabled = isDateDisabled(day);
              const selected = !!selectedDate && sameDay(day, selectedDate);
              const todayCell = sameDay(day, today);

              return (
                <TouchableOpacity
                  key={toISODateLocal(day)}
                  style={[
                    styles.dayCell,
                    selected && { backgroundColor: accentColor },
                    todayCell && !selected && styles.todayCell,
                    disabled && styles.dayCellDisabled,
                  ]}
                  activeOpacity={0.8}
                  disabled={disabled}
                  onPress={() => onSelect(toISODateLocal(day))}
                >
                  <Text
                    style={[
                      styles.dayText,
                      selected && styles.dayTextSelected,
                      disabled && styles.dayTextDisabled,
                      todayCell && !selected && { color: accentColor },
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.footerBtn}
              onPress={() => onSelect(toISODateLocal(today))}
              activeOpacity={0.8}
            >
              <Text style={[styles.footerBtnText, { color: accentColor }]}>{t('common.today')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.footerBtnText}>{t('leave.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSubtle,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSubtle,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
  },
  todayCell: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dayCellDisabled: {
    opacity: 0.35,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  dayTextSelected: {
    color: colors.white,
    fontWeight: '800',
  },
  dayTextDisabled: {
    color: colors.textTertiary,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  footerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.bgSubtle,
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
