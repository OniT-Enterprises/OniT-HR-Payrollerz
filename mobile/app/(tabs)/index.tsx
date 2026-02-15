/**
 * Kaixa — Home Screen
 * Dark theme with gradient hero summary, Lucide icons, warm accents
 */
import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Minus,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { colors } from '../../lib/colors';

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
  const [refreshing, setRefreshing] = useState(false);

  const greeting = getGreeting();
  const firstName = profile?.displayName?.split(' ')[0] || 'User';

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Refresh data from Firestore
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
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
              $0.00
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <View style={styles.summaryIconRow}>
              <ArrowUpRight size={14} color={colors.moneyOut} strokeWidth={2.5} />
              <Text style={styles.summaryLabel}>Sai</Text>
            </View>
            <Text style={[styles.summaryAmount, { color: colors.moneyOut }]}>
              $0.00
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <View style={styles.summaryIconRow}>
              <Minus size={14} color={colors.primary} strokeWidth={2.5} />
              <Text style={styles.summaryLabel}>Lukru</Text>
            </View>
            <Text style={[styles.summaryAmount, { color: colors.text }]}>
              $0.00
            </Text>
          </View>
        </View>
      </LinearGradient>

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
          onPress={() => router.push('/(tabs)/sales')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(224, 141, 107, 0.15)' }]}>
            <ShoppingBag size={22} color={colors.primary} strokeWidth={2} />
          </View>
          <Text style={styles.actionLabel}>Faan</Text>
          <Text style={styles.actionSub}>Sell</Text>
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
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Clock size={28} color={colors.textTertiary} strokeWidth={1.5} />
        </View>
        <Text style={styles.emptyText}>Seidauk iha transasaun</Text>
        <Text style={styles.emptySubtext}>
          Tap Money In or Money Out to start tracking
        </Text>
      </View>
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
    width: '47%',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  actionSub: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
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
