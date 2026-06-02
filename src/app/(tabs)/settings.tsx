import { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useStore } from '@/store';
import { Brand } from '@/constants/theme';
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
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const addEmployee = useStore((s) => s.addEmployee);
  const updateEmployee = useStore((s) => s.updateEmployee);
  const removeEmployee = useStore((s) => s.removeEmployee);

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
    const parsed = numeric ? parseFloat(val) || 0 : val;

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
});
