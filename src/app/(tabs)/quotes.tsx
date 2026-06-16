import { useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useStore } from '@/store';
import { Brand } from '@/constants/theme';
import type { Quote, QuoteStatus } from '@/types';

const FILTERS: { label: string; value: QuoteStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Declined', value: 'declined' },
  { label: 'Expired', value: 'expired' },
];

const STATUS_COLORS: Record<QuoteStatus, { bg: string; text: string }> = {
  draft:    { bg: Brand.border,     text: '#374151' },
  sent:     { bg: Brand.blueLight,  text: Brand.blueText },
  accepted: { bg: Brand.greenLight, text: Brand.greenText },
  declined: { bg: Brand.redLight,   text: Brand.redText },
  expired:  { bg: Brand.amberLight, text: Brand.amberText },
};

function QuoteRow({ item }: { item: Quote }) {
  const s = STATUS_COLORS[item.status];
  const date = new Date(item.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  });

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => router.push(`/quote/${item.id}`)}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowCustomer}>{item.customerName}</Text>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.rowDate}>{item.quoteNumber} · {date}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowTotal}>£{item.total.toLocaleString()}</Text>
        <View style={[styles.badge, { backgroundColor: s.bg }]}>
          <Text style={[styles.badgeText, { color: s.text }]}>{item.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function QuotesScreen() {
  const quotes = useStore((s) => s.quotes);
  const [filter, setFilter] = useState<QuoteStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = quotes
    .filter((q) => {
      const matchFilter = filter === 'all' || q.status === filter;
      const matchSearch =
        search.length === 0 ||
        q.customerName.toLowerCase().includes(search.toLowerCase()) ||
        q.title.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quotes</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/quote/new')}>
          <Ionicons name="add" size={20} color={Brand.white} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={Brand.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by customer or job..."
          placeholderTextColor={Brand.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.chip, filter === f.value && styles.chipActive]}
            onPress={() => setFilter(f.value)}>
            <Text style={[styles.chipText, filter === f.value && styles.chipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <View style={[styles.card, index === 0 && styles.cardFirst]}>
            <QuoteRow item={item} />
            {index < filtered.length - 1 && <View style={styles.separator} />}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={40} color={Brand.border} />
            <Text style={styles.emptyText}>No quotes found</Text>
          </View>
        }
      />
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
  filterRow: { paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  chipActive: { backgroundColor: Brand.navy, borderColor: Brand.navy },
  chipText: { fontSize: 12, fontWeight: '500', color: Brand.textSecondary },
  chipTextActive: { color: Brand.white, fontWeight: '600' },
  listContent: { paddingHorizontal: 12, paddingBottom: 32 },
  card: {
    backgroundColor: Brand.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
    marginBottom: 2,
  },
  cardFirst: {},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowLeft: { flex: 1, marginRight: 12 },
  rowCustomer: { fontSize: 13, fontWeight: '600', color: Brand.navy },
  rowTitle: { fontSize: 11, color: Brand.textMuted, marginTop: 1 },
  rowDate: { fontSize: 10, color: Brand.textMuted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowTotal: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  badgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  separator: { height: 1, backgroundColor: Brand.borderLight, marginHorizontal: 14 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, color: Brand.textMuted },
});
