/**
 * Ekipa — Digital Employee ID Card Screen
 * Premium dark theme with green (#22C55E) accent.
 * Full-screen card layout with QR code for employment verification.
 */
import { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, Share2, User, Shield } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTenantStore } from '../../stores/tenantStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';

const GREEN = '#22C55E';
const GREEN_BG = 'rgba(34, 197, 94, 0.10)';

export default function DigitalIDCard() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId);
  const tenantName = useTenantStore((s) => s.tenantName);
  const employee = useEmployeeStore((s) => s.employee);
  const cardRef = useRef<View>(null);

  const fullName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : '\u2014';

  const qrData = JSON.stringify({
    type: 'ekipa_id',
    empId: employee?.id || '',
    tenantId: tenantId || '',
    ts: Math.floor(Date.now() / 1000),
  });

  const handleShare = async () => {
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: t('idCard.shareTitle'),
      });
    } catch {
      Alert.alert(t('common.error'), t('idCard.shareError'));
    }
  };

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('idCard.title')}</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn} activeOpacity={0.7}>
          <Share2 size={20} color={GREEN} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Card */}
      <View style={styles.cardContainer}>
        <View ref={cardRef} collapsable={false} style={styles.card}>
          {/* Card header with company name */}
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderDecor1} />
            <View style={styles.cardHeaderDecor2} />
            <View style={styles.cardHeaderRow}>
              <Shield size={18} color={colors.white} strokeWidth={2} />
              <Text style={styles.companyName}>
                {tenantName || 'Company'}
              </Text>
            </View>
            <Text style={styles.cardTypeLabel}>{t('idCard.employeeId')}</Text>
          </View>

          {/* Photo placeholder + info */}
          <View style={styles.cardBody}>
            <View style={styles.photoContainer}>
              <View style={styles.photoPlaceholder}>
                <User size={44} color={GREEN} strokeWidth={1.4} />
              </View>
            </View>

            <Text style={styles.employeeName}>{fullName}</Text>
            <Text style={styles.employeePosition}>
              {employee?.position || '\u2014'}
            </Text>

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('idCard.department')}</Text>
                <Text style={styles.infoValue}>
                  {employee?.department || '\u2014'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('idCard.idNumber')}</Text>
                <Text style={styles.infoValue}>
                  {employee?.id || '\u2014'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('idCard.startDate')}</Text>
                <Text style={styles.infoValue}>
                  {employee?.startDate || '\u2014'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('idCard.status')}</Text>
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeText}>
                    {employee?.status === 'active' ? t('idCard.active') : (employee?.status || '\u2014')}
                  </Text>
                </View>
              </View>
            </View>

            {/* QR Code */}
            <View style={styles.qrContainer}>
              <View style={styles.qrWrapper}>
                <QRCode
                  value={qrData}
                  size={120}
                  backgroundColor={colors.white}
                  color={colors.bg}
                />
              </View>
            </View>
          </View>

          {/* Card footer */}
          <View style={styles.cardFooter}>
            <View style={styles.footerLine} />
            <Text style={styles.footerText}>{t('idCard.verifyText')}</Text>
          </View>
        </View>
      </View>

      {/* Bottom hint */}
      <Text style={styles.bottomHint}>{t('idCard.showToVerify')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // -- Top bar --
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN_BG,
  },

  // -- Card container --
  cardContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },

  // -- Card header --
  cardHeader: {
    backgroundColor: GREEN,
    paddingVertical: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  cardHeaderDecor1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cardHeaderDecor2: {
    position: 'absolute',
    bottom: -20,
    left: 30,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
  },
  cardTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },

  // -- Card body --
  cardBody: {
    padding: 24,
    alignItems: 'center',
  },
  photoContainer: {
    marginTop: -4,
    marginBottom: 16,
  },
  photoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: GREEN_BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: GREEN,
  },
  employeeName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  employeePosition: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },

  // -- Info grid --
  infoGrid: {
    width: '100%',
    marginTop: 20,
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN,
  },
  activeText: {
    fontSize: 12,
    fontWeight: '700',
    color: GREEN,
  },

  // -- QR code --
  qrContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
  },

  // -- Card footer --
  cardFooter: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 4,
    alignItems: 'center',
  },
  footerLine: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: GREEN,
    marginBottom: 10,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  // -- Bottom hint --
  bottomHint: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
    paddingBottom: 32,
    paddingTop: 16,
  },
});

/*
 * i18n keys to add to lib/i18n.ts:
 *
 * 'idCard.title':       { tet: 'Kartaun ID', en: 'ID Card' }
 * 'idCard.employeeId':  { tet: 'Kartaun Funsionáriu', en: 'Employee ID Card' }
 * 'idCard.department':  { tet: 'Departamentu', en: 'Department' }
 * 'idCard.idNumber':    { tet: 'Numeru ID', en: 'ID Number' }
 * 'idCard.startDate':   { tet: 'Loron hahú', en: 'Start date' }
 * 'idCard.status':      { tet: 'Status', en: 'Status' }
 * 'idCard.active':      { tet: 'Ativu', en: 'Active' }
 * 'idCard.verifyText':  { tet: 'Scan QR atu verifika', en: 'Scan QR to verify' }
 * 'idCard.showToVerify':{ tet: 'Hatudu kartaun ida ne\'e atu verifika ita-nia empregu', en: 'Show this card to verify your employment' }
 * 'idCard.shareTitle':  { tet: 'Kartaun ID Funsionáriu', en: 'Employee ID Card' }
 * 'idCard.shareError':  { tet: 'La konsege fahe kartaun', en: 'Could not share card' }
 */
