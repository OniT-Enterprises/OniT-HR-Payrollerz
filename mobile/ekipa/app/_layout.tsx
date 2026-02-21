/**
 * Ekipa — Root Layout
 * Auth gate + tenant/employee resolution
 * Dark theme StatusBar
 */
import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { useEmployeeStore } from '../stores/employeeStore';
import { useI18nStore, t } from '../lib/i18n';
import { colors } from '../lib/colors';

export default function RootLayout() {
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const tenantError = useTenantStore((s) => s.error);
  const loadSavedTenant = useTenantStore((s) => s.loadSavedTenant);
  const setTenant = useTenantStore((s) => s.setTenant);
  const resolveEmployee = useTenantStore((s) => s.resolveEmployee);
  const fetchEmployee = useEmployeeStore((s) => s.fetchEmployee);
  const loadLanguage = useI18nStore((s) => s.loadLanguage);
  const signOut = useAuthStore((s) => s.signOut);

  // Load saved language
  useEffect(() => {
    loadLanguage();
  }, [loadLanguage]);

  // Load saved tenant on login
  useEffect(() => {
    if (user) {
      loadSavedTenant();
    }
  }, [user, loadSavedTenant]);

  // Auto-select tenant from profile.tenantAccess (no standalone fallback)
  useEffect(() => {
    if (!profile || tenantId) return;

    if (profile.tenantAccess) {
      const entries = Object.entries(profile.tenantAccess);
      if (entries.length > 0) {
        const [id, info] = entries[0];
        setTenant(id, info.name, info.role);
      }
    }
    // No standalone fallback — if no tenantAccess, user sees error
  }, [profile, tenantId, setTenant]);

  // Resolve employeeId from member doc once tenant is set
  useEffect(() => {
    if (user && tenantId && !employeeId) {
      resolveEmployee(user.uid);
    }
  }, [user, tenantId, employeeId, resolveEmployee]);

  // Fetch employee record once we have employeeId
  useEffect(() => {
    if (tenantId && employeeId) {
      fetchEmployee(tenantId, employeeId);
    }
  }, [tenantId, employeeId, fetchEmployee]);

  // Loading splash
  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
        <StatusBar style="light" />
      </View>
    );
  }

  // Logged in but no tenant access
  if (user && profile && !profile.tenantAccess) {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />
        <Text style={styles.errorTitle}>{t('login.error.noAccess')}</Text>
        <Text style={styles.errorSub}>
          Contact your HR administrator to get access.
        </Text>
        <TouchableOpacity style={styles.errorButton} onPress={signOut}>
          <Text style={styles.errorButtonText}>{t('profile.signOut')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Logged in, has tenant, but no employeeId
  if (user && tenantId && tenantError === 'noEmployee') {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />
        <Text style={styles.errorTitle}>{t('login.error.noAccess')}</Text>
        <Text style={styles.errorSub}>
          Your account is not linked to an employee record.
        </Text>
        <TouchableOpacity style={styles.errorButton} onPress={signOut}>
          <Text style={styles.errorButtonText}>{t('profile.signOut')}</Text>
        </TouchableOpacity>
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
        <Stack.Screen name="(tabs)" redirect={!user || !employeeId} />
        <Stack.Screen
          name="screens/PayslipDetail"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="screens/LeaveRequestForm"
          redirect={!user || !employeeId}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="screens/CrewClockIn"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="screens/CrewClockOut"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="screens/QRScanner"
          redirect={!user || !employeeId}
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="screens/SyncQueue"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="screens/CrewHistory"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="screens/AttendanceHistory"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="screens/DigitalIDCard"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="screens/EmploymentLetterRequest"
          redirect={!user || !employeeId}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="screens/Announcements"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="screens/EditProfile"
          redirect={!user || !employeeId}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="screens/ShiftSchedule"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="screens/ExpenseForm"
          redirect={!user || !employeeId}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="screens/Expenses"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="screens/TaxSummary"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="screens/HolidayCalendar"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="screens/ManagerApprovals"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="screens/Recognition"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="screens/Directory"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="screens/GrievanceReport"
          redirect={!user || !employeeId}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="screens/WageAlerts"
          redirect={!user || !employeeId}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
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
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
