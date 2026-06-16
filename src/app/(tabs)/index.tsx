import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useStore } from '@/store';
import { Brand } from '@/constants/theme';
import type { Quote, QuoteStatus } from '@/types';

const STATUS_COLORS: Record<QuoteStatus, { bg: string; text: string; label: string }> = {
  draft:    { bg: Brand.border,      text: '#374151',       label: 'Draft' },
  sent:     { bg: Brand.blueLight,   text: Brand.blueText,  label: 'Sent' },
  accepted: { bg: Brand.greenLight,  text: Brand.greenText, label: 'Accepted' },
  declined: { bg: Brand.redLight,    text: Brand.redText,   label: 'Declined' },
  expired:  { bg: Brand.amberLight,  text: Brand.amberText, label: 'Expired' },
};

function StatusBadge({ status }: { status: QuoteStatus }) {
  const s = STATUS_COLORS[status];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.text }]}>{s.label}</Text>
    </View>
  );
}

function QuoteCard({ item }: { item: Quote }) {
  return (
    <TouchableOpacity
      style={styles.quoteCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/quote/${item.id}`)}>
      <View style={styles.quoteCardLeft}>
        <Text style={styles.quoteCustomer}>{item.customerName}</Text>
        <Text style={styles.quoteTitle} numberOfLines={1}>{item.title}</Text>
      </View>
      <View style={styles.quoteCardRight}>
        <Text style={styles.quoteTotal}>£{item.total.toLocaleString()}</Text>
        <StatusBadge status={item.status} />
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const quotes = useStore((s) => s.quotes);
  const settings = useStore((s) => s.settings);

  const now = new Date();
  const thisMonth = quotes.filter((q) => {
    const d = new Date(q.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const accepted = quotes.filter((q) => q.status === 'accepted');
  const totalValue = accepted.reduce((sum, q) => sum + q.total, 0);
  const recent = quotes.slice(0, 5);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{(() => {
            const h = new Date().getHours();
            if (h < 12) return 'Good morning,';
            if (h < 18) return 'Good afternoon,';
            return 'Good evening,';
          })()}</Text>
          <Text style={styles.name}>{settings.ownerName ? `${settings.ownerName} 👋` : 'Welcome back 👋'}</Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          activeOpacity={0.8}
          onPress={() => router.push('/quote/new')}>
          <Ionicons name="add" size={18} color={Brand.white} />
          <Text style={styles.newBtnText}>New Quote</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={recent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{thisMonth.length}</Text>
                <Text style={styles.statLabel}>This month</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: Brand.green }]}>{accepted.length}</Text>
                <Text style={styles.statLabel}>Accepted</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: Brand.orange, fontSize: 16 }]}>
                  £{(totalValue / 1000).toFixed(1)}k
                </Text>
                <Text style={styles.statLabel}>Total value</Text>
              </View>
            </View>

            {/* No employees warning */}
            {settings.employees.length === 0 && (
              <TouchableOpacity
                style={styles.warningBanner}
                activeOpacity={0.8}
                onPress={() => router.push('/(tabs)/settings')}>
                <Ionicons name="warning-outline" size={16} color={Brand.amberText} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningTitle}>Add your employees first</Text>
                  <Text style={styles.warningBody}>Labour costs will be £0 until you add employees in Settings.</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={Brand.amberText} />
              </TouchableOpacity>
            )}

            <Text style={styles.sectionTitle}>Recent Quotes</Text>
          </>
        }
        renderItem={({ item, index }) => (
          <View>
            <QuoteCard item={item} />
            {index < recent.length - 1 && <View style={styles.separator} />}
          </View>
        )}
        ItemSeparatorComponent={null}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔨</Text>
            <Text style={styles.emptyTitle}>No quotes yet</Text>
            <Text style={styles.emptyBody}>Tap "New Quote" to generate your first AI-powered estimate in under 3 minutes.</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/quote/new')}>
              <Text style={styles.emptyBtnText}>Create first quote</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          quotes.length > 5 ? (
            <TouchableOpacity
              style={styles.viewAll}
              onPress={() => router.push('/(tabs)/quotes')}>
              <Text style={styles.viewAllText}>View all quotes →</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.bg,
  },
  header: {
    backgroundColor: Brand.navy,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  greeting: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: Brand.white,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Brand.orange,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  newBtnText: {
    color: Brand.white,
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Brand.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Brand.navy,
  },
  statLabel: {
    fontSize: 10,
    color: Brand.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  quoteCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Brand.white,
  },
  quoteCardLeft: {
    flex: 1,
    marginRight: 12,
  },
  quoteCustomer: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.navy,
  },
  quoteTitle: {
    fontSize: 11,
    color: Brand.textMuted,
    marginTop: 2,
  },
  quoteCardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  quoteTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.navy,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  separator: {
    height: 1,
    backgroundColor: Brand.borderLight,
    marginHorizontal: 14,
  },
  card: {
    backgroundColor: Brand.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
  },
  viewAll: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  viewAllText: {
    fontSize: 12,
    color: Brand.orange,
    fontWeight: '500',
  },
  warningBanner: {
    backgroundColor: Brand.amberLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.amber,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  warningTitle: { fontSize: 12, fontWeight: '700', color: Brand.amberText },
  warningBody:  { fontSize: 11, color: Brand.amberText, marginTop: 1 },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Brand.navy },
  emptyBody:  { fontSize: 13, color: Brand.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    backgroundColor: Brand.orange,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  emptyBtnText: { color: Brand.white, fontSize: 14, fontWeight: '700' },
});
