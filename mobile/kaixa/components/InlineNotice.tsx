import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { colors } from '../lib/colors';

interface InlineNoticeProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function InlineNotice({
  title = 'Unable to load data',
  message,
  onRetry,
}: InlineNoticeProps) {
  return (
    <View style={styles.container}>
      <AlertTriangle size={17} color={colors.warning} strokeWidth={2} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message} numberOfLines={3}>{message}</Text>
      </View>
      {onRetry && (
        <TouchableOpacity style={styles.retry} onPress={onRetry} activeOpacity={0.7}>
          <RefreshCw size={14} color={colors.primary} strokeWidth={2.2} />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(250, 204, 21, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.18)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  copy: { flex: 1 },
  title: { color: colors.text, fontSize: 12, fontWeight: '700' },
  message: { color: colors.textTertiary, fontSize: 10, lineHeight: 14, marginTop: 2 },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: colors.primaryGlow,
  },
  retryText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
});
