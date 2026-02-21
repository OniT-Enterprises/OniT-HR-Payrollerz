/**
 * Ekipa — Services Tab
 * Stripe-style landing page layout with hero, grouped sections, mixed card sizes.
 */
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import {
  FileText, CalendarDays, Users, Star, CalendarClock, Shield, ClipboardCheck, ChevronRight,
} from 'lucide-react-native';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';

const SCREEN_W = Dimensions.get('window').width;
const PAIR_GAP = 12;
const PAIR_W = (SCREEN_W - 40 - PAIR_GAP) / 2;

export default function ServicesScreen() {
  const t = useT();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ══ Hero ═══════════════════════════════════ */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{t('services.hero')}</Text>
        <Text style={styles.heroSub}>{t('services.heroSub')}</Text>
      </View>

      {/* ══ Tax — full-width featured card ═════════ */}
      <TouchableOpacity
        style={styles.featCard}
        onPress={() => router.push('/screens/TaxSummary')}
        activeOpacity={0.7}
      >
        <View style={styles.featRow}>
          <View style={[styles.featIcon, { backgroundColor: colors.blueBg }]}>
            <FileText size={22} color={colors.blue} strokeWidth={1.8} />
          </View>
          <View style={styles.featText}>
            <Text style={styles.featTitle}>{t('home.taxSummary')}</Text>
            <Text style={styles.featDesc}>{t('services.taxSub')}</Text>
          </View>
          <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
        </View>
      </TouchableOpacity>

      {/* ══ Calendar — section ═════════════════════ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('services.calendarSection')}</Text>
        <Text style={styles.sectionSub}>{t('services.calendarSectionSub')}</Text>
        <View style={styles.pair}>
          <TouchableOpacity
            style={styles.pairCard}
            onPress={() => router.push('/screens/HolidayCalendar')}
            activeOpacity={0.7}
          >
            <View style={[styles.pairIcon, { backgroundColor: colors.violetBg }]}>
              <CalendarDays size={20} color={colors.violet} strokeWidth={1.8} />
            </View>
            <Text style={styles.pairLabel}>{t('home.holidays')}</Text>
            <Text style={styles.pairDesc}>{t('services.holidaysSub')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pairCard}
            onPress={() => router.push('/screens/ShiftSchedule')}
            activeOpacity={0.7}
          >
            <View style={[styles.pairIcon, { backgroundColor: colors.orangeBg }]}>
              <CalendarClock size={20} color={colors.orange} strokeWidth={1.8} />
            </View>
            <Text style={styles.pairLabel}>{t('home.shifts')}</Text>
            <Text style={styles.pairDesc}>{t('services.shiftsSub')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ People — section ══════════════════════ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('services.peopleSection')}</Text>
        <Text style={styles.sectionSub}>{t('services.peopleSectionSub')}</Text>
        <View style={styles.pair}>
          <TouchableOpacity
            style={styles.pairCard}
            onPress={() => router.push('/screens/Directory')}
            activeOpacity={0.7}
          >
            <View style={[styles.pairIcon, { backgroundColor: colors.blueBg }]}>
              <Users size={20} color={colors.blue} strokeWidth={1.8} />
            </View>
            <Text style={styles.pairLabel}>{t('home.directory')}</Text>
            <Text style={styles.pairDesc}>{t('services.directorySub')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pairCard}
            onPress={() => router.push('/screens/Recognition')}
            activeOpacity={0.7}
          >
            <View style={[styles.pairIcon, { backgroundColor: colors.amberBg }]}>
              <Star size={20} color={colors.amber} strokeWidth={1.8} />
            </View>
            <Text style={styles.pairLabel}>{t('home.recognition')}</Text>
            <Text style={styles.pairDesc}>{t('services.recognitionSub')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ Tools — grouped rows in a card ════════ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('services.toolsSection')}</Text>
        <Text style={styles.sectionSub}>{t('services.toolsSectionSub')}</Text>
        <View style={styles.rowList}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/screens/WageAlerts')} activeOpacity={0.7}>
            <View style={[styles.rowIcon, { backgroundColor: colors.amberBg }]}>
              <Shield size={18} color={colors.amber} strokeWidth={1.8} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{t('home.wageCheck')}</Text>
              <Text style={styles.rowDesc}>{t('services.wageSub')}</Text>
            </View>
            <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity style={styles.row} onPress={() => router.push('/screens/ManagerApprovals')} activeOpacity={0.7}>
            <View style={[styles.rowIcon, { backgroundColor: colors.primaryBg }]}>
              <ClipboardCheck size={18} color={colors.primary} strokeWidth={1.8} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{t('home.approvals')}</Text>
              <Text style={styles.rowDesc}>{t('services.approvalsSub')}</Text>
            </View>
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

  /* ── Featured card (full-width) ──────────── */
  featCard: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 32,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  featText: { flex: 1 },
  featTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  featDesc: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textTertiary,
    lineHeight: 17,
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
    marginBottom: 3,
  },
  pairDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
    lineHeight: 16,
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
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 1,
  },
  rowDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
  },
});
