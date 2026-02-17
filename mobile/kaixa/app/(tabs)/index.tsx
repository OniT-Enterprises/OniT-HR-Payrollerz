/**
 * Kaixa — Home Screen v2
 * Sharp editorial dark theme. Premium fintech feel.
 *
 * Wired to transaction store — shows real today's data from Firestore.
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
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
    if (!tenantId) {
      Alert.alert('Avizu', 'Log in ba atu haree relatóriu');
      return;
    }
    setGeneratingReport(true);
    try {
      const { text } = await generateMonthlyReport(
        tenantId,
        bizProfile.businessName || tenantName || 'Kaixa'
      );
      await Share.share({ message: text });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Error', `Failed to generate report: ${msg}`);
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
      {/* Logo */}
      <View style={styles.logoRow}>
        <Image
          source={require('../../assets/kaixa-logo-light-on-dark.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Greeting */}
      <View style={styles.greetingContainer}>
        <Text style={styles.greetingText}>
          {greeting.tetum}, {firstName}
        </Text>
        <Text style={styles.dateText}>{getTodayFormatted()}</Text>
        {tenantName && <Text style={styles.tenantText}>{tenantName}</Text>}
      </View>

      {/* Hero Summary Card */}
      <View style={styles.summaryCard}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryGradientStrip}
        />
        <Text style={styles.summaryTitle}>OHIN</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <View style={styles.summaryIconRow}>
              <ArrowDownLeft size={13} color={colors.moneyIn} strokeWidth={2.5} />
              <Text style={styles.summaryLabel}>Tama</Text>
            </View>
            <Text style={[styles.summaryAmount, { color: colors.moneyIn }]}>
              ${totalIn().toFixed(2)}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <View style={styles.summaryIconRow}>
              <ArrowUpRight size={13} color={colors.moneyOut} strokeWidth={2.5} />
              <Text style={styles.summaryLabel}>Sai</Text>
            </View>
            <Text style={[styles.summaryAmount, { color: colors.moneyOut }]}>
              ${totalOut().toFixed(2)}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <View style={styles.summaryIconRow}>
              <Minus size={13} color={colors.primary} strokeWidth={2.5} />
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
      </View>

      {/* VAT Dashboard — only when VAT is active */}
      {vatActive && (
        <View style={styles.vatDashboard}>
          <View style={styles.vatDashHeader}>
            <View style={styles.vatDashIcon}>
              <Receipt size={14} color={colors.info} strokeWidth={2} />
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
          <TouchableOpacity
            style={styles.vatDashBtn}
            onPress={() => router.push('/tax-filing')}
            activeOpacity={0.7}
          >
            <FileBarChart size={13} color={colors.info} strokeWidth={2} />
            <Text style={styles.vatDashBtnText}>Deklarasaun VAT</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Aksaun Lalais</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.moneyInBg }]}
          onPress={() => router.push('/(tabs)/money?type=in')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(52, 211, 153, 0.12)' }]}>
            <TrendingUp size={20} color={colors.moneyIn} strokeWidth={2} />
          </View>
          <Text style={styles.actionLabel}>Osan Tama</Text>
          <Text style={styles.actionSub}>Money In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.moneyOutBg }]}
          onPress={() => router.push('/(tabs)/money?type=out')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(251, 113, 133, 0.12)' }]}>
            <TrendingDown size={20} color={colors.moneyOut} strokeWidth={2} />
          </View>
          <Text style={styles.actionLabel}>Osan Sai</Text>
          <Text style={styles.actionSub}>Money Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primaryGlow }]}
          onPress={() => router.push('/(tabs)/sell')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(224, 141, 107, 0.12)' }]}>
            <ShoppingBag size={20} color={colors.primary} strokeWidth={2} />
          </View>
          <Text style={styles.actionLabel}>Faan</Text>
          <Text style={styles.actionSub}>Sell</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: 'rgba(250, 204, 21, 0.06)' }]}
          onPress={() => router.push('/(tabs)/sales')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(250, 204, 21, 0.12)' }]}>
            <Users size={20} color={colors.warning} strokeWidth={2} />
          </View>
          <Text style={styles.actionLabel}>Tab</Text>
          <Text style={styles.actionSub}>Credit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: 'rgba(96, 165, 250, 0.06)' }]}
          onPress={handleMonthlyReport}
          disabled={generatingReport}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(96, 165, 250, 0.12)' }]}>
            {generatingReport ? (
              <ActivityIndicator size="small" color={colors.info} />
            ) : (
              <FileBarChart size={20} color={colors.info} strokeWidth={2} />
            )}
          </View>
          <Text style={styles.actionLabel}>Relatóriu</Text>
          <Text style={styles.actionSub}>Report</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: 'rgba(74, 222, 128, 0.06)' }]}
          onPress={() => router.push('/tax-filing')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(74, 222, 128, 0.12)' }]}>
            <Receipt size={20} color={colors.success} strokeWidth={2} />
          </View>
          <Text style={styles.actionLabel}>VAT</Text>
          <Text style={styles.actionSub}>Tax Filing</Text>
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
            <Clock size={24} color={colors.textTertiary} strokeWidth={1.5} />
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
                  styles.txDot,
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

  // Logo
  logoRow: {
    marginBottom: 20,
  },
  logo: {
    height: 36,
    width: 140,
  },

  // Greeting
  greetingContainer: {
    marginBottom: 24,
  },
  greetingText: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 4,
    letterSpacing: 0.1,
  },
  tenantText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 6,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },

  // Summary Card
  summaryCard: {
    borderRadius: 10,
    padding: 20,
    marginBottom: 24,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
    position: 'relative',
  },
  summaryGradientStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  summaryTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    marginBottom: 16,
    letterSpacing: 1.5,
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
    width: 0.5,
    height: 40,
    backgroundColor: colors.borderMedium,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  vatLine: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  vatLineText: {
    fontSize: 11,
    color: colors.textTertiary,
  },

  // VAT Dashboard
  vatDashboard: {
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(96, 165, 250, 0.15)',
  },
  vatDashHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  vatDashIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vatDashTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.info,
    letterSpacing: 0.3,
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
    width: 0.5,
    height: 28,
    backgroundColor: colors.borderMedium,
  },
  vatDashLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vatDashValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  vatDashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(96, 165, 250, 0.2)',
  },
  vatDashBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.info,
    letterSpacing: 0.1,
  },

  // Section Title
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // Quick Actions
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  actionButton: {
    width: '31%',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 0,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.1,
  },
  actionSub: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Recent Transactions
  recentList: {
    gap: 2,
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
  txTime: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },

  // Empty State
  emptyState: {
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    padding: 32,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
