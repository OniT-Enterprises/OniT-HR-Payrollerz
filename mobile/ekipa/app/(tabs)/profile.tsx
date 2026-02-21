/**
 * Ekipa — Profile Tab
 * Premium dark theme with blue (#3B82F6) module accent.
 * Green header banner, personal info, job details, documents, attendance, settings.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
  Linking,
  Switch,
} from 'react-native';
import {
  User,
  Briefcase,
  FileCheck,
  Clock,
  Globe,
  LogOut,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  Edit3,
  CreditCard,
  FileText,
  Fingerprint,
  ShieldAlert,
} from 'lucide-react-native';
import { isBiometricAvailable, isBiometricEnabled, setBiometricEnabled } from '../../lib/biometricLock';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { useAttendanceStore } from '../../stores/attendanceStore';
import { useI18nStore, useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';

/* ── Info Row ─────────────────────────────────────────── */
function InfoRow({ label, value, last }: { label: string; value?: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '\u2014'}</Text>
    </View>
  );
}

/* ── Section Header ───────────────────────────────────── */
function SectionHeader({ icon: Icon, label }: { icon: typeof User; label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconBadge}>
        <Icon size={14} color={colors.blue} strokeWidth={2.2} />
      </View>
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
}

/* ── Main Screen ──────────────────────────────────────── */
export default function ProfileScreen() {
  const t = useT();
  const signOut = useAuthStore((s) => s.signOut);
  const clearTenant = useTenantStore((s) => s.clearTenant);
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const employee = useEmployeeStore((s) => s.employee);
  const empLoading = useEmployeeStore((s) => s.loading);
  const summary = useAttendanceStore((s) => s.summary);
  const fetchAttendance = useAttendanceStore((s) => s.fetchAttendance);
  const language = useI18nStore((s) => s.language);
  const setLanguage = useI18nStore((s) => s.setLanguage);

  useEffect(() => {
    if (tenantId && employeeId) {
      fetchAttendance(tenantId, employeeId);
    }
  }, [tenantId, employeeId, fetchAttendance]);

  const handleSignOut = () => {
    Alert.alert(
      t('profile.signOut'),
      '',
      [
        { text: t('leave.cancel'), style: 'cancel' },
        {
          text: t('profile.signOut'),
          style: 'destructive',
          onPress: async () => {
            clearTenant();
            await signOut();
          },
        },
      ]
    );
  };

  const [biometricAvail, setBiometricAvail] = useState(false);
  const [biometricOn, setBiometricOn] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvail);
    isBiometricEnabled().then(setBiometricOn);
  }, []);

  const toggleBiometric = useCallback(async (value: boolean) => {
    setBiometricOn(value);
    await setBiometricEnabled(value);
  }, []);

  const LANG_CYCLE = ['tet', 'en', 'pt', 'id'] as const;
  const LANG_LABELS: Record<string, string> = { tet: 'Tetum', en: 'English', pt: 'Português', id: 'Bahasa' };
  const toggleLanguage = () => {
    const idx = LANG_CYCLE.indexOf(language as any);
    const next = LANG_CYCLE[(idx + 1) % LANG_CYCLE.length];
    setLanguage(next);
  };

  const insets = useSafeAreaInsets();

  /* Loading state */
  if (empLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} bounces={false}>
      {/* ── Green Banner ─────────────────────────────── */}
      <View style={styles.headerBanner}>
        <View style={styles.bannerDecor1} />
        <View style={styles.bannerDecor2} />
        <View style={styles.bannerDecor3} />

        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { top: insets.top + 8 }]}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.white} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* ── Avatar + Identity ────────────────────────── */}
      <View style={styles.headerContent}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <User size={34} color={colors.primary} strokeWidth={1.5} />
          </View>
        </View>
        <Text style={styles.profileName}>
          {employee ? `${employee.firstName} ${employee.lastName}` : '\u2014'}
        </Text>
        <Text style={styles.profileRole}>
          {employee?.position || '\u2014'}
        </Text>
        {employee?.department && (
          <View style={styles.deptBadge}>
            <Text style={styles.deptBadgeText}>{employee.department}</Text>
          </View>
        )}
      </View>

      {/* ── Body ─────────────────────────────────────── */}
      <View style={styles.body}>

        {/* Personal Info */}
        <View style={styles.section}>
          <SectionHeader icon={User} label={t('profile.personalInfo')} />
          <View style={styles.card}>
            <InfoRow label={t('profile.email')} value={employee?.email} />
            <InfoRow label={t('profile.phone')} value={employee?.phone} />
            <InfoRow label={t('profile.employeeId')} value={employee?.id} last />
          </View>
        </View>

        {/* Job Details */}
        <View style={styles.section}>
          <SectionHeader icon={Briefcase} label={t('profile.jobDetails')} />
          <View style={styles.card}>
            <InfoRow label={t('profile.department')} value={employee?.department} />
            <InfoRow label={t('profile.position')} value={employee?.position} />
            <InfoRow label={t('profile.startDate')} value={employee?.startDate} last />
          </View>
        </View>

        {/* Documents */}
        {employee?.documents && employee.documents.length > 0 && (
          <View style={styles.section}>
            <SectionHeader icon={FileCheck} label={t('profile.documents')} />
            <View style={styles.card}>
              {employee.documents.map((docItem, i) => {
                const isExpired = docItem.expiryDate && new Date(docItem.expiryDate) < new Date();
                const isLast = i === employee.documents!.length - 1;
                const hasUrl = !!(docItem as any).url;
                const Row = hasUrl ? TouchableOpacity : View;
                return (
                  <Row
                    key={i}
                    style={[styles.docRow, isLast && styles.docRowLast]}
                    {...(hasUrl ? {
                      activeOpacity: 0.7,
                      onPress: () => Linking.openURL((docItem as any).url),
                    } : {})}
                  >
                    <View style={styles.docLeft}>
                      <Text style={styles.docName}>{docItem.name}</Text>
                      {docItem.expiryDate && (
                        <Text style={[styles.docExpiry, isExpired && styles.docExpired]}>
                          {isExpired ? t('profile.expired') : t('profile.expires')}: {docItem.expiryDate}
                        </Text>
                      )}
                    </View>
                    {isExpired ? (
                      <AlertTriangle size={16} color={colors.error} strokeWidth={2} />
                    ) : hasUrl ? (
                      <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
                    ) : null}
                  </Row>
                );
              })}
            </View>
          </View>
        )}

        {/* Attendance */}
        {summary && (
          <View style={styles.section}>
            <SectionHeader icon={Clock} label={t('profile.attendance')} />
            <View style={styles.attendanceGrid}>
              {/* Present */}
              <View style={styles.attendanceCard}>
                <View style={[styles.attendanceTopBorder, { backgroundColor: colors.success }]} />
                <Text style={[styles.attendanceValue, { color: colors.success }]}>
                  {summary.daysPresent}
                </Text>
                <Text style={styles.attendanceLabel}>{t('profile.present')}</Text>
              </View>
              {/* Late */}
              <View style={styles.attendanceCard}>
                <View style={[styles.attendanceTopBorder, { backgroundColor: colors.warning }]} />
                <Text style={[styles.attendanceValue, { color: colors.warning }]}>
                  {summary.daysLate}
                </Text>
                <Text style={styles.attendanceLabel}>{t('profile.late')}</Text>
              </View>
              {/* Absent */}
              <View style={styles.attendanceCard}>
                <View style={[styles.attendanceTopBorder, { backgroundColor: colors.error }]} />
                <Text style={[styles.attendanceValue, { color: colors.error }]}>
                  {summary.daysAbsent}
                </Text>
                <Text style={styles.attendanceLabel}>{t('profile.absent')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick Links */}
        <View style={styles.section}>
          <SectionHeader icon={FileText} label={t('profile.quickLinks')} />
          <View style={styles.quickLinksGrid}>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/screens/EditProfile')} activeOpacity={0.7}>
              <View style={[styles.quickLinkIcon, { backgroundColor: colors.primaryBg }]}>
                <Edit3 size={18} color={colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.quickLinkLabel}>{t('profile.editInfo')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/screens/DigitalIDCard')} activeOpacity={0.7}>
              <View style={[styles.quickLinkIcon, { backgroundColor: colors.primaryBg }]}>
                <CreditCard size={18} color={colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.quickLinkLabel}>{t('profile.digitalId')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/screens/EmploymentLetterRequest')} activeOpacity={0.7}>
              <View style={[styles.quickLinkIcon, { backgroundColor: colors.blueBg }]}>
                <FileText size={18} color={colors.blue} strokeWidth={2} />
              </View>
              <Text style={styles.quickLinkLabel}>{t('profile.requestLetter')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/screens/GrievanceReport')} activeOpacity={0.7}>
              <View style={[styles.quickLinkIcon, { backgroundColor: colors.errorBg }]}>
                <ShieldAlert size={18} color={colors.error} strokeWidth={2} />
              </View>
              <Text style={styles.quickLinkLabel}>{t('profile.reportConcern')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <SectionHeader icon={Globe} label={t('profile.settings')} />

          <TouchableOpacity style={styles.settingRow} onPress={toggleLanguage} activeOpacity={0.7}>
            <Text style={styles.settingLabel}>{t('profile.language')}</Text>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {LANG_LABELS[language] || language}
              </Text>
              <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
            </View>
          </TouchableOpacity>

          {biometricAvail && (
            <View style={styles.settingRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Fingerprint size={18} color={colors.primary} strokeWidth={2} />
                <Text style={styles.settingLabel}>{t('profile.biometricLock')}</Text>
              </View>
              <Switch
                value={biometricOn}
                onValueChange={toggleBiometric}
                trackColor={{ false: colors.secondary, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          )}

          <TouchableOpacity
            style={styles.signOutRow}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <LogOut size={18} color={colors.error} strokeWidth={2} />
            <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

/* ── Styles ───────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },

  /* ── Header Banner ──────────────────────────────── */
  headerBanner: {
    height: 140,
    backgroundColor: colors.primary,
    overflow: 'hidden',
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  bannerDecor1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bannerDecor2: {
    position: 'absolute',
    bottom: -30,
    left: 10,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  bannerDecor3: {
    position: 'absolute',
    top: 20,
    left: '50%' as any,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  /* ── Avatar + Identity ─────────────────────────── */
  headerContent: {
    alignItems: 'center',
    marginTop: -48,
    paddingBottom: 24,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  profileName: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
    marginTop: 14,
  },
  profileRole: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  deptBadge: {
    marginTop: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  deptBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.3,
  },

  /* ── Body ───────────────────────────────────────── */
  body: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },

  /* ── Sections ───────────────────────────────────── */
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  /* ── Cards (inline, no shadow) ──────────────────── */
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },

  /* ── Info Rows ──────────────────────────────────── */
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '55%',
    textAlign: 'right',
  },

  /* ── Documents ──────────────────────────────────── */
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  docRowLast: {
    borderBottomWidth: 0,
  },
  docLeft: {
    flex: 1,
    marginRight: 12,
  },
  docName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  docExpiry: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 3,
  },
  docExpired: {
    color: colors.error,
    fontWeight: '600',
  },

  /* ── Attendance Grid ────────────────────────────── */
  attendanceGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  attendanceCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 0,
    paddingBottom: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  attendanceTopBorder: {
    width: '100%',
    height: 3,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    marginBottom: 14,
  },
  attendanceValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  attendanceLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 4,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  /* ── Settings ───────────────────────────────────── */
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingLabel: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 15,
    color: colors.blue,
    fontWeight: '600',
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.errorBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
    marginTop: 2,
  },
  signOutText: {
    fontSize: 15,
    color: colors.error,
    fontWeight: '600',
  },

  /* ── Quick Links Grid ────────────────────────── */
  quickLinksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickLink: {
    width: '48%' as any,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  quickLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
