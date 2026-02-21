/**
 * Ekipa — Grievance Report Screen
 * Premium dark theme with error red (#EF4444) accent.
 * Anonymous grievance submission + status check by ticket ID.
 */
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ShieldAlert,
  Send,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Ticket,
  Copy,
} from 'lucide-react-native';
import { useTenantStore } from '../../stores/tenantStore';
import { useGrievanceStore } from '../../stores/grievanceStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import type { GrievanceCategory, GrievanceStatus } from '../../types/grievance';

const CATEGORIES: { id: GrievanceCategory; labelKey: string }[] = [
  { id: 'harassment', labelKey: 'grievance.harassment' },
  { id: 'wage_issue', labelKey: 'grievance.wageIssue' },
  { id: 'safety_concern', labelKey: 'grievance.safetyConcern' },
  { id: 'discrimination', labelKey: 'grievance.discrimination' },
  { id: 'other', labelKey: 'grievance.other' },
];

const STATUS_CONFIG: Record<GrievanceStatus, { icon: typeof Clock; color: string; labelKey: string }> = {
  submitted: { icon: Clock, color: colors.warning, labelKey: 'grievance.statusSubmitted' },
  reviewing: { icon: AlertTriangle, color: colors.blue, labelKey: 'grievance.statusReviewing' },
  resolved: { icon: CheckCircle2, color: colors.success, labelKey: 'grievance.statusResolved' },
  dismissed: { icon: XCircle, color: colors.textTertiary, labelKey: 'grievance.statusDismissed' },
};

