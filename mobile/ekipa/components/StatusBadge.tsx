/**
 * StatusBadge — colored badge for leave status, attendance status, etc.
 */
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/colors';

type StatusType = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'present' | 'late' | 'absent';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
}

const statusColors: Record<StatusType, { bg: string; text: string }> = {
  pending: { bg: colors.pendingBg, text: colors.pending },
  approved: { bg: colors.approvedBg, text: colors.approved },
  rejected: { bg: colors.rejectedBg, text: colors.rejected },
  cancelled: { bg: colors.cancelledBg, text: colors.cancelled },
  present: { bg: colors.successBg, text: colors.success },
  late: { bg: colors.warningBg, text: colors.warning },
  absent: { bg: colors.errorBg, text: colors.error },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const c = statusColors[status] || statusColors.pending;

  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <View style={[styles.dot, { backgroundColor: c.text }]} />
      <Text style={[styles.text, { color: c.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
