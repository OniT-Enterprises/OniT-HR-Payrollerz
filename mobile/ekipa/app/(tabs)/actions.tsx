/**
 * Ekipa — Actions Tab
 * Xefe · Ekipa design language: one olive accent, editorial section labels,
 * hero intro, full-width leave banner, mixed card sizes.
 */
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import {
  Calendar, FileText, Clock, CreditCard, Megaphone, Receipt, ArrowRight, ChevronRight,
} from 'lucide-react-native';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { SectionLabel, ChipIcon } from '../../components/ui';

const SCREEN_W = Dimensions.get('window').width;
const PAIR_GAP = 12;
const PAIR_W = (SCREEN_W - 40 - PAIR_GAP) / 2;

export default function ActionsScreen() {
  const t = useT();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ══ Hero — big CTA block ═══════════════════ */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{t('actions.hero')}</Text>
        <Text style={styles.heroSub}>{t('actions.heroSub')}</Text>
      </View>

      {/* ══ Leave — full-width banner ══════════════ */}
      <TouchableOpacity
        style={styles.banner}
        onPress={() => router.push('/screens/LeaveRequestForm')}
        activeOpacity={0.7}
      >
        <View style={styles.bannerContent}>
          <Image
            source={require('../../assets/xefe-card-leave.webp')}
            style={styles.bannerImage}
            resizeMode="contain"
          />
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>{t('actions.leaveHero')}</Text>
            <Text style={styles.bannerDesc}>{t('actions.leaveHeroSub')}</Text>
          </View>
        </View>
        <View style={styles.bannerBtn}>
          <Text style={styles.bannerBtnText}>{t('actions.leaveBtn')}</Text>
          <ArrowRight size={14} color={colors.white} strokeWidth={2.5} />
        </View>
      </TouchableOpacity>

      {/* ══ Your Money — section ═══════════════════ */}
      <View style={styles.section}>
        <SectionLabel>{t('actions.paySection')}</SectionLabel>
        <View style={styles.pair}>
          <TouchableOpacity
            style={styles.pairCard}
            onPress={() => router.push('/(tabs)/payslips')}
            activeOpacity={0.7}
          >
            <ChipIcon icon={FileText} />
            <Text style={styles.pairLabel}>{t('home.viewPayslips')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pairCard}
            onPress={() => router.push('/screens/Expenses')}
            activeOpacity={0.7}
          >
            <ChipIcon icon={Receipt} />
            <Text style={styles.pairLabel}>{t('home.expenses')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ Your Time — section ═══════════════════ */}
      <View style={styles.section}>
        <SectionLabel>{t('actions.timeSection')}</SectionLabel>
        <View style={styles.pair}>
          <TouchableOpacity
            style={styles.pairCard}
            onPress={() => router.push('/(tabs)/leave')}
            activeOpacity={0.7}
          >
            <ChipIcon icon={Calendar} />
            <Text style={styles.pairLabel}>{t('home.leaveBalance')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pairCard}
            onPress={() => router.push('/screens/AttendanceHistory')}
            activeOpacity={0.7}
          >
            <ChipIcon icon={Clock} />
            <Text style={styles.pairLabel}>{t('home.attendance')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ Quick Access — compact rows ═══════════ */}
      <View style={styles.section}>
        <SectionLabel>{t('actions.quickSection')}</SectionLabel>
        <View style={styles.rowList}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/screens/DigitalIDCard')} activeOpacity={0.7}>
            <ChipIcon icon={CreditCard} size={36} />
            <Text style={styles.rowLabel}>{t('home.digitalId')}</Text>
            <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity style={styles.row} onPress={() => router.push('/screens/Announcements')} activeOpacity={0.7}>
            <ChipIcon icon={Megaphone} size={36} />
            <Text style={styles.rowLabel}>{t('home.announcements')}</Text>
            <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 120 },

  /* ── Hero ─────────────────────────────────── */
  hero: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 22,
  },

  /* ── Banner (full-width CTA) ─────────────── */
  banner: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 28,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  bannerText: { flex: 1 },
  bannerImage: {
    width: 52,
    height: 62,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  bannerDesc: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textTertiary,
    lineHeight: 18,
  },
  bannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bannerBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },

  /* ── Section ─────────────────────────────── */
  section: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },

  /* ── Pair cards (2-up) ───────────────────── */
  pair: {
    flexDirection: 'row',
    gap: PAIR_GAP,
  },
  pairCard: {
    width: PAIR_W,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pairLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },

  /* ── Row list (grouped in a card) ────────── */
  rowList: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
