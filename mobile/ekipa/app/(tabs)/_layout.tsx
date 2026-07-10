/**
 * Ekipa — Tab Navigation Layout
 * Premium dark theme header bar with brand name + profile avatar.
 * 4 tabs: Home, Actions, Services, Time
 * Profile, Payslips, Leave accessible as hidden screens (not in tab bar).
 */
import { Tabs, router } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Home, Zap, Briefcase, Clock, User, Bell } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { useEmployeeStore } from '../../stores/employeeStore';
import { useAuthStore } from '../../stores/authStore';
import { useAnnouncementStore } from '../../stores/announcementStore';

const ICON_SIZE = 21;
const STROKE_DEFAULT = 1.6;
const STROKE_ACTIVE = 2.2;

/* ── Header Right — Profile Avatar ──────────────────── */
function HeaderProfileButton() {
  const employee = useEmployeeStore((s) => s.employee);
  const initials = employee
    ? `${(employee.firstName?.[0] || '').toUpperCase()}${(employee.lastName?.[0] || '').toUpperCase()}`
    : '';

  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/profile')}
      activeOpacity={0.7}
      style={styles.profileBtn}
    >
      {initials ? (
        <Text style={styles.profileInitials}>{initials}</Text>
      ) : (
        <User size={18} color={colors.primary} strokeWidth={2} />
      )}
    </TouchableOpacity>
  );
}

function HeaderActions() {
  const uid = useAuthStore((s) => s.user?.uid);
  const announcements = useAnnouncementStore((s) => s.announcements);
  const unread = uid
    ? announcements.filter((announcement) => !announcement.readBy?.[uid]).length
    : 0;

  return (
    <View style={styles.headerActions}>
      <TouchableOpacity
        onPress={() => router.push('/screens/Announcements')}
        activeOpacity={0.7}
        style={styles.notificationBtn}
        accessibilityRole="button"
        accessibilityLabel="Announcements"
      >
        <Bell size={19} color={colors.textSecondary} strokeWidth={1.9} />
        {unread > 0 ? (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      <HeaderProfileButton />
    </View>
  );
}

/* ── Header Left — Brand ────────────────────────────── */
function HeaderBrand() {
  return (
    <View style={styles.brandWrap}>
      <View style={styles.brandDot} />
      <Text style={styles.brandText}>Ekipa</Text>
    </View>
  );
}

export default function TabLayout() {
  const t = useT();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        // ── Custom header — dark with brand + profile ──
        headerStyle: {
          backgroundColor: colors.bg,
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 17,
          color: colors.text,
          letterSpacing: -0.3,
        },
        headerTitle: '',
        headerLeft: () => <HeaderBrand />,
        headerRight: () => <HeaderActions />,
        // ── Tab bar — dark bg, subtle top border, green active ──
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingBottom: Math.max(4, insets.bottom),
          paddingTop: 8,
          height: 58 + insets.bottom,
          shadowColor: 'transparent',
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 4,
          letterSpacing: 0.2,
        },
        sceneStyle: {
          backgroundColor: colors.bg,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarLabel: t('nav.home'),
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.activeDot} />}
              <Home
                size={ICON_SIZE}
                color={color}
                strokeWidth={focused ? STROKE_ACTIVE : STROKE_DEFAULT}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="actions"
        options={{
          title: t('nav.actions'),
          tabBarLabel: t('nav.actions'),
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.activeDot} />}
              <Zap
                size={ICON_SIZE}
                color={color}
                strokeWidth={focused ? STROKE_ACTIVE : STROKE_DEFAULT}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: t('nav.services'),
          tabBarLabel: t('nav.services'),
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.activeDot} />}
              <Briefcase
                size={ICON_SIZE}
                color={color}
                strokeWidth={focused ? STROKE_ACTIVE : STROKE_DEFAULT}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="crew"
        options={{
          title: t('nav.time'),
          tabBarLabel: t('nav.time'),
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.activeDot} />}
              <Clock
                size={ICON_SIZE}
                color={color}
                strokeWidth={focused ? STROKE_ACTIVE : STROKE_DEFAULT}
              />
            </View>
          ),
        }}
      />
      {/* Hidden tabs — still navigable as screens, not in tab bar */}
      <Tabs.Screen
        name="payslips"
        options={{
          title: t('nav.payslips'),
          href: null,
        }}
      />
      <Tabs.Screen
        name="leave"
        options={{
          title: t('nav.leave'),
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    top: -8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },

  /* ── Brand (header left) ───────────────────────── */
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 16,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  brandText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.8,
  },

  /* ── Profile button (header right) ──────────── */
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 16,
  },
  notificationBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  notificationBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.textInverse,
  },
});
