/**
 * Ekipa — Manager Approvals Screen
 * Premium dark theme with green (#22C55E) accent.
 * Approval queue for leave requests (expandable to timesheets/expenses).
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Receipt,
  ChevronRight,
  MessageSquare,
  X,
} from 'lucide-react-native';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantStore } from '../../stores/tenantStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { EmptyState } from '../../components/EmptyState';

type ApprovalTab = 'leave' | 'timesheets' | 'expenses';

interface PendingLeave {
  id: string;
  employeeName: string;
  employeeId: string;
  department: string;
  leaveType: string;
  leaveTypeLabel: string;
  startDate: string;
  endDate: string;
  duration: number;
  reason: string;
  status: string;
  requestDate: string;
}

export default function ManagerApprovals() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId);
  const role = useTenantStore((s) => s.role);
  const employee = useEmployeeStore((s) => s.employee);

  const [activeTab, setActiveTab] = useState<ApprovalTab>('leave');
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Bottom sheet state
  const [selectedItem, setSelectedItem] = useState<PendingLeave | null>(null);
  const [comment, setComment] = useState('');

  const isManager = role === 'owner' || role === 'hr-admin' || role === 'manager';

  const fetchPendingLeaves = useCallback(async () => {
    if (!tenantId) return;
    try {
      const q = query(
        collection(db, 'leave_requests'),
        where('tenantId', '==', tenantId),
        where('status', '==', 'pending'),
        orderBy('requestDate', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      const items: PendingLeave[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          employeeName: data.employeeName || '',
          employeeId: data.employeeId || '',
          department: data.department || '',
          leaveType: data.leaveType || '',
          leaveTypeLabel: data.leaveTypeLabel || data.leaveType || '',
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          duration: data.duration || 0,
          reason: data.reason || '',
          status: data.status || 'pending',
          requestDate: data.requestDate || '',
        };
      });
      setPendingLeaves(items);
    } catch {
      setPendingLeaves([]);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId && isManager) {
      setLoading(true);
      fetchPendingLeaves().finally(() => setLoading(false));
    }
  }, [tenantId, isManager, fetchPendingLeaves]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPendingLeaves();
    setRefreshing(false);
  }, [fetchPendingLeaves]);

  const handleAction = async (action: 'approved' | 'rejected') => {
    if (!selectedItem || !employee || processing) return;
    setProcessing(true);
    try {
      const updateData: Record<string, unknown> = {
        status: action,
        approverId: employee.id,
        approverName: `${employee.firstName} ${employee.lastName}`,
        approvedDate: new Date().toISOString().split('T')[0],
        updatedAt: serverTimestamp(),
      };
      if (action === 'rejected' && comment.trim()) {
        updateData.rejectionReason = comment.trim();
      }
      if (comment.trim()) {
        updateData.approverComment = comment.trim();
      }

      await updateDoc(doc(db, 'leave_requests', selectedItem.id), updateData);

      // Remove from local state
      setPendingLeaves((prev) => prev.filter((item) => item.id !== selectedItem.id));
      setSelectedItem(null);
      setComment('');
    } catch {
      Alert.alert(t('common.error'), t('approvals.actionError'));
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = pendingLeaves.length;

  const tabs: { id: ApprovalTab; labelKey: string; icon: typeof Calendar }[] = [
    { id: 'leave', labelKey: 'approvals.tabLeave', icon: Calendar },
    { id: 'timesheets', labelKey: 'approvals.tabTimesheets', icon: Clock },
    { id: 'expenses', labelKey: 'approvals.tabExpenses', icon: Receipt },
  ];

  if (!isManager) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>{t('approvals.title')}</Text>
          <View style={styles.backBtn} />
        </View>
        <EmptyState title={t('approvals.noAccess')} subtitle={t('approvals.noAccessSub')} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Green hero header ──────────────────────────── */}
      <View style={styles.heroHeader}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.heroDecor3} />

        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{t('approvals.title')}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.heroContent}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeNumber}>{pendingCount}</Text>
          </View>
          <Text style={styles.heroLabel}>{t('approvals.pending')}</Text>
        </View>
      </View>

      {/* ── Tab pills ──────────────────────────────────── */}
      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabPill, active && styles.tabPillActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <Icon
                size={14}
                color={active ? colors.white : colors.textSecondary}
                strokeWidth={2.5}
              />
              <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Content ────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {activeTab === 'leave' && (
          <>
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : pendingLeaves.length === 0 ? (
              <EmptyState
                title={t('approvals.emptyLeave')}
                subtitle={t('approvals.emptyLeaveSub')}
              />
            ) : (
              <View style={styles.list}>
                {pendingLeaves.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.approvalCard}
                    onPress={() => { setSelectedItem(item); setComment(''); }}
                    activeOpacity={0.7}
                  >
                    {/* Avatar / initials */}
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {item.employeeName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.cardContent}>
                      <Text style={styles.cardName} numberOfLines={1}>{item.employeeName}</Text>
                      <Text style={styles.cardType}>{item.leaveTypeLabel}</Text>
                      <Text style={styles.cardDates}>
                        {item.startDate} — {item.endDate} ({item.duration} {t('leave.days')})
                      </Text>
                    </View>

                    <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'timesheets' && (
          <EmptyState
            title={t('approvals.comingSoon')}
            subtitle={t('approvals.comingSoonSub')}
          />
        )}

        {activeTab === 'expenses' && (
          <EmptyState
            title={t('approvals.comingSoon')}
            subtitle={t('approvals.comingSoonSub')}
          />
        )}
      </ScrollView>

      {/* ── Detail bottom sheet modal ──────────────────── */}
      <Modal
        visible={selectedItem !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismiss}
            onPress={() => setSelectedItem(null)}
            activeOpacity={1}
          />
          <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20 }]}>
            {/* Handle bar */}
            <View style={styles.sheetHandle} />

            {/* Close button */}
            <TouchableOpacity
              style={styles.sheetClose}
              onPress={() => setSelectedItem(null)}
              activeOpacity={0.7}
            >
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>

            {selectedItem && (
              <>
                <Text style={styles.sheetName}>{selectedItem.employeeName}</Text>
                <Text style={styles.sheetDept}>{selectedItem.department}</Text>

                <View style={styles.sheetDetailRow}>
                  <Text style={styles.sheetLabel}>{t('leave.type')}</Text>
                  <Text style={styles.sheetValue}>{selectedItem.leaveTypeLabel}</Text>
                </View>
                <View style={styles.sheetDetailRow}>
                  <Text style={styles.sheetLabel}>{t('approvals.dateRange')}</Text>
                  <Text style={styles.sheetValue}>
                    {selectedItem.startDate} — {selectedItem.endDate}
                  </Text>
                </View>
                <View style={styles.sheetDetailRow}>
                  <Text style={styles.sheetLabel}>{t('approvals.duration')}</Text>
                  <Text style={styles.sheetValue}>
                    {selectedItem.duration} {t('leave.days')}
                  </Text>
                </View>
                <View style={styles.sheetDetailRow}>
                  <Text style={styles.sheetLabel}>{t('leave.reason')}</Text>
                  <Text style={styles.sheetValue}>{selectedItem.reason}</Text>
                </View>

                {/* Comment field */}
                <View style={styles.commentWrap}>
                  <MessageSquare size={14} color={colors.textTertiary} strokeWidth={2} />
                  <TextInput
                    style={styles.commentInput}
                    value={comment}
                    onChangeText={setComment}
                    placeholder={t('approvals.commentPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                {/* Action buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleAction('rejected')}
                    disabled={processing}
                    activeOpacity={0.85}
                  >
                    {processing ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <>
                        <XCircle size={18} color={colors.white} strokeWidth={2.5} />
                        <Text style={styles.actionBtnText}>{t('approvals.reject')}</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleAction('approved')}
                    disabled={processing}
                    activeOpacity={0.85}
                  >
                    {processing ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <>
                        <CheckCircle2 size={18} color={colors.white} strokeWidth={2.5} />
                        <Text style={styles.actionBtnText}>{t('approvals.approve')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // ── Simple header bar (for non-managers) ────────────
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.bgCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },

  // ── Green hero header ───────────────────────────────
  heroHeader: {
    backgroundColor: colors.primary,
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
    gap: 8,
  },
  heroBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgeNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // ── Tab pills ───────────────────────────────────────
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabPillTextActive: {
    color: colors.white,
  },

  // ── Content ─────────────────────────────────────────
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  loadingWrap: {
    padding: 40,
    alignItems: 'center',
  },

  // ── Approval list ───────────────────────────────────
  list: {
    gap: 10,
  },
  approvalCard: {
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
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  cardType: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  cardDates: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
    marginTop: 2,
  },

  // ── Bottom sheet modal ──────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderMedium,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetClose: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  sheetDept: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textTertiary,
    marginBottom: 20,
  },
  sheetDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sheetValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },

  // ── Comment input ───────────────────────────────────
  commentWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 18,
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    minHeight: 40,
    textAlignVertical: 'top',
  },

  // ── Action buttons ──────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.error,
    borderRadius: 14,
    paddingVertical: 15,
    ...Platform.select({
      ios: {
        shadowColor: colors.error,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
});
