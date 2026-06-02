import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';

import { useStore } from '@/store';
import { Brand } from '@/constants/theme';
import { generateQuotePDF, draftQuoteEmail } from '@/lib/api';
import type { QuoteStatus } from '@/types';

const STATUS_CONFIG: Record<QuoteStatus, { bg: string; text: string; label: string }> = {
  draft:    { bg: Brand.border,     text: '#374151',       label: 'Draft' },
  sent:     { bg: Brand.blueLight,  text: Brand.blueText,  label: 'Sent' },
  accepted: { bg: Brand.greenLight, text: Brand.greenText, label: 'Accepted' },
  declined: { bg: Brand.redLight,   text: Brand.redText,   label: 'Declined' },
  expired:  { bg: Brand.amberLight, text: Brand.amberText, label: 'Expired' },
};

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const quotes = useStore((s) => s.quotes);
  const settings = useStore((s) => s.settings);
  const updateQuote = useStore((s) => s.updateQuote);
  const deleteQuote = useStore((s) => s.deleteQuote);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const quote = quotes.find((q) => q.id === id);

  if (!quote) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={Brand.navy} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Quote not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = STATUS_CONFIG[quote.status];
  const createdDate = new Date(quote.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const validDate = new Date(quote.validUntil).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  function markAs(newStatus: QuoteStatus) {
    updateQuote(quote!.id, {
      status: newStatus,
      ...(newStatus === 'sent' ? { sentAt: new Date().toISOString() } : {}),
      ...(newStatus === 'accepted' ? { acceptedAt: new Date().toISOString() } : {}),
      ...(newStatus === 'declined' ? { declinedAt: new Date().toISOString() } : {}),
    });
  }

  async function handleSharePDF() {
    setPdfLoading(true);
    try {
      const result = await generateQuotePDF({
        quote,
        settings: {
          businessName: settings.businessName,
          ownerName: settings.ownerName,
          phone: settings.phone,
          email: settings.email,
          paymentTerms: settings.paymentTerms,
        },
      });

      if (Platform.OS === 'web') {
        // Browser download
        const bytes = atob(result.pdf_base64);
        const array = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
        const blob = new Blob([array], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Native: write to cache then open share sheet
        const dir = FileSystem.cacheDirectory;
        if (!dir) throw new Error('Cache directory unavailable');
        const path = dir + result.filename;
        await FileSystem.writeAsStringAsync(path, result.pdf_base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Sharing.shareAsync(path, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${quote.quoteNumber}`,
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[SharePDF]', msg);
      Alert.alert('PDF Error', msg);
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleEmailCustomer() {
    if (!quote.customerEmail) {
      Alert.alert('No email address', 'Add the customer\'s email address to this quote first.');
      return;
    }

    setEmailLoading(true);
    try {
      const backendPayload = {
        quote,
        settings: {
          businessName: settings.businessName,
          ownerName: settings.ownerName,
          phone: settings.phone,
          email: settings.email,
          paymentTerms: settings.paymentTerms,
        },
      };

      // Draft email and generate PDF in parallel
      const [emailDraft, pdfResult] = await Promise.all([
        draftQuoteEmail(backendPayload),
        generateQuotePDF(backendPayload),
      ]);

      if (Platform.OS === 'web') {
        // Web: open mailto with subject + body (no attachment support in mailto)
        const mailto = `mailto:${quote.customerEmail}`
          + `?subject=${encodeURIComponent(emailDraft.subject)}`
          + `&body=${encodeURIComponent(emailDraft.body)}`;
        window.open(mailto, '_blank');
      } else {
        // Native: write PDF to cache then open mail composer
        const dir = FileSystem.cacheDirectory;
        if (!dir) throw new Error('Cache directory unavailable');
        const pdfPath = dir + pdfResult.filename;
        await FileSystem.writeAsStringAsync(pdfPath, pdfResult.pdf_base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const available = await MailComposer.isAvailableAsync();
        if (!available) {
          Alert.alert('No mail app', 'No email client is set up on this device.');
          return;
        }

        await MailComposer.composeAsync({
          recipients: [quote.customerEmail],
          subject: emailDraft.subject,
          body: emailDraft.body,
          attachments: [pdfPath],
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[EmailCustomer]', msg);
      Alert.alert('Error', msg);
    } finally {
      setEmailLoading(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete Quote', `Delete ${quote?.quoteNumber}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteQuote(quote!.id);
          router.back();
        },
      },
    ]);
  }

  const materials = quote.lineItems.filter((i) => i.type === 'material');
  const labour = quote.lineItems.filter((i) => i.type === 'labour');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Brand.navy} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{quote.quoteNumber}</Text>
        <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color={Brand.red} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status + customer */}
        <View style={styles.topCard}>
          <View style={styles.topCardRow}>
            <View style={[styles.badge, { backgroundColor: status.bg }]}>
              <Text style={[styles.badgeText, { color: status.text }]}>{status.label}</Text>
            </View>
            <Text style={styles.quoteDate}>{createdDate}</Text>
          </View>
          <Text style={styles.quoteTitle}>{quote.title}</Text>
          <View style={styles.customerRow}>
            <Ionicons name="person-circle-outline" size={16} color={Brand.textMuted} />
            <Text style={styles.customerName}>{quote.customerName}</Text>
            {quote.customerPhone && (
              <Text style={styles.customerPhone}>{quote.customerPhone}</Text>
            )}
          </View>
          {quote.jobDescription ? (
            <Text style={styles.jobDesc} numberOfLines={3}>{quote.jobDescription}</Text>
          ) : null}
          <Text style={styles.validUntil}>Valid until {validDate}</Text>
        </View>

        {/* Summary */}
        <View style={styles.summaryBanner}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>MATERIALS</Text>
            <Text style={styles.summaryValue}>£{quote.subtotalMaterials}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>LABOUR</Text>
            <Text style={styles.summaryValue}>£{quote.subtotalLabour}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>VAT</Text>
            <Text style={styles.summaryValue}>£{quote.vatAmount}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: Brand.orange }]}>TOTAL</Text>
            <Text style={[styles.summaryValue, { color: Brand.orange, fontSize: 16 }]}>
              £{quote.total.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Materials */}
        {materials.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>MATERIALS</Text>
              <Text style={styles.sectionSubtotal}>£{quote.subtotalMaterials}</Text>
            </View>
            {materials.map((item, i) => (
              <View key={item.id}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.lineItem}>
                  <View style={styles.lineItemLeft}>
                    <Text style={styles.lineItemName}>{item.name}</Text>
                    <Text style={styles.lineItemSub}>{item.quantity} {item.unit} × £{item.unitCost}</Text>
                  </View>
                  <Text style={styles.lineItemTotal}>£{item.totalCost}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Labour */}
        {labour.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>LABOUR</Text>
              <Text style={styles.sectionSubtotal}>£{quote.subtotalLabour}</Text>
            </View>
            {labour.map((item, i) => (
              <View key={item.id}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.lineItem}>
                  <View style={styles.lineItemLeft}>
                    <Text style={styles.lineItemName}>{item.name}</Text>
                    <Text style={styles.lineItemSub}>{item.quantity} {item.unit} × £{item.unitCost}/hr</Text>
                  </View>
                  <Text style={styles.lineItemTotal}>£{item.totalCost}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Totals breakdown */}
        <View style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>Materials subtotal</Text>
            <Text style={styles.totalRowValue}>£{quote.subtotalMaterials}</Text>
          </View>
          {quote.markupAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Markup ({quote.markupPercent}%)</Text>
              <Text style={styles.totalRowValue}>£{quote.markupAmount}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>Labour subtotal</Text>
            <Text style={styles.totalRowValue}>£{quote.subtotalLabour}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowSubtotal]}>
            <Text style={styles.totalRowLabel}>Subtotal</Text>
            <Text style={styles.totalRowValue}>£{quote.subtotal}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>VAT ({quote.vatRate}%)</Text>
            <Text style={styles.totalRowValue}>£{quote.vatAmount}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL</Text>
            <Text style={styles.grandTotalValue}>£{quote.total.toLocaleString()}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          {quote.status === 'draft' && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => markAs('sent')}>
              <Ionicons name="send-outline" size={16} color={Brand.white} />
              <Text style={styles.actionBtnText}>Mark as Sent</Text>
            </TouchableOpacity>
          )}
          {quote.status === 'sent' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Brand.green }]}
                onPress={() => markAs('accepted')}>
                <Ionicons name="checkmark-circle-outline" size={16} color={Brand.white} />
                <Text style={styles.actionBtnText}>Mark Accepted</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Brand.red }]}
                onPress={() => markAs('declined')}>
                <Ionicons name="close-circle-outline" size={16} color={Brand.white} />
                <Text style={styles.actionBtnText}>Mark Declined</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, emailLoading && { opacity: 0.6 }]}
            onPress={handleEmailCustomer}
            disabled={emailLoading}>
            <Ionicons
              name={emailLoading ? 'hourglass-outline' : 'mail-outline'}
              size={16}
              color={Brand.white}
            />
            <Text style={styles.actionBtnText}>
              {emailLoading ? 'Drafting email...' : 'Email Customer'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary, pdfLoading && { opacity: 0.6 }]}
            onPress={handleSharePDF}
            disabled={pdfLoading}>
            <Ionicons
              name={pdfLoading ? 'hourglass-outline' : 'share-outline'}
              size={16}
              color={Brand.navy}
            />
            <Text style={[styles.actionBtnText, { color: Brand.navy }]}>
              {pdfLoading ? 'Generating PDF...' : 'Share PDF'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
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
  headerTitle: { fontSize: 15, fontWeight: '700', color: Brand.navy },
  deleteBtn: { width: 36, alignItems: 'flex-end' },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 15, color: Brand.textMuted },
  content: { padding: 14, gap: 12, paddingBottom: 24 },
  topCard: {
    backgroundColor: Brand.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: 14,
    gap: 6,
  },
  topCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  quoteDate: { fontSize: 11, color: Brand.textMuted },
  quoteTitle: { fontSize: 16, fontWeight: '700', color: Brand.navy, marginTop: 2 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  customerName: { fontSize: 13, fontWeight: '500', color: Brand.navy },
  customerPhone: { fontSize: 12, color: Brand.textMuted },
  jobDesc: { fontSize: 12, color: Brand.textSecondary, lineHeight: 18, marginTop: 2 },
  validUntil: { fontSize: 11, color: Brand.textMuted, marginTop: 4 },
  summaryBanner: {
    backgroundColor: Brand.navy,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 9, color: 'rgba(255,255,255,0.45)', marginBottom: 3 },
  summaryValue: { fontSize: 14, fontWeight: '700', color: Brand.white },
  section: {
    backgroundColor: Brand.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: Brand.bg,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  sectionTitle: { fontSize: 10, fontWeight: '700', color: Brand.navy, letterSpacing: 0.5 },
  sectionSubtotal: { fontSize: 11, color: Brand.textMuted },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  lineItemLeft: { flex: 1, marginRight: 8 },
  lineItemName: { fontSize: 12, fontWeight: '500', color: Brand.navy },
  lineItemSub: { fontSize: 10, color: Brand.textMuted, marginTop: 1 },
  lineItemTotal: { fontSize: 13, fontWeight: '600', color: Brand.navy },
  divider: { height: 1, backgroundColor: Brand.borderLight, marginHorizontal: 14 },
  totalsCard: {
    backgroundColor: Brand.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
    padding: 14,
    gap: 6,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalRowSubtotal: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Brand.border,
    marginTop: 2,
  },
  totalRowLabel: { fontSize: 12, color: Brand.textSecondary },
  totalRowValue: { fontSize: 12, color: Brand.navy, fontWeight: '500' },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Brand.navy,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
  },
  grandTotalLabel: { fontSize: 11, fontWeight: '700', color: Brand.white },
  grandTotalValue: { fontSize: 18, fontWeight: '800', color: Brand.orange },
  actionsSection: { gap: 10 },
  actionBtn: {
    backgroundColor: Brand.orange,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnSecondary: {
    backgroundColor: Brand.white,
    borderWidth: 1.5,
    borderColor: Brand.border,
  },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: Brand.white },
});
