/**
 * Ekipa — Actions Tab
 * Stripe-style landing page layout with hero, content sections, mixed card sizes.
 */
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import {
  Calendar, FileText, Clock, CreditCard, Megaphone, Receipt, ArrowRight, ChevronRight,
} from 'lucide-react-native';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';

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
          <View style={[styles.bannerIcon, { backgroundColor: colors.violetBg }]}>
            <Calendar size={22} color={colors.violet} strokeWidth={1.8} />
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>{t('actions.leaveHero')}</Text>
            <Text style={styles.bannerDesc}>{t('actions.leaveHeroSub')}</Text>
          </View>
        </View>
        <View style={styles.bannerBtn}>
          <Text style={styles.bannerBtnText}>{t('actions.leaveBtn')}</Text>
          <ArrowRight size={14} color={colors.textInverse} strokeWidth={2.5} />
        </View>
      </TouchableOpacity>

      {/* ══ Your Money — section ═══════════════════ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('actions.paySection')}</Text>
        <Text style={styles.sectionSub}>{t('actions.paySectionSub')}</Text>
        <View style={styles.pair}>
          <TouchableOpacity
            style={styles.pairCard}
            onPress={() => router.push('/(tabs)/payslips')}
            activeOpacity={0.7}
          >
            <View style={[styles.pairIcon, { backgroundColor: colors.blueBg }]}>
              <FileText size={20} color={colors.blue} strokeWidth={1.8} />
            </View>
            <Text style={styles.pairLabel}>{t('home.viewPayslips')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pairCard}
            onPress={() => router.push('/screens/Expenses')}
            activeOpacity={0.7}
          >
            <View style={[styles.pairIcon, { backgroundColor: colors.emeraldBg }]}>
              <Receipt size={20} color={colors.emerald} strokeWidth={1.8} />
            </View>
            <Text style={styles.pairLabel}>{t('home.expenses')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ Your Time — section ═══════════════════ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('actions.timeSection')}</Text>
        <Text style={styles.sectionSub}>{t('actions.timeSectionSub')}</Text>
        <View style={styles.pair}>
          <TouchableOpacity
            style={styles.pairCard}
            onPress={() => router.push('/(tabs)/leave')}
            activeOpacity={0.7}
          >
            <View style={[styles.pairIcon, { backgroundColor: colors.violetBg }]}>
              <Calendar size={20} color={colors.violet} strokeWidth={1.8} />
            </View>
            <Text style={styles.pairLabel}>{t('home.leaveBalance')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pairCard}
            onPress={() => router.push('/screens/AttendanceHistory')}
            activeOpacity={0.7}
          >
            <View style={[styles.pairIcon, { backgroundColor: colors.emeraldBg }]}>
              <Clock size={20} color={colors.emerald} strokeWidth={1.8} />
            </View>
            <Text style={styles.pairLabel}>{t('home.attendance')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ Quick Access — compact rows ═══════════ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('actions.quickSection')}</Text>
        <View style={styles.rowList}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/screens/DigitalIDCard')} activeOpacity={0.7}>
            <View style={[styles.rowIcon, { backgroundColor: colors.primaryBg }]}>
              <CreditCard size={18} color={colors.primary} strokeWidth={1.8} />
            </View>
            <Text style={styles.rowLabel}>{t('home.digitalId')}</Text>
            <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity style={styles.row} onPress={() => router.push('/screens/Announcements')} activeOpacity={0.7}>
            <View style={[styles.rowIcon, { backgroundColor: colors.tealBg }]}>
              <Megaphone size={18} color={colors.teal} strokeWidth={1.8} />
            </View>
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
  content: { paddingBottom: 48 },

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
    marginBottom: 32,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  bannerText: { flex: 1 },
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
    backgroundColor: colors.violet,
    borderRadius: 10,
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
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textTertiary,
    marginBottom: 14,
    lineHeight: 18,
  },

  /* ── Pair cards (2-up) ───────────────────── */
  pair: {
    flexDirection: 'row',
    gap: PAIR_GAP,
  },
  pairCard: {
    width: PAIR_W,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pairIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pairLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },

  /* ── Row list (grouped in a card) ────────── */
  rowList: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
