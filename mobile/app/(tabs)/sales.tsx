/**
 * Kaixa — Sales Screen (Faan)
 * Dark theme placeholder — Tier 2 feature
 */
import { View, Text, StyleSheet } from 'react-native';
import { ShoppingBag, Package, Printer, CreditCard, Scan } from 'lucide-react-native';
import { colors } from '../../lib/colors';

const FEATURES = [
  { icon: Package, label: 'Katalogo produtu', labelEn: 'Product catalog' },
  { icon: Scan, label: 'Tap hodi faan', labelEn: 'Tap to sell' },
  { icon: Printer, label: 'Printer Bluetooth', labelEn: 'Receipt printing' },
  { icon: CreditCard, label: 'Tab kliente', labelEn: 'Customer tabs' },
];

export default function SalesScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.comingSoon}>
        <View style={styles.iconWrap}>
          <ShoppingBag size={40} color={colors.primary} strokeWidth={1.5} />
        </View>
        <Text style={styles.title}>Faan</Text>
        <Text style={styles.subtitle}>Sei mai iha faze tuirmai</Text>
        <Text style={styles.subtitleEn}>Coming in Phase 2</Text>

        <View style={styles.featureList}>
          {FEATURES.map(({ icon: Icon, label, labelEn }) => (
            <View key={label} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Icon size={18} color={colors.textSecondary} strokeWidth={1.8} />
              </View>
              <View>
                <Text style={styles.featureLabel}>{label}</Text>
                <Text style={styles.featureLabelEn}>{labelEn}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  comingSoon: {
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(224, 141, 107, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 8,
  },
  subtitleEn: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 2,
  },
  featureList: {
    marginTop: 28,
    alignSelf: 'stretch',
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  featureLabelEn: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});
