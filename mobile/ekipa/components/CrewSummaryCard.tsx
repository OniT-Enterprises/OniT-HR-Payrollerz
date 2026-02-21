/**
 * CrewSummaryCard — batch summary showing date, time, workers, site, photo, sync status
 */
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Users, MapPin, Clock } from 'lucide-react-native';
import { colors } from '../lib/colors';
import { useT } from '../lib/i18n';
import { SyncStatusBadge } from './SyncStatusBadge';
import type { SyncBatch } from '../types/crew';

interface CrewSummaryCardProps {
  batch: SyncBatch;
  onPress?: () => void;
}

function formatDate(dateStr: string, t: (key: string) => string): string {
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d, 10)} ${t(`month.${parseInt(m, 10)}`)} ${y}`;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function CrewSummaryCard({ batch, onPress }: CrewSummaryCardProps) {
  const t = useT();
  const isClockOut = batch.recordType === 'clock_out';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.dateText}>{formatDate(batch.date, t)}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>
              {isClockOut ? t('crew.clockOutLabel') : t('crew.clockInLabel')}
            </Text>
          </View>
        </View>
        <SyncStatusBadge status={batch.syncStatus} />
      </View>

      <View style={styles.details}>
        <View style={styles.detail}>
          <Users size={14} color={colors.textTertiary} strokeWidth={1.8} />
          <Text style={styles.detailText}>
            {batch.workerCount === 1
              ? `${batch.workerCount} ${t('crew.worker')}`
              : `${batch.workerCount} ${t('crew.workers')}`}
          </Text>
        </View>

        <View style={styles.detail}>
          <Clock size={14} color={colors.textTertiary} strokeWidth={1.8} />
          <Text style={styles.detailText}>{formatTime(batch.createdAt)}</Text>
        </View>

        {batch.siteName ? (
          <View style={styles.detail}>
            <MapPin size={14} color={colors.textTertiary} strokeWidth={1.8} />
            <Text style={styles.detailText} numberOfLines={1}>
              {batch.siteName}
            </Text>
          </View>
        ) : null}
      </View>

      {(batch.photoUrl || batch.photoLocalPath) ? (
        <Image
          source={{ uri: batch.photoUrl || batch.photoLocalPath }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  typeBadge: {
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  details: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  thumbnail: {
    width: '100%',
    height: 120,
    borderRadius: 8,
  },
});
