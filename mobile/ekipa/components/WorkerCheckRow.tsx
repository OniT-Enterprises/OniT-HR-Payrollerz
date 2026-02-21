/**
 * WorkerCheckRow — selectable worker row with checkbox
 * Follows PayslipRow pattern: accent bar, card styling, shadow
 */
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '../lib/colors';

interface WorkerCheckRowProps {
  name: string;
  department?: string;
  selected: boolean;
  onToggle: () => void;
}

export function WorkerCheckRow({ name, department, selected, onToggle }: WorkerCheckRowProps) {
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.row}>
      <View style={[styles.accent, selected && styles.accentActive]} />
      <View style={styles.body}>
        <View style={[styles.checkbox, selected && styles.checkboxActive]}>
          {selected && <Check size={14} color="#fff" strokeWidth={3} />}
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          {department ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{department}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  accent: {
    width: 4,
    backgroundColor: colors.border,
  },
  accentActive: {
    backgroundColor: colors.primary,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  badge: {
    backgroundColor: colors.bgSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
