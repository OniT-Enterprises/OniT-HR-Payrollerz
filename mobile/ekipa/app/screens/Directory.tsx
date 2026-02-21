/**
 * Ekipa — Employee Directory Screen
 * Premium dark theme with blue (#3B82F6) accent.
 * Search bar + section list grouped by department.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
  Linking,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Search,
  Users,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantStore } from '../../stores/tenantStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { EmptyState } from '../../components/EmptyState';
import type { DirectoryEntry } from '../../types/directory';

interface DirectorySection {
  title: string;
  data: DirectoryEntry[];
}

function getInitials(first: string, last: string): string {
  return `${(first[0] || '').toUpperCase()}${(last[0] || '').toUpperCase()}`;
}

export default function Directory() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId);

  const [employees, setEmployees] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    if (!tenantId) return;
    try {
      const q = query(
        collection(db, `tenants/${tenantId}/employees`),
        where('status', '==', 'active'),
        orderBy('firstName')
      );
      const snap = await getDocs(q);
      const entries: DirectoryEntry[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          phone: data.phone,
          department: data.department || t('directory.noDepartment'),
          position: data.position,
          photoUrl: data.photoUrl,
          status: data.status || 'active',
        };
      });
      setEmployees(entries);
    } catch {
      setEmployees([]);
    }
  }, [tenantId, t]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchEmployees().finally(() => setLoading(false));
    };
    load();
  }, [fetchEmployees]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEmployees();
    setRefreshing(false);
  }, [fetchEmployees]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter(
      (e) =>
        e.firstName.toLowerCase().includes(q) ||
        e.lastName.toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q) ||
        (e.position || '').toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  // Group by department
  const sections: DirectorySection[] = useMemo(() => {
    const deptMap = new Map<string, DirectoryEntry[]>();
    for (const emp of filtered) {
      const dept = emp.department || t('directory.noDepartment');
      if (!deptMap.has(dept)) deptMap.set(dept, []);
      deptMap.get(dept)!.push(emp);
    }
    return Array.from(deptMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }));
  }, [filtered, t]);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const renderItem = ({ item }: { item: DirectoryEntry }) => {
    const isExpanded = expandedId === item.id;
    const initials = getInitials(item.firstName, item.lastName);

    return (
      <View>
        <TouchableOpacity
          style={styles.row}
          onPress={() => toggleExpand(item.id)}
          activeOpacity={0.7}
        >
          {/* Avatar */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          {/* Info */}
          <View style={styles.rowInfo}>
            <Text style={styles.rowName} numberOfLines={1}>
              {item.firstName} {item.lastName}
            </Text>
            <Text style={styles.rowPosition} numberOfLines={1}>
              {item.position || item.department}
            </Text>
          </View>

          {/* Expand icon */}
          {isExpanded ? (
            <ChevronUp size={18} color={colors.textTertiary} strokeWidth={2} />
          ) : (
            <ChevronDown size={18} color={colors.textTertiary} strokeWidth={2} />
          )}
        </TouchableOpacity>

        {/* Expanded details */}
        {isExpanded && (
          <View style={styles.expandedRow}>
            {/* Email */}
            {item.email && (
              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => handleEmail(item.email)}
                activeOpacity={0.7}
              >
                <View style={[styles.contactIcon, { backgroundColor: colors.blueBg }]}>
                  <Mail size={14} color={colors.blue} strokeWidth={2.2} />
                </View>
                <Text style={styles.contactText}>{item.email}</Text>
              </TouchableOpacity>
            )}

            {/* Phone */}
            {item.phone && (
              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => handleCall(item.phone!)}
                activeOpacity={0.7}
              >
                <View style={[styles.contactIcon, { backgroundColor: colors.primaryBg }]}>
                  <Phone size={14} color={colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={styles.contactText}>{item.phone}</Text>
              </TouchableOpacity>
            )}

            {/* Department + Position */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('profile.department')}</Text>
              <Text style={styles.detailValue}>{item.department}</Text>
            </View>
            {item.position && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('profile.position')}</Text>
                <Text style={styles.detailValue}>{item.position}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderSectionHeader = ({ section }: { section: DirectorySection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
      <View style={styles.sectionBadge}>
        <Text style={styles.sectionBadgeText}>{section.data.length}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* ── Blue hero header ───────────────────────────── */}
      <View style={styles.heroHeader}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.heroDecor3} />

        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{t('directory.title')}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.heroContent}>
          <Users size={28} color={colors.white} strokeWidth={1.8} />
          <Text style={styles.heroCount}>
            {employees.length} {t('directory.employees')}
          </Text>
        </View>
      </View>

      {/* ── Search bar ─────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textTertiary} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('directory.searchPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            autoCorrect={false}
          />
        </View>
      </View>

      {/* ── Section list ───────────────────────────────── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.blue} />
        </View>
      ) : sections.length === 0 ? (
        <EmptyState
          title={searchQuery ? t('directory.noResults') : t('directory.empty')}
          subtitle={searchQuery ? t('directory.noResultsSub') : undefined}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // ── Blue hero header ────────────────────────────────
  heroHeader: {
    backgroundColor: colors.blue,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  heroDecor1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroDecor2: {
    position: 'absolute',
    bottom: -24,
    left: 16,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroDecor3: {
    position: 'absolute',
    top: 30,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleWhite: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.3,
  },
  heroContent: {
    alignItems: 'center',
    paddingTop: 12,
    gap: 6,
  },
  heroCount: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },

  // ── Search bar ──────────────────────────────────────
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.bg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },

  // ── Loading ─────────────────────────────────────────
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Section list ────────────────────────────────────
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBadge: {
    backgroundColor: colors.blueBg,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.blue,
  },

  // ── Employee row ────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.blue,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  rowPosition: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  separator: {
    height: 8,
  },

  // ── Expanded row ────────────────────────────────────
  expandedRow: {
    backgroundColor: colors.bgCard,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    paddingHorizontal: 14,
    paddingBottom: 14,
    marginTop: -14,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.border,
    gap: 10,
    paddingTop: 18,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  contactIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.blue,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
