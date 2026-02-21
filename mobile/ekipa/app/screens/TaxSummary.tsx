/**
 * Ekipa — Tax Summary Screen (WIT/INSS Year-to-Date)
 * Premium dark theme with blue (#3B82F6) module accent.
 * Aggregates payslip data for the selected year with visual bar chart.
 */
import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Shield,
  DollarSign,
  Info,
} from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantStore } from '../../stores/tenantStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { useI18nStore, useT } from '../../lib/i18n';
import { formatCurrency } from '../../lib/currency';
import { colors } from '../../lib/colors';
import { Card } from '../../components/Card';

const ACCENT = colors.blue;

interface MonthlyData {
  month: number; // 1-12
  gross: number;
  wit: number;
  inssEmployee: number;
  inssEmployer: number;
  net: number;
}

interface YTDSummary {
  totalGross: number;
  totalWIT: number;
  totalINSSEmployee: number;
  totalINSSEmployer: number;
  totalNet: number;
  months: MonthlyData[];
}

export default function TaxSummary() {
  const t = useT();
  const language = useI18nStore((s) => s.language);
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const currency = useEmployeeStore((s) => s.employee?.currency || 'USD');

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<YTDSummary>({
    totalGross: 0,
    totalWIT: 0,
    totalINSSEmployee: 0,
    totalINSSEmployer: 0,
    totalNet: 0,
    months: [],
  });

  useEffect(() => {
    if (!tenantId || !employeeId) return;

    const fetchYearData = async () => {
      setLoading(true);
      try {
        const months: MonthlyData[] = [];
        let totalGross = 0;
        let totalWIT = 0;
        let totalINSSEmployee = 0;
        let totalINSSEmployer = 0;
        let totalNet = 0;

        // Fetch all 12 months in parallel
        const maxMonth = year === currentYear ? new Date().getMonth() + 1 : 12;
        const fetches = [];
        for (let m = 1; m <= maxMonth; m++) {
          const period = `${year}${String(m).padStart(2, '0')}`;
          fetches.push(
            getDoc(doc(db, `tenants/${tenantId}/payruns/${period}/payslips/${employeeId}`))
              .then((snap) => ({ month: m, snap }))
              .catch(() => ({ month: m, snap: null }))
          );
        }

        const results = await Promise.all(fetches);
        for (const { month, snap } of results) {
          if (snap && snap.exists()) {
            const data = snap.data();
            const gross = data.grossPay || 0;
            const wit = data.witAmount || 0;
            const inssEmp = data.inssEmployee || 0;
            const inssEr = data.inssEmployer || 0;
            const net = data.netPay || 0;

            months.push({ month, gross, wit, inssEmployee: inssEmp, inssEmployer: inssEr, net });
            totalGross += gross;
            totalWIT += wit;
            totalINSSEmployee += inssEmp;
            totalINSSEmployer += inssEr;
            totalNet += net;
          } else {
            months.push({ month, gross: 0, wit: 0, inssEmployee: 0, inssEmployer: 0, net: 0 });
          }
        }

        months.sort((a, b) => a.month - b.month);
        setSummary({ totalGross, totalWIT, totalINSSEmployee, totalINSSEmployer, totalNet, months });
      } catch {
        setSummary({ totalGross: 0, totalWIT: 0, totalINSSEmployee: 0, totalINSSEmployer: 0, totalNet: 0, months: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchYearData();
  }, [tenantId, employeeId, year, currentYear]);

  // Find max gross for bar chart scaling
  const maxGross = useMemo(() => {
    const max = Math.max(...summary.months.map((m) => m.gross), 1);
    return max;
  }, [summary.months]);

  const MONTH_ABBREVS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

  return (
    <View style={styles.container}>
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
            <Text style={styles.headerTitleWhite}>{t('tax.title')}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        {/* Year selector */}
        <View style={styles.yearSelector}>
          <TouchableOpacity
            onPress={() => setYear((y) => y - 1)}
            style={styles.yearBtn}
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.yearText}>{year}</Text>
          <TouchableOpacity
            onPress={() => setYear((y) => Math.min(y + 1, currentYear))}
            style={styles.yearBtn}
            activeOpacity={0.7}
            disabled={year >= currentYear}
          >
            <ChevronRight
              size={20}
              color={year >= currentYear ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)'}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Summary cards */}
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <View style={[styles.summaryBorderTop, { backgroundColor: colors.emerald }]} />
              <TrendingUp size={18} color={colors.emerald} strokeWidth={2} />
              <Text style={styles.summaryLabel}>{t('tax.grossYTD')}</Text>
              <Text style={[styles.summaryValue, { color: colors.emerald }]}>
                {formatCurrency(summary.totalGross, language, currency)}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <View style={[styles.summaryBorderTop, { backgroundColor: colors.error }]} />
              <DollarSign size={18} color={colors.error} strokeWidth={2} />
              <Text style={styles.summaryLabel}>{t('tax.witYTD')}</Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>
                {formatCurrency(summary.totalWIT, language, currency)}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <View style={[styles.summaryBorderTop, { backgroundColor: ACCENT }]} />
              <Shield size={18} color={ACCENT} strokeWidth={2} />
              <Text style={styles.summaryLabel}>{t('tax.inssEmployeeYTD')}</Text>
              <Text style={[styles.summaryValue, { color: ACCENT }]}>
                {formatCurrency(summary.totalINSSEmployee, language, currency)}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <View style={[styles.summaryBorderTop, { backgroundColor: colors.violet }]} />
              <Shield size={18} color={colors.violet} strokeWidth={2} />
              <Text style={styles.summaryLabel}>{t('tax.inssEmployerYTD')}</Text>
              <Text style={[styles.summaryValue, { color: colors.violet }]}>
                {formatCurrency(summary.totalINSSEmployer, language, currency)}
              </Text>
            </View>

            <View style={[styles.summaryCard, styles.summaryCardWide]}>
              <View style={[styles.summaryBorderTop, { backgroundColor: colors.primary }]} />
              <DollarSign size={18} color={colors.primary} strokeWidth={2} />
              <Text style={styles.summaryLabel}>{t('tax.netYTD')}</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>
                {formatCurrency(summary.totalNet, language, currency)}
              </Text>
            </View>
          </View>

          {/* Monthly bar chart */}
          <Text style={styles.sectionTitle}>{t('tax.monthlyBreakdown')}</Text>
          <Card>
            <View style={styles.chartContainer}>
              {summary.months.map((m) => {
                const barHeight = maxGross > 0 ? Math.max((m.gross / maxGross) * 120, 4) : 4;
                const hasData = m.gross > 0;
                return (
                  <View key={m.month} style={styles.chartBar}>
                    <View style={styles.chartBarColumn}>
                      {hasData && (
                        <Text style={styles.chartBarValue}>
                          {Math.round(m.gross)}
                        </Text>
                      )}
                      <View
                        style={[
                          styles.chartBarFill,
                          {
                            height: barHeight,
                            backgroundColor: hasData ? ACCENT : colors.border,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.chartBarLabel}>{MONTH_ABBREVS[m.month - 1]}</Text>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* Employer INSS info card */}
          {summary.totalINSSEmployer > 0 && (
            <View style={styles.infoCard}>
              <Info size={18} color={colors.violet} strokeWidth={2} />
              <Text style={styles.infoCardText}>
                {t('tax.employerContribution').replace(
                  '{amount}',
                  formatCurrency(summary.totalINSSEmployer, language, currency)
                )}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
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

  // -- Year selector --
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 12,
  },
  yearBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  yearText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },

  // -- Content --
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // -- Summary grid --
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  summaryCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
    overflow: 'hidden',
  },
  summaryCardWide: {
    width: '100%',
  },
  summaryBorderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  // -- Section title --
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // -- Bar chart --
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
    gap: 4,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartBarColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  chartBarValue: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.textTertiary,
    marginBottom: 3,
  },
  chartBarFill: {
    width: '80%',
    minWidth: 8,
    borderRadius: 4,
  },
  chartBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    marginTop: 6,
  },

  // -- Info card --
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.violetBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    marginTop: 20,
  },
  infoCardText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.violet,
    lineHeight: 21,
  },
});

/*
 * i18n keys to add to lib/i18n.ts:
 *
 * 'tax.title':                { tet: 'Rezumu Impostu', en: 'Tax Summary' }
 * 'tax.grossYTD':             { tet: 'Brútu tinan ida', en: 'Gross YTD' }
 * 'tax.witYTD':               { tet: 'WIT tinan ida', en: 'WIT YTD' }
 * 'tax.inssEmployeeYTD':      { tet: 'INSS funsionáriu (4%)', en: 'INSS Employee (4%)' }
 * 'tax.inssEmployerYTD':      { tet: 'INSS empreza (6%)', en: 'INSS Employer (6%)' }
 * 'tax.netYTD':               { tet: 'Líkidu tinan ida', en: 'Net YTD' }
 * 'tax.monthlyBreakdown':     { tet: 'Diskriminasaun mensal', en: 'Monthly Breakdown' }
 * 'tax.employerContribution': { tet: 'Ita-nia empreza kontribui {amount} ba INSS ba ita', en: 'Your employer also contributes {amount} to INSS for you' }
 */
