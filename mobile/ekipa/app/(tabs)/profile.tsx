/**
 * Ekipa — Profile Tab
 * Teal header banner, personal info, job details, documents, attendance, settings
 */
import { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
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
} from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { useAttendanceStore } from '../../stores/attendanceStore';
import { useI18nStore, useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { Card } from '../../components/Card';

function InfoRow({ label, value, last }: { label: string; value?: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '\u2014'}</Text>
    </View>
  );
}

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

  const toggleLanguage = () => {
    setLanguage(language === 'tet' ? 'en' : 'tet');
  };

  if (empLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} bounces={false}>
      {/* Profile Header with teal banner */}
      <View style={styles.headerBanner}>
        <View style={styles.bannerDecor1} />
        <View style={styles.bannerDecor2} />
      </View>
      <View style={styles.headerContent}>
        <View style={styles.avatar}>
          <User size={32} color={colors.primary} strokeWidth={1.6} />
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

      <View style={styles.body}>
        {/* Personal info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={16} color={colors.primary} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t('profile.personalInfo')}</Text>
          </View>
          <Card>
            <InfoRow label={t('profile.email')} value={employee?.email} />
            <InfoRow label={t('profile.phone')} value={employee?.phone} />
            <InfoRow label={t('profile.employeeId')} value={employee?.id} last />
          </Card>
        </View>

        {/* Job details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Briefcase size={16} color={colors.primary} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t('profile.jobDetails')}</Text>
          </View>
          <Card>
            <InfoRow label={t('profile.department')} value={employee?.department} />
            <InfoRow label={t('profile.position')} value={employee?.position} />
            <InfoRow label={t('profile.startDate')} value={employee?.startDate} last />
          </Card>
        </View>

        {/* Documents */}
        {employee?.documents && employee.documents.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FileCheck size={16} color={colors.primary} strokeWidth={2} />
              <Text style={styles.sectionTitle}>{t('profile.documents')}</Text>
            </View>
            <Card>
              {employee.documents.map((doc, i) => {
                const isExpired = doc.expiryDate && new Date(doc.expiryDate) < new Date();
                const isLast = i === employee.documents!.length - 1;
                return (
                  <View key={i} style={[styles.docRow, isLast && styles.docRowLast]}>
                    <View style={styles.docLeft}>
                      <Text style={styles.docName}>{doc.name}</Text>
                      {doc.expiryDate && (
                        <Text style={[styles.docExpiry, isExpired && styles.docExpired]}>
                          {isExpired ? 'Expired' : 'Expires'}: {doc.expiryDate}
                        </Text>
                      )}
                    </View>
                    {isExpired && (
                      <AlertTriangle size={16} color={colors.error} strokeWidth={2} />
                    )}
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        {/* Attendance */}
        {summary && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Clock size={16} color={colors.primary} strokeWidth={2} />
              <Text style={styles.sectionTitle}>{t('profile.attendance')}</Text>
            </View>
            <View style={styles.attendanceGrid}>
              <View style={[styles.attendanceStat, { backgroundColor: colors.successBg }]}>
                <Text style={[styles.attendanceValue, { color: colors.success }]}>
                  {summary.daysPresent}
                </Text>
                <Text style={styles.attendanceLabel}>{t('profile.present')}</Text>
              </View>
              <View style={[styles.attendanceStat, { backgroundColor: colors.warningBg }]}>
                <Text style={[styles.attendanceValue, { color: colors.warning }]}>
                  {summary.daysLate}
                </Text>
                <Text style={styles.attendanceLabel}>{t('profile.late')}</Text>
              </View>
              <View style={[styles.attendanceStat, { backgroundColor: colors.errorBg }]}>
                <Text style={[styles.attendanceValue, { color: colors.error }]}>
                  {summary.daysAbsent}
                </Text>
                <Text style={styles.attendanceLabel}>{t('profile.absent')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Settings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Globe size={16} color={colors.primary} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>
          </View>

          <TouchableOpacity style={styles.settingRow} onPress={toggleLanguage} activeOpacity={0.7}>
            <Text style={styles.settingLabel}>{t('profile.language')}</Text>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {language === 'tet' ? 'Tetum' : 'English'}
              </Text>
              <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingRow, styles.signOutRow]}
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

  // Header banner
  headerBanner: {
    height: 120,
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },
  bannerDecor1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bannerDecor2: {
    position: 'absolute',
    bottom: -20,
    left: 20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerContent: {
    alignItems: 'center',
    marginTop: -44,
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginTop: 12,
  },
  profileRole: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 3,
    fontWeight: '500',
  },
  deptBadge: {
    marginTop: 8,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  deptBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  body: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  // Sections
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '55%',
    textAlign: 'right',
  },

  // Documents
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  docRowLast: {
    borderBottomWidth: 0,
  },
  docLeft: {
    flex: 1,
  },
  docName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  docExpiry: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  docExpired: {
    color: colors.error,
    fontWeight: '600',
  },

  // Attendance
  attendanceGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  attendanceStat: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  attendanceValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  attendanceLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Settings
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settingLabel: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  signOutRow: {
    justifyContent: 'flex-start',
    gap: 10,
    marginTop: 4,
  },
  signOutText: {
    fontSize: 15,
    color: colors.error,
    fontWeight: '600',
  },
});
