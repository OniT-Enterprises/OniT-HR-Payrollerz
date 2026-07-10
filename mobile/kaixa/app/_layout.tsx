/**
 * Kaixa — Root Layout
 * Auth gate + dark theme StatusBar
 */
import { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { useTransactionStore } from '../stores/transactionStore';
import { useProductStore } from '../stores/productStore';
import { useCustomerTabStore } from '../stores/customerTabStore';
import { useBusinessProfileStore } from '../stores/businessProfileStore';
import { useVATStore } from '../stores/vatStore';
import { colors } from '../lib/colors';

export default function RootLayout() {
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const tenantId = useTenantStore((s) => s.tenantId);
  const tenantLoading = useTenantStore((s) => s.loading);
  const loadSavedTenant = useTenantStore((s) => s.loadSavedTenant);
  const setTenant = useTenantStore((s) => s.setTenant);
  const clearTenant = useTenantStore((s) => s.clearTenant);

  // Load saved tenant on login
  useEffect(() => {
    if (user) {
      loadSavedTenant();
    }
  }, [user, loadSavedTenant]);

  // Validate the saved tenant and fall back to the first current membership.
  useEffect(() => {
    if (!profile || tenantLoading) return;

    const entries = Object.entries(profile.tenantAccess || {});
    const savedTenant = tenantId ? profile.tenantAccess?.[tenantId] : undefined;
    if (tenantId && savedTenant) {
      setTenant(tenantId, savedTenant.name, savedTenant.role);
      return;
    }

    if (entries.length > 0) {
      const [id, info] = entries[0];
      setTenant(id, info.name, info.role);
    } else if (tenantId) {
      clearTenant();
    }
  }, [profile, tenantId, tenantLoading, setTenant, clearTenant]);

  // Tenant-scoped configuration must be ready before receipts, VAT, or reports run.
  useEffect(() => {
    if (!tenantId || !profile?.tenantAccess?.[tenantId]) return;

    useTransactionStore.getState().clear();
    useProductStore.getState().clear();
    useCustomerTabStore.getState().clear();
    useBusinessProfileStore.getState().clear();
    useVATStore.getState().clear();

    useBusinessProfileStore.getState().load(tenantId);
    useVATStore.getState().loadCached(tenantId).then(() => {
      useVATStore.getState().syncFromFirestore(tenantId);
    });
  }, [tenantId, profile]);

  // Never retain one operator's tenant data after their session ends.
  useEffect(() => {
    if (loading || user) return;
    useTenantStore.getState().clearTenant();
    useTransactionStore.getState().clear();
    useProductStore.getState().clear();
    useCustomerTabStore.getState().clear();
    useBusinessProfileStore.getState().clear();
    useVATStore.getState().clear();
  }, [loading, user]);

  const hasTenantAccess = Object.keys(profile?.tenantAccess || {}).length > 0;
  if (loading || (user && (tenantLoading || (hasTenantAccess && !tenantId)))) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
        <StatusBar style="light" />
      </View>
    );
  }

  if (user && profile && !hasTenantAccess) {
    return <NoBusinessAccess />;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" redirect={!user} />
        <Stack.Screen
          name="tax-filing"
          redirect={!user}
          options={{
            presentation: 'modal',
            headerShown: true,
            headerTitle: 'Deklarasaun VAT',
            headerStyle: { backgroundColor: colors.bgCard },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="(auth)" redirect={!!user} />
      </Stack>
    </>
  );
}

function NoBusinessAccess() {
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <View style={styles.noBusiness}>
      <StatusBar style="light" />
      <Image
        source={require('../assets/kaixa-logo-light-on-dark.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.noBusinessTitle}>Negósiu seidauk liga</Text>
      <Text style={styles.noBusinessText}>
        This account is not connected to a business yet. Ask the business owner
        to add your account in Xefe, then sign in again.
      </Text>
      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sai · Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noBusiness: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 190,
    height: 64,
    marginBottom: 32,
  },
  noBusinessTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  noBusinessText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  signOutButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  signOutText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
