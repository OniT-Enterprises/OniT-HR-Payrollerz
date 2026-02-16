/**
 * Kaixa — Customer Tabs Screen (Tab Kliente)
 * Track informal credit: who owes you, who you owe.
 *
 * "João owes me $15" — the credit notebook replacement.
 * Dark theme, warm accents. Tetum-first labels.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {
  UserPlus,
  DollarSign,
  CheckCircle,
  MessageCircle,
  Trash2,
  X,
  Plus,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useTenantStore } from '../../stores/tenantStore';
import {
  useCustomerTabStore,
  type CustomerTab,
} from '../../stores/customerTabStore';
import { colors } from '../../lib/colors';

export default function CustomerTabsScreen() {
  const { tenantId } = useTenantStore();
  const {
    tabs,
    loading,
    totalOwed,
    activeTabCount,
    loadTabs,
    addCustomer,
    addEntry,
    deleteCustomer,
  } = useCustomerTabStore();

  // Modal state
  const [addCustomerModal, setAddCustomerModal] = useState(false);
  const [entryModal, setEntryModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<CustomerTab | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryType, setEntryType] = useState<'debt' | 'payment'>('debt');
  const [entryNote, setEntryNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Load on mount
  useEffect(() => {
    if (tenantId) {
      loadTabs(tenantId);
    }
  }, [tenantId, loadTabs]);

  const handleAddCustomer = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    if (!tenantId) return;

    setSaving(true);
    try {
      await addCustomer(tenantId, newName.trim(), newPhone.trim());
      setAddCustomerModal(false);
      setNewName('');
      setNewPhone('');
    } catch {
      Alert.alert('Error', 'Failed to add customer');
    } finally {
      setSaving(false);
    }
  };

  const openEntryModal = (tab: CustomerTab, type: 'debt' | 'payment') => {
    setSelectedTab(tab);
    setEntryType(type);
    setEntryAmount('');
    setEntryNote('');
    setEntryModal(true);
  };

  const handleAddEntry = async () => {
    const parsed = parseFloat(entryAmount);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!tenantId || !selectedTab) return;

    setSaving(true);
    try {
      await addEntry(
        tenantId,
        selectedTab.id,
        Math.round(parsed * 100) / 100,
        entryType,
        entryNote.trim()
      );
      setEntryModal(false);
    } catch {
      Alert.alert('Error', 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (tab: CustomerTab) => {
    Alert.alert(
      'Delete',
      `Remove ${tab.customerName}? All history will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (tenantId) {
              try {
                await deleteCustomer(tenantId, tab.id);
              } catch {
                Alert.alert('Error', 'Failed to delete');
              }
            }
          },
        },
      ]
    );
  };

  const sendWhatsAppReminder = useCallback((tab: CustomerTab) => {
    if (!tab.phone) {
      Alert.alert('No phone', 'Add a phone number first');
      return;
    }
    const phone = tab.phone.replace(/[^0-9+]/g, '');
    const msg = `Bondia ${tab.customerName}, ita-boot iha devida $${tab.balance.toFixed(2)}. Favor selu bainhira bele. Obrigadu!`;
    const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'WhatsApp not installed');
    });
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      timeZone: 'Asia/Dili',
    });

  return (
    <View style={styles.container}>
      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>KLIENTE</Text>
          <Text style={styles.summaryValue}>{activeTabCount()}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>TOTAL DEVIDA</Text>
          <Text style={[styles.summaryValue, { color: colors.warning }]}>
            ${totalOwed().toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Customer List */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
      >
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : tabs.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Users size={32} color={colors.textTertiary} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyText}>Seidauk iha kliente</Text>
            <Text style={styles.emptySubtext}>
              Tap + to add a customer and track credit
            </Text>
          </View>
        ) : (
          tabs.map((tab) => (
            <View key={tab.id} style={styles.tabCard}>
              {/* Customer Header */}
              <TouchableOpacity
                style={styles.tabHeader}
                onPress={() => toggleExpand(tab.id)}
                activeOpacity={0.7}
              >
                <View style={styles.tabLeft}>
                  <View
                    style={[
                      styles.tabAvatar,
                      {
                        backgroundColor:
                          tab.balance > 0
                            ? 'rgba(250, 204, 21, 0.15)'
                            : 'rgba(74, 222, 128, 0.15)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabAvatarText,
                        {
                          color:
                            tab.balance > 0 ? colors.warning : colors.moneyIn,
                        },
                      ]}
                    >
                      {tab.customerName[0].toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.tabName}>{tab.customerName}</Text>
                    {tab.phone ? (
                      <Text style={styles.tabPhone}>{tab.phone}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.tabRight}>
                  <Text
                    style={[
                      styles.tabBalance,
                      {
                        color:
                          tab.balance > 0
                            ? colors.warning
                            : tab.balance < 0
                              ? colors.moneyIn
                              : colors.textTertiary,
                      },
                    ]}
                  >
                    ${Math.abs(tab.balance).toFixed(2)}
                  </Text>
                  {tab.balance > 0 && (
                    <Text style={styles.tabOwesLabel}>devida</Text>
                  )}
                  {expandedId === tab.id ? (
                    <ChevronUp
                      size={16}
                      color={colors.textTertiary}
                      strokeWidth={2}
                    />
                  ) : (
                    <ChevronDown
                      size={16}
                      color={colors.textTertiary}
                      strokeWidth={2}
                    />
                  )}
                </View>
              </TouchableOpacity>

              {/* Expanded: Actions + History */}
              {expandedId === tab.id && (
                <View style={styles.tabExpanded}>
                  {/* Quick Actions */}
                  <View style={styles.tabActions}>
                    <TouchableOpacity
                      style={[
                        styles.tabActionBtn,
                        { backgroundColor: 'rgba(250, 204, 21, 0.1)' },
                      ]}
                      onPress={() => openEntryModal(tab, 'debt')}
                      activeOpacity={0.7}
                    >
                      <DollarSign
                        size={16}
                        color={colors.warning}
                        strokeWidth={2}
                      />
                      <Text
                        style={[styles.tabActionText, { color: colors.warning }]}
                      >
                        + Devida
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.tabActionBtn,
                        { backgroundColor: 'rgba(74, 222, 128, 0.1)' },
                      ]}
                      onPress={() => openEntryModal(tab, 'payment')}
                      activeOpacity={0.7}
                    >
                      <CheckCircle
                        size={16}
                        color={colors.moneyIn}
                        strokeWidth={2}
                      />
                      <Text
                        style={[styles.tabActionText, { color: colors.moneyIn }]}
                      >
                        Selu
                      </Text>
                    </TouchableOpacity>

                    {tab.phone && (
                      <TouchableOpacity
                        style={[
                          styles.tabActionBtn,
                          { backgroundColor: 'rgba(74, 222, 128, 0.1)' },
                        ]}
                        onPress={() => sendWhatsAppReminder(tab)}
                        activeOpacity={0.7}
                      >
                        <MessageCircle
                          size={16}
                          color={colors.moneyIn}
                          strokeWidth={2}
                        />
                        <Text
                          style={[
                            styles.tabActionText,
                            { color: colors.moneyIn },
                          ]}
                        >
                          WhatsApp
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.tabActionBtn,
                        { backgroundColor: 'rgba(248, 113, 113, 0.1)' },
                      ]}
                      onPress={() => handleDelete(tab)}
                      activeOpacity={0.7}
                    >
                      <Trash2
                        size={16}
                        color={colors.error}
                        strokeWidth={2}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Entry History */}
                  {tab.entries.length > 0 && (
                    <View style={styles.historyList}>
                      <Text style={styles.historyTitle}>ISTORIA</Text>
                      {[...tab.entries]
                        .reverse()
                        .slice(0, 10)
                        .map((entry) => (
                          <View key={entry.id} style={styles.historyRow}>
                            <View
                              style={[
                                styles.historyDot,
                                {
                                  backgroundColor:
                                    entry.type === 'debt'
                                      ? colors.warning
                                      : colors.moneyIn,
                                },
                              ]}
                            />
                            <Text style={styles.historyDate}>
                              {formatDate(entry.date)}
                            </Text>
                            <Text style={styles.historyNote}>
                              {entry.note ||
                                (entry.type === 'debt' ? 'Devida' : 'Pagamentu')}
                            </Text>
                            <Text
                              style={[
                                styles.historyAmount,
                                {
                                  color:
                                    entry.type === 'debt'
                                      ? colors.warning
                                      : colors.moneyIn,
                                },
                              ]}
                            >
                              {entry.type === 'debt' ? '+' : '-'}$
                              {entry.amount.toFixed(2)}
                            </Text>
                          </View>
                        ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB — Add Customer */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setNewName('');
          setNewPhone('');
          setAddCustomerModal(true);
        }}
        activeOpacity={0.85}
      >
        <Plus size={28} color={colors.white} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Add Customer Modal */}
      <Modal
        visible={addCustomerModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddCustomerModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setAddCustomerModal(false)}
              style={styles.modalHeaderBtn}
            >
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Kliente Foun</Text>
            <TouchableOpacity
              onPress={handleAddCustomer}
              style={styles.modalHeaderBtn}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <UserPlus
                  size={20}
                  color={colors.primary}
                  strokeWidth={2}
                />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>NARAN</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Customer name"
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />

            <Text style={styles.modalLabel}>TELEFONE (optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={newPhone}
              onChangeText={setNewPhone}
              placeholder="+670 7xxx xxxx"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
            />
          </View>
        </View>
      </Modal>

      {/* Add Entry Modal */}
      <Modal
        visible={entryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEntryModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setEntryModal(false)}
              style={styles.modalHeaderBtn}
            >
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {entryType === 'debt'
                ? `${selectedTab?.customerName} — Devida`
                : `${selectedTab?.customerName} — Pagamentu`}
            </Text>
            <TouchableOpacity
              onPress={handleAddEntry}
              style={styles.modalHeaderBtn}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <CheckCircle
                  size={20}
                  color={colors.primary}
                  strokeWidth={2}
                />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>MONTANTE</Text>
            <View
              style={[
                styles.amountContainer,
                {
                  borderColor:
                    entryType === 'debt' ? colors.warning : colors.moneyIn,
                },
              ]}
            >
              <Text style={styles.amountPrefix}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={entryAmount}
                onChangeText={setEntryAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            {selectedTab && selectedTab.balance > 0 && entryType === 'payment' && (
              <TouchableOpacity
                style={styles.payFullBtn}
                onPress={() =>
                  setEntryAmount(selectedTab.balance.toFixed(2))
                }
                activeOpacity={0.7}
              >
                <Text style={styles.payFullText}>
                  Selu hotu ${selectedTab.balance.toFixed(2)}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.modalLabel}>NOTA (optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={entryNote}
              onChangeText={setEntryNote}
              placeholder="e.g. cigarettes, phone credit"
              placeholderTextColor={colors.textTertiary}
            />
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

  // Summary
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
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },

  // List
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listContent: {
    paddingBottom: 100,
  },

  // Tab Card
  tabCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  tabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  tabLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  tabAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabAvatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  tabName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  tabPhone: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 1,
  },
  tabRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  tabBalance: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  tabOwesLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Expanded
  tabExpanded: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    padding: 14,
    paddingTop: 12,
  },
  tabActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tabActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabActionText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // History
  historyList: {
    marginTop: 14,
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  historyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  historyDate: {
    fontSize: 12,
    color: colors.textTertiary,
    width: 50,
    fontVariant: ['tabular-nums'],
  },
  historyNote: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
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
    flex: 1,
    textAlign: 'center',
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
  modalInput: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    fontSize: 16,
    color: colors.text,
  },

  // Amount
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
  },
  amountPrefix: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.textTertiary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  payFullBtn: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  payFullText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.moneyIn,
  },
});
