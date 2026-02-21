/**
 * Card — dark theme card container for Ekipa.
 * Default: dark card (#1F2937), subtle border, no shadows.
 * Subtle: slightly different dark (#1A2332), no border.
 */
import { View, StyleSheet, type ViewProps } from 'react-native';
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
  },
  subtle: {
    backgroundColor: colors.bgSubtle,
    borderWidth: 0,
    borderColor: colors.transparent,
  },
});
