/**
 * Ekipa — Login Screen
 * Premium feel with teal hero section
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
import { ArrowRight, Shield } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, loading, error, clearError } = useAuthStore();
  const t = useT();

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) return;
    signIn(email.trim(), password);
  };

  const errorMessage = error
    ? error === 'invalid'
      ? t('login.error.invalid')
      : error === 'tooMany'
        ? t('login.error.tooMany')
        : t('login.error.generic')
    : null;

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
              <Shield size={28} color={colors.white} strokeWidth={2} />
            </View>
            <Text style={styles.brandName}>Ekipa</Text>
            <Text style={styles.brandTagline}>{t('login.tagline')}</Text>
          </View>
        </View>

        {/* Form Section */}
        <View style={styles.formWrap}>
          <View style={styles.formContainer}>
            <Text style={styles.welcomeText}>{t('login.signIn')}</Text>

            {errorMessage && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <TouchableOpacity onPress={clearError} hitSlop={12}>
                  <Text style={styles.errorDismiss}>{'\u2715'}</Text>
                </TouchableOpacity>
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
              returnKeyType="next"
            />

            <Text style={styles.label}>{t('login.password')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={'\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading || !email.trim() || !password.trim()}
              activeOpacity={0.85}
              style={[
                styles.button,
                (loading || !email.trim() || !password.trim()) && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.buttonText}>{t('login.signIn')}</Text>
                  <ArrowRight size={18} color={colors.white} strokeWidth={2.5} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
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
  brandName: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1.5,
  },
  brandTagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
    fontWeight: '500',
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
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
    letterSpacing: -0.3,
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

  // Button
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
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },

  // Error
  errorContainer: {
    backgroundColor: colors.errorBg,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.15)',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  errorDismiss: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '700',
    paddingLeft: 12,
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
