/**
 * Ekipa — Employment Letter Request Screen
 * Premium dark theme with blue (#3B82F6) module accent.
 * Request proof of employment, salary certificate, or INSS summary.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  FileText,
  DollarSign,
  ShieldCheck,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react-native';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantStore } from '../../stores/tenantStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { StatusBadge } from '../../components/StatusBadge';

const ACCENT = colors.blue;
const ACCENT_BG = colors.blueBg;

type DocType = 'proof_of_employment' | 'salary_certificate' | 'inss_summary';

interface DocTypeOption {
  id: DocType;
  labelKey: string;
  descKey: string;
  icon: typeof FileText;
}

const DOC_TYPES: DocTypeOption[] = [
  {
    id: 'proof_of_employment',
    labelKey: 'docRequest.proofOfEmployment',
    descKey: 'docRequest.proofOfEmploymentDesc',
    icon: FileText,
  },
  {
    id: 'salary_certificate',
    labelKey: 'docRequest.salaryCertificate',
    descKey: 'docRequest.salaryCertificateDesc',
    icon: DollarSign,
  },
  {
    id: 'inss_summary',
    labelKey: 'docRequest.inssSummary',
    descKey: 'docRequest.inssSummaryDesc',
    icon: ShieldCheck,
  },
];

interface DocRequest {
  id: string;
  type: DocType;
  typeLabel: string;
  status: 'pending' | 'ready' | 'rejected';
  notes?: string;
  requestedAt: Date;
}

export default function EmploymentLetterRequest() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const employee = useEmployeeStore((s) => s.employee);
  const user = useAuthStore((s) => s.user);

  const [selectedType, setSelectedType] = useState<DocType>('proof_of_employment');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requests, setRequests] = useState<DocRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!tenantId || !employeeId) return;
    setLoadingRequests(true);
    try {
      const q = query(
        collection(db, `tenants/${tenantId}/employees/${employeeId}/document_requests`),
        orderBy('requestedAt', 'desc')
      );
      const snap = await getDocs(q);
      const items: DocRequest[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type || 'proof_of_employment',
          typeLabel: data.typeLabel || data.type || '',
          status: data.status || 'pending',
          notes: data.notes,
          requestedAt: data.requestedAt instanceof Timestamp
            ? data.requestedAt.toDate()
            : new Date(),
        };
      });
      setRequests(items);
    } catch {
      // Silently fail
    } finally {
      setLoadingRequests(false);
    }
  }, [tenantId, employeeId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSubmit = async () => {
    if (!tenantId || !employeeId || !employee) return;

    setSubmitting(true);
    try {
      const typeLabel = t(DOC_TYPES.find((dt) => dt.id === selectedType)?.labelKey || '');
      await addDoc(
        collection(db, `tenants/${tenantId}/employees/${employeeId}/document_requests`),
        {
          type: selectedType,
          typeLabel,
          status: 'pending',
          notes: notes.trim() || null,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          requestedBy: user?.uid || '',
          requestedAt: serverTimestamp(),
        }
      );
      setSubmitted(true);
      setNotes('');
      fetchRequests();
    } catch {
      Alert.alert(t('common.error'), t('docRequest.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  const statusConfig: Record<string, { status: 'pending' | 'approved' | 'rejected'; labelKey: string }> = {
    pending: { status: 'pending', labelKey: 'docRequest.statusPending' },
    ready: { status: 'approved', labelKey: 'docRequest.statusReady' },
    rejected: { status: 'rejected', labelKey: 'docRequest.statusRejected' },
  };

  const renderRequest = ({ item }: { item: DocRequest }) => {
    const cfg = statusConfig[item.status] || statusConfig.pending;
    const Icon = item.status === 'ready' ? CheckCircle2
      : item.status === 'rejected' ? XCircle
      : Clock;
    const iconColor = item.status === 'ready' ? colors.emerald
      : item.status === 'rejected' ? colors.error
      : colors.warning;

    return (
      <View style={styles.requestRow}>
        <View style={[styles.requestIcon, { backgroundColor: `${iconColor}15` }]}>
          <Icon size={16} color={iconColor} strokeWidth={2} />
        </View>
        <View style={styles.requestInfo}>
          <Text style={styles.requestType}>{item.typeLabel}</Text>
          <Text style={styles.requestDate}>
            {item.requestedAt.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>
        <StatusBadge status={cfg.status} label={t(cfg.labelKey)} />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Blue hero header */}
      <View style={styles.heroHeader}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.heroDecor3} />
        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{t('docRequest.title')}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.heroContent}>
          <FileText size={28} color="rgba(255,255,255,0.8)" strokeWidth={1.5} />
          <Text style={styles.heroSubtitle}>{t('docRequest.subtitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {submitted ? (
          <View style={styles.successCard}>
            <CheckCircle2 size={40} color={colors.emerald} strokeWidth={1.5} />
            <Text style={styles.successTitle}>{t('docRequest.successTitle')}</Text>
            <Text style={styles.successMessage}>{t('docRequest.successMessage')}</Text>
            <TouchableOpacity
              style={styles.newRequestBtn}
              onPress={() => setSubmitted(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.newRequestBtnText}>{t('docRequest.newRequest')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Document type selector */}
            <Text style={styles.label}>{t('docRequest.selectType')}</Text>
            {DOC_TYPES.map((dt) => {
              const Icon = dt.icon;
              const isActive = selectedType === dt.id;
              return (
                <TouchableOpacity
                  key={dt.id}
                  style={[styles.typeCard, isActive && styles.typeCardActive]}
                  onPress={() => setSelectedType(dt.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.typeIcon, isActive && styles.typeIconActive]}>
                    <Icon size={20} color={isActive ? colors.white : ACCENT} strokeWidth={2} />
                  </View>
                  <View style={styles.typeInfo}>
                    <Text style={[styles.typeName, isActive && styles.typeNameActive]}>
                      {t(dt.labelKey)}
                    </Text>
                    <Text style={styles.typeDesc}>{t(dt.descKey)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Notes */}
            <Text style={styles.label}>{t('docRequest.notes')}</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('docRequest.notesPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Send size={18} color={colors.white} strokeWidth={2.5} />
                  <Text style={styles.submitBtnText}>{t('docRequest.submit')}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Previous requests */}
        <Text style={styles.sectionTitle}>{t('docRequest.previousRequests')}</Text>
        {loadingRequests ? (
          <ActivityIndicator size="small" color={ACCENT} style={{ marginTop: 20 }} />
        ) : requests.length === 0 ? (
          <Text style={styles.noRequests}>{t('docRequest.noRequests')}</Text>
        ) : (
          <View style={styles.requestsList}>
            {requests.map((req) => (
              <View key={req.id}>{renderRequest({ item: req })}</View>
            ))}
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

  // -- Blue hero header --
  heroHeader: {
    backgroundColor: ACCENT,
    paddingBottom: 28,
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
  backBtn: {
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
    gap: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // -- Labels --
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    marginBottom: 10,
    marginTop: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // -- Type cards --
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  typeCardActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT_BG,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: ACCENT_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconActive: {
    backgroundColor: ACCENT,
  },
  typeInfo: {
    flex: 1,
    gap: 3,
  },
  typeName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  typeNameActive: {
    color: ACCENT,
  },
  typeDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 17,
  },

  // -- Input --
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  textarea: {
    height: 80,
    paddingTop: 14,
  },

  // -- Submit --
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    borderRadius: 14,
    padding: 16,
    backgroundColor: ACCENT,
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
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
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },

  // -- Success state --
  successCard: {
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 32,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
  },
  successMessage: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  newRequestBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: ACCENT_BG,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  newRequestBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: ACCENT,
  },

  // -- Previous requests --
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 32,
    marginBottom: 12,
  },
  noRequests: {
    fontSize: 14,
    color: colors.textTertiary,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 20,
  },
  requestsList: {
    gap: 10,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestInfo: {
    flex: 1,
    gap: 2,
  },
  requestType: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  requestDate: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
  },
});

/*
 * i18n keys to add to lib/i18n.ts:
 *
 * 'docRequest.title':                  { tet: 'Husu Dokumentu', en: 'Request Document' }
 * 'docRequest.subtitle':               { tet: 'Husu karta servisu ka sertifikadu', en: 'Request employment letter or certificate' }
 * 'docRequest.selectType':             { tet: 'Tipu dokumentu', en: 'Document type' }
 * 'docRequest.proofOfEmployment':      { tet: 'Prova Empregu', en: 'Proof of Employment' }
 * 'docRequest.proofOfEmploymentDesc':  { tet: 'Karta konfirma katak ita servisu iha ne\'e', en: 'Letter confirming your current employment' }
 * 'docRequest.salaryCertificate':      { tet: 'Sertifikadu Salário', en: 'Salary Certificate' }
 * 'docRequest.salaryCertificateDesc':  { tet: 'Dokumentu ho detallu salário atuál', en: 'Document with your current salary details' }
 * 'docRequest.inssSummary':            { tet: 'Rezumu INSS', en: 'INSS Summary' }
 * 'docRequest.inssSummaryDesc':        { tet: 'Rezumu kontribuisaun INSS tinan ida', en: 'Summary of INSS contributions for the year' }
 * 'docRequest.notes':                  { tet: 'Nota adisionál (opsionál)', en: 'Additional notes (optional)' }
 * 'docRequest.notesPlaceholder':       { tet: 'Hakerek se iha pedidu espesiál', en: 'Write any special requests' }
 * 'docRequest.submit':                 { tet: 'Submete Pedidu', en: 'Submit Request' }
 * 'docRequest.submitError':            { tet: 'La konsege submete pedidu', en: 'Could not submit request' }
 * 'docRequest.successTitle':           { tet: 'Pedidu submete ona', en: 'Request Submitted' }
 * 'docRequest.successMessage':         { tet: 'Ita-nia pedidu submete ona. RH sei prepara ita-nia dokumentu.', en: 'Your request has been submitted. HR will prepare your document.' }
 * 'docRequest.newRequest':             { tet: 'Pedidu foun', en: 'New Request' }
 * 'docRequest.previousRequests':       { tet: 'Pedidu anterior sira', en: 'Previous Requests' }
 * 'docRequest.noRequests':             { tet: 'Seidauk iha pedidu', en: 'No requests yet' }
 * 'docRequest.statusPending':          { tet: 'Pendente', en: 'Pending' }
 * 'docRequest.statusReady':            { tet: 'Pronto', en: 'Ready' }
 * 'docRequest.statusRejected':         { tet: 'Rejeita ona', en: 'Rejected' }
 */
