/**
 * Kaixa design kit — Xefe · Kaixa flavor of the shared @xefe/mobile kit.
 *
 * One decorative accent (terracotta); functional fintech tones
 * (moneyIn/moneyOut/status) stay — they carry meaning, not decoration.
 * Screens keep importing SectionLabel/ChipIcon/EmptyCard from here.
 */
import { createKit } from '@xefe/mobile';
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
    success: { bg: 'rgba(74, 222, 128, 0.12)', fg: colors.success },
    warning: { bg: 'rgba(250, 204, 21, 0.12)', fg: colors.warning },
    error: { bg: 'rgba(248, 113, 113, 0.12)', fg: colors.error },
    moneyIn: { bg: 'rgba(52, 211, 153, 0.12)', fg: colors.moneyIn },
    moneyOut: { bg: 'rgba(248, 113, 113, 0.12)', fg: colors.moneyOut },
  },
  emptyImage: require('../assets/xefe-empty.webp'),
});
