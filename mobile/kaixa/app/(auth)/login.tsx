/**
 * Kaixa — Login Screen
 * Dark theme with logo, gradient CTA, glassmorphic form
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
  Image,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { colors } from '../../lib/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, signInWithGoogle, resetPassword, loading, error, clearError } = useAuthStore();

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Informasaun falta', 'Enter your email and password to continue.');
      return;
    }
    signIn(email.trim(), password);
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Email presiza', 'Enter your email first, then tap reset password.');
      return;
    }

    try {
      await resetPassword(email.trim());
      Alert.alert(
        'Email haruka ona',
        'Check your inbox for a link to reset your password.'
      );
    } catch {
      // The store exposes the localized error in the form card.
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.brandContainer}>
          <Image
            source={require('../../assets/xefe-mark.webp')}
            style={styles.xefeMark}
            resizeMode="contain"
          />
          <Image
            source={require('../../assets/kaixa-logo-light-on-dark.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandTagline}>Ita-nia kaixa dijital</Text>
          <Text style={styles.brandSubTagline}>Your digital cash box</Text>
        </View>

        {/* Form Card */}
        <View style={styles.formContainer}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={clearError}>
                <Text style={styles.errorDismiss}>x</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email@example.com"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="next"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            style={styles.forgotButton}
            onPress={handleResetPassword}
            disabled={loading}
          >
            <Text style={styles.forgotText}>Haluha password? · Reset password</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
            style={styles.buttonWrap}
          >
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.button, loading && styles.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.buttonText}>Tama</Text>
                  <ArrowRight size={18} color={colors.white} strokeWidth={2.5} />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ka</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google sign-in */}
          <TouchableOpacity
            onPress={signInWithGoogle}
            disabled={loading}
            activeOpacity={0.85}
            style={[styles.googleButton, loading && styles.buttonDisabled]}
          >
            <View style={styles.buttonInner}>
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.googleButtonText}>Kontinua ho Google</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>powered by Xefe</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  // Brand
  brandContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  xefeMark: {
    width: 34,
    height: 38,
    marginBottom: 14,
    opacity: 0.9,
  },
  logo: {
    width: 200,
    height: 64,
    marginBottom: 12,
  },
  brandTagline: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  brandSubTagline: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Form
  formContainer: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bgElevated,
  },

  // Button
  buttonWrap: {
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    paddingVertical: 10,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  googleButton: {
    marginTop: 18,
    borderRadius: 14,
    padding: 15,
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleG: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  googleButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
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
    backgroundColor: colors.moneyOutBg,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    flex: 1,
  },
  errorDismiss: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '700',
    paddingLeft: 8,
  },

  footer: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 32,
  },
});
