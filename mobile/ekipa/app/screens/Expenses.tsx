/**
 * Ekipa — Expenses List Screen
 * Premium dark theme with emerald (#10B981) module accent.
 * Expense list with filter pills and FAB to add new expense.
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  Plane,
  ShoppingBag,
  Utensils,
  Car,
  Wrench,
  MoreHorizontal,
} from 'lucide-react-native';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantStore } from '../../stores/tenantStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { useI18nStore, useT } from '../../lib/i18n';
import { formatCurrency } from '../../lib/currency';
import { colors } from '../../lib/colors';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/EmptyState';
import type { Expense, ExpenseCategory, ExpenseStatus } from '../../types/expense';

const ACCENT = colors.emerald;
const ACCENT_BG = colors.emeraldBg;

type FilterType = 'all' | ExpenseStatus;

const CATEGORY_ICONS: Record<ExpenseCategory, typeof Plane> = {
  travel: Plane,
  supplies: ShoppingBag,
  meals: Utensils,
  transport: Car,
  equipment: Wrench,
  other: MoreHorizontal,
};

const FILTERS: { id: FilterType; labelKey: string }[] = [
  { id: 'all', labelKey: 'expenses.all' },
  { id: 'submitted', labelKey: 'expenses.pending' },
  { id: 'approved', labelKey: 'expenses.approved' },
  { id: 'rejected', labelKey: 'expenses.rejected' },
];

export default function Expenses() {
  const t = useT();
  const language = useI18nStore((s) => s.language);
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const currency = useEmployeeStore((s) => s.employee?.currency || 'USD');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    if (!tenantId || !employeeId) return;

    const fetchExpenses = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, `tenants/${tenantId}/expenses`),
          where('employeeId', '==', employeeId),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const items: Expense[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            tenantId: data.tenantId || tenantId,
            employeeId: data.employeeId || employeeId,
            employeeName: data.employeeName || '',
            amount: data.amount || 0,
            currency: data.currency || 'USD',
            category: data.category || 'other',
            date: data.date || '',
            description: data.description || '',
            receiptUrl: data.receiptUrl,
            status: data.status || 'submitted',
            approvedBy: data.approvedBy,
            approverName: data.approverName,
            approvedAt: data.approvedAt instanceof Timestamp ? data.approvedAt.toDate() : data.approvedAt,
            rejectionReason: data.rejectionReason,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
          };
        });
        setExpenses(items);
      } catch {
        setExpenses([]);
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [tenantId, employeeId]);

  const filteredExpenses = useMemo(() => {
    if (filter === 'all') return expenses;
    return expenses.filter((e) => e.status === filter);
  }, [expenses, filter]);

  const pendingTotal = useMemo(() => {
    return expenses
      .filter((e) => e.status === 'submitted')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const renderExpense = useCallback(({ item }: { item: Expense }) => {
    const statusMap: Record<ExpenseStatus, 'pending' | 'approved' | 'rejected'> = {
      submitted: 'pending',
      approved: 'approved',
      rejected: 'rejected',
      paid: 'approved',
    };
    const Icon = CATEGORY_ICONS[item.category] || MoreHorizontal;
    const badgeStatus = statusMap[item.status] || 'pending';
    const statusLabel = t(`expenses.status_${item.status}`);

    return (
      <TouchableOpacity style={styles.expenseRow} activeOpacity={0.8}>
        <View style={styles.expenseIcon}>
          <Icon size={18} color={ACCENT} strokeWidth={2} />
        </View>
        <View style={styles.expenseInfo}>
          <Text style={styles.expenseDesc} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={styles.expenseDate}>
            {item.date} {'\u00B7'} {t(`expense.${item.category}`)}
          </Text>
        </View>
        <View style={styles.expenseRight}>
          <Text style={styles.expenseAmount}>
            {formatCurrency(item.amount, language, item.currency)}
          </Text>
          <StatusBadge status={badgeStatus} label={statusLabel} />
        </View>
      </TouchableOpacity>
    );
  }, [t, language]);

  return (
    <View style={styles.container}>
      {/* Emerald hero header */}
      <View style={styles.heroHeader}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.heroDecor3} />
        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{t('expenses.title')}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.heroContent}>
          <Text style={styles.heroLabel}>{t('expenses.pendingTotal')}</Text>
          <Text style={styles.heroAmount}>
            {formatCurrency(pendingTotal, language, currency)}
          </Text>
        </View>
      </View>

      {/* Filter pills */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterPill, filter === f.id && styles.filterPillActive]}
              onPress={() => setFilter(f.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterPillText, filter === f.id && styles.filterPillTextActive]}>
                {t(f.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Expense list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={filteredExpenses}
          keyExtractor={(item) => item.id}
          renderItem={renderExpense}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title={t('expenses.empty')}
              subtitle={t('expenses.emptySub')}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push('/screens/ExpenseForm')}
        activeOpacity={0.85}
      >
        <Plus size={24} color={colors.white} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // -- Emerald hero header --
  heroHeader: {
    backgroundColor: ACCENT,
    paddingBottom: 32,
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
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1.5,
    marginTop: 4,
  },

  // -- Filter pills --
  filterContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: colors.white,
  },

  // -- Expense list --
  listContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 10,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // -- Expense row --
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: ACCENT_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: {
    flex: 1,
    gap: 3,
  },
  expenseDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  expenseDate: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  expenseRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },

  // -- FAB --
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    ...StyleSheet.flatten([
      {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
      },
    ]),
  },
});

/*
 * i18n keys to add to lib/i18n.ts:
 *
 * 'expenses.title':            { tet: 'Despeza Sira', en: 'Expenses' }
 * 'expenses.pendingTotal':     { tet: 'Total pendente', en: 'Pending total' }
 * 'expenses.all':              { tet: 'Hotu', en: 'All' }
 * 'expenses.pending':          { tet: 'Pendente', en: 'Pending' }
 * 'expenses.approved':         { tet: 'Aprova ona', en: 'Approved' }
 * 'expenses.rejected':         { tet: 'Rejeita ona', en: 'Rejected' }
 * 'expenses.empty':            { tet: 'Seidauk iha despeza', en: 'No expenses yet' }
 * 'expenses.emptySub':         { tet: 'Klik + atu submete despeza foun', en: 'Tap + to submit a new expense' }
 * 'expenses.status_submitted': { tet: 'Pendente', en: 'Pending' }
 * 'expenses.status_approved':  { tet: 'Aprova ona', en: 'Approved' }
 * 'expenses.status_rejected':  { tet: 'Rejeita ona', en: 'Rejected' }
 * 'expenses.status_paid':      { tet: 'Selu ona', en: 'Paid' }
 */
