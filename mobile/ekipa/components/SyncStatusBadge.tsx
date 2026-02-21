/**
 * SyncStatusBadge — colored badge for sync status
 * Follows StatusBadge pattern: colored dot + text in rounded pill
 */
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/colors';
import { useT } from '../lib/i18n';
import type { SyncStatus } from '../types/crew';

interface SyncStatusBadgeProps {
  status: SyncStatus;
}

const statusConfig: Record<SyncStatus, { bg: string; text: string; labelKey: string }> = {
  pending: { bg: colors.warningBg, text: colors.warning, labelKey: 'crew.syncStatus.pending' },
  uploading: { bg: colors.infoBg, text: colors.info, labelKey: 'crew.syncStatus.uploading' },
  synced: { bg: colors.successBg, text: colors.success, labelKey: 'crew.syncStatus.synced' },
  error: { bg: colors.errorBg, text: colors.error, labelKey: 'crew.syncStatus.error' },
};

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const t = useT();
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <View style={[styles.dot, { backgroundColor: config.text }]} />
      <Text style={[styles.text, { color: config.text }]}>{t(config.labelKey)}</Text>
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
