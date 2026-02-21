/**
 * CrewHistory — past attendance history screen
 * Monthly-grouped list of past batches with expandable details
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors } from '../../lib/colors';
import { useI18nStore, useT } from '../../lib/i18n';
import { useTenantStore } from '../../stores/tenantStore';
import { getAllBatchesByMonth } from '../../lib/db';
import { CrewSummaryCard } from '../../components/CrewSummaryCard';
import { EmptyState } from '../../components/EmptyState';
import type { SyncBatch } from '../../types/crew';

interface MonthSection {
  title: string;
  yearMonth: string;
  data: SyncBatch[];
}

function getRecentMonths(count: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(ym);
  }
  return months;
}

function formatMonthTitle(yearMonth: string, t: (key: string) => string): string {
  const [y, m] = yearMonth.split('-');
  return `${t(`month.${parseInt(m, 10)}`)} ${y}`;
}

export default function CrewHistoryScreen() {
  const t = useT();
  const language = useI18nStore((s) => s.language);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId)!;
  const [sections, setSections] = useState<MonthSection[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    const build = () => {
      const months = getRecentMonths(6);
      const result: MonthSection[] = [];

      for (const ym of months) {
        const batches = getAllBatchesByMonth(tenantId, ym);
        if (batches.length > 0) {
          result.push({
            title: formatMonthTitle(ym, t),
            yearMonth: ym,
            data: batches,
          });
        }
      }

      setSections(result);
      // Auto-expand current month
      if (months.length > 0) {
        setExpandedMonths(new Set([months[0]]));
      }
    };
    build();
  }, [tenantId, language, t]);

  const toggleMonth = (ym: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(ym)) next.delete(ym);
      else next.add(ym);
      return next;
    });
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('crew.history')}</Text>
        <View style={styles.backBtn} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleMonth(section.yearMonth)}
          >
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionRight}>
              <Text style={styles.sectionCount}>
                {section.data.length}{' '}
                {section.data.length === 1 ? t('crew.batch') : t('crew.batches')}
              </Text>
              {expandedMonths.has(section.yearMonth) ? (
                <ChevronUp size={18} color={colors.textTertiary} strokeWidth={2} />
              ) : (
                <ChevronDown size={18} color={colors.textTertiary} strokeWidth={2} />
              )}
            </View>
          </TouchableOpacity>
        )}
        renderItem={({ item, section }) => {
          if (!expandedMonths.has(section.yearMonth)) return null;
          return (
            <View style={styles.batchItem}>
              <CrewSummaryCard batch={item} />
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title={t('crew.noHistory')}
            subtitle={t('crew.noHistorySub')}
          />
        }
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
  list: { padding: 16, gap: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionCount: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  batchItem: {
    marginBottom: 10,
  },
});
