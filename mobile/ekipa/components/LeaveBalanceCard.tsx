/**
 * LeaveBalanceCard — shows entitled/used/remaining with progress bar and accent
 */
import { View, Text, StyleSheet, Platform } from 'react-native';
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
    <View style={styles.card}>
      {/* Colored accent bar */}
      <View style={[styles.accent, { backgroundColor: color }]} />

      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.remainingWrap}>
            <Text style={[styles.remainingValue, { color }]}>{balance.remaining}</Text>
            <Text style={styles.remainingUnit}> / {balance.entitled}</Text>
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

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: color }]} />
            <Text style={styles.stat}>Used: {balance.used}</Text>
          </View>
          {balance.pending > 0 && (
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.stat, { color: colors.warning }]}>
                Pending: {balance.pending}
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
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  accent: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  remainingWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  remainingValue: {
    fontWeight: '800',
    fontSize: 18,
  },
  remainingUnit: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '500',
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.bgSubtle,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stat: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
