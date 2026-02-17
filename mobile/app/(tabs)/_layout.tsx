/**
 * Kaixa — Tab Navigation Layout v2
 * Sharp, editorial dark theme. Refined tab bar with dot indicator.
 *
 * Bottom tabs: Home, Osan, Faan
 * Hidden tabs (still navigable): Tab (sales), Konta (profile)
 * Konta accessible via top-right header icon on all screens.
 */
import { Tabs, router } from 'expo-router';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Home, Wallet, ShoppingBag, User } from 'lucide-react-native';
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

export default function TabLayout() {
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
        headerRight: () => <KontaHeaderButton />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          paddingBottom: 2,
          paddingTop: 10,
          height: 68,
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
          title: 'Home',
          tabBarLabel: 'Home',
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
        name="money"
        options={{
          title: 'Osan',
          tabBarLabel: 'Osan',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.activeDot} />}
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
              {focused && <View style={styles.activeDot} />}
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
