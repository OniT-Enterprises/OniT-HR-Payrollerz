/**
 * Ekipa — Leave Request Form
 * Premium dark theme with violet (#8B5CF6) module accent.
 * Type picker, date range, reason, submit.
 */
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Calendar, Check } from 'lucide-react-native';
import { useTenantStore } from '../../stores/tenantStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { useLeaveStore } from '../../stores/leaveStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { addDays, isValidISODate, toISODateLocal } from '../../lib/dateInput';
import { DatePickerModal } from '../../components/DatePickerModal';
import type { LeaveType } from '../../types/leave';

const LEAVE_TYPES: { id: LeaveType; labelKey: string }[] = [
  { id: 'annual', labelKey: 'leave.annual' },
  { id: 'sick', labelKey: 'leave.sick' },
  { id: 'maternity', labelKey: 'leave.maternity' },
  { id: 'paternity', labelKey: 'leave.paternity' },
  { id: 'bereavement', labelKey: 'leave.bereavement' },
  { id: 'marriage', labelKey: 'leave.marriage' },
  { id: 'unpaid', labelKey: 'leave.unpaid' },
];

function calculateWorkingDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  let count = 0;
  const current = new Date(s);
  while (current <= e) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export default function LeaveRequestForm() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const employee = useEmployeeStore((s) => s.employee);
  const { createRequest, submitting } = useLeaveStore();

  const [leaveType, setLeaveType] = useState<LeaveType>('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [datePickerField, setDatePickerField] = useState<'start' | 'end' | null>(null);
  const startDateValid = isValidISODate(startDate);
  const endDateValid = isValidISODate(endDate);
  const hasBothDates = !!startDate && !!endDate;
  const duration =
    hasBothDates && startDateValid && endDateValid ? calculateWorkingDays(startDate, endDate) : 0;
  const hasRangeError = hasBothDates && startDateValid && endDateValid && duration <= 0;
  const canSubmit =
    !!tenantId &&
    !!employeeId &&
    !!employee &&
    !!reason.trim() &&
    startDateValid &&
    endDateValid &&
    duration > 0 &&
    !submitting;

  const applyQuickRange = (days: number) => {
    const start = new Date();
    setStartDate(toISODateLocal(start));
    setEndDate(toISODateLocal(addDays(start, days - 1)));
  };

  const handleSelectDate = (isoDate: string) => {
    if (datePickerField === 'start') {
      setStartDate(isoDate);
      if (endDateValid && endDate < isoDate) {
        setEndDate(isoDate);
      }
    } else if (datePickerField === 'end') {
      setEndDate(isoDate);
    }
    setDatePickerField(null);
  };

  const handleSubmit = async () => {
    if (!tenantId || !employeeId || !employee) return;

    if (!startDate || !endDate) {
      Alert.alert(t('common.error'), t('leave.alert.enterDates'));
      return;
    }

    if (!startDateValid || !endDateValid) {
      Alert.alert(t('common.error'), t('leave.alert.invalidDateFormat'));
      return;
    }

    if (!reason.trim()) {
      Alert.alert(t('common.error'), t('leave.alert.enterReason'));
      return;
    }

    if (duration <= 0) {
      Alert.alert(t('common.error'), t('leave.alert.invalidDateRange'));
      return;
    }

    const typeLabel = t(LEAVE_TYPES.find((lt) => lt.id === leaveType)?.labelKey || 'leave.annual');

    await createRequest({
      tenantId,
      employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      department: employee.department || '',
      departmentId: employee.departmentId || '',
      leaveType,
      leaveTypeLabel: typeLabel,
      startDate,
      endDate,
      duration,
      reason: reason.trim(),
    });

    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header — dark card bg with white title */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('leave.request')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Leave type chips */}
        <Text style={styles.label}>{t('leave.type')}</Text>
        <View style={styles.typeGrid}>
          {LEAVE_TYPES.map((lt) => (
            <TouchableOpacity
              key={lt.id}
              style={[
                styles.typeChip,
                leaveType === lt.id && styles.typeChipActive,
              ]}
              onPress={() => setLeaveType(lt.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.typeChipText,
                  leaveType === lt.id && styles.typeChipTextActive,
                ]}
              >
                {t(lt.labelKey)}
              </Text>
              {leaveType === lt.id && (
                <Check size={14} color={colors.white} strokeWidth={3} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Dates — dark inputs */}
        <Text style={styles.label}>{t('leave.startDate')}</Text>
        <TouchableOpacity
          style={styles.dateField}
          onPress={() => setDatePickerField('start')}
          activeOpacity={0.8}
        >
          <Calendar size={16} color={colors.violet} strokeWidth={2.2} />
          <Text style={startDate ? styles.dateFieldValue : styles.dateFieldPlaceholder}>
            {startDate || t('common.selectDate')}
          </Text>
        </TouchableOpacity>
        {startDate.length > 0 && !startDateValid && (
          <Text style={styles.errorHint}>{t('leave.alert.invalidDateFormat')}</Text>
        )}

        <Text style={styles.label}>{t('leave.endDate')}</Text>
        <TouchableOpacity
          style={styles.dateField}
          onPress={() => setDatePickerField('end')}
          activeOpacity={0.8}
        >
          <Calendar size={16} color={colors.violet} strokeWidth={2.2} />
          <Text style={endDate ? styles.dateFieldValue : styles.dateFieldPlaceholder}>
            {endDate || t('common.selectDate')}
          </Text>
        </TouchableOpacity>
        {endDate.length > 0 && !endDateValid && (
          <Text style={styles.errorHint}>{t('leave.alert.invalidDateFormat')}</Text>
        )}

        <Text style={styles.quickRangeLabel}>{t('leave.quickRange')}</Text>
        <View style={styles.quickRangeRow}>
          <TouchableOpacity
            style={styles.quickRangeChip}
            onPress={() => applyQuickRange(1)}
            activeOpacity={0.8}
          >
            <Text style={styles.quickRangeChipText}>{t('leave.quickToday')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickRangeChip}
            onPress={() => applyQuickRange(3)}
            activeOpacity={0.8}
          >
            <Text style={styles.quickRangeChipText}>{t('leave.quickThreeDays')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickRangeChip}
            onPress={() => applyQuickRange(7)}
            activeOpacity={0.8}
          >
            <Text style={styles.quickRangeChipText}>{t('leave.quickWeek')}</Text>
          </TouchableOpacity>
        </View>

        {hasRangeError && (
          <Text style={styles.errorHint}>{t('leave.alert.invalidDateRange')}</Text>
        )}

        {hasBothDates && !hasRangeError && (
          <Text style={styles.durationPreview}>
            {duration} {t('leave.days')}
          </Text>
        )}

        {/* Reason — dark textarea */}
        <Text style={styles.label}>{t('leave.reason')}</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={reason}
          onChangeText={setReason}
          placeholder={t('leave.reasonPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Submit — violet solid with glow */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>{t('leave.submit')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <DatePickerModal
        visible={datePickerField !== null}
        title={t('common.selectDate')}
        value={datePickerField === 'start' ? startDate : endDate}
        minDate={datePickerField === 'end' && startDateValid ? startDate : undefined}
        maxDate={datePickerField === 'start' && endDateValid ? endDate : undefined}
        accentColor={colors.violet}
        onClose={() => setDatePickerField(null)}
        onSelect={handleSelectDate}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // ── Header — dark card background ─────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.bgCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // ── Form labels ───────────────────────────────────
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    marginBottom: 8,
    marginTop: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Dark inputs ───────────────────────────────────
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.bg,
  },
  dateFieldPlaceholder: {
    fontSize: 15,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  dateFieldValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  errorHint: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '500',
    marginTop: 6,
  },
  quickRangeLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  quickRangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickRangeChip: {
    backgroundColor: colors.violetBg,
    borderColor: 'rgba(139, 92, 246, 0.28)',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickRangeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.violet,
  },
  textarea: {
    height: 100,
    paddingTop: 14,
  },

  // ── Type chips — dark cards, active = violet solid ─
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  typeChipActive: {
    backgroundColor: colors.violet,
    borderColor: colors.violet,
    ...Platform.select({
      ios: {
        shadowColor: colors.violet,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeChipTextActive: {
    color: colors.white,
  },

  // ── Duration preview ──────────────────────────────
  durationPreview: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.violet,
    marginTop: 10,
    backgroundColor: colors.violetBg,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },

  // ── Submit — violet solid with subtle glow ────────
  submitBtn: {
    marginTop: 32,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.violet,
    ...Platform.select({
      ios: {
        shadowColor: colors.violet,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  btnDisabled: {
    opacity: 0.5,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});
