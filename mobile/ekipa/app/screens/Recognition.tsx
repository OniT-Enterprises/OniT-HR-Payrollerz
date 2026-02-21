/**
 * Ekipa — Recognition Screen
 * Premium dark theme with amber (#F59E0B) accent.
 * Peer recognition feed + "Send Kudos" FAB.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Platform,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Star,
  Plus,
  X,
  Search,
  Users,
  Lightbulb,
  Shield,
  Heart,
  Sparkles,
  Crown,
  Send,
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
import { useEmployeeStore } from '../../stores/employeeStore';
import { useRecognitionStore } from '../../stores/recognitionStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { EmptyState } from '../../components/EmptyState';
import type { RecognitionCategory } from '../../types/recognition';
import type { DirectoryEntry } from '../../types/directory';

/** Category configuration: label key, icon, color */
const CATEGORIES: {
  id: RecognitionCategory;
  labelKey: string;
  icon: typeof Star;
  color: string;
  bg: string;
}[] = [
  { id: 'teamwork', labelKey: 'recognition.teamwork', icon: Users, color: colors.blue, bg: colors.blueBg },
  { id: 'above_and_beyond', labelKey: 'recognition.aboveAndBeyond', icon: Sparkles, color: colors.warning, bg: colors.warningBg },
  { id: 'safety', labelKey: 'recognition.safety', icon: Shield, color: colors.orange, bg: colors.orangeBg },
  { id: 'customer_service', labelKey: 'recognition.customerService', icon: Heart, color: colors.emerald, bg: colors.emeraldBg },
  { id: 'innovation', labelKey: 'recognition.innovation', icon: Lightbulb, color: colors.violet, bg: colors.violetBg },
  { id: 'leadership', labelKey: 'recognition.leadership', icon: Crown, color: colors.primary, bg: colors.primaryBg },
];

function getCategoryConfig(cat: RecognitionCategory) {
  return CATEGORIES.find((c) => c.id === cat) || CATEGORIES[0];
}

