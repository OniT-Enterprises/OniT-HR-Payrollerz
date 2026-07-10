/**
 * Ekipa design kit — shared primitives for the Xefe · Ekipa design language.
 *
 * Discipline rules (apply everywhere):
 *  - ONE accent: colors.primary (Xefe olive). Module icon chips are always
 *    primary-on-primaryBg or neutral — never per-module rainbow colors.
 *  - Semantic colors (success/warning/error/pending…) are reserved for STATUS
 *    (badges, deltas), never for decoration.
 *  - Section headers are small uppercase editorial labels (SectionLabel).
 *  - Empty states are quiet and friendly (EmptyCard / the illustrated
 *    EmptyState), never headline-sized placeholder text.
 */
import { View, Text, Image, StyleSheet, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors } from '../lib/colors';

/* ── SectionLabel — uppercase editorial section header ── */
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <Text style={[styles.sectionLabel, style as object]}>{children}</Text>;
}

/* ── ChipIcon — the ONLY icon-chip treatment in the app ── */
type ChipTone = 'primary' | 'neutral' | 'success' | 'warning' | 'error';

const CHIP_TONES: Record<ChipTone, { bg: string; fg: string }> = {
  primary: { bg: colors.primaryBg, fg: colors.primary },
  neutral: { bg: colors.bgElevated, fg: colors.textSecondary },
  success: { bg: colors.successBg, fg: colors.success },
  warning: { bg: colors.warningBg, fg: colors.warning },
  error: { bg: colors.errorBg, fg: colors.error },
};

export function ChipIcon({
  icon: Icon,
  tone = 'primary',
  size = 40,
  iconSize,
}: {
  icon: LucideIcon;
  tone?: ChipTone;
  size?: number;
  iconSize?: number;
}) {
  const palette = CHIP_TONES[tone];
  return (
    <View
      style={[
        styles.chip,
        { width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: palette.bg },
      ]}
    >
      <Icon size={iconSize ?? Math.round(size * 0.45)} color={palette.fg} strokeWidth={1.8} />
    </View>
  );
}

/* ── EmptyCard — quiet inline empty state with the Xefe illustration ── */
export function EmptyCard({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.emptyCard}>
      <Image
        source={require('../assets/xefe-empty.webp')}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  emptyImage: {
    width: 96,
    height: 96,
    marginBottom: 10,
    opacity: 0.9,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
