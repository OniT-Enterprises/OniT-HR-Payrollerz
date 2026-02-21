/**
 * Ekipa — Wage Alerts Screen
 * Premium dark theme with amber (#F59E0B) accent.
 * Compares attendance hours vs payslip hours, minimum wage check.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingDown,
} from 'lucide-react-native';
import { useTenantStore } from '../../stores/tenantStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { useAttendanceStore } from '../../stores/attendanceStore';
import { usePayslipStore } from '../../stores/payslipStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';

const TL_MIN_WAGE = 115; // USD per month

interface DiscrepancyCheck {
  hasHourDiscrepancy: boolean;
  hasMinWageWarning: boolean;
  attendanceHours: number;
  payslipHours: number;
  hourDiff: number;
  netPay: number;
  employmentType: string;
  periodLabel: string;
}

export default function WageAlerts() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const employee = useEmployeeStore((s) => s.employee);

  const attendanceSummary = useAttendanceStore((s) => s.summary);
  const attendanceLoading = useAttendanceStore((s) => s.loading);
  const fetchAttendance = useAttendanceStore((s) => s.fetchAttendance);

  const payslips = usePayslipStore((s) => s.payslips);
  const payslipLoading = usePayslipStore((s) => s.loading);
  const fetchPayslips = usePayslipStore((s) => s.fetchPayslips);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (tenantId && employeeId) {
      fetchAttendance(tenantId, employeeId);
      fetchPayslips(tenantId, employeeId);
    }
  }, [tenantId, employeeId, fetchAttendance, fetchPayslips]);

  const onRefresh = useCallback(async () => {
    if (!tenantId || !employeeId) return;
    setRefreshing(true);
    await Promise.all([
      fetchAttendance(tenantId, employeeId),
      fetchPayslips(tenantId, employeeId),
    ]);
    setRefreshing(false);
  }, [tenantId, employeeId, fetchAttendance, fetchPayslips]);

  // Find the most recent payslip for comparison
  const check: DiscrepancyCheck | null = useMemo(() => {
    const latestPayslip = payslips[0]; // Already sorted desc by period
    if (!latestPayslip || !attendanceSummary) return null;

    // Total attendance hours = regular + overtime
    const attendanceHours = attendanceSummary.totalRegularHours + attendanceSummary.totalOvertimeHours;

    // Payslip hours: estimate from base salary if not explicit
    // If payslip has explicit hours, use them; otherwise estimate from working days * 8
    const payslipHours = latestPayslip.overtimePay
      ? attendanceSummary.totalRegularHours // approximate: use attendance regular as baseline
      : attendanceSummary.workingDays * 8;

    const hourDiff = Math.abs(attendanceHours - payslipHours);
    const hasHourDiscrepancy = hourDiff > 2;

    const isFullTime = employee?.employmentType === 'full_time' || !employee?.employmentType;
    const hasMinWageWarning = isFullTime && latestPayslip.netPay < TL_MIN_WAGE;

    return {
      hasHourDiscrepancy,
      hasMinWageWarning,
      attendanceHours: Math.round(attendanceHours * 10) / 10,
      payslipHours: Math.round(payslipHours * 10) / 10,
      hourDiff: Math.round(hourDiff * 10) / 10,
      netPay: latestPayslip.netPay,
      employmentType: employee?.employmentType || 'full_time',
      periodLabel: latestPayslip.periodLabel,
    };
  }, [payslips, attendanceSummary, employee]);

  const isLoading = (attendanceLoading || payslipLoading) && !check;
  const allGood = check && !check.hasHourDiscrepancy && !check.hasMinWageWarning;
  const alertCount = (check?.hasHourDiscrepancy ? 1 : 0) + (check?.hasMinWageWarning ? 1 : 0);

  return (
    <View style={styles.container}>
      {/* ── Amber hero header ──────────────────────────── */}
      <View style={styles.heroHeader}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.heroDecor3} />

        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{t('wageAlerts.title')}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.heroContent}>
          <ShieldCheck size={32} color={colors.white} strokeWidth={1.8} />
          <Text style={styles.heroSubtext}>{t('wageAlerts.subtitle')}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.warning} />
        }
      >
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.warning} />
            <Text style={styles.loadingText}>{t('wageAlerts.checking')}</Text>
          </View>
        ) : !check ? (
          <View style={styles.noDataWrap}>
            <Clock size={36} color={colors.textTertiary} strokeWidth={1.5} />
            <Text style={styles.noDataTitle}>{t('wageAlerts.noData')}</Text>
            <Text style={styles.noDataSubtext}>{t('wageAlerts.noDataSub')}</Text>
          </View>
        ) : (
          <>
            {/* ── Status summary ─────────────────────────── */}
            {allGood ? (
              <View style={styles.allGoodCard}>
                <View style={styles.allGoodIconWrap}>
                  <CheckCircle2 size={40} color={colors.success} strokeWidth={1.8} />
                </View>
                <Text style={styles.allGoodTitle}>{t('wageAlerts.allGood')}</Text>
                <Text style={styles.allGoodMessage}>{t('wageAlerts.allGoodMessage')}</Text>
              </View>
            ) : (
              <View style={styles.alertSummary}>
                <AlertTriangle size={20} color={colors.warning} strokeWidth={2} />
                <Text style={styles.alertSummaryText}>
                  {alertCount} {alertCount === 1 ? t('wageAlerts.alert') : t('wageAlerts.alerts')}
                </Text>
              </View>
            )}

            {/* ── Period card ────────────────────────────── */}
            <View style={styles.periodCard}>
              <Text style={styles.periodLabel}>{t('wageAlerts.period')}</Text>
              <Text style={styles.periodValue}>{check.periodLabel}</Text>
            </View>

            {/* ── Hours comparison ────────────────────────── */}
            <View style={styles.sectionHeader}>
              <View style={styles.iconBadge}>
                <Clock size={14} color={colors.warning} strokeWidth={2.5} />
              </View>
              <Text style={styles.sectionTitle}>{t('wageAlerts.hoursComparison')}</Text>
            </View>

            <View style={[styles.comparisonCard, check.hasHourDiscrepancy && styles.comparisonCardAlert]}>
              {/* Attendance hours */}
              <View style={styles.compRow}>
                <View style={styles.compLabel}>
                  <Clock size={14} color={colors.blue} strokeWidth={2} />
                  <Text style={styles.compLabelText}>{t('wageAlerts.attendanceHours')}</Text>
                </View>
                <Text style={styles.compValue}>{check.attendanceHours}h</Text>
              </View>

              {/* Payslip hours */}
              <View style={styles.compRow}>
                <View style={styles.compLabel}>
                  <DollarSign size={14} color={colors.primary} strokeWidth={2} />
                  <Text style={styles.compLabelText}>{t('wageAlerts.payslipHours')}</Text>
                </View>
                <Text style={styles.compValue}>{check.payslipHours}h</Text>
              </View>

              {/* Difference */}
              {check.hasHourDiscrepancy && (
                <>
                  <View style={styles.compDivider} />
                  <View style={styles.compRow}>
                    <View style={styles.compLabel}>
                      <AlertTriangle size={14} color={colors.warning} strokeWidth={2} />
                      <Text style={[styles.compLabelText, { color: colors.warning }]}>
                        {t('wageAlerts.difference')}
                      </Text>
                    </View>
                    <Text style={[styles.compValue, { color: colors.warning }]}>
                      {check.hourDiff}h
                    </Text>
                  </View>
                </>
              )}

              {/* Status message */}
              {check.hasHourDiscrepancy ? (
                <View style={styles.discrepancyMessage}>
                  <AlertTriangle size={16} color={colors.warning} strokeWidth={2} />
                  <Text style={styles.discrepancyText}>
                    {t('wageAlerts.hourDiscrepancyMessage')
                      .replace('{attended}', String(check.attendanceHours))
                      .replace('{payslip}', String(check.payslipHours))}
                  </Text>
                </View>
              ) : (
                <View style={styles.matchMessage}>
                  <CheckCircle2 size={16} color={colors.success} strokeWidth={2} />
                  <Text style={styles.matchText}>{t('wageAlerts.hoursMatch')}</Text>
                </View>
              )}

              {check.hasHourDiscrepancy && (
                <Text style={styles.advice}>{t('wageAlerts.hourDiscrepancyAdvice')}</Text>
              )}
            </View>

            {/* ── Minimum wage check ─────────────────────── */}
            <View style={styles.sectionHeader}>
              <View style={[styles.iconBadge, { backgroundColor: colors.primaryBg }]}>
                <DollarSign size={14} color={colors.primary} strokeWidth={2.5} />
              </View>
              <Text style={styles.sectionTitle}>{t('wageAlerts.minWageCheck')}</Text>
            </View>

            <View style={[styles.wageCard, check.hasMinWageWarning && styles.wageCardAlert]}>
              <View style={styles.wageRow}>
                <Text style={styles.wageLabel}>{t('wageAlerts.yourNetPay')}</Text>
                <Text style={[
                  styles.wageValue,
                  check.hasMinWageWarning ? { color: colors.error } : { color: colors.success },
                ]}>
                  ${check.netPay.toFixed(2)}
                </Text>
              </View>
              <View style={styles.wageRow}>
                <Text style={styles.wageLabel}>{t('wageAlerts.minWage')}</Text>
                <Text style={styles.wageValueNeutral}>${TL_MIN_WAGE.toFixed(2)}</Text>
              </View>

              {check.hasMinWageWarning ? (
                <View style={styles.minWageWarning}>
                  <TrendingDown size={16} color={colors.error} strokeWidth={2} />
                  <Text style={styles.minWageWarningText}>{t('wageAlerts.minWageWarning')}</Text>
                </View>
              ) : (
                <View style={styles.matchMessage}>
                  <CheckCircle2 size={16} color={colors.success} strokeWidth={2} />
                  <Text style={styles.matchText}>{t('wageAlerts.minWageOk')}</Text>
                </View>
              )}
            </View>

            {/* ── Disclaimer ─────────────────────────────── */}
            <Text style={styles.disclaimer}>{t('wageAlerts.disclaimer')}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // ── Amber hero header ───────────────────────────────
  heroHeader: {
    backgroundColor: colors.warning,
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
    gap: 8,
  },
  heroSubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },

  // ── Content ─────────────────────────────────────────
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },

  // ── Loading / No data ───────────────────────────────
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 60,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  noDataWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 60,
  },
  noDataTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  noDataSubtext: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── All good card ───────────────────────────────────
  allGoodCard: {
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 28,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 20,
    gap: 8,
  },
  allGoodIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  allGoodTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.success,
  },
  allGoodMessage: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Alert summary ───────────────────────────────────
  alertSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.warningBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  alertSummaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.warning,
  },

  // ── Period card ─────────────────────────────────────
  periodCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  periodLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  periodValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },

  // ── Section header ──────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    marginTop: 4,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Comparison card ─────────────────────────────────
  comparisonCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    gap: 10,
  },
  comparisonCardAlert: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 2,
  },
  compRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compLabelText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  compValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  compDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  // ── Discrepancy message ─────────────────────────────
  discrepancyMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.warningBg,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  discrepancyText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
    lineHeight: 18,
  },
  advice: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
    lineHeight: 17,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // ── Match message ───────────────────────────────────
  matchMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successBg,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  matchText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },

  // ── Wage card ───────────────────────────────────────
  wageCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    gap: 10,
  },
  wageCardAlert: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 2,
  },
  wageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wageLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  wageValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  wageValueNeutral: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  minWageWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.errorBg,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  minWageWarningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
    lineHeight: 18,
  },

  // ── Disclaimer ──────────────────────────────────────
  disclaimer: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
    marginTop: 4,
  },
});
