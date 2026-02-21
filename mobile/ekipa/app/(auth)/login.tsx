/**
 * Ekipa -- Login Screen
 * Premium dark theme with green (#22C55E) hero section
 * Glass-morphism shield icon, elevated form card overlapping hero
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
        {/* ── Hero Section ─────────────────────────────── */}
        <View style={styles.hero}>
          {/* Decorative circles */}
          <View style={styles.heroPattern}>
            <View style={styles.heroCircle1} />
            <View style={styles.heroCircle2} />
            <View style={styles.heroCircle3} />
          </View>

          <View style={styles.heroContent}>
            {/* Glass-morphism shield icon */}
            <View style={styles.logoGlass}>
              <View style={styles.logoInner}>
                <Shield size={30} color={colors.white} strokeWidth={2} />
              </View>
            </View>

            <Text style={styles.brandName}>Ekipa</Text>
            <Text style={styles.brandTagline}>{t('login.tagline')}</Text>
          </View>
        </View>

        {/* ── Form Section ─────────────────────────────── */}
        <View style={styles.formWrap}>
          <View style={styles.formCard}>
            <Text style={styles.signInTitle}>{t('login.signIn')}</Text>
            {/* Error */}
            {errorMessage && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <TouchableOpacity onPress={clearError} hitSlop={12}>
                  <Text style={styles.errorDismiss}>{'\u2715'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Email */}
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

            {/* Password */}
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

            {/* Forgot password */}
            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              activeOpacity={0.7}
              style={styles.forgotBtn}
            >
              <Text style={styles.forgotText}>{t('forgot.title')}</Text>
            </TouchableOpacity>

            {/* Sign In button */}
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

/* ── Styles ─────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },

  /* ── Hero ─────────────────────────────────────────── */
  hero: {
    backgroundColor: colors.primary,
    paddingTop: 80,
    paddingBottom: 56,
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
    top: -50,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroCircle2: {
    position: 'absolute',
    bottom: -40,
    left: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroCircle3: {
    position: 'absolute',
    top: 30,
    left: 40,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroContent: {
    alignItems: 'center',
    zIndex: 1,
  },

  /* Glass-morphism logo */
  logoGlass: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  logoInner: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandName: {
    fontSize: 46,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: -2,
  },
  brandTagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.70)',
    marginTop: 6,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  /* ── Form ─────────────────────────────────────────── */
  formWrap: {
    flex: 1,
    paddingHorizontal: 24,
    marginTop: -24,
  },
  formCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  signInTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
    letterSpacing: -0.3,
  },

  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    marginBottom: 6,
    marginTop: 20,
    textTransform: 'uppercase',
    letterSpacing: 1,
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

  /* Forgot password */
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },

  /* Button */
  button: {
    marginTop: 24,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  buttonDisabled: {
    opacity: 0.45,
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

  /* Error */
  errorCard: {
    backgroundColor: colors.errorBg,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.18)',
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
