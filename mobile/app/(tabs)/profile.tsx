/**
 * Kaixa — Profile / Settings Screen (Konta)
 * Dark theme with gradient avatar, warm accents
 */
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  LogOut,
  Globe,
  DollarSign,
  Bell,
  Info,
  ChevronRight,
  Building2,
  RefreshCw,
} from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { colors } from '../../lib/colors';

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const { tenantName, tenantId, role, clearTenant } = useTenantStore();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          clearTenant();
          signOut();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>
            {(profile?.displayName || 'U')[0].toUpperCase()}
          </Text>
        </LinearGradient>
        <Text style={styles.name}>{profile?.displayName || 'User'}</Text>
        <Text style={styles.email}>{profile?.email || ''}</Text>
      </View>

      {/* Tenant Info */}
      {tenantId && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Building2 size={14} color={colors.textTertiary} strokeWidth={2} />
            <Text style={styles.sectionTitle}>NEGOSIU</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Naran</Text>
            <Text style={styles.infoValue}>{tenantName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Papel</Text>
            <Text style={styles.infoValue}>{role}</Text>
          </View>
          {profile?.tenantAccess &&
            Object.keys(profile.tenantAccess).length > 1 && (
              <TouchableOpacity style={styles.switchButton} activeOpacity={0.7}>
                <RefreshCw size={14} color={colors.primary} strokeWidth={2} />
                <Text style={styles.switchButtonText}>Troka Negosiu</Text>
              </TouchableOpacity>
            )}
        </View>
      )}

      {/* Settings */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Info size={14} color={colors.textTertiary} strokeWidth={2} />
          <Text style={styles.sectionTitle}>DEFINISAUN</Text>
        </View>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.6}>
          <View style={styles.menuLeft}>
            <Globe size={18} color={colors.textSecondary} strokeWidth={1.8} />
            <Text style={styles.menuText}>Lian (Language)</Text>
          </View>
          <View style={styles.menuRight}>
            <Text style={styles.menuValue}>Tetun</Text>
            <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.6}>
          <View style={styles.menuLeft}>
            <DollarSign size={18} color={colors.textSecondary} strokeWidth={1.8} />
            <Text style={styles.menuText}>Moeda (Currency)</Text>
          </View>
          <View style={styles.menuRight}>
            <Text style={styles.menuValue}>USD ($)</Text>
            <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.6}>
          <View style={styles.menuLeft}>
            <Bell size={18} color={colors.textSecondary} strokeWidth={1.8} />
            <Text style={styles.menuText}>Notifikasaun</Text>
          </View>
          <View style={styles.menuRight}>
            <Text style={styles.menuValue}>On</Text>
            <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
          </View>
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.section}>
        <View style={styles.menuItem}>
          <Text style={styles.menuText}>Versaun</Text>
          <Text style={styles.menuValue}>0.1.0</Text>
        </View>
        <View style={[styles.menuItem, { borderBottomWidth: 0 }]}>
          <Text style={styles.menuText}>Powered by</Text>
          <Text style={[styles.menuValue, { color: colors.primary }]}>Meza</Text>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        activeOpacity={0.7}
      >
        <LogOut size={18} color={colors.error} strokeWidth={2} />
        <Text style={styles.signOutText}>Sai (Sign Out)</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Kaixa by OniT - Timor-Leste</Text>
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

  // Profile Card
  profileCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  email: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Sections
  section: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  infoLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  switchButton: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(224, 141, 107, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(224, 141, 107, 0.2)',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  switchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // Menu Items
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuText: {
    fontSize: 15,
    color: colors.text,
  },
  menuValue: {
    fontSize: 14,
    color: colors.textTertiary,
  },

  // Sign Out
  signOutButton: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },

  footer: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 24,
  },
});
