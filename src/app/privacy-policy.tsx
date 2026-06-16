import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Brand } from '@/constants/theme';

const LAST_UPDATED = '10 June 2026';

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Brand.navy} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>

        <Section title="Who we are">
          TradeQuoteAI is operated by KaasTech Ltd ("we", "us", "our"). We provide AI-powered quoting software for painting and decorating tradespeople in the United Kingdom. Our registered address and contact details are available at kaastech.co.uk.
        </Section>

        <Section title="What data we collect">
          We collect and process the following information when you use TradeQuoteAI:{'\n\n'}
          • <Bold>Account information:</Bold> your email address and password (stored securely via Supabase Auth).{'\n'}
          • <Bold>Business profile:</Bold> your business name, owner name, phone number, email, VAT settings, markup preferences, and employee names and hourly rates.{'\n'}
          • <Bold>Quote data:</Bold> job descriptions, measurements, customer names, addresses, phone numbers, email addresses, and generated quote line items and totals.{'\n'}
          • <Bold>Usage data:</Bold> number of quotes generated per month (for billing tier enforcement).{'\n'}
          • <Bold>Billing information:</Bold> your Stripe customer ID and subscription tier. We do not store card details — these are held by Stripe.
        </Section>

        <Section title="How we use your data">
          • To provide the quoting service, generate PDFs, and draft emails on your behalf.{'\n'}
          • To enforce subscription limits (free tier: 5 quotes/month).{'\n'}
          • To process payments and manage your subscription via Stripe.{'\n'}
          • To improve the AI model prompts and quote accuracy (aggregated, anonymised data only).{'\n'}
          • We do not sell your personal data to third parties.
        </Section>

        <Section title="Third-party services">
          We use the following third-party processors:{'\n\n'}
          • <Bold>Supabase</Bold> — database and authentication (EU data residency).{'\n'}
          • <Bold>Groq Inc.</Bold> — AI inference for quote generation (data sent to their API is not retained for training per their policy).{'\n'}
          • <Bold>Stripe Inc.</Bold> — payment processing. Stripe's privacy policy applies to billing data.{'\n'}
          • <Bold>Expo / EAS</Bold> — app distribution and over-the-air updates.
        </Section>

        <Section title="Data retention">
          Your account data is retained for as long as your account is active. You may request deletion of your account and all associated data at any time by emailing kenula@kaastech.co.uk. We will process deletion requests within 30 days.
        </Section>

        <Section title="Your rights (UK GDPR)">
          Under UK GDPR you have the right to:{'\n'}
          • Access the personal data we hold about you.{'\n'}
          • Correct inaccurate data.{'\n'}
          • Request erasure of your data.{'\n'}
          • Object to processing.{'\n'}
          • Data portability (receive your data in a machine-readable format).{'\n\n'}
          To exercise any of these rights, contact us at kenula@kaastech.co.uk.
        </Section>

        <Section title="Cookies and local storage">
          The app uses device local storage (AsyncStorage) solely to maintain your login session. No tracking cookies are used.
        </Section>

        <Section title="Changes to this policy">
          We may update this policy from time to time. Significant changes will be notified via an in-app message. Continued use of the app after changes constitutes acceptance.
        </Section>

        <Section title="Contact">
          KaasTech Ltd{'\n'}
          Email: kenula@kaastech.co.uk{'\n'}
          Website: kaastech.co.uk
        </Section>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

function Bold({ children }: { children: string }) {
  return <Text style={{ fontWeight: '700' }}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
  backText: { fontSize: 13, color: Brand.orange, fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Brand.navy },
  content: { padding: 16, gap: 0 },
  updated: { fontSize: 11, color: Brand.textMuted, marginBottom: 16, textAlign: 'center' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Brand.navy, marginBottom: 8 },
  sectionBody: { fontSize: 13, color: Brand.textSecondary, lineHeight: 20 },
});
