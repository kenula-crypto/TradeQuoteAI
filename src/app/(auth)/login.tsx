import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/constants/theme';

export default function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const [forgotMode, setForgotMode]   = useState(false);
  const [resetEmail, setResetEmail]   = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent]     = useState(false);

  const passwordRef = useRef<TextInput>(null);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    const err = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (err) setError(err);
  }

  async function handleResetPassword() {
    if (!resetEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setResetLoading(true);
    setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      resetEmail.trim().toLowerCase(),
    );
    setResetLoading(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setResetSent(true);
    }
  }

  function openForgot() {
    setResetEmail(email.trim()); // prefill with whatever email was entered
    setError('');
    setForgotMode(true);
  }

  function backToLogin() {
    setForgotMode(false);
    setResetSent(false);
    setError('');
  }

  // ── Reset sent confirmation ───────────────────────────────────────
  if (resetSent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <View style={styles.logoArea}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoEmoji}>✉️</Text>
            </View>
            <Text style={styles.logoTitle}>Check your email</Text>
            <Text style={styles.logoSub}>Password reset instructions sent to</Text>
            <Text style={[styles.logoSub, { color: Brand.orange, fontWeight: '600', marginTop: 2 }]}>
              {resetEmail.trim().toLowerCase()}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { fontSize: 14, fontWeight: '400', color: Brand.textSecondary }]}>
              Follow the link in the email to set a new password, then sign in here.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={backToLogin}>
              <Text style={styles.btnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Forgot password form ──────────────────────────────────────────
  if (forgotMode) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.inner}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.logoArea}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoEmoji}>🔑</Text>
            </View>
            <Text style={styles.logoTitle}>Reset Password</Text>
            <Text style={styles.logoSub}>We'll email you a reset link</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Forgot your password?</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <TextInput
                style={styles.input}
                value={resetEmail}
                onChangeText={setResetEmail}
                placeholder="you@example.com"
                placeholderTextColor={Brand.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
                returnKeyType="send"
                onSubmitEditing={handleResetPassword}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, resetLoading && { opacity: 0.7 }]}
              onPress={handleResetPassword}
              disabled={resetLoading}>
              {resetLoading
                ? <ActivityIndicator color={Brand.white} />
                : <Text style={styles.btnText}>Send Reset Link</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={backToLogin}>
              <Text style={styles.footerLink}>← Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Login form ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <View style={styles.logoArea}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoEmoji}>🔨</Text>
          </View>
          <Text style={styles.logoTitle}>TradeQuoteAI</Text>
          <Text style={styles.logoSub}>Professional quotes in minutes</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Brand.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Brand.textMuted}
              secureTextEntry
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
            />
          </View>

          <TouchableOpacity style={styles.forgotLink} onPress={openForgot}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleSignIn}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color={Brand.white} />
              : <Text style={styles.btnText}>Sign In</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.footerLink}>Create one</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.bg },
  inner:     { flex: 1, justifyContent: 'center', padding: 24, gap: 24 },
  logoArea:  { alignItems: 'center', gap: 8 },
  logoIcon: {
    width: 72,
    height: 72,
    backgroundColor: Brand.orange,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoEmoji: { fontSize: 36 },
  logoTitle: { fontSize: 26, fontWeight: '800', color: Brand.navy },
  logoSub:   { fontSize: 13, color: Brand.textMuted },
  card: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: 20,
    gap: 14,
  },
  cardTitle:  { fontSize: 18, fontWeight: '700', color: Brand.navy },
  errorText:  { fontSize: 12, color: Brand.red, backgroundColor: Brand.redLight, borderRadius: 8, padding: 10 },
  fieldGroup: { gap: 5 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: Brand.textMuted, letterSpacing: 0.5 },
  input: {
    backgroundColor: Brand.bg,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: Brand.navy,
  },
  forgotLink: { alignSelf: 'flex-end', marginTop: -6 },
  forgotText: { fontSize: 12, color: Brand.orange, fontWeight: '500' },
  btn: {
    backgroundColor: Brand.orange,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: Brand.white, fontSize: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { fontSize: 13, color: Brand.textMuted },
  footerLink: { fontSize: 13, color: Brand.orange, fontWeight: '600' },
});
