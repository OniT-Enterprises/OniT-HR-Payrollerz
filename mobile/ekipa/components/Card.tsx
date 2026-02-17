/**
 * Card — elevated card container with shadow for Ekipa light theme
 */
import { View, StyleSheet, Platform, type ViewProps } from 'react-native';
import { colors } from '../lib/colors';

interface CardProps extends ViewProps {
  variant?: 'default' | 'subtle';
}

export function Card({ children, variant = 'default', style, ...props }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        variant === 'subtle' && styles.subtle,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    // Shadow
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  subtle: {
    backgroundColor: colors.bgSubtle,
    borderColor: colors.transparent,
    ...Platform.select({
      ios: {
        shadowOpacity: 0,
      },
      android: {
        elevation: 0,
      },
    }),
  },
});
