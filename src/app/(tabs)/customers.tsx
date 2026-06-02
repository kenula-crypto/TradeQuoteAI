import { useState } from 'react';
import {
  FlatList,
  Modal,
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

function CustomerRow({ item }: { item: Customer }) {
  const initials = item.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{item.name}</Text>
        {item.companyName && (
          <Text style={styles.rowSub}>{item.companyName}</Text>
        )}
        {item.phone && !item.companyName && (
          <Text style={styles.rowSub}>{item.phone}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Brand.border} />
    </View>
  );
}

function AddCustomerModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const addCustomer = useStore((s) => s.addCustomer);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  function save() {
    if (!name.trim()) return;
    addCustomer({
      id: `c-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
    setName(''); setPhone(''); setEmail(''); setAddress('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>New Client</Text>
          <TouchableOpacity onPress={save}>
            <Text style={[styles.cancelText, { color: Brand.orange, fontWeight: '600' }]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalBody}>
          {[
            { label: 'NAME *', value: name, set: setName, placeholder: 'Full name or company' },
            { label: 'PHONE', value: phone, set: setPhone, placeholder: '07700 900 000' },
            { label: 'EMAIL', value: email, set: setEmail, placeholder: 'email@example.com' },
            { label: 'ADDRESS', value: address, set: setAddress, placeholder: 'Street, city, postcode' },
          ].map((field) => (
            <View key={field.label} style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <TextInput
                style={styles.fieldInput}
                value={field.value}
                onChangeText={field.set}
                placeholder={field.placeholder}
                placeholderTextColor={Brand.textMuted}
              />
            </View>
          ))}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function CustomersScreen() {
  const customers = useStore((s) => s.customers);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const filtered = customers.filter(
    (c) =>
      search.length === 0 ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()),
  );

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
          <View>
            <CustomerRow item={item} />
            {index < filtered.length - 1 && <View style={styles.separator} />}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={Brand.border} />
            <Text style={styles.emptyText}>No clients yet</Text>
            <TouchableOpacity onPress={() => setShowAdd(true)}>
              <Text style={[styles.emptyText, { color: Brand.orange, marginTop: 4 }]}>
                Add your first client
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      <AddCustomerModal visible={showAdd} onClose={() => setShowAdd(false)} />
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Brand.white,
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
  rowSub: { fontSize: 11, color: Brand.textMuted, marginTop: 1 },
  separator: { height: 1, backgroundColor: Brand.borderLight, marginHorizontal: 14 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 6 },
  emptyText: { fontSize: 14, color: Brand.textMuted },
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
});
