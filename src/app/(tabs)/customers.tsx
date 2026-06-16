import { useState } from 'react';
import {
  Alert,
  FlatList,
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
import type { Customer } from '@/types';

function CustomerRow({ item, onPress }: { item: Customer; onPress: () => void }) {
  const initials = item.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{item.name}</Text>
        {item.companyName ? (
          <Text style={styles.rowSub}>{item.companyName}</Text>
        ) : item.phone ? (
          <Text style={styles.rowSub}>{item.phone}</Text>
        ) : item.email ? (
          <Text style={styles.rowSub}>{item.email}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Brand.border} />
    </TouchableOpacity>
  );
}

type CustomerFormState = {
  name: string;
  companyName: string;
  phone: string;
  email: string;
  address: string;
};

function CustomerModal({
  visible,
  initial,
  title,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  initial: CustomerFormState;
  title: string;
  onClose: () => void;
  onSave: (v: CustomerFormState) => void;
  onDelete?: () => void;
}) {
  const [name, setName]               = useState(initial.name);
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [phone, setPhone]             = useState(initial.phone);
  const [email, setEmail]             = useState(initial.email);
  const [address, setAddress]         = useState(initial.address);

  function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter the client\'s name.');
      return;
    }
    onSave({ name: name.trim(), companyName: companyName.trim(), phone: phone.trim(), email: email.trim(), address: address.trim() });
  }

  const fields: { label: string; value: string; set: (v: string) => void; placeholder: string; keyboard?: 'default' | 'email-address' | 'phone-pad' }[] = [
    { label: 'NAME *',       value: name,        set: setName,        placeholder: 'Full name or company' },
    { label: 'COMPANY',      value: companyName,  set: setCompanyName, placeholder: 'Optional' },
    { label: 'PHONE',        value: phone,        set: setPhone,       placeholder: '07700 900 000', keyboard: 'phone-pad' },
    { label: 'EMAIL',        value: email,        set: setEmail,       placeholder: 'email@example.com', keyboard: 'email-address' },
    { label: 'ADDRESS',      value: address,      set: setAddress,     placeholder: 'Street, city, postcode' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.cancelText, { color: Brand.orange, fontWeight: '600' }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          {fields.map((f) => (
            <View key={f.label} style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <TextInput
                style={styles.fieldInput}
                value={f.value}
                onChangeText={f.set}
                placeholder={f.placeholder}
                placeholderTextColor={Brand.textMuted}
                keyboardType={f.keyboard ?? 'default'}
                autoCapitalize={f.keyboard === 'email-address' ? 'none' : 'words'}
              />
            </View>
          ))}

          {onDelete && (
            <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
              <Ionicons name="trash-outline" size={16} color={Brand.red} />
              <Text style={styles.deleteBtnText}>Remove Client</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function CustomersScreen() {
  const customers      = useStore((s) => s.customers);
  const addCustomer    = useStore((s) => s.addCustomer);
  const updateCustomer = useStore((s) => s.updateCustomer);
  const removeCustomer = useStore((s) => s.removeCustomer);

  const [search, setSearch]                   = useState('');
  const [showAdd, setShowAdd]                 = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const filtered = customers
    .filter(
      (c) =>
        search.length === 0 ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.companyName?.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  function handleAdd(form: CustomerFormState) {
    addCustomer({
      id: `c-${Date.now()}`,
      name: form.name,
      companyName: form.companyName || undefined,
      phone:       form.phone       || undefined,
      email:       form.email       || undefined,
      address:     form.address     || undefined,
      createdAt: new Date().toISOString(),
    });
    setShowAdd(false);
  }

  function handleEdit(form: CustomerFormState) {
    if (!editingCustomer) return;
    updateCustomer(editingCustomer.id, {
      name:        form.name,
      companyName: form.companyName || undefined,
      phone:       form.phone       || undefined,
      email:       form.email       || undefined,
      address:     form.address     || undefined,
    });
    setEditingCustomer(null);
  }

  function handleDelete() {
    if (!editingCustomer) return;
    Alert.alert('Remove Client', `Remove ${editingCustomer.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeCustomer(editingCustomer.id);
          setEditingCustomer(null);
        },
      },
    ]);
  }

  const emptyForm: CustomerFormState = { name: '', companyName: '', phone: '', email: '', address: '' };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Clients</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={20} color={Brand.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={Brand.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search clients..."
          placeholderTextColor={Brand.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <View style={[styles.card, index === 0 && { marginTop: 0 }]}>
            <CustomerRow item={item} onPress={() => setEditingCustomer(item)} />
            {index < filtered.length - 1 && <View style={styles.separator} />}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={Brand.border} />
            <Text style={styles.emptyTitle}>No clients yet</Text>
            <Text style={styles.emptyBody}>Save customer details here to quickly fill in quotes.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAdd(true)}>
              <Text style={styles.emptyBtnText}>Add first client</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <CustomerModal
        visible={showAdd}
        initial={emptyForm}
        title="New Client"
        onClose={() => setShowAdd(false)}
        onSave={handleAdd}
      />

      {editingCustomer && (
        <CustomerModal
          visible={true}
          initial={{
            name:        editingCustomer.name,
            companyName: editingCustomer.companyName ?? '',
            phone:       editingCustomer.phone       ?? '',
            email:       editingCustomer.email       ?? '',
            address:     editingCustomer.address     ?? '',
          }}
          title="Edit Client"
          onClose={() => setEditingCustomer(null)}
          onSave={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Brand.navy },
  addBtn: {
    backgroundColor: Brand.orange,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: Brand.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: Brand.navy },
  listContent: { paddingHorizontal: 12, paddingBottom: 32 },
  card: {
    backgroundColor: Brand.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Brand.white, fontWeight: '700', fontSize: 14 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 13, fontWeight: '600', color: Brand.navy },
  rowSub:  { fontSize: 11, color: Brand.textMuted, marginTop: 1 },
  separator: { height: 1, backgroundColor: Brand.borderLight, marginHorizontal: 14 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: Brand.navy },
  emptyBody:  { fontSize: 13, color: Brand.textMuted, textAlign: 'center', paddingHorizontal: 32 },
  emptyBtn: {
    marginTop: 4,
    backgroundColor: Brand.orange,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyBtnText: { fontSize: 13, fontWeight: '700', color: Brand.white },
  modal: { flex: 1, backgroundColor: Brand.bg },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Brand.navy },
  cancelText: { fontSize: 14, color: Brand.textSecondary },
  modalBody: { padding: 16, gap: 14 },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: Brand.textMuted, letterSpacing: 0.5 },
  fieldInput: {
    backgroundColor: Brand.white,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Brand.navy,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Brand.red,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: Brand.red },
});
