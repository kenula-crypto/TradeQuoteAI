import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { Brand } from '@/constants/theme';

export default function RegisterScreen() {
  const signUp = useAuthStore((s) => s.signUp);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName]       = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  async function handleRegister() {
    if (!businessName.trim() || !ownerName.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    const err = await signUp(email.trim().toLowerCase(), password, businessName.trim(), ownerName.trim());
    setLoading(false);
    if (err) setError(err);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoEmoji}>🔨</Text>
            </View>
            <Text style={styles.logoTitle}>TradeQuoteAI</Text>
            <Text style={styles.logoSub}>Set up your account in 30 seconds</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create account</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {[
              { label: 'BUSINESS NAME', value: businessName, set: setBusinessName, placeholder: "Mike's Decorating" },
              { label: 'YOUR NAME',     value: ownerName,    set: setOwnerName,    placeholder: 'Mike Smith' },
              { label: 'EMAIL',         value: email,        set: setEmail,        placeholder: 'mike@example.com', email: true },
              { label: 'PASSWORD',      value: password,     set: setPassword,     placeholder: '6+ characters', secure: true },
            ].map((f) => (
              <View key={f.label} style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  value={f.value}
                  onChangeText={f.set}
                  placeholder={f.placeholder}
                  placeholderTextColor={Brand.textMuted}
                  secureTextEntry={f.secure}
                  keyboardType={f.email ? 'email-address' : 'default'}
                  autoCapitalize={f.email || f.secure ? 'none' : 'words'}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}>
              {loading
                ? <ActivityIndicator color={Brand.white} />
                : <Text style={styles.btnText}>Create Account</Text>}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Brand.bg },
  inner:      { padding: 24, gap: 24, paddingBottom: 40 },
  logoArea:   { alignItems: 'center', gap: 8, paddingTop: 12 },
  logoIcon: {
    width: 64,
    height: 64,
    backgroundColor: Brand.orange,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoEmoji:  { fontSize: 32 },
  logoTitle:  { fontSize: 24, fontWeight: '800', color: Brand.navy },
  logoSub:    { fontSize: 12, color: Brand.textMuted },
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
  btn: {
    backgroundColor: Brand.orange,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText:    { color: Brand.white, fontSize: 15, fontWeight: '700' },
  footer:     { flexDirection: 'row', justifyContent: 'center' },
  footerText: { fontSize: 13, color: Brand.textMuted },
  footerLink: { fontSize: 13, color: Brand.orange, fontWeight: '600' },
});
