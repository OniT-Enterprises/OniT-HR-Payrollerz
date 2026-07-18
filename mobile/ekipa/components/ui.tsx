/**
 * Ekipa design kit — Xefe · Ekipa flavor of the shared @xefe/mobile kit.
 *
 * One decorative accent (Xefe olive); semantic tones for status only.
 * Screens keep importing SectionLabel/ChipIcon/EmptyCard from here.
 */
import { createKit } from '@xefe/mobile';
import { Inbox } from 'lucide-react-native';
import { colors } from '../lib/colors';

export const { SectionLabel, ChipIcon, EmptyCard } = createKit({
  tokens: {
    text: colors.text,
    textTertiary: colors.textTertiary,
    bgCard: colors.bgCard,
    border: colors.border,
  },
  tones: {
    primary: { bg: colors.primaryBg, fg: colors.primary },
    neutral: { bg: colors.bgElevated, fg: colors.textSecondary },
    success: { bg: colors.successBg, fg: colors.success },
    warning: { bg: colors.warningBg, fg: colors.warning },
    error: { bg: colors.errorBg, fg: colors.error },
  },
  // Icon-based empty states — matches the web dashboard (the kawaii
  // illustrations were retired with the line-art icon migration).
  emptyIcon: Inbox,
});
