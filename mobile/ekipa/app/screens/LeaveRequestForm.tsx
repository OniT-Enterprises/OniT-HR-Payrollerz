/**
 * Ekipa — Leave Request Form
 * Type picker, date range, reason, submit
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
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useTenantStore } from '../../stores/tenantStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { useLeaveStore } from '../../stores/leaveStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
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
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const employee = useEmployeeStore((s) => s.employee);
  const { createRequest, submitting } = useLeaveStore();

  const [leaveType, setLeaveType] = useState<LeaveType>('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = async () => {
    if (!tenantId || !employeeId || !employee) return;

    if (!startDate || !endDate) {
      Alert.alert(t('common.error'), 'Please enter start and end dates (YYYY-MM-DD)');
      return;
    }

    if (!reason.trim()) {
      Alert.alert(t('common.error'), 'Please enter a reason');
      return;
    }

    const duration = calculateWorkingDays(startDate, endDate);
    if (duration <= 0) {
      Alert.alert(t('common.error'), 'End date must be after start date');
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('leave.request')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Leave type */}
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

        {/* Dates */}
        <Text style={styles.label}>{t('leave.startDate')}</Text>
        <TextInput
          style={styles.input}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
          keyboardType={Platform.OS === 'ios' ? 'default' : 'default'}
        />

        <Text style={styles.label}>{t('leave.endDate')}</Text>
        <TextInput
          style={styles.input}
          value={endDate}
          onChangeText={setEndDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
        />

        {startDate && endDate && (
          <Text style={styles.durationPreview}>
            {calculateWorkingDays(startDate, endDate)} {t('leave.days')}
          </Text>
        )}

        {/* Reason */}
        <Text style={styles.label}>{t('leave.reason')}</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={reason}
          onChangeText={setReason}
          placeholder="..."
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>{t('leave.submit')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 0.5,
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

  // Form
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bgCard,
  },
  textarea: {
    height: 100,
    paddingTop: 14,
  },

  // Type chips
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
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  typeChipTextActive: {
    color: colors.white,
  },

  // Duration preview
  durationPreview: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 10,
    backgroundColor: colors.primaryBg,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },

  // Submit
  submitBtn: {
    marginTop: 32,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.primary,
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
  btnDisabled: {
    opacity: 0.6,
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
