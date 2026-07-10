/**
 * Xefe mobile design kit — themeable primitives shared by Ekipa and Kaixa.
 *
 * Each app calls createKit() with its own palette tokens and chip tones, and
 * re-exports the result from its local components/ui.tsx, so screens keep
 * importing SectionLabel/ChipIcon/EmptyCard exactly as before.
 *
 * Discipline rules the kit encodes:
 *  - ONE decorative accent per app (the app's primary). Icon chips are always
 *    tone-driven, never ad-hoc rainbow colors.
 *  - Semantic/status colors are reserved for STATE, never decoration.
 *  - Section headers are small uppercase editorial labels.
 *  - Empty states are quiet and friendly, never headline-sized placeholders.
 */
import { View, Text, Image, StyleSheet, type ViewStyle, type ImageSourcePropType } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

export interface KitTokens {
  /** Primary body text color */
  text: string;
  /** Muted/tertiary text (labels, hints) */
  textTertiary: string;
  /** Card surface */
  bgCard: string;
  /** Card border */
  border: string;
}

export interface ChipTone {
  bg: string;
  fg: string;
}

export interface KitConfig<Tones extends Record<string, ChipTone>> {
  tokens: KitTokens;
  /** Chip tone map — must include a `primary` entry (the default tone). */
  tones: Tones & { primary: ChipTone };
  /** Illustration shown by EmptyCard (app-local asset, e.g. xefe-empty.webp). */
  emptyImage: ImageSourcePropType;
}

export function createKit<Tones extends Record<string, ChipTone>>(
  config: KitConfig<Tones>,
) {
  const { tokens, tones, emptyImage } = config;

  const styles = StyleSheet.create({
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: tokens.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 12,
    },
    chip: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyCard: {
      backgroundColor: tokens.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: tokens.border,
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
      color: tokens.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: '500',
      color: tokens.textTertiary,
      textAlign: 'center',
      lineHeight: 18,
    },
  });

  /* ── SectionLabel — uppercase editorial section header ── */
  function SectionLabel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
    return <Text style={[styles.sectionLabel, style as object]}>{children}</Text>;
  }

  /* ── ChipIcon — the ONLY icon-chip treatment in the app ── */
  function ChipIcon({
    icon: Icon,
    tone = 'primary' as keyof Tones | 'primary',
    size = 40,
    iconSize,
  }: {
    icon: LucideIcon;
    tone?: keyof Tones | 'primary';
    size?: number;
    iconSize?: number;
  }) {
    const palette = tones[tone as keyof Tones] ?? tones.primary;
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
  function EmptyCard({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
      <View style={styles.emptyCard}>
        <Image source={emptyImage} style={styles.emptyImage} resizeMode="contain" />
        <Text style={styles.emptyTitle}>{title}</Text>
        {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
      </View>
    );
  }

  return { SectionLabel, ChipIcon, EmptyCard };
}
