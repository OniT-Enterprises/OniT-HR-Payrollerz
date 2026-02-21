/**
 * Ekipa — Announcements Screen
 * Premium dark theme with teal (#0D9488) accent.
 * Company announcements feed with pinned items and read tracking.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Megaphone,
  Pin,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react-native';
import { useTenantStore } from '../../stores/tenantStore';
import { useAuthStore } from '../../stores/authStore';
import { useAnnouncementStore } from '../../stores/announcementStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { EmptyState } from '../../components/EmptyState';
import type { Announcement } from '../../types/announcement';

const TEAL = '#0D9488';
const TEAL_BG = 'rgba(13, 148, 136, 0.10)';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export default function Announcements() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId);
  const user = useAuthStore((s) => s.user);
  const announcements = useAnnouncementStore((s) => s.announcements);
  const loading = useAnnouncementStore((s) => s.loading);
  const fetchAnnouncements = useAnnouncementStore((s) => s.fetchAnnouncements);
  const markAsRead = useAnnouncementStore((s) => s.markAsRead);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (tenantId) {
      fetchAnnouncements(tenantId);
    }
  }, [tenantId, fetchAnnouncements]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Mark as read when expanded
        if (tenantId && user) {
          markAsRead(tenantId, id, user.uid);
        }
      }
      return next;
    });
  }, [tenantId, user, markAsRead]);

  const renderItem = useCallback(({ item }: { item: Announcement }) => {
    const isExpanded = expandedIds.has(item.id);
    const isRead = user ? !!item.readBy?.[user.uid] : false;
    const isPinned = item.pinned;

    return (
      <TouchableOpacity
        style={[
          styles.announcementCard,
          isPinned && styles.announcementCardPinned,
          !isRead && styles.announcementCardUnread,
        ]}
        onPress={() => toggleExpand(item.id)}
        activeOpacity={0.8}
      >
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            {isPinned && (
              <View style={styles.pinBadge}>
                <Pin size={12} color={TEAL} strokeWidth={2.5} />
              </View>
            )}
            {!isRead && <View style={styles.unreadDot} />}
            <Text style={styles.cardTitle} numberOfLines={isExpanded ? undefined : 2}>
              {item.title}
            </Text>
          </View>
          <View style={styles.expandIcon}>
            {isExpanded ? (
              <ChevronUp size={18} color={colors.textTertiary} strokeWidth={2} />
            ) : (
              <ChevronDown size={18} color={colors.textTertiary} strokeWidth={2} />
            )}
          </View>
        </View>

        {/* Body */}
        <Text
          style={styles.cardBody}
          numberOfLines={isExpanded ? undefined : 3}
        >
          {item.body}
        </Text>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.postedBy}>
            <Text style={styles.postedByText}>
              {item.createdByName || t('announcements.hrTeam')}
            </Text>
            <Text style={styles.postedDate}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
          {isRead && (
            <View style={styles.readBadge}>
              <Eye size={12} color={colors.textTertiary} strokeWidth={2} />
              <Text style={styles.readText}>{t('announcements.read')}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [expandedIds, user, toggleExpand, t]);

  return (
    <View style={styles.container}>
      {/* Teal hero header with decorative circles */}
      <View style={styles.heroHeader}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.heroDecor3} />
        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{t('announcements.title')}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.heroContent}>
          <Megaphone size={28} color="rgba(255,255,255,0.8)" strokeWidth={1.5} />
          <Text style={styles.heroSubtitle}>
            {announcements.length} {t('announcements.count')}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title={t('announcements.empty')}
              subtitle={t('announcements.emptySub')}
            />
          }
          showsVerticalScrollIndicator={false}
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

  // -- Teal hero header --
  heroHeader: {
    backgroundColor: TEAL,
    paddingBottom: 28,
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
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },

  // -- List --
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // -- Announcement card --
  announcementCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  announcementCardPinned: {
    borderColor: `${TEAL}40`,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
  },
  announcementCardUnread: {
    backgroundColor: colors.bgElevated,
  },

  // -- Card header --
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pinBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: TEAL_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: TEAL,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    letterSpacing: -0.2,
  },
  expandIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // -- Card body --
  cardBody: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 21,
    marginTop: 10,
  },

  // -- Card footer --
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  postedBy: {
    gap: 2,
  },
  postedByText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  postedDate: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  readBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: colors.bgSubtle,
  },
  readText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
  },
});

/*
 * i18n keys to add to lib/i18n.ts:
 *
 * 'announcements.title':   { tet: 'Anúnsiu', en: 'Announcements' }
 * 'announcements.count':   { tet: 'anúnsiu', en: 'announcements' }
 * 'announcements.empty':   { tet: 'Seidauk iha anúnsiu', en: 'No announcements yet' }
 * 'announcements.emptySub':{ tet: 'Anúnsiu husi kompanía sei mosu iha ne\'e', en: 'Company announcements will appear here' }
 * 'announcements.read':    { tet: 'Lee ona', en: 'Read' }
 * 'announcements.hrTeam':  { tet: 'Ekipa RH', en: 'HR Team' }
 */
