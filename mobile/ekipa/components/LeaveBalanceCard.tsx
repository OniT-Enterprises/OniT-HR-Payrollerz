/**
 * LeaveBalanceCard — Dark premium card with colored left border,
 * large remaining number, progress bar, and clean stat dots.
 */
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/colors';
import type { LeaveBalanceItem } from '../types/leave';

interface LeaveBalanceCardProps {
  label: string;
  balance: LeaveBalanceItem;
  color?: string;
}

export function LeaveBalanceCard({ label, balance, color = colors.primary }: LeaveBalanceCardProps) {
  const progress = balance.entitled > 0
    ? Math.min((balance.used + balance.pending) / balance.entitled, 1)
    : 0;

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.body}>
        {/* Header: label + large remaining */}
        <View style={styles.header}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.remainingWrap}>
            <Text style={[styles.remainingValue, { color }]}>{balance.remaining}</Text>
            <Text style={styles.remainingUnit}>/ {balance.entitled}</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%`, backgroundColor: color },
            ]}
          />
        </View>

        {/* Stat dots */}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: color }]} />
            <Text style={styles.statLabel}>Used</Text>
            <Text style={styles.statValue}>{balance.used}</Text>
          </View>
          {balance.pending > 0 && (
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: colors.warning }]} />
              <Text style={styles.statLabel}>Pending</Text>
              <Text style={[styles.statValue, { color: colors.warning }]}>
                {balance.pending}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  body: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  remainingWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  remainingValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  remainingUnit: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#1A2332',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  stats: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