export default function GrievanceReport() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId);

  const submitting = useGrievanceStore((s) => s.submitting);
  const checking = useGrievanceStore((s) => s.checking);
  const trackedGrievance = useGrievanceStore((s) => s.trackedGrievance);
  const error = useGrievanceStore((s) => s.error);
  const submitGrievance = useGrievanceStore((s) => s.submitGrievance);
  const checkStatus = useGrievanceStore((s) => s.checkStatus);

  // Form state
  const [category, setCategory] = useState<GrievanceCategory>('harassment');
  const [description, setDescription] = useState('');
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  // Status check state
  const [checkTicketId, setCheckTicketId] = useState('');

  const canSubmit = !!tenantId && description.trim().length >= 20 && !submitting;

  const handleSubmit = async () => {
    if (!tenantId) return;

    if (description.trim().length < 20) {
      Alert.alert(t('common.error'), t('grievance.minDescription'));
      return;
    }

    const ticketId = await submitGrievance({
      tenantId,
      category,
      description: description.trim(),
    });

    if (ticketId) {
      setSubmittedTicketId(ticketId);
      setDescription('');
    } else {
      Alert.alert(t('common.error'), t('grievance.submitError'));
    }
  };

  const handleCheckStatus = async () => {
    if (!tenantId || !checkTicketId.trim()) return;
    await checkStatus(tenantId, checkTicketId.trim().toUpperCase());
  };

  const handleCopyTicket = async (ticketId: string) => {
    try {
      await Share.share({ message: `${t('grievance.title')} — Ticket: ${ticketId}` });
    } catch {
      // User cancelled share
    }
  };

  // After successful submission — show ticket ID
  if (submittedTicketId) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>{t('grievance.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.successContainer}>
          <View style={styles.successIconWrap}>
            <CheckCircle2 size={48} color={colors.success} strokeWidth={1.5} />
          </View>
          <Text style={styles.successTitle}>{t('grievance.submitted')}</Text>
          <Text style={styles.successMessage}>{t('grievance.ticketMessage')}</Text>

          {/* Ticket ID display */}
          <View style={styles.ticketIdCard}>
            <Ticket size={20} color={colors.warning} strokeWidth={2} />
            <Text style={styles.ticketIdText}>{submittedTicketId}</Text>
            <TouchableOpacity
              onPress={() => handleCopyTicket(submittedTicketId)}
              style={styles.copyBtn}
              activeOpacity={0.7}
            >
              <Copy size={16} color={colors.blue} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <Text style={styles.ticketWarning}>{t('grievance.saveTicketWarning')}</Text>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => {
              setSubmittedTicketId(null);
              router.back();
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>{t('grievance.done')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.newReportBtn}
            onPress={() => setSubmittedTicketId(null)}
            activeOpacity={0.7}
          >
            <Text style={styles.newReportBtnText}>{t('grievance.newReport')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* ── Red hero header ─────────────────────────────── */}
      <View style={styles.heroHeader}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.heroDecor3} />

        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtnHero} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{t('grievance.title')}</Text>
          </View>
          <View style={styles.backBtnHero} />
        </View>

        <View style={styles.heroContent}>
          <ShieldAlert size={32} color={colors.white} strokeWidth={1.8} />
          <Text style={styles.heroSubtext}>{t('grievance.heroSubtext')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* ── Anonymous notice ──────────────────────────── */}
        <View style={styles.anonymousNotice}>
          <ShieldAlert size={20} color={colors.success} strokeWidth={2} />
          <Text style={styles.anonymousText}>{t('grievance.anonymousNotice')}</Text>
        </View>

        {/* ── Category selector ────────────────────────── */}
        <Text style={styles.label}>{t('grievance.categoryLabel')}</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                category === cat.id && styles.categoryChipActive,
              ]}
              onPress={() => setCategory(cat.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  category === cat.id && styles.categoryChipTextActive,
                ]}
              >
                {t(cat.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Description ──────────────────────────────── */}
        <Text style={styles.label}>{t('grievance.descriptionLabel')}</Text>
        <TextInput
          style={styles.textarea}
          value={description}
          onChangeText={setDescription}
          placeholder={t('grievance.descriptionPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>
          {description.length}/20 {t('grievance.minChars')}
        </Text>

        {/* ── Submit button ────────────────────────────── */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Send size={18} color={colors.white} strokeWidth={2.5} />
              <Text style={styles.submitBtnText}>{t('grievance.submit')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Divider ──────────────────────────────────── */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('grievance.or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ── Check Status ─────────────────────────────── */}
        <Text style={styles.sectionTitle}>{t('grievance.checkStatus')}</Text>
        <Text style={styles.sectionSubtext}>{t('grievance.checkStatusSub')}</Text>

        <View style={styles.checkRow}>
          <TextInput
            style={styles.ticketInput}
            value={checkTicketId}
            onChangeText={setCheckTicketId}
            placeholder={t('grievance.ticketPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="characters"
            maxLength={8}
          />
          <TouchableOpacity
            style={[styles.checkBtn, (!checkTicketId.trim() || checking) && styles.btnDisabled]}
            onPress={handleCheckStatus}
            disabled={!checkTicketId.trim() || checking}
            activeOpacity={0.85}
          >
            {checking ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Search size={18} color={colors.white} strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        </View>

        {/* Status result */}
        {error === 'notFound' && (
          <View style={styles.statusCard}>
            <XCircle size={20} color={colors.error} strokeWidth={2} />
            <Text style={styles.statusNotFound}>{t('grievance.notFound')}</Text>
          </View>
        )}

        {trackedGrievance && (
          <View style={styles.statusCard}>
            {(() => {
              const config = STATUS_CONFIG[trackedGrievance.status];
              const StatusIcon = config.icon;
              return (
                <>
                  <View style={styles.statusHeader}>
                    <StatusIcon size={22} color={config.color} strokeWidth={2} />
                    <Text style={[styles.statusLabel, { color: config.color }]}>
                      {t(config.labelKey)}
                    </Text>
                  </View>
                  <View style={styles.statusDetails}>
                    <View style={styles.statusDetailRow}>
                      <Text style={styles.statusDetailLabel}>{t('grievance.categoryLabel')}</Text>
                      <Text style={styles.statusDetailValue}>
                        {t(CATEGORIES.find((c) => c.id === trackedGrievance.category)?.labelKey || 'grievance.other')}
                      </Text>
                    </View>
                    <View style={styles.statusDetailRow}>
                      <Text style={styles.statusDetailLabel}>{t('grievance.submittedOn')}</Text>
                      <Text style={styles.statusDetailValue}>
                        {trackedGrievance.createdAt
                          ? trackedGrievance.createdAt.toLocaleDateString()
                          : '--'}
                      </Text>
                    </View>
                    {trackedGrievance.resolution && (
                      <View style={styles.statusDetailRow}>
                        <Text style={styles.statusDetailLabel}>{t('grievance.resolution')}</Text>
                        <Text style={styles.statusDetailValue}>{trackedGrievance.resolution}</Text>
                      </View>
                    )}
                  </View>
                </>
              );
            })()}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // ── Header bar (for success page) ───────────────────
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.bgCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Red hero header ─────────────────────────────────
  heroHeader: {
    backgroundColor: colors.error,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  heroDecor1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroDecor2: {
    position: 'absolute',
    bottom: -24,
    left: 16,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroDecor3: {
    position: 'absolute',
    top: 30,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  backBtnHero: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleWhite: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.3,
  },
  heroContent: {
    alignItems: 'center',
    paddingTop: 12,
    gap: 8,
  },
  heroSubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },

  // ── Content ─────────────────────────────────────────
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // ── Anonymous notice ────────────────────────────────
  anonymousNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.successBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    marginBottom: 20,
  },
  anonymousText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
    lineHeight: 20,
  },

  // ── Labels ──────────────────────────────────────────
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    marginBottom: 10,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Category chips ──────────────────────────────────
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  categoryChipActive: {
    backgroundColor: colors.error,
    borderColor: colors.error,
    ...Platform.select({
      ios: {
        shadowColor: colors.error,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: colors.white,
  },

  // ── Textarea ────────────────────────────────────────
  textarea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bgCard,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
    marginTop: 6,
    textAlign: 'right',
  },

  // ── Submit button ───────────────────────────────────
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    borderRadius: 14,
    padding: 16,
    backgroundColor: colors.error,
    ...Platform.select({
      ios: {
        shadowColor: colors.error,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  btnDisabled: {
    opacity: 0.5,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },

  // ── Divider ─────────────────────────────────────────
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderMedium,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
    paddingHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Check status section ────────────────────────────
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtext: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textTertiary,
    marginBottom: 16,
  },
  checkRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ticketInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
    backgroundColor: colors.bgCard,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  checkBtn: {
    width: 50,
    borderRadius: 12,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.blue,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },

  // ── Status result card ──────────────────────────────
  statusCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  statusNotFound: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusDetails: {
    gap: 8,
    marginTop: 4,
  },
  statusDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusDetailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statusDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },

  // ── Success page ────────────────────────────────────
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  ticketIdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 2,
    borderColor: colors.warning,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: colors.warning,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  ticketIdText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.warning,
    letterSpacing: 3,
    flex: 1,
    textAlign: 'center',
  },
  copyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketWarning: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
  },
  doneBtn: {
    width: '100%',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.primary,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  newReportBtn: {
    padding: 12,
  },
  newReportBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
