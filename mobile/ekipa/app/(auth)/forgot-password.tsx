/**
 * Ekipa — Forgot Password Screen
 * Sends a Firebase password reset email
 */
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';


export default function ForgotPasswordScreen() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch {
      setError(t('forgot.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.heroPattern}>
            <View style={styles.heroCircle1} />
            <View style={styles.heroCircle2} />
          </View>
          <View style={styles.heroContent}>
            <View style={styles.logoWrap}>
              <Mail size={28} color={colors.white} strokeWidth={2} />
            </View>
            <Text style={styles.heroTitle}>{t('forgot.title')}</Text>
          </View>
        </View>

        {/* Form Section */}
        <View style={styles.formWrap}>
          <View style={styles.formContainer}>
            {sent ? (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>{t('forgot.success')}</Text>
                <TouchableOpacity
                  onPress={() => router.back()}
                  activeOpacity={0.85}
                  style={styles.button}
                >
                  <Text style={styles.buttonText}>{t('forgot.back')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.description}>{t('forgot.description')}</Text>
                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <Text style={styles.label}>{t('login.email')}</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@company.com"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                />

                <TouchableOpacity
                  onPress={handleReset}
                  disabled={loading || !email.trim()}
                  activeOpacity={0.85}
                  style={[
                    styles.button,
                    (loading || !email.trim()) && styles.buttonDisabled,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.buttonText}>{t('forgot.submit')}</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.back()}
                  activeOpacity={0.7}
                  style={styles.backLink}
                >
                  <ArrowLeft size={16} color={colors.primary} strokeWidth={2} />
                  <Text style={styles.backText}>{t('forgot.back')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <Text style={styles.footer}>{t('common.poweredBy')}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Hero
  hero: {
    backgroundColor: colors.primary,
    paddingTop: 80,
    paddingBottom: 48,
    alignItems: 'center',
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroPattern: {
    ...StyleSheet.absoluteFillObject,
  },
  heroCircle1: {
    position: 'absolute',
    top: -40,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },

  // Form
  formWrap: {
    flex: 1,
    paddingHorizontal: 24,
    marginTop: -20,
  },
  formContainer: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  button: {
    marginTop: 24,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  buttonDisabled: {
    opacity: 0.5,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  buttonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // Success
  successContainer: {
    alignItems: 'center',
    gap: 16,
  },
  successText: {
    fontSize: 15,
    color: colors.success,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Error
  errorContainer: {
    backgroundColor: colors.errorBg,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.15)',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '500',
  },

  footer: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 28,
    marginBottom: 20,
    fontWeight: '500',
  },
});
