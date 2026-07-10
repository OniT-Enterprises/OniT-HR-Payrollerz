/**
 * Kaixa — Tab Navigation Layout v2
 * Sharp, editorial dark theme. Refined tab bar with dot indicator.
 *
 * Bottom tabs: Home, Osan, Faan
 * Hidden tabs (still navigable): Tab (sales), Konta (profile)
 * Konta accessible via top-right header icon on all screens.
 */
import { Tabs, router } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { Home, Wallet, ShoppingBag, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../lib/colors';

const ICON_SIZE = 21;
const STROKE_DEFAULT = 1.6;
const STROKE_ACTIVE = 2.2;

function KontaHeaderButton() {
  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/profile')}
      style={styles.headerBtn}
      activeOpacity={0.7}
    >
      <User size={20} color={colors.textSecondary} strokeWidth={1.8} />
    </TouchableOpacity>
  );
}

function HeaderBrand() {
  return (
    <View style={styles.brandWrap}>
      <Image
        source={require('../../assets/xefe-mark.webp')}
        style={styles.brandMark}
        resizeMode="contain"
      />
      <View>
        <Text style={styles.brandOverline}>XEFE</Text>
        <Text style={styles.brandText}>Kaixa</Text>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.bg,
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: 0.5,
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
        headerRight: () => <KontaHeaderButton />,
        // ── Tab bar — floating dock: rounded island, active tab in a
        //    terracotta tint pill; content scrolls behind ──
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: [styles.tabBar, { bottom: insets.bottom + 12 }],
        tabBarItemStyle: styles.tabItem,
        tabBarActiveBackgroundColor: colors.primaryBg,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
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
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
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
        name="money"
        options={{
          title: 'Osan',
          tabBarLabel: 'Osan',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              <Wallet
                size={ICON_SIZE}
                color={color}
                strokeWidth={focused ? STROKE_ACTIVE : STROKE_DEFAULT}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: 'Faan',
          tabBarLabel: 'Faan',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              <ShoppingBag
                size={ICON_SIZE}
                color={color}
                strokeWidth={focused ? STROKE_ACTIVE : STROKE_DEFAULT}
              />
            </View>
          ),
        }}
      />
      {/* Hidden from bottom tab bar — still navigable via Quick Actions */}
      <Tabs.Screen
        name="sales"
        options={{
          title: 'Tab',
          href: null,
        }}
      />
      {/* Hidden from bottom tab bar — accessible via top-right header icon */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Konta',
          href: null,
          headerRight: undefined,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  /* ── Floating dock tab bar ─────────────────────── */
  tabBar: {
    position: 'absolute',
    // React Navigation pins the absolute tab bar to both edges; margins are
    // what actually inset the floating island.
    marginHorizontal: 64,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.bgCard,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingTop: 6,
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  tabItem: {
    // overflow-hidden + margins turn the active background into a rounded pill.
    borderRadius: 22,
    marginHorizontal: 6,
    marginVertical: 2,
    overflow: 'hidden',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  /* ── Brand (header left) ───────────────────────── */
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 16,
  },
  brandMark: {
    width: 26,
    height: 29,
  },
  brandOverline: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 2,
    marginBottom: -2,
  },
  brandText: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
});
