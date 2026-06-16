import { useState, useEffect } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useStore } from '@/store';
import { useAuthStore } from '@/store/auth';
import { Brand } from '@/constants/theme';
import { createCheckoutSession, createPortalSession, getBillingStatus } from '@/lib/api';
import type { Employee } from '@/types';

function SettingRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingRight}>
        <Text style={styles.settingValue}>{value}</Text>
        {onPress && <Ionicons name="chevron-forward" size={14} color={Brand.border} />}
      </View>
    </TouchableOpacity>
  );
}

function EditFieldModal({
  visible,
  title,
  value,
  keyboardType,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  value: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  onClose: () => void;
  onSave: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.editModal}>
          <Text style={styles.editModalTitle}>{title}</Text>
          <TextInput
            style={styles.editInput}
            value={text}
            onChangeText={setText}
            keyboardType={keyboardType ?? 'default'}
            autoFocus
            selectTextOnFocus
          />
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.editBtn} onPress={onClose}>
              <Text style={styles.editBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editBtn, styles.editBtnPrimary]}
              onPress={() => { onSave(text); onClose(); }}>
              <Text style={[styles.editBtnText, { color: Brand.white }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const settings             = useStore((s) => s.settings);
  const updateSettings       = useStore((s) => s.updateSettings);
  const addEmployee          = useStore((s) => s.addEmployee);
  const updateEmployee       = useStore((s) => s.updateEmployee);
  const removeEmployee       = useStore((s) => s.removeEmployee);
  const updateBilling        = useStore((s) => s.updateBilling);
  const subscriptionTier     = useStore((s) => s.subscriptionTier);
  const stripeCustomerId     = useStore((s) => s.stripeCustomerId);
  const quoteCountThisMonth  = useStore((s) => s.quoteCountThisMonth);
  const quoteMonth           = useStore((s) => s.quoteMonth);
  const userId               = useStore((s) => s.userId);
  const signOut              = useAuthStore((s) => s.signOut);
  const user                 = useAuthStore((s) => s.user);

  // Use auth store user.id as fallback — it's set immediately on session restore,
  // while store.userId is set later after loadUserData completes.
  const effectiveUserId = userId ?? user?.id ?? null;

  const [billingLoading, setBillingLoading] = useState<string | null>(null);
  const [billingError,   setBillingError]   = useState<string>('');

  // Auto-refresh billing status whenever screen loads (catches return from Stripe checkout)
  useEffect(() => {
    const email = user?.email;
    if (email) {
      getBillingStatus(email)
        .then((status) => updateBilling({ subscriptionTier: status.tier }))
        .catch(() => {});
    }
  }, [user?.email]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const quotesUsed   = quoteMonth === currentMonth ? quoteCountThisMonth : 0;

  async function openUrl(url: string) {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
      return;
    }
    // On native, use openAuthSessionAsync so the in-app browser auto-closes when
    // Stripe redirects back to the tradequoteaiapp:// scheme after checkout.
    await WebBrowser.openAuthSessionAsync(url, 'tradequoteaiapp://');
    // Auto-refresh billing status after the Stripe session ends
    const email = user?.email;
    if (email) {
      getBillingStatus(email)
        .then((status) => updateBilling({ subscriptionTier: status.tier }))
        .catch(() => {});
    }
  }

  async function handleUpgrade(plan: 'pro' | 'team') {
    setBillingError('');
    if (!effectiveUserId) { setBillingError('Not signed in — please sign out and back in.'); return; }
    if (!user?.email) { setBillingError('No email on account — contact support.'); return; }

    const priceId = plan === 'pro'
      ? process.env.EXPO_PUBLIC_STRIPE_PRO_PRICE_ID
      : process.env.EXPO_PUBLIC_STRIPE_TEAM_PRICE_ID;

    if (!priceId || priceId.startsWith('your_')) {
      setBillingError('Stripe price IDs not set — add them to your .env file.');
      return;
    }

    setBillingLoading(plan);
    try {
      const appUrl = Platform.OS === 'web' ? window.location.origin : 'tradequoteaiapp://stripe-return';
      const result = await createCheckoutSession({
        userId: effectiveUserId,
        email: user.email,
        priceId,
        successUrl: appUrl,
        cancelUrl:  appUrl,
      });
      updateBilling({ stripeCustomerId: result.customerId });
      await openUrl(result.url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Billing checkout]', msg);
      setBillingError(msg);
    } finally {
      setBillingLoading(null);
    }
  }

  async function handleManage() {
    setBillingError('');
    if (!stripeCustomerId) { setBillingError('No billing account found — upgrade first.'); return; }
    setBillingLoading('portal');
    try {
      const appUrl = Platform.OS === 'web' ? window.location.origin : 'tradequoteaiapp://stripe-return';
      const result = await createPortalSession({ customerId: stripeCustomerId, returnUrl: appUrl });
      await openUrl(result.url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Billing portal]', msg);
      setBillingError(msg);
    } finally {
      setBillingLoading(null);
    }
  }

  async function handleRefreshPlan() {
    setBillingError('');
    if (!user?.email) { setBillingError('Not signed in.'); return; }
    setBillingLoading('refresh');
    try {
      const status = await getBillingStatus(user.email);
      updateBilling({ subscriptionTier: status.tier });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Billing status]', msg);
      setBillingError(msg);
    } finally {
      setBillingLoading(null);
    }
  }

  const [editing, setEditing] = useState<{
    field: string;
    label: string;
    value: string;
    numeric?: boolean;
  } | null>(null);

  function edit(field: string, label: string, value: string | number, numeric = false) {
    setEditing({ field, label, value: String(value), numeric });
  }

  function saveEdit(val: string) {
    if (!editing) return;
    const { field, numeric } = editing;
    let parsed: string | number = numeric ? parseFloat(val) : val;

    if (numeric) {
      if (isNaN(parsed as number)) parsed = 0;
      if (field.endsWith(':hourlyRate') && (parsed as number) < 0) {
        Alert.alert('Invalid Rate', 'Hourly rate cannot be negative.');
        return;
      }
      if (field === 'defaultMarkup' && (parsed as number) < 0) {
        Alert.alert('Invalid Markup', 'Markup cannot be negative.');
        return;
      }
      if (field === 'vatRate' && ((parsed as number) < 0 || (parsed as number) > 100)) {
        Alert.alert('Invalid VAT Rate', 'VAT rate must be between 0 and 100.');
        return;
      }
      if (field === 'validityDays' && (parsed as number) < 1) {
        parsed = 1;
      }
    }

    if (field.startsWith('emp:')) {
      const [, empId, empField] = field.split(':');
      updateEmployee(empId, { [empField]: numeric ? parsed : val });
    } else {
      updateSettings({ [field]: parsed });
    }
  }

  function addNewEmployee() {
    addEmployee({
      id: `e-${Date.now()}`,
      name: 'New Employee',
      role: 'Painter',
      hourlyRate: 15,
    });
  }

  function confirmRemoveEmployee(emp: Employee) {
    Alert.alert('Remove Employee', `Remove ${emp.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeEmployee(emp.id) },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Business Profile */}
        <View style={styles.profileCard}>
          <View style={styles.profileIcon}>
            <Text style={{ fontSize: 24 }}>🔨</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{settings.businessName}</Text>
            <Text style={styles.profileEmail}>{settings.email}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </View>

        {/* Business Details */}
        <Text style={styles.sectionTitle}>BUSINESS DETAILS</Text>
        <View style={styles.section}>
          <SettingRow
            label="Business Name"
            value={settings.businessName}
            onPress={() => edit('businessName', 'Business Name', settings.businessName)}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Your Name"
            value={settings.ownerName}
            onPress={() => edit('ownerName', 'Your Name', settings.ownerName)}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Phone"
            value={settings.phone}
            onPress={() => edit('phone', 'Phone', settings.phone)}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Email"
            value={settings.email}
            onPress={() => edit('email', 'Email', settings.email)}
          />
        </View>

        {/* Quote Defaults */}
        <Text style={styles.sectionTitle}>QUOTE DEFAULTS</Text>
        <View style={styles.section}>
          <SettingRow
            label="Material Markup"
            value={`${settings.defaultMarkup}%`}
            onPress={() => edit('defaultMarkup', 'Material Markup (%)', settings.defaultMarkup, true)}
          />
          <View style={styles.divider} />
          <SettingRow
            label="VAT Rate"
            value={`${settings.vatRate}%`}
            onPress={() => edit('vatRate', 'VAT Rate (%)', settings.vatRate, true)}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Quote Validity"
            value={`${settings.validityDays} days`}
            onPress={() => edit('validityDays', 'Validity (days)', settings.validityDays, true)}
          />
        </View>

        {/* Employees */}
        <Text style={styles.sectionTitle}>EMPLOYEES & WAGES</Text>
        <View style={styles.section}>
          {settings.employees.map((emp, index) => (
            <View key={emp.id}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.empRow}>
                <View style={styles.empInfo}>
                  <TouchableOpacity
                    onPress={() => edit(`emp:${emp.id}:name`, 'Name', emp.name)}>
                    <Text style={styles.empName}>{emp.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => edit(`emp:${emp.id}:role`, 'Role', emp.role)}>
                    <Text style={styles.empRole}>{emp.role}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    edit(`emp:${emp.id}:hourlyRate`, `${emp.name}'s Rate (£/hr)`, emp.hourlyRate, true)
                  }>
                  <Text style={styles.empRate}>£{emp.hourlyRate}/hr</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => confirmRemoveEmployee(emp)}>
                  <Ionicons name="trash-outline" size={16} color={Brand.red} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={styles.divider} />
          <TouchableOpacity style={styles.addEmpBtn} onPress={addNewEmployee}>
            <Ionicons name="add-circle-outline" size={16} color={Brand.orange} />
            <Text style={styles.addEmpText}>Add employee</Text>
          </TouchableOpacity>
        </View>

        {/* Payment Terms */}
        <Text style={styles.sectionTitle}>PAYMENT TERMS</Text>
        <View style={styles.section}>
          <SettingRow
            label="Terms"
            value={settings.paymentTerms}
            onPress={() => edit('paymentTerms', 'Payment Terms', settings.paymentTerms)}
          />
        </View>

        {/* Plan & Billing */}
        <Text style={styles.sectionTitle}>PLAN & BILLING</Text>
        <View style={styles.section}>
          <View style={styles.planRow}>
            <View>
              <Text style={styles.planName}>
                {subscriptionTier === 'free' ? 'Free Plan' :
                 subscriptionTier === 'pro'  ? 'Pro Plan'  : 'Team Plan'}
              </Text>
              <Text style={styles.planDetail}>
                {subscriptionTier === 'free'
                  ? `${quotesUsed} of 5 quotes used this month`
                  : 'Unlimited quotes'}
              </Text>
            </View>
            {subscriptionTier !== 'free' && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>ACTIVE</Text>
              </View>
            )}
          </View>

          {billingError ? (
            <Text style={styles.billingError}>{billingError}</Text>
          ) : null}

          {subscriptionTier === 'free' ? (
            <View style={styles.upgradeButtons}>
              <TouchableOpacity
                style={[styles.upgradeBtn, billingLoading === 'pro' && { opacity: 0.6 }]}
                onPress={() => handleUpgrade('pro')}
                disabled={!!billingLoading}>
                <Text style={styles.upgradeBtnText}>
                  {billingLoading === 'pro' ? 'Opening...' : 'Upgrade to Pro — £29/mo'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.upgradeBtnSecondary, billingLoading === 'team' && { opacity: 0.6 }]}
                onPress={() => handleUpgrade('team')}
                disabled={!!billingLoading}>
                <Text style={styles.upgradeBtnSecondaryText}>
                  {billingLoading === 'team' ? 'Opening...' : 'Upgrade to Team — £59/mo'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.upgradeButtons}>
              <TouchableOpacity
                style={[styles.upgradeBtnSecondary, billingLoading === 'portal' && { opacity: 0.6 }]}
                onPress={handleManage}
                disabled={!!billingLoading}>
                <Text style={styles.upgradeBtnSecondaryText}>
                  {billingLoading === 'portal' ? 'Opening...' : 'Manage Subscription'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.upgradeBtnSecondary, billingLoading === 'refresh' && { opacity: 0.6 }]}
                onPress={handleRefreshPlan}
                disabled={!!billingLoading}>
                <Text style={styles.upgradeBtnSecondaryText}>
                  {billingLoading === 'refresh' ? 'Refreshing...' : 'Refresh Plan Status'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Legal */}
        <Text style={styles.sectionTitle}>LEGAL</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/privacy-policy' as never)}>
            <Text style={styles.settingLabel}>Privacy Policy</Text>
            <View style={styles.settingRight}>
              <Ionicons name="chevron-forward" size={14} color={Brand.border} />
            </View>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/terms-of-service' as never)}>
            <Text style={styles.settingLabel}>Terms of Service</Text>
            <View style={styles.settingRight}>
              <Ionicons name="chevron-forward" size={14} color={Brand.border} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={async () => {
            await signOut();
            if (Platform.OS === 'web') {
              window.location.replace('/');
            }
          }}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {editing && (
        <EditFieldModal
          visible={true}
          title={editing.label}
          value={editing.value}
          keyboardType={editing.numeric ? 'decimal-pad' : 'default'}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.bg },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Brand.navy },
  content: { padding: 16, gap: 0 },
  profileCard: {
    backgroundColor: Brand.navy,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  profileIcon: {
    width: 48,
    height: 48,
    backgroundColor: Brand.orange,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: '700', color: Brand.white },
  profileEmail: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Brand.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },
  section: {
    backgroundColor: Brand.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  settingLabel: { fontSize: 13, color: Brand.navy },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingValue: { fontSize: 13, fontWeight: '500', color: Brand.orange },
  divider: { height: 1, backgroundColor: Brand.borderLight, marginHorizontal: 14 },
  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  empInfo: { flex: 1 },
  empName: { fontSize: 13, fontWeight: '600', color: Brand.navy },
  empRole: { fontSize: 11, color: Brand.textMuted, marginTop: 1 },
  empRate: { fontSize: 13, fontWeight: '600', color: Brand.orange },
  removeBtn: { padding: 4 },
  addEmpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addEmpText: { fontSize: 13, color: Brand.orange, fontWeight: '500' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  editModal: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    gap: 14,
  },
  editModalTitle: { fontSize: 15, fontWeight: '700', color: Brand.navy, textAlign: 'center' },
  editInput: {
    backgroundColor: Brand.bg,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Brand.navy,
    textAlign: 'center',
  },
  editActions: { flexDirection: 'row', gap: 10 },
  editBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Brand.bg,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  editBtnPrimary: { backgroundColor: Brand.orange, borderColor: Brand.orange },
  editBtnText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  planName:   { fontSize: 15, fontWeight: '700', color: Brand.navy },
  planDetail: { fontSize: 12, color: Brand.textMuted, marginTop: 2 },
  activeBadge: {
    backgroundColor: Brand.greenLight,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeBadgeText: { fontSize: 10, fontWeight: '700', color: Brand.greenText },
  upgradeButtons: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  upgradeBtn: {
    backgroundColor: Brand.orange,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  upgradeBtnText: { color: Brand.white, fontSize: 13, fontWeight: '700' },
  upgradeBtnSecondary: {
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  upgradeBtnSecondaryText: { color: Brand.navy, fontSize: 13, fontWeight: '600' },
  billingError: {
    fontSize: 12,
    color: Brand.red,
    backgroundColor: Brand.redLight,
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 14,
    marginBottom: 8,
  },
  signOutBtn: {
    marginTop: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Brand.red,
    paddingVertical: 13,
    alignItems: 'center',
  },
  signOutText: { fontSize: 14, fontWeight: '600', color: Brand.red },
});
