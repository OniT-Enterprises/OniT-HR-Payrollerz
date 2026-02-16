/**
 * Kaixa — Home Screen
 * Dark theme with gradient hero summary, Lucide icons, warm accents
 *
 * Wired to transaction store — shows real today's data from Firestore.
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Minus,
  Receipt,
  FileBarChart,
  ShoppingBag,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { useTransactionStore } from '../../stores/transactionStore';
import { useVATStore } from '../../stores/vatStore';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';
import { colors } from '../../lib/colors';
import { generateMonthlyReport } from '../../lib/monthlyReport';

function getGreeting(): { tetum: string; english: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { tetum: 'Bondia', english: 'Good morning' };
  if (hour < 18) return { tetum: 'Botarde', english: 'Good afternoon' };
  return { tetum: 'Bonite', english: 'Good evening' };
}

function getTodayFormatted(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Dili',
  });
}

export default function HomeScreen() {
  const profile = useAuthStore((s) => s.profile);
  const tenantName = useTenantStore((s) => s.tenantName);
  const tenantId = useTenantStore((s) => s.tenantId);

  // Transaction data
  const {
    loading,
    totalIn,
    totalOut,
    totalNet,
    recentTransactions,
    loadRange,
  } = useTransactionStore();

  // VAT
  const vatActive = useVATStore((s) => s.isVATActive());
  const vatRate = useVATStore((s) => s.effectiveRate());
  const periodVAT = useTransactionStore((s) => s.totalVAT());
  const bizProfile = useBusinessProfileStore((s) => s.profile);

  const [generatingReport, setGeneratingReport] = useState(false);

  const greeting = getGreeting();
  const firstName = profile?.displayName?.split(' ')[0] || 'User';
  const recent = recentTransactions(5);

  // Load today's transactions on mount
  useEffect(() => {
    if (tenantId) {
      loadRange(tenantId, 'today');
    }
  }, [tenantId, loadRange]);

  const onRefresh = async () => {
    if (tenantId) {
      await loadRange(tenantId, 'today');
    }
  };

  const handleMonthlyReport = async () => {
    if (!tenantId) return;
    setGeneratingReport(true);
    try {
      const { text } = await generateMonthlyReport(
        tenantId,
        bizProfile.businessName || tenantName || 'Kaixa'
      );
      await Share.share({ message: text });
    } catch {
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Dili',
    });

  const getCategoryLabel = (key: string): string => {
    const labels: Record<string, string> = {
      sales: 'Venda',
      service: 'Servisu',
      payment_received: 'Pagamentu',
      other_income: 'Seluk',
      stock: 'Estoke',
      rent: 'Alugel',
      supplies: 'Fornese',
      salary: 'Saláriu',
      transport: 'Transporte',
      food: 'Hahan',
      other_expense: 'Seluk',
    };
    return labels[key] || key;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          progressBackgroundColor={colors.bgCard}
        />
      }
    >
      {/* Greeting */}
      <View style={styles.greetingContainer}>
        <Text style={styles.greetingText}>
          {greeting.tetum}, {firstName}
        </Text>
        <Text style={styles.dateText}>{getTodayFormatted()}</Text>
        {tenantName && <Text style={styles.tenantText}>{tenantName}</Text>}
      </View>

      {/* Hero Summary Card */}
      <LinearGradient
        colors={[colors.bgCard, colors.bgElevated]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.summaryCard}
      >
        <Text style={styles.summaryTitle}>OHIN (TODAY)</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <View style={styles.summaryIconRow}>
              <ArrowDownLeft size={14} color={colors.moneyIn} strokeWidth={2.5} />
              <Text style={styles.summaryLabel}>Tama</Text>
            </View>
            <Text style={[styles.summaryAmount, { color: colors.moneyIn }]}>
              ${totalIn().toFixed(2)}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <View style={styles.summaryIconRow}>
              <ArrowUpRight size={14} color={colors.moneyOut} strokeWidth={2.5} />
              <Text style={styles.summaryLabel}>Sai</Text>
            </View>
            <Text style={[styles.summaryAmount, { color: colors.moneyOut }]}>
              ${totalOut().toFixed(2)}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <View style={styles.summaryIconRow}>
              <Minus size={14} color={colors.primary} strokeWidth={2.5} />
              <Text style={styles.summaryLabel}>Lukru</Text>
            </View>
            <Text style={[styles.summaryAmount, { color: colors.text }]}>
              ${totalNet().toFixed(2)}
            </Text>
          </View>
        </View>

        {/* VAT line — only when active */}
        {vatActive && periodVAT > 0 && (
          <View style={styles.vatLine}>
            <Text style={styles.vatLineText}>
              VAT simu ohin: ${periodVAT.toFixed(2)}
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* VAT Dashboard — only when VAT is active */}
      {vatActive && (
        <View style={styles.vatDashboard}>
          <View style={styles.vatDashHeader}>
            <View style={styles.vatDashIcon}>
              <Receipt size={16} color={colors.info} strokeWidth={2} />
            </View>
            <Text style={styles.vatDashTitle}>VAT {vatRate}%</Text>
          </View>
          <View style={styles.vatDashRow}>
            <View style={styles.vatDashItem}>
              <Text style={styles.vatDashLabel}>Simu ohin</Text>
              <Text style={styles.vatDashValue}>${periodVAT.toFixed(2)}</Text>
            </View>
            <View style={styles.vatDashDivider} />
            <View style={styles.vatDashItem}>
              <Text style={styles.vatDashLabel}>Transasaun</Text>
              <Text style={styles.vatDashValue}>
                {recentTransactions(999).filter((t) => t.vatAmount > 0).length}
              </Text>
            </View>
          </View>
          <Text style={styles.vatDashHint}>
            Haree Money tab ba detalle VAT
          </Text>
        </View>
      )}

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Aksaun Lalais</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.moneyInBg, borderColor: 'rgba(74, 222, 128, 0.15)' }]}
          onPress={() => router.push('/(tabs)/money?type=in')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
            <TrendingUp size={22} color={colors.moneyIn} strokeWidth={2} />
          </View>
          <Text style={styles.actionLabel}>Osan Tama</Text>
          <Text style={styles.actionSub}>Money In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.moneyOutBg, borderColor: 'rgba(248, 113, 113, 0.15)' }]}
          onPress={() => router.push('/(tabs)/money?type=out')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(248, 113, 113, 0.15)' }]}>
            <TrendingDown size={22} color={colors.moneyOut} strokeWidth={2} />
          </View>
          <Text style={styles.actionLabel}>Osan Sai</Text>
          <Text style={styles.actionSub}>Money Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: 'rgba(224, 141, 107, 0.08)', borderColor: 'rgba(224, 141, 107, 0.15)' }]}
          onPress={() => router.push('/(tabs)/sell')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(224, 141, 107, 0.15)' }]}>
            <ShoppingBag size={22} color={colors.primary} strokeWidth={2} />
          </View>
          <Text style={styles.actionLabel}>Faan</Text>
          <Text style={styles.actionSub}>Sell</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: 'rgba(250, 204, 21, 0.08)', borderColor: 'rgba(250, 204, 21, 0.15)' }]}
          onPress={() => router.push('/(tabs)/sales')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(250, 204, 21, 0.15)' }]}>
            <Users size={22} color={colors.warning} strokeWidth={2} />
          </View>
          <Text style={styles.actionLabel}>Tab</Text>
          <Text style={styles.actionSub}>Credit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: 'rgba(96, 165, 250, 0.08)', borderColor: 'rgba(96, 165, 250, 0.15)' }]}
          onPress={handleMonthlyReport}
          disabled={generatingReport}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(96, 165, 250, 0.15)' }]}>
            {generatingReport ? (
              <ActivityIndicator size="small" color={colors.info} />
            ) : (
              <FileBarChart size={22} color={colors.info} strokeWidth={2} />
            )}
          </View>
          <Text style={styles.actionLabel}>Relatóriu</Text>
          <Text style={styles.actionSub}>Report</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: 'rgba(77, 179, 163, 0.08)', borderColor: 'rgba(77, 179, 163, 0.15)' }]}
          onPress={() => router.push('/(tabs)/money')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(77, 179, 163, 0.15)' }]}>
            <Clock size={22} color={colors.secondary} strokeWidth={2} />
          </View>
          <Text style={styles.actionLabel}>Istoria</Text>
          <Text style={styles.actionSub}>History</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Transactions */}
      <Text style={styles.sectionTitle}>Movimentu Ikus</Text>
      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : recent.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Clock size={28} color={colors.textTertiary} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyText}>Seidauk iha transasaun</Text>
          <Text style={styles.emptySubtext}>
            Tap Money In or Money Out to start tracking
          </Text>
        </View>
      ) : (
        <View style={styles.recentList}>
          {recent.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View
                style={[
                  styles.txIndicator,
                  {
                    backgroundColor:
                      tx.type === 'in' ? colors.moneyIn : colors.moneyOut,
                  },
                ]}
              />
              <View style={styles.txLeft}>
                <Text style={styles.txCategory}>
                  {getCategoryLabel(tx.category)}
                </Text>
                {tx.note ? (
                  <Text style={styles.txNote} numberOfLines={1}>
                    {tx.note}
                  </Text>
                ) : null}
                <Text style={styles.txTime}>{formatTime(tx.timestamp)}</Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  {
                    color:
                      tx.type === 'in' ? colors.moneyIn : colors.moneyOut,
                  },
                ]}
              >
                {tx.type === 'in' ? '+' : '-'}${tx.amount.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // Greeting
  greetingContainer: {
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  dateText: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 2,
  },
  tenantText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },

  // Summary Card
  summaryCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    marginBottom: 16,
    letterSpacing: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  summaryDivider: {
    width: 1,
    height: 44,
    backgroundColor: colors.border,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  vatLine: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    alignItems: 'center',
  },
  vatLineText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },

  // VAT Dashboard
  vatDashboard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
  },
  vatDashHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  vatDashIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vatDashTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.info,
  },
  vatDashRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vatDashItem: {
    flex: 1,
    alignItems: 'center',
  },
  vatDashDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  vatDashLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
    marginBottom: 2,
  },
  vatDashValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  vatDashHint: {
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },

  // Section Title
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Quick Actions
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  actionButton: {
    width: '30%',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  actionSub: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Recent Transactions
  recentList: {
    gap: 8,
  },
  txRow: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    paddingLeft: 18,
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
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