function timeAgo(date: Date, t: (k: string) => string): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t('recognition.justNow');
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w`;
}

export default function Recognition() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const employee = useEmployeeStore((s) => s.employee);

  const recognitions = useRecognitionStore((s) => s.recognitions);
  const loading = useRecognitionStore((s) => s.loading);
  const submitting = useRecognitionStore((s) => s.submitting);
  const fetchRecognitions = useRecognitionStore((s) => s.fetchRecognitions);
  const sendRecognition = useRecognitionStore((s) => s.sendRecognition);

  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Modal form state
  const [searchQuery, setSearchQuery] = useState('');
  const [colleagues, setColleagues] = useState<DirectoryEntry[]>([]);
  const [selectedColleague, setSelectedColleague] = useState<DirectoryEntry | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<RecognitionCategory>('teamwork');
  const [message, setMessage] = useState('');
  const [loadingColleagues, setLoadingColleagues] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchRecognitions(tenantId);
    }
  }, [tenantId, fetchRecognitions]);

  const onRefresh = useCallback(async () => {
    if (!tenantId) return;
    setRefreshing(true);
    await fetchRecognitions(tenantId);
    setRefreshing(false);
  }, [tenantId, fetchRecognitions]);

  const fetchColleagues = useCallback(async () => {
    if (!tenantId) return;
    setLoadingColleagues(true);
    try {
      const q = query(
        collection(db, `tenants/${tenantId}/employees`),
        where('status', '==', 'active'),
        orderBy('firstName')
      );
      const snap = await getDocs(q);
      const entries: DirectoryEntry[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone,
            department: data.department,
            position: data.position,
            photoUrl: data.photoUrl,
            status: data.status || 'active',
          };
        })
        .filter((e) => e.id !== employeeId); // Exclude self
      setColleagues(entries);
    } catch {
      setColleagues([]);
    } finally {
      setLoadingColleagues(false);
    }
  }, [tenantId, employeeId]);

  const handleOpenModal = () => {
    setShowModal(true);
    setSelectedColleague(null);
    setSelectedCategory('teamwork');
    setMessage('');
    setSearchQuery('');
    fetchColleagues();
  };

  const handleSubmit = async () => {
    if (!tenantId || !employeeId || !employee || !selectedColleague || !message.trim()) return;

    await sendRecognition({
      tenantId,
      fromEmployeeId: employeeId,
      fromEmployeeName: `${employee.firstName} ${employee.lastName}`,
      toEmployeeId: selectedColleague.id,
      toEmployeeName: `${selectedColleague.firstName} ${selectedColleague.lastName}`,
      message: message.trim(),
      category: selectedCategory,
    });

    setShowModal(false);
    Alert.alert(t('common.success'), t('recognition.sent'));
  };

  const filteredColleagues = colleagues.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      (c.department || '').toLowerCase().includes(q)
    );
  });

  const canSubmit = !!selectedColleague && message.trim().length > 0 && !submitting;

  return (
    <View style={styles.container}>
      {/* ── Amber hero header ──────────────────────────── */}
      <View style={styles.heroHeader}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.heroDecor3} />

        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{t('recognition.title')}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.heroContent}>
          <Star size={36} color={colors.white} strokeWidth={1.8} fill="rgba(255,255,255,0.3)" />
          <Text style={styles.heroSubtext}>{t('recognition.subtitle')}</Text>
        </View>
      </View>

      {/* ── Feed ───────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.warning} />
        }
      >
        {loading && recognitions.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.warning} />
          </View>
        ) : recognitions.length === 0 ? (
          <EmptyState
            title={t('recognition.empty')}
            subtitle={t('recognition.emptySub')}
          />
        ) : (
          <View style={styles.feed}>
            {recognitions.map((rec) => {
              const catConfig = getCategoryConfig(rec.category);
              const CatIcon = catConfig.icon;
              return (
                <View key={rec.id} style={styles.feedCard}>
                  {/* Category accent bar */}
                  <View style={[styles.accentBar, { backgroundColor: catConfig.color }]} />

                  <View style={styles.feedCardInner}>
                    {/* From -> To */}
                    <View style={styles.feedHeader}>
                      <View style={styles.feedNames}>
                        <Text style={styles.feedFrom}>{rec.fromEmployeeName}</Text>
                        <Text style={styles.feedArrow}>→</Text>
                        <Text style={styles.feedTo}>{rec.toEmployeeName}</Text>
                      </View>
                      <Text style={styles.feedTime}>
                        {rec.createdAt ? timeAgo(rec.createdAt, t) : ''}
                      </Text>
                    </View>

                    {/* Message */}
                    <Text style={styles.feedMessage}>{rec.message}</Text>

                    {/* Category badge */}
                    <View style={[styles.categoryBadge, { backgroundColor: catConfig.bg, borderColor: catConfig.color + '30' }]}>
                      <CatIcon size={12} color={catConfig.color} strokeWidth={2.5} />
                      <Text style={[styles.categoryBadgeText, { color: catConfig.color }]}>
                        {t(catConfig.labelKey)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── FAB: Send Kudos ────────────────────────────── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={handleOpenModal}
        activeOpacity={0.85}
      >
        <Plus size={22} color={colors.white} strokeWidth={2.5} />
        <Text style={styles.fabText}>{t('recognition.sendKudos')}</Text>
      </TouchableOpacity>

      {/* ── Send Kudos Modal ───────────────────────────── */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          {/* Modal header */}
          <View style={[styles.modalHeader, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 12 }]}>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseBtn} activeOpacity={0.7}>
              <X size={20} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('recognition.sendKudos')}</Text>
            <View style={styles.modalCloseBtn} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            {/* 1. Select colleague */}
            <Text style={styles.modalLabel}>{t('recognition.selectColleague')}</Text>

            {selectedColleague ? (
              <View style={styles.selectedColleagueCard}>
                <View style={styles.colleagueAvatar}>
                  <Text style={styles.colleagueAvatarText}>
                    {selectedColleague.firstName[0]}{selectedColleague.lastName[0]}
                  </Text>
                </View>
                <View style={styles.colleagueInfo}>
                  <Text style={styles.colleagueName}>
                    {selectedColleague.firstName} {selectedColleague.lastName}
                  </Text>
                  <Text style={styles.colleagueDept}>{selectedColleague.department}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedColleague(null)}
                  style={styles.changeBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeBtnText}>{t('recognition.change')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Search bar */}
                <View style={styles.searchBar}>
                  <Search size={16} color={colors.textTertiary} strokeWidth={2} />
                  <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={t('recognition.searchColleague')}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                {loadingColleagues ? (
                  <ActivityIndicator size="small" color={colors.warning} style={{ margin: 20 }} />
                ) : (
                  <View style={styles.colleagueList}>
                    {filteredColleagues.slice(0, 20).map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={styles.colleagueRow}
                        onPress={() => setSelectedColleague(c)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.colleagueAvatar}>
                          <Text style={styles.colleagueAvatarText}>
                            {c.firstName[0]}{c.lastName[0]}
                          </Text>
                        </View>
                        <View style={styles.colleagueInfo}>
                          <Text style={styles.colleagueName}>{c.firstName} {c.lastName}</Text>
                          <Text style={styles.colleagueDept}>{c.department || c.position}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* 2. Select category */}
            <Text style={styles.modalLabel}>{t('recognition.selectCategory')}</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const CatIcon = cat.icon;
                const isActive = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      isActive && { backgroundColor: cat.color, borderColor: cat.color },
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
                    activeOpacity={0.7}
                  >
                    <CatIcon
                      size={16}
                      color={isActive ? colors.white : cat.color}
                      strokeWidth={2}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        isActive ? { color: colors.white } : { color: cat.color },
                      ]}
                    >
                      {t(cat.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 3. Write message */}
            <Text style={styles.modalLabel}>{t('recognition.writeMessage')}</Text>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={setMessage}
              placeholder={t('recognition.messagePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Send size={18} color={colors.white} strokeWidth={2.5} />
                  <Text style={styles.submitBtnText}>{t('recognition.send')}</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // ── Amber hero header ───────────────────────────────
  heroHeader: {
    backgroundColor: colors.warning,
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
    gap: 8,
  },
  heroSubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },

  // ── Feed ────────────────────────────────────────────
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  loadingWrap: {
    padding: 40,
    alignItems: 'center',
  },
  feed: {
    gap: 12,
  },
  feedCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
  },
  accentBar: {
    width: 4,
  },
  feedCardInner: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedNames: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  feedFrom: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  feedArrow: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  feedTo: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.warning,
    flex: 1,
  },
  feedTime: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    marginLeft: 8,
  },
  feedMessage: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // ── FAB ─────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warning,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: colors.warning,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },

  // ── Modal ───────────────────────────────────────────
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.bgCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  modalContent: {
    padding: 20,
    paddingBottom: 40,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    marginBottom: 10,
    marginTop: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Search bar ──────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },

  // ── Colleague list ──────────────────────────────────
  colleagueList: {
    gap: 6,
    maxHeight: 220,
  },
  colleagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colleagueAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  colleagueAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.warning,
  },
  colleagueInfo: {
    flex: 1,
  },
  colleagueName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  colleagueDept: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
  },

  // ── Selected colleague ──────────────────────────────
  selectedColleagueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.warning + '40',
  },
  changeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.warningBg,
  },
  changeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
  },

  // ── Category grid ───────────────────────────────────
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Message input ───────────────────────────────────
  messageInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bgCard,
    minHeight: 100,
    textAlignVertical: 'top',
  },

  // ── Submit button ───────────────────────────────────
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    borderRadius: 14,
    padding: 16,
    backgroundColor: colors.warning,
    ...Platform.select({
      ios: {
        shadowColor: colors.warning,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  btnDisabled: {
    opacity: 0.5,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
});
