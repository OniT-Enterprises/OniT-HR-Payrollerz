/**
 * Kaixa — Tab Navigation Layout
 * Dark theme with Lucide icons
 */
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Home, Wallet, ShoppingBag, User } from 'lucide-react-native';
import { colors } from '../../lib/colors';

const ICON_SIZE = 22;
const STROKE_WIDTH = 1.8;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.bg,
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
        },
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          color: colors.text,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
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
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Home
                size={ICON_SIZE}
                color={color}
                strokeWidth={focused ? 2.2 : STROKE_WIDTH}
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
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Wallet
                size={ICON_SIZE}
                color={color}
                strokeWidth={focused ? 2.2 : STROKE_WIDTH}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'Faan',
          tabBarLabel: 'Faan',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <ShoppingBag
                size={ICON_SIZE}
                color={color}
                strokeWidth={focused ? 2.2 : STROKE_WIDTH}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Konta',
          tabBarLabel: 'Konta',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <User
                size={ICON_SIZE}
                color={color}
                strokeWidth={focused ? 2.2 : STROKE_WIDTH}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconWrap: {
    backgroundColor: 'rgba(224, 141, 107, 0.12)',
    borderRadius: 10,
    padding: 4,
    marginTop: -2,
  },
});
