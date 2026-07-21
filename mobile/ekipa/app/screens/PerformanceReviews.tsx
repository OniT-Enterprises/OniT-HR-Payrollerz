import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, CheckCircle2, ClipboardCheck, Star } from 'lucide-react-native';
import { useTenantStore } from '../../stores/tenantStore';
import { useReviewStore } from '../../stores/reviewStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { EmptyState } from '../../components/EmptyState';
import { ChipIcon } from '../../components/ui';

export default function PerformanceReviews() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((state) => state.tenantId);
  const employeeId = useTenantStore((state) => state.employeeId);
  const reviews = useReviewStore((state) => state.reviews);
  const loading = useReviewStore((state) => state.loading);
  const savingId = useReviewStore((state) => state.savingId);
  const error = useReviewStore((state) => state.error);
  const fetchReviews = useReviewStore((state) => state.fetchReviews);
  const acknowledge = useReviewStore((state) => state.acknowledge);
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (tenantId && employeeId) void fetchReviews(tenantId, employeeId);
  }, [employeeId, fetchReviews, tenantId]);

  const submitAcknowledgement = async (reviewId: string) => {
    if (!tenantId) return;
    const saved = await acknowledge(tenantId, reviewId, comments[reviewId]);
    Alert.alert(
      saved ? t('common.success') : t('common.error'),
      saved ? t('reviews.acknowledged') : t('reviews.saveError'),
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('reviews.title')}</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error === 'fetchError' ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('reviews.fetchError')}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => tenantId && employeeId && fetchReviews(tenantId, employeeId)}
          >
            <Text style={styles.primaryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : reviews.length === 0 ? (
        <EmptyState
          title={t('reviews.empty')}
          subtitle={t('reviews.emptySub')}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>{t('reviews.intro')}</Text>
          {reviews.map((review) => (
            <View key={review.id} style={styles.card}>
              <View style={styles.cardTitleRow}>
                <ChipIcon icon={ClipboardCheck} size={24} />
                <View style={styles.titleCopy}>
                  <Text style={styles.cardTitle}>{review.reviewType.replace('_', ' ')}</Text>
                  <Text style={styles.meta}>
                    {review.reviewPeriodStart} – {review.reviewPeriodEnd}
                  </Text>
                </View>
                <View style={styles.rating}>
                  <Star size={15} color={colors.warning} />
                  <Text style={styles.ratingText}>{review.overallRating}/5</Text>
                </View>
              </View>

              <ReviewField label={t('reviews.reviewer')} value={review.reviewerName} />
              <ReviewField label={t('reviews.strengths')} value={review.strengths} />
              <ReviewField label={t('reviews.improvements')} value={review.areasForImprovement} />
              <ReviewField label={t('reviews.comments')} value={review.managerComments} />
              <ReviewField label={t('reviews.plan')} value={review.developmentPlan} />

              {review.competencies.length > 0 && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t('reviews.competencies')}</Text>
                  {review.competencies.map((competency) => (
                    <Text key={competency.name} style={styles.fieldValue}>
                      {competency.name}: {competency.rating}/5
                    </Text>
                  ))}
                </View>
              )}

              {review.status === 'submitted' ? (
                <View style={styles.ackBox}>
                  <Text style={styles.fieldLabel}>{t('reviews.yourComments')}</Text>
                  <TextInput
                    style={styles.input}
                    multiline
                    maxLength={2000}
                    value={comments[review.id] || ''}
                    onChangeText={(value) => setComments((current) => ({ ...current, [review.id]: value }))}
                    placeholder={t('reviews.commentsPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                  />
                  <TouchableOpacity
                    style={[styles.primaryButton, savingId === review.id && styles.disabled]}
                    disabled={savingId === review.id}
                    onPress={() => submitAcknowledgement(review.id)}
                  >
                    {savingId === review.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>{t('reviews.acknowledge')}</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.ackHelp}>{t('reviews.ackHelp')}</Text>
                </View>
              ) : (
                <View style={styles.acknowledgedRow}>
                  <CheckCircle2 size={18} color={colors.success} />
                  <Text style={styles.acknowledgedText}>{t('reviews.acknowledged')}</Text>
                </View>
              )}

              {review.employeeComments ? (
                <ReviewField label={t('reviews.yourComments')} value={review.employeeComments} />
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function ReviewField({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: 12,
  },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  content: { padding: 16, paddingBottom: 36, gap: 14 },
  intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleCopy: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700', textTransform: 'capitalize' },
  meta: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: colors.text, fontWeight: '700' },
  field: { gap: 4 },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  fieldValue: { color: colors.text, fontSize: 14, lineHeight: 20 },
  ackBox: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 14, gap: 10 },
  input: { minHeight: 92, color: colors.text, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  primaryButton: { minHeight: 46, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.55 },
  ackHelp: { color: colors.textTertiary, fontSize: 12, lineHeight: 17 },
  acknowledgedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  acknowledgedText: { color: colors.success, fontWeight: '700' },
  errorText: { color: colors.error, textAlign: 'center' },
});
