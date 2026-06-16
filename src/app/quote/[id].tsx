import { useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';

import { useStore } from '@/store';
import { Brand } from '@/constants/theme';
import { generateQuotePDF, draftQuoteEmail } from '@/lib/api';
import type { Quote, QuoteStatus } from '@/types';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const STATUS_CONFIG: Record<QuoteStatus, { bg: string; text: string; label: string }> = {
  draft:    { bg: Brand.border,     text: '#374151',       label: 'Draft' },
  sent:     { bg: Brand.blueLight,  text: Brand.blueText,  label: 'Sent' },
  accepted: { bg: Brand.greenLight, text: Brand.greenText, label: 'Accepted' },
  declined: { bg: Brand.redLight,   text: Brand.redText,   label: 'Declined' },
  expired:  { bg: Brand.amberLight, text: Brand.amberText, label: 'Expired' },
};

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const quotes        = useStore((s) => s.quotes);
  const settings      = useStore((s) => s.settings);
  const updateQuote   = useStore((s) => s.updateQuote);
  const deleteQuote   = useStore((s) => s.deleteQuote);
  const addQuote      = useStore((s) => s.addQuote);
  const nextQuoteNumber = useStore((s) => s.nextQuoteNumber);
  const [pdfLoading, setPdfLoading]       = useState(false);
  const [emailLoading, setEmailLoading]   = useState(false);
  const [editingNotes, setEditingNotes]   = useState(false);
  const [notesText, setNotesText]         = useState('');
  const [editingDetails, setEditingDetails] = useState(false);
  const [editTitle, setEditTitle]           = useState('');
  const [editCustomerName, setEditCustomerName]     = useState('');
  const [editCustomerEmail, setEditCustomerEmail]   = useState('');
  const [editCustomerPhone, setEditCustomerPhone]   = useState('');
  const [editCustomerAddress, setEditCustomerAddress] = useState('');
  const [editJobDescription, setEditJobDescription] = useState('');

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

  function handleDuplicate() {
    const quoteNumber = nextQuoteNumber();
    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setDate(validUntil.getDate() + settings.validityDays);
    const dupeQuote: Quote = {
      ...quote!,
      id: uid(),
      quoteNumber,
      title: quote!.title.endsWith(' (Copy)') ? quote!.title : `${quote!.title} (Copy)`,
      status: 'draft',
      createdAt: now.toISOString(),
      validUntil: validUntil.toISOString(),
      sentAt: undefined,
      acceptedAt: undefined,
      declinedAt: undefined,
    };
    addQuote(dupeQuote);
    router.replace(`/quote/${dupeQuote.id}`);
  }

  function openDetailsEdit() {
    setEditTitle(quote!.title);
    setEditCustomerName(quote!.customerName);
    setEditCustomerEmail(quote!.customerEmail ?? '');
    setEditCustomerPhone(quote!.customerPhone ?? '');
    setEditCustomerAddress(quote!.customerAddress ?? '');
    setEditJobDescription(quote!.jobDescription);
    setEditingDetails(true);
  }

  function saveDetails() {
    if (!editTitle.trim() || !editCustomerName.trim()) return;
    updateQuote(quote!.id, {
      title:           editTitle.trim(),
      customerName:    editCustomerName.trim(),
      customerEmail:   editCustomerEmail.trim()   || undefined,
      customerPhone:   editCustomerPhone.trim()   || undefined,
      customerAddress: editCustomerAddress.trim() || undefined,
      jobDescription:  editJobDescription.trim(),
    });
    setEditingDetails(false);
  }

  function openNotesEdit() {
    setNotesText(quote?.notes ?? '');
    setEditingNotes(true);
  }

  function saveNotes() {
    updateQuote(quote!.id, { notes: notesText.trim() || undefined });
    setEditingNotes(false);
  }

  async function handleSharePDF() {
    setPdfLoading(true);
    try {
      const result = await generateQuotePDF({
        quote: quote!,
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
          dialogTitle: `Share ${quote!.quoteNumber}`,
        });
      }
    } catch (e: unknown) {
      console.error('[SharePDF]', e instanceof Error ? e.message : e);
      Alert.alert('Could not generate PDF', 'Please check your internet connection and try again.');
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleEmailCustomer() {
    if (!quote!.customerEmail) {
      Alert.alert('No email address', 'Add the customer\'s email address to this quote first.');
      return;
    }

    setEmailLoading(true);
    try {
      const backendPayload = {
        quote: quote!,
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
        const mailto = `mailto:${quote!.customerEmail}`
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

        const composed = await MailComposer.composeAsync({
          recipients: [quote!.customerEmail!],
          subject: emailDraft.subject,
          body: emailDraft.body,
          attachments: [pdfPath],
        });
        if (composed.status === MailComposer.MailComposerStatus.SENT && quote!.status === 'draft') {
          markAs('sent');
        }
        return; // skip the web sent-mark below
      }
      // Web: mailto opened, mark as sent optimistically
      if (quote!.status === 'draft') markAs('sent');
    } catch (e: unknown) {
      console.error('[EmailCustomer]', e instanceof Error ? e.message : e);
      Alert.alert('Could not send email', 'Please check your internet connection and try again.');
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={styles.quoteDate}>{createdDate}</Text>
              <TouchableOpacity onPress={openDetailsEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="create-outline" size={16} color={Brand.orange} />
              </TouchableOpacity>
            </View>
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

        {/* AI Notes */}
        {quote.aiNotes ? (
          <View style={styles.aiNotesCard}>
            <Text style={styles.aiNotesLabel}>AI NOTES</Text>
            <Text style={styles.aiNotesText}>{quote.aiNotes}</Text>
          </View>
        ) : null}

        {/* User Notes */}
        <TouchableOpacity style={styles.notesCard} onPress={openNotesEdit} activeOpacity={0.7}>
          <View style={styles.notesTitleRow}>
            <Text style={styles.notesLabel}>NOTES</Text>
            <Ionicons name="create-outline" size={14} color={Brand.orange} />
          </View>
          <Text style={quote.notes ? styles.notesText : styles.notesPlaceholder}>
            {quote.notes || 'Tap to add notes…'}
          </Text>
        </TouchableOpacity>

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
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() =>
              Alert.alert('Duplicate Quote', 'Create a new draft quote based on this one?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Duplicate', onPress: handleDuplicate },
              ])
            }>
            <Ionicons name="copy-outline" size={16} color={Brand.navy} />
            <Text style={[styles.actionBtnText, { color: Brand.navy }]}>Duplicate Quote</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Edit Details modal */}
      <Modal visible={editingDetails} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Brand.bg }}>
          <View style={styles.detailsModalHeader}>
            <TouchableOpacity onPress={() => setEditingDetails(false)}>
              <Text style={styles.detailsModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.detailsModalTitle}>Edit Quote Details</Text>
            <TouchableOpacity onPress={saveDetails}>
              <Text style={[styles.detailsModalCancel, { color: Brand.orange, fontWeight: '600' }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.detailsModalBody} keyboardShouldPersistTaps="handled">
            <View style={styles.detailsField}>
              <Text style={styles.detailsFieldLabel}>QUOTE TITLE</Text>
              <TextInput style={styles.detailsInput} value={editTitle} onChangeText={setEditTitle}
                placeholder="e.g. Lounge repaint" placeholderTextColor={Brand.textMuted} autoCapitalize="words" />
            </View>
            <View style={styles.detailsField}>
              <Text style={styles.detailsFieldLabel}>CUSTOMER NAME</Text>
              <TextInput style={styles.detailsInput} value={editCustomerName} onChangeText={setEditCustomerName}
                placeholder="Full name" placeholderTextColor={Brand.textMuted} autoCapitalize="words" />
            </View>
            <View style={styles.detailsField}>
              <Text style={styles.detailsFieldLabel}>EMAIL</Text>
              <TextInput style={styles.detailsInput} value={editCustomerEmail} onChangeText={setEditCustomerEmail}
                placeholder="customer@example.com" placeholderTextColor={Brand.textMuted}
                keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View style={styles.detailsField}>
              <Text style={styles.detailsFieldLabel}>PHONE</Text>
              <TextInput style={styles.detailsInput} value={editCustomerPhone} onChangeText={setEditCustomerPhone}
                placeholder="07700 900 000" placeholderTextColor={Brand.textMuted} keyboardType="phone-pad" />
            </View>
            <View style={styles.detailsField}>
              <Text style={styles.detailsFieldLabel}>ADDRESS</Text>
              <TextInput style={styles.detailsInput} value={editCustomerAddress} onChangeText={setEditCustomerAddress}
                placeholder="Street, city, postcode" placeholderTextColor={Brand.textMuted} autoCapitalize="words" />
            </View>
            <View style={styles.detailsField}>
              <Text style={styles.detailsFieldLabel}>JOB DESCRIPTION</Text>
              <TextInput
                style={[styles.detailsInput, { height: 90, textAlignVertical: 'top' }]}
                value={editJobDescription}
                onChangeText={setEditJobDescription}
                placeholder="Describe the work to be done…"
                placeholderTextColor={Brand.textMuted}
                multiline
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Notes edit modal */}
      <Modal visible={editingNotes} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.notesModal}>
            <Text style={styles.notesModalTitle}>Quote Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={notesText}
              onChangeText={setNotesText}
              placeholder="Internal notes, follow-up reminders…"
              placeholderTextColor={Brand.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.notesModalBtns}>
              <TouchableOpacity style={styles.notesCancelBtn} onPress={() => setEditingNotes(false)}>
                <Text style={styles.notesCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.notesSaveBtn} onPress={saveNotes}>
                <Text style={styles.notesSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  aiNotesCard: {
    backgroundColor: Brand.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: 12,
    gap: 4,
  },
  aiNotesLabel: { fontSize: 9, fontWeight: '700', color: Brand.textMuted, letterSpacing: 0.5 },
  aiNotesText: { fontSize: 12, color: Brand.textSecondary, lineHeight: 18, fontStyle: 'italic' },
  notesCard: {
    backgroundColor: Brand.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: 12,
    gap: 6,
  },
  notesTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notesLabel: { fontSize: 9, fontWeight: '700', color: Brand.textMuted, letterSpacing: 0.5 },
  notesText: { fontSize: 12, color: Brand.navy, lineHeight: 18 },
  notesPlaceholder: { fontSize: 12, color: Brand.textMuted, fontStyle: 'italic' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  notesModal: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    gap: 14,
  },
  notesModalTitle: { fontSize: 15, fontWeight: '700', color: Brand.navy },
  notesInput: {
    backgroundColor: Brand.bg,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: Brand.navy,
    minHeight: 100,
  },
  notesModalBtns: { flexDirection: 'row', gap: 10 },
  notesCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Brand.bg,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  notesCancelText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  notesSaveBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Brand.orange,
  },
  notesSaveText: { fontSize: 13, fontWeight: '700', color: Brand.white },
  detailsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  detailsModalTitle:  { fontSize: 16, fontWeight: '700', color: Brand.navy },
  detailsModalCancel: { fontSize: 14, color: Brand.textSecondary },
  detailsModalBody:   { padding: 16, gap: 14 },
  detailsField:       { gap: 4 },
  detailsFieldLabel:  { fontSize: 10, fontWeight: '700', color: Brand.textMuted, letterSpacing: 0.5 },
  detailsInput: {
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
