/**
 * Kaixa — Money Screen (Osan) v2
 * Sharp editorial dark theme. Premium fintech feel.
 * Friendly helper text and descriptions throughout.
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

  const { isVATActive, effectiveRate, config, syncFromFirestore, loadCached } =
    useVATStore();
  const { tenantId } = useTenantStore();
  const { user } = useAuthStore();
  const bizProfile = useBusinessProfileStore((s) => s.profile);

  const vatActive = isVATActive();
  const vatRate = effectiveRate();

  useEffect(() => {
    if (tenantId) {
      loadRange(tenantId);
    }
  }, [tenantId, loadRange]);

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
      // User cancelled
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
          <Text style={styles.summaryLabel}>TAMA</Text>
          <Text style={[styles.summaryValue, { color: colors.moneyIn }]}>
            ${totalIn().toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>SAI</Text>
          <Text style={[styles.summaryValue, { color: colors.moneyOut }]}>
            ${totalOut().toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>LUKRU</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            ${(totalIn() - totalOut()).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* VAT Summary */}
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
            colors={['#059669', '#34D399']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bigButton}
          >
            <ArrowDownLeft size={26} color={colors.white} strokeWidth={2.5} />
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
            colors={['#E11D48', '#FB7185']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bigButton}
          >
            <ArrowUpRight size={26} color={colors.white} strokeWidth={2.5} />
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
            <FileText size={22} color={colors.textTertiary} strokeWidth={1.5} />
            <Text style={styles.emptyText}>Seidauk iha transasaun</Text>
            <Text style={styles.emptySubtext}>
              Tap the green or red button above to record money coming in or going out
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
                styles.txDot,
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
                  <Share2 size={13} color={colors.textTertiary} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
        {transactions.length > 0 && (
          <Text style={styles.listHint}>
            Hold any transaction to share as a receipt
          </Text>
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
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.modalHeaderBtn}
            >
              <X size={18} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {txType === 'in' ? 'Osan Tama' : 'Osan Sai'}
            </Text>
            <TouchableOpacity
              onPress={saveTransaction}
              style={[styles.modalHeaderBtn, styles.modalSaveBtn]}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Check size={18} color={colors.white} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.modalLabel}>MONTANTE</Text>
            <Text style={styles.modalHint}>
              {txType === 'in'
                ? 'How much money did you receive?'
                : 'How much did you spend?'}
            </Text>
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
            {vatActive && amount && parseFloat(amount) > 0 && (
              <Text style={styles.vatHint}>
                incl. VAT {vatRate}%: ${(
                  parseFloat(amount) -
                  parseFloat(amount) / (1 + vatRate / 100)
                ).toFixed(2)}
              </Text>
            )}

            <Text style={styles.modalLabel}>KATEGORIA</Text>
            <Text style={styles.modalHint}>
              What type of {txType === 'in' ? 'income' : 'expense'} is this?
            </Text>
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

            <Text style={styles.modalLabel}>NOTA</Text>
            <Text style={styles.modalHint}>
              Add a short note to remember what this was for
            </Text>
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
    paddingBottom: 6,
    gap: 6,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  periodTabActive: {
    backgroundColor: colors.bgElevated,
    borderWidth: 0.5,
    borderColor: colors.primary,
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: -0.1,
  },
  periodTabTextActive: {
    color: colors.primary,
  },
  periodTabSub: {
    fontSize: 9,
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
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 9,
    color: colors.textTertiary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  summaryDivider: {
    width: 0.5,
    height: 34,
    backgroundColor: colors.borderMedium,
  },

  // VAT bar
  vatBar: {
    backgroundColor: colors.bgElevated,
    paddingVertical: 5,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  vatBarText: {
    fontSize: 10,
    color: colors.textTertiary,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // Count bar
  countBar: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: colors.bg,
  },
  countText: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
  },

  // Big Buttons
  bigButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  bigButtonWrap: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  bigButton: {
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    gap: 4,
  },
  bigButtonLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  bigButtonSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
  },

  // Transaction List
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingBottom: 20,
    gap: 2,
  },
  listHint: {
    fontSize: 10,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 12,
  },
  txRow: {
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    padding: 14,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  txDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 12,
  },
  txLeft: {
    flex: 1,
  },
  txCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.1,
  },
  txNote: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  txVat: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  txTime: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  txRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
    gap: 6,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
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
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
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
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  modalHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtn: {
    backgroundColor: colors.primary,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    marginBottom: 4,
    marginTop: 20,
    letterSpacing: 1.5,
  },
  modalHint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 8,
    lineHeight: 16,
  },

  // Amount Input
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    borderWidth: 1.5,
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
    letterSpacing: -1,
  },
  vatHint: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 6,
    textAlign: 'right',
  },

  // Category Grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: colors.borderMedium,
    minWidth: '30%',
  },
  categoryChipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.1,
  },
  categoryChipTextActive: {
    color: colors.white,
  },
  categoryChipSub: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 1,
  },
  categoryChipSubActive: {
    color: 'rgba(255,255,255,0.65)',
  },

  // Note Input
  noteInput: {
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: colors.borderMedium,
    padding: 14,
    fontSize: 14,
    color: colors.text,
    minHeight: 56,
    textAlignVertical: 'top',
  },
});
