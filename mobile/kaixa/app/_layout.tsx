/**
 * Kaixa — Root Layout
 * Auth gate + dark theme StatusBar
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { colors } from '../lib/colors';

export default function RootLayout() {
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const tenantId = useTenantStore((s) => s.tenantId);
  const loadSavedTenant = useTenantStore((s) => s.loadSavedTenant);
  const setTenant = useTenantStore((s) => s.setTenant);

  // Load saved tenant on login
  useEffect(() => {
    if (user) {
      loadSavedTenant();
    }
  }, [user, loadSavedTenant]);

  // Auto-select tenant if none saved
  useEffect(() => {
    if (!profile || tenantId) return;

    // If user has Meza tenantAccess, use the first one
    if (profile.tenantAccess) {
      const entries = Object.entries(profile.tenantAccess);
      if (entries.length > 0) {
        const [id, info] = entries[0];
        setTenant(id, info.name, info.role);
        return;
      }
    }

    // Standalone Kaixa user — use UID as personal tenant
    setTenant(profile.uid, profile.displayName || 'Kaixa', 'owner');
  }, [profile, tenantId, setTenant]);

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
        <StatusBar style="light" />
      </View>
    );
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

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
