/**
 * SyncQueue — offline queue management screen
 * Shows pending batches, sync all button, retry/delete individual batches
 */
import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  RefreshCw,
  Trash2,
  RotateCcw,
  CloudOff,
} from 'lucide-react-native';
import { colors } from '../../lib/colors';
import { useT } from '../../lib/i18n';
import { useSyncStore } from '../../stores/syncStore';
import { CrewSummaryCard } from '../../components/CrewSummaryCard';
import { EmptyState } from '../../components/EmptyState';

export default function SyncQueueScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const errorCount = useSyncStore((s) => s.errorCount);
  const syncing = useSyncStore((s) => s.syncing);
  const pendingBatches = useSyncStore((s) => s.pendingBatches);
  const refreshCounts = useSyncStore((s) => s.refreshCounts);
  const triggerSyncAll = useSyncStore((s) => s.triggerSyncAll);
  const retryBatch = useSyncStore((s) => s.retryBatch);
  const removeBatch = useSyncStore((s) => s.removeBatch);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  const handleDelete = useCallback(
    (batchId: string) => {
      Alert.alert(
        t('crew.deleteBatch'),
        t('crew.deleteBatchConfirm'),
        [
          { text: t('leave.cancel'), style: 'cancel' },
          {
            text: t('crew.delete'),
            style: 'destructive',
            onPress: () => removeBatch(batchId),
          },
        ]
      );
    },
    [t, removeBatch]
  );

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('crew.syncQueue')}</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <CloudOff size={16} color={colors.warning} strokeWidth={2} />
          <Text style={styles.statText}>
            {pendingCount} {t('crew.pending')}
          </Text>
        </View>
        {errorCount > 0 && (
          <View style={styles.stat}>
            <Text style={[styles.statText, { color: colors.error }]}>
              {errorCount} {t('crew.errors')}
            </Text>
          </View>
        )}
      </View>

      {/* Sync All button */}
      {pendingCount > 0 && (
        <View style={styles.syncAllRow}>
          <TouchableOpacity
            style={[styles.syncAllBtn, syncing && styles.syncAllBtnDisabled]}
            onPress={triggerSyncAll}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <RefreshCw size={18} color="#fff" strokeWidth={2} />
            )}
            <Text style={styles.syncAllBtnText}>
              {syncing ? t('crew.syncing') : t('crew.syncAll')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Batch list */}
      <FlatList
        data={pendingBatches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.batchRow}>
            <CrewSummaryCard batch={item} />
            <View style={styles.batchActions}>
              {item.syncStatus === 'error' && (
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => retryBatch(item.id)}
                >
                  <RotateCcw size={14} color={colors.primary} strokeWidth={2} />
                  <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item.id)}
              >
                <Trash2 size={14} color={colors.error} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            {item.syncError && (
              <Text style={styles.errorText}>{item.syncError}</Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            title={t('crew.queueEmpty')}
            subtitle={t('crew.queueEmptySub')}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  statsBar: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.bgSubtle,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  syncAllRow: { padding: 16, paddingBottom: 4 },
  syncAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  syncAllBtnDisabled: { opacity: 0.6 },
  syncAllBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  list: { padding: 16, paddingTop: 12 },
  batchRow: { gap: 8 },
  batchActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primaryBg,
    borderRadius: 8,
  },
  retryBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.errorBg,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
});
