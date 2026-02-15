/**
 * Kaixa — Money Screen (Osan)
 * Dark theme — gradient action buttons, dark modal, Lucide icons
 */
import { useState, useCallback } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Check,
  FileText,
} from 'lucide-react-native';
import { colors } from '../../lib/colors';

type TransactionType = 'in' | 'out';

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  timestamp: Date;
}

const CATEGORIES_IN = [
  { key: 'sales', label: 'Venda', labelEn: 'Sales' },
  { key: 'service', label: 'Servisu', labelEn: 'Service' },
  { key: 'payment', label: 'Pagamentu', labelEn: 'Payment received' },
  { key: 'other', label: 'Seluk', labelEn: 'Other' },
];

const CATEGORIES_OUT = [
  { key: 'stock', label: 'Stogu', labelEn: 'Stock/Inventory' },
  { key: 'rent', label: 'Alugel', labelEn: 'Rent' },
  { key: 'supplies', label: 'Material', labelEn: 'Supplies' },
  { key: 'salary', label: 'Salariu', labelEn: 'Salary' },
  { key: 'transport', label: 'Transporte', labelEn: 'Transport' },
  { key: 'food', label: 'Ai-han', labelEn: 'Food' },
  { key: 'other', label: 'Seluk', labelEn: 'Other' },
];

export default function MoneyScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [txType, setTxType] = useState<TransactionType>('in');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  const categories = txType === 'in' ? CATEGORIES_IN : CATEGORIES_OUT;

  const todayTotal = useCallback(
    (type: TransactionType) =>
      transactions
        .filter((t) => t.type === type)
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const openEntry = (type: TransactionType) => {
    setTxType(type);
    setAmount('');
    setCategory('');
    setNote('');
    setModalVisible(true);
  };

  const saveTransaction = () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    const tx: Transaction = {
      id: Date.now().toString(),
      type: txType,
      amount: Math.round(parsed * 100) / 100,
      category,
      note: note.trim(),
      timestamp: new Date(),
    };

    setTransactions((prev) => [tx, ...prev]);
    setModalVisible(false);

    // TODO: Save to Firestore / local DB
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Dili',
    });

  const getCategoryLabel = (key: string) => {
    const all = [...CATEGORIES_IN, ...CATEGORIES_OUT];
    return all.find((c) => c.key === key)?.label || key;
  };

  return (
    <View style={styles.container}>
      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Tama</Text>
          <Text style={[styles.summaryValue, { color: colors.moneyIn }]}>
            ${todayTotal('in').toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Sai</Text>
          <Text style={[styles.summaryValue, { color: colors.moneyOut }]}>
            ${todayTotal('out').toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Lukru</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            ${(todayTotal('in') - todayTotal('out')).toFixed(2)}
          </Text>
        </View>
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
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={24} color={colors.textTertiary} strokeWidth={1.5} />
            <Text style={styles.emptyText}>Tap iha butaun leten hodi hahu</Text>
            <Text style={styles.emptySubtext}>
              Tap a button above to start tracking
            </Text>
          </View>
        ) : (
          transactions.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={[
                styles.txIndicator,
                { backgroundColor: tx.type === 'in' ? colors.moneyIn : colors.moneyOut },
              ]} />
              <View style={styles.txLeft}>
                <Text style={styles.txCategory}>{getCategoryLabel(tx.category)}</Text>
                {tx.note ? (
                  <Text style={styles.txNote} numberOfLines={1}>{tx.note}</Text>
                ) : null}
                <Text style={styles.txTime}>{formatTime(tx.timestamp)}</Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  { color: tx.type === 'in' ? colors.moneyIn : colors.moneyOut },
                ]}
              >
                {tx.type === 'in' ? '+' : '-'}${tx.amount.toFixed(2)}
              </Text>
            </View>
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
            <TouchableOpacity onPress={saveTransaction} style={styles.modalHeaderBtn}>
              <Check size={20} color={colors.primary} strokeWidth={2.5} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
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

  // Big Buttons
  bigButtons: {
    flexDirection: 'row',
    padding: 16,
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
  txTime: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  txAmount: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
    fontVariant: ['tabular-nums'],
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
