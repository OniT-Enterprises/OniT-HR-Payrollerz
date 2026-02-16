/**
 * Kaixa — Money Screen (Osan)
 * Dark theme — gradient action buttons, dark modal, Lucide icons
 *
 * VAT-ready: every transaction captures VAT fields (zeroed when VAT inactive).
 * Supports date range filtering: today / week / month.
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Check,
  FileText,
  Share2,
  Package,
  Plus,
} from 'lucide-react-native';
import { colors } from '../../lib/colors';
import { useVATStore } from '../../stores/vatStore';
import { useTransactionStore, type DateRange } from '../../stores/transactionStore';
import { useTenantStore } from '../../stores/tenantStore';
import { useAuthStore } from '../../stores/authStore';
import {
  createTransaction,
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
} from '../../types/transaction';
import { inferVATCategory } from '@onit/shared';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';
import { useProductStore, type Product } from '../../stores/productStore';
import { generateTextReceipt, getWhatsAppShareURL } from '../../lib/receipt';
import { getNextReceiptNumber } from '../../lib/receiptCounter';
import type { KaixaTransaction } from '../../types/transaction';

type TransactionType = 'in' | 'out';

const CATEGORIES_IN = INCOME_CATEGORIES.map((c) => ({
  key: c.key,
  label: c.labelTL || c.label,
  labelEn: c.label,
}));

const CATEGORIES_OUT = EXPENSE_CATEGORIES.map((c) => ({
  key: c.key,
  label: c.labelTL || c.label,
  labelEn: c.label,
}));

const PERIOD_OPTIONS: { key: DateRange; label: string; labelEn: string }[] = [
  { key: 'today', label: 'Ohin', labelEn: 'Today' },
  { key: 'week', label: 'Semana', labelEn: 'Week' },
  { key: 'month', label: 'Fulan', labelEn: 'Month' },
];

export default function MoneyScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [txType, setTxType] = useState<TransactionType>('in');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Transaction store (Firestore-backed)
  const {
    transactions,
    loading,
    dateRange,
    totalIn,
    totalOut,
    totalVAT,
    transactionCount,
    addTransaction,
    loadRange,
  } = useTransactionStore();

  // VAT state
  const { isVATActive, effectiveRate, config, syncFromFirestore, loadCached } =
    useVATStore();
  const { tenantId } = useTenantStore();
  const { user } = useAuthStore();
  const bizProfile = useBusinessProfileStore((s) => s.profile);
  const { products, loadProducts, updateProduct } = useProductStore();

  // Restock modal state
  const [restockModal, setRestockModal] = useState(false);
  const [restockQtys, setRestockQtys] = useState<Record<string, string>>({});
  const [restocking, setRestocking] = useState(false);

  const vatActive = isVATActive();
  const vatRate = effectiveRate();

  // Load transactions for current date range
  useEffect(() => {
    if (tenantId) {
      loadRange(tenantId);
      loadProducts(tenantId);
    }
  }, [tenantId, loadRange, loadProducts]);

  // Load cached VAT config on mount, sync when online
  useEffect(() => {
    loadCached();
    if (tenantId) {
      syncFromFirestore(tenantId);
    }
  }, [tenantId, loadCached, syncFromFirestore]);

  const categories = txType === 'in' ? CATEGORIES_IN : CATEGORIES_OUT;

  const switchPeriod = (range: DateRange) => {
    if (tenantId) {
      loadRange(tenantId, range);
    }
  };

  const openEntry = (type: TransactionType) => {
    setTxType(type);
    setAmount('');
    setCategory('');
    setNote('');
    setModalVisible(true);
  };

  const saveTransaction = async () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    if (!tenantId) {
      Alert.alert('Error', 'No business selected');
      return;
    }

    setSaving(true);
    try {
      const vatCategory = vatActive
        ? inferVATCategory(category, config)
        : ('none' as const);

      const txData = createTransaction({
        type: txType,
        amount: Math.round(parsed * 100) / 100,
        category,
        note: note.trim(),
        tenantId,
        createdBy: user?.uid || 'anonymous',
        vatRate: vatActive ? vatRate : 0,
        vatCategory,
      });

      await addTransaction(txData, tenantId);
      setModalVisible(false);

      // If this was a stock purchase, offer to update product inventory
      if (txType === 'out' && category === 'stock' && products.length > 0) {
        const stockProducts = products.filter((p) => p.stock !== null);
        if (stockProducts.length > 0) {
          Alert.alert(
            'Atualiza Stoke?',
            'Update product stock levels for this purchase?',
            [
              { text: 'Lae (No)', style: 'cancel' },
              {
                text: 'Sin (Yes)',
                onPress: () => {
                  setRestockQtys({});
                  setRestockModal(true);
                },
              },
            ]
          );
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Dili',
    });

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      timeZone: 'Asia/Dili',
    });

  const getCategoryLabel = (key: string) => {
    const all = [...CATEGORIES_IN, ...CATEGORIES_OUT];
    return all.find((c) => c.key === key)?.label || key;
  };

  const shareReceipt = async (tx: KaixaTransaction) => {
    let receiptNumber = tx.receiptNumber;
    if (!receiptNumber && tenantId) {
      try {
        receiptNumber = await getNextReceiptNumber(tenantId);
      } catch {
        // Continue without receipt number
      }
    }

    const receipt = generateTextReceipt({
      transaction: tx,
      businessName: bizProfile.businessName,
      businessPhone: bizProfile.phone,
      businessAddress: bizProfile.address,
      vatRegNumber: bizProfile.vatRegNumber || undefined,
      receiptNumber,
    });

    try {
      await Share.share({ message: receipt });
    } catch {
      // User cancelled — that's fine
    }
  };

  const shareViaWhatsApp = async (tx: KaixaTransaction) => {
    let receiptNumber = tx.receiptNumber;
    if (!receiptNumber && tenantId) {
      try {
        receiptNumber = await getNextReceiptNumber(tenantId);
      } catch {
        // Continue without receipt number
      }
    }

    const receipt = generateTextReceipt({
      transaction: tx,
      businessName: bizProfile.businessName,
      businessPhone: bizProfile.phone,
      businessAddress: bizProfile.address,
      vatRegNumber: bizProfile.vatRegNumber || undefined,
      receiptNumber,
    });
    const url = getWhatsAppShareURL(receipt);
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'WhatsApp not installed');
    });
  };

  // ── Restock handler ─────────────────────────

  const stockProducts = products.filter((p) => p.stock !== null);

  const handleRestock = async () => {
    if (!tenantId) return;

    const updates: { product: Product; qty: number }[] = [];
    for (const product of stockProducts) {
      const raw = restockQtys[product.id];
      if (!raw) continue;
      const qty = parseInt(raw, 10);
      if (isNaN(qty) || qty <= 0) continue;
      updates.push({ product, qty });
    }

    if (updates.length === 0) {
      setRestockModal(false);
      return;
    }

    setRestocking(true);
    try {
      for (const { product, qty } of updates) {
        await updateProduct(tenantId, product.id, {
          stock: (product.stock ?? 0) + qty,
        });
      }
      setRestockModal(false);
      Alert.alert(
        'Susesu!',
        `Updated stock for ${updates.length} product${updates.length > 1 ? 's' : ''}`
      );
    } catch {
      Alert.alert('Error', 'Failed to update stock');
    } finally {
      setRestocking(false);
    }
  };

  const periodLabel =
    PERIOD_OPTIONS.find((p) => p.key === dateRange)?.label || 'Ohin';

  return (
    <View style={styles.container}>
      {/* Period Selector */}
      <View style={styles.periodBar}>
        {PERIOD_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.periodTab,
              dateRange === opt.key && styles.periodTabActive,
            ]}
            onPress={() => switchPeriod(opt.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.periodTabText,
                dateRange === opt.key && styles.periodTabTextActive,
              ]}
            >
              {opt.label}
            </Text>
            <Text
              style={[
                styles.periodTabSub,
                dateRange === opt.key && styles.periodTabSubActive,
              ]}
            >
              {opt.labelEn}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Tama</Text>
          <Text style={[styles.summaryValue, { color: colors.moneyIn }]}>
            ${totalIn().toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Sai</Text>
          <Text style={[styles.summaryValue, { color: colors.moneyOut }]}>
            ${totalOut().toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Lukru</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            ${(totalIn() - totalOut()).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* VAT Summary — only visible when VAT is active */}
      {vatActive && (
        <View style={styles.vatBar}>
          <Text style={styles.vatBarText}>
            VAT {vatRate}% — {periodLabel}: ${totalVAT().toFixed(2)}
          </Text>
        </View>
      )}

      {/* Transaction count */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {transactionCount()} transasaun
        </Text>
      </View>

      {/* Big Action Buttons */}
      <View style={styles.bigButtons}>
        <TouchableOpacity
          style={styles.bigButtonWrap}
          onPress={() => openEntry('in')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#16A34A', '#4ADE80']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bigButton}
          >
            <ArrowDownLeft size={28} color={colors.white} strokeWidth={2.5} />
            <Text style={styles.bigButtonLabel}>OSAN TAMA</Text>
            <Text style={styles.bigButtonSub}>Money In</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bigButtonWrap}
          onPress={() => openEntry('out')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#DC2626', '#F87171']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bigButton}
          >
            <ArrowUpRight size={28} color={colors.white} strokeWidth={2.5} />
            <Text style={styles.bigButtonLabel}>OSAN SAI</Text>
            <Text style={styles.bigButtonSub}>Money Out</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Transaction List */}
      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.emptySubtext}>Loading...</Text>
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={24} color={colors.textTertiary} strokeWidth={1.5} />
            <Text style={styles.emptyText}>Tap iha butaun leten hodi hahu</Text>
            <Text style={styles.emptySubtext}>
              Tap a button above to start tracking
            </Text>
          </View>
        ) : (
          transactions.map((tx) => (
            <TouchableOpacity
              key={tx.id}
              style={styles.txRow}
              onLongPress={() => shareReceipt(tx)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.txIndicator,
                { backgroundColor: tx.type === 'in' ? colors.moneyIn : colors.moneyOut },
              ]} />
              <View style={styles.txLeft}>
                <Text style={styles.txCategory}>{getCategoryLabel(tx.category)}</Text>
                {tx.note ? (
                  <Text style={styles.txNote} numberOfLines={1}>{tx.note}</Text>
                ) : null}
                {tx.vatAmount > 0 && (
                  <Text style={styles.txVat}>
                    incl. VAT ${tx.vatAmount.toFixed(2)}
                  </Text>
                )}
                <Text style={styles.txTime}>
                  {dateRange !== 'today' && `${formatDate(tx.timestamp)} · `}
                  {formatTime(tx.timestamp)}
                </Text>
              </View>
              <View style={styles.txRight}>
                <Text
                  style={[
                    styles.txAmount,
                    { color: tx.type === 'in' ? colors.moneyIn : colors.moneyOut },
                  ]}
                >
                  {tx.type === 'in' ? '+' : '-'}${tx.amount.toFixed(2)}
                </Text>
                <TouchableOpacity
                  onPress={() => shareViaWhatsApp(tx)}
                  style={styles.shareBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Share2 size={14} color={colors.textTertiary} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Entry Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.modalHeaderBtn}
            >
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {txType === 'in' ? 'Osan Tama' : 'Osan Sai'}
            </Text>
            <TouchableOpacity
              onPress={saveTransaction}
              style={styles.modalHeaderBtn}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Check size={20} color={colors.primary} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Amount Input */}
            <Text style={styles.modalLabel}>MONTANTE</Text>
            <View style={[
              styles.amountContainer,
              { borderColor: txType === 'in' ? colors.moneyIn : colors.moneyOut },
            ]}>
              <Text style={styles.amountPrefix}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
            {/* VAT hint when active */}
            {vatActive && amount && parseFloat(amount) > 0 && (
              <Text style={styles.vatHint}>
                incl. VAT {vatRate}%: ${(
                  parseFloat(amount) -
                  parseFloat(amount) / (1 + vatRate / 100)
                ).toFixed(2)}
              </Text>
            )}

            {/* Category Selection */}
            <Text style={styles.modalLabel}>KATEGORIA</Text>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryChip,
                    category === cat.key && styles.categoryChipActive,
                  ]}
                  onPress={() => setCategory(cat.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      category === cat.key && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                  <Text
                    style={[
                      styles.categoryChipSub,
                      category === cat.key && styles.categoryChipSubActive,
                    ]}
                  >
                    {cat.labelEn}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Note */}
            <Text style={styles.modalLabel}>NOTA</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Optional note..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={2}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Restock Modal */}
      <Modal
        visible={restockModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRestockModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setRestockModal(false)}
              style={styles.modalHeaderBtn}
            >
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Atualiza Stoke</Text>
            <TouchableOpacity
              onPress={handleRestock}
              style={styles.modalHeaderBtn}
              disabled={restocking}
            >
              {restocking ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Check size={20} color={colors.primary} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.restockHint}>
              Enter quantity to add for each product
            </Text>
            {stockProducts.map((product) => (
              <View key={product.id} style={styles.restockRow}>
                <View style={styles.restockInfo}>
                  <Text style={styles.restockName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.restockCurrent}>
                    Current: {product.stock ?? 0}
                  </Text>
                </View>
                <View style={styles.restockInputWrap}>
                  <Plus
                    size={14}
                    color={colors.moneyIn}
                    strokeWidth={2.5}
                  />
                  <TextInput
                    style={styles.restockInput}
                    value={restockQtys[product.id] || ''}
                    onChangeText={(val) =>
                      setRestockQtys((prev) => ({
                        ...prev,
                        [product.id]: val,
                      }))
                    }
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            ))}
          </ScrollView>
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

  // Period Selector
  periodBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  periodTabActive: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  periodTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  periodTabTextActive: {
    color: colors.primary,
  },
  periodTabSub: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 1,
  },
  periodTabSubActive: {
    color: colors.primaryMuted,
  },

  // Summary Bar
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },

  // VAT bar (only shows when VAT is active)
  vatBar: {
    backgroundColor: colors.bgElevated,
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  vatBarText: {
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Count bar
  countBar: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: colors.bg,
  },
  countText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '500',
  },

  // Big Buttons
  bigButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  bigButtonWrap: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  bigButton: {
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    gap: 6,
  },
  bigButtonLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bigButtonSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
  },

  // Transaction List
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  txRow: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    paddingLeft: 18,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  txIndicator: {
    width: 3,
    height: 32,
    borderRadius: 2,
    marginRight: 12,
  },
  txLeft: {
    flex: 1,
  },
  txCategory: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  txNote: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 2,
  },
  txVat: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  txTime: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  txRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
    gap: 6,
  },
  txAmount: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  shareBtn: {
    padding: 4,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textTertiary,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  modalHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    marginBottom: 8,
    marginTop: 20,
    letterSpacing: 1,
  },

  // Amount Input
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
  },
  amountPrefix: {
    fontSize: 32,
    fontWeight: '300',
    color: colors.textTertiary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  vatHint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 6,
    textAlign: 'right',
    fontStyle: 'italic',
  },

  // Category Grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: '30%',
  },
  categoryChipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  categoryChipTextActive: {
    color: colors.white,
  },
  categoryChipSub: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 1,
  },
  categoryChipSubActive: {
    color: 'rgba(255,255,255,0.7)',
  },

  // Restock
  restockHint: {
    fontSize: 13,
    color: colors.textTertiary,
    marginBottom: 16,
  },
  restockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 12,
    marginBottom: 8,
  },
  restockInfo: {
    flex: 1,
  },
  restockName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  restockCurrent: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  restockInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    gap: 4,
  },
  restockInput: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.moneyIn,
    width: 50,
    textAlign: 'center',
    paddingVertical: 8,
    fontVariant: ['tabular-nums'],
  },

  // Note Input
  noteInput: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
});
