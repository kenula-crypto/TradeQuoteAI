import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { generateQuoteFromAI } from '@/lib/api';
import { useStore } from '@/store';
import { Brand } from '@/constants/theme';
import type { Measurement, Quote, QuoteLineItem, SurfaceType } from '@/types';

type Step = 'details' | 'measurements' | 'processing' | 'review' | 'send';

const SURFACE_TYPES: { label: string; value: SurfaceType }[] = [
  { label: 'Walls', value: 'walls' },
  { label: 'Ceiling', value: 'ceiling' },
  { label: 'Woodwork', value: 'woodwork' },
  { label: 'Exterior', value: 'exterior' },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}


export default function NewQuoteScreen() {
  const settings = useStore((s) => s.settings);
  const addQuote = useStore((s) => s.addQuote);
  const nextQuoteNumber = useStore((s) => s.nextQuoteNumber);

  const [step, setStep] = useState<Step>('details');
  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [generatedData, setGeneratedData] = useState<Pick<Quote, 'lineItems' | 'measurements' | 'subtotalMaterials' | 'subtotalLabour' | 'markupAmount' | 'subtotal' | 'vatAmount' | 'total' | 'markupPercent' | 'vatRate'> | null>(null);

  const [showAddArea, setShowAddArea] = useState(false);
  const [areaLabel, setAreaLabel] = useState('');
  const [areaSurface, setAreaSurface] = useState<SurfaceType>('walls');
  const [areaWidth, setAreaWidth] = useState('');
  const [areaHeight, setAreaHeight] = useState('');
  const [areaM2Direct, setAreaM2Direct] = useState('');

  const processingDots = useRef(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (step !== 'processing') return;

    const interval = setInterval(() => {
      processingDots.current = (processingDots.current + 1) % 4;
      setDots('.'.repeat(processingDots.current));
    }, 400);

    generateQuoteFromAI({
      job_description: jobDescription,
      measurements: measurements.map((m) => ({
        label: m.label,
        surface_type: m.surfaceType,
        area_m2: m.areaM2,
      })),
      employees: settings.employees.map((e) => ({
        name: e.name,
        role: e.role,
        hourly_rate: e.hourlyRate,
      })),
      markup_percent: settings.defaultMarkup,
      vat_rate: settings.vatRate,
    })
      .then((result) => {
        clearInterval(interval);
        const lineItems: QuoteLineItem[] = result.line_items.map((i) => ({
          id: i.id,
          type: i.type,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          unitCost: i.unit_cost,
          totalCost: i.total_cost,
        }));
        setGeneratedData({
          lineItems,
          measurements,
          subtotalMaterials: result.subtotal_materials,
          subtotalLabour: result.subtotal_labour,
          markupAmount: result.markup_amount,
          subtotal: result.subtotal,
          vatAmount: result.vat_amount,
          total: result.total,
          markupPercent: settings.defaultMarkup,
          vatRate: settings.vatRate,
        });
        setStep('review');
      })
      .catch((err) => {
        clearInterval(interval);
        Alert.alert(
          'AI Error',
          'Could not generate quote. Make sure the backend is running.\n\n' + String(err?.message ?? err),
        );
        setStep('measurements');
      });

    return () => clearInterval(interval);
  }, [step]);

  function addArea() {
    const m2 = areaM2Direct
      ? parseFloat(areaM2Direct)
      : parseFloat(areaWidth) * parseFloat(areaHeight);
    if (!areaLabel.trim() || !m2 || isNaN(m2)) {
      Alert.alert('Missing info', 'Please enter a label and dimensions.');
      return;
    }
    setMeasurements((prev) => [
      ...prev,
      { id: uid(), label: areaLabel.trim(), surfaceType: areaSurface, areaM2: Math.round(m2 * 10) / 10 },
    ]);
    setAreaLabel(''); setAreaWidth(''); setAreaHeight(''); setAreaM2Direct('');
    setAreaSurface('walls');
    setShowAddArea(false);
  }

  function saveQuote() {
    if (!generatedData) return;
    const quoteNumber = nextQuoteNumber();
    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setDate(validUntil.getDate() + settings.validityDays);

    const quote: Quote = {
      id: uid(),
      quoteNumber,
      title: title.trim() || `Quote for ${customerName}`,
      customerName: customerName.trim() || 'Customer',
      customerPhone: customerPhone.trim() || undefined,
      status: 'draft',
      jobDescription,
      createdAt: now.toISOString(),
      validUntil: validUntil.toISOString(),
      ...generatedData,
    };
    addQuote(quote);
    router.replace(`/quote/${quote.id}`);
  }

  function goBack() {
    const order: Step[] = ['details', 'measurements', 'processing', 'review', 'send'];
    const idx = order.indexOf(step);
    if (idx === 0) { router.back(); return; }
    setStep(order[idx - 1] as Step);
  }

  const totalM2 = measurements.reduce((s, m) => s + m.areaM2, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Brand.navy} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'details' && 'Job Details'}
          {step === 'measurements' && 'Measurements'}
          {step === 'processing' && 'Generating...'}
          {step === 'review' && 'Review Quote'}
          {step === 'send' && 'Save & Send'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Progress bar */}
      {step !== 'processing' && (
        <View style={styles.progressBar}>
          {(['details', 'measurements', 'review', 'send'] as const).map((s, i) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                step === s && styles.progressDotActive,
                (['measurements', 'review', 'send'] as string[]).indexOf(step) > i && styles.progressDotDone,
              ]}
            />
          ))}
        </View>
      )}

      {/* STEP 1: Details */}
      {step === 'details' && (
        <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled">
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>JOB TITLE (OPTIONAL)</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Full repaint — 3-bed semi" placeholderTextColor={Brand.textMuted} />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>CUSTOMER NAME</Text>
            <TextInput style={styles.input} value={customerName} onChangeText={setCustomerName} placeholder="e.g. Sarah Johnson" placeholderTextColor={Brand.textMuted} />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>CUSTOMER PHONE</Text>
            <TextInput style={styles.input} value={customerPhone} onChangeText={setCustomerPhone} placeholder="07700 900 000" placeholderTextColor={Brand.textMuted} keyboardType="phone-pad" />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>DESCRIBE THE JOB</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={jobDescription}
              onChangeText={setJobDescription}
              placeholder="Describe the job in plain English — paint types, number of rooms, any special requirements..."
              placeholderTextColor={Brand.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              if (!customerName.trim()) { Alert.alert('Required', 'Please enter a customer name.'); return; }
              setStep('measurements');
            }}>
            <Text style={styles.primaryBtnText}>Continue →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* STEP 2: Measurements */}
      {step === 'measurements' && (
        <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>Add each room or surface area separately for an accurate quote.</Text>

          {measurements.map((m) => (
            <View key={m.id} style={styles.areaCard}>
              <View style={styles.areaCardLeft}>
                <Text style={styles.areaLabel}>{m.label}</Text>
                <Text style={styles.areaSurface}>{m.surfaceType}</Text>
              </View>
              <View style={styles.areaCardRight}>
                <Text style={styles.areaM2}>{m.areaM2} m²</Text>
                <TouchableOpacity onPress={() => setMeasurements((p) => p.filter((x) => x.id !== m.id))}>
                  <Ionicons name="trash-outline" size={16} color={Brand.red} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addAreaBtn} onPress={() => setShowAddArea(true)}>
            <Ionicons name="add-circle-outline" size={18} color={Brand.orange} />
            <Text style={styles.addAreaText}>Add Area</Text>
          </TouchableOpacity>

          {measurements.length > 0 && (
            <View style={styles.totalBar}>
              <Text style={styles.totalBarLabel}>Total area</Text>
              <Text style={styles.totalBarValue}>{totalM2.toFixed(1)} m²</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, measurements.length === 0 && styles.primaryBtnDisabled]}
            onPress={() => measurements.length > 0 ? setStep('processing') : Alert.alert('Add measurements', 'Add at least one area to continue.')}>
            <Text style={styles.primaryBtnText}>Generate Quote →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* STEP 3: Processing */}
      {step === 'processing' && (
        <View style={styles.processingCenter}>
          <View style={styles.processingIcon}>
            <Text style={{ fontSize: 44 }}>🤖</Text>
          </View>
          <Text style={styles.processingTitle}>Building your quote{dots}</Text>
          <Text style={styles.processingSubtitle}>Usually takes 10–20 seconds</Text>
          <View style={styles.stepsList}>
            {[
              { label: 'Analysing job description', done: true },
              { label: 'Calculating materials', done: true },
              { label: 'Estimating labour hours', done: false },
              { label: 'Applying your rates', done: false },
            ].map((s) => (
              <View key={s.label} style={[styles.stepsItem, !s.done && styles.stepsItemPending]}>
                <View style={[styles.stepsTick, s.done ? styles.stepsTickDone : styles.stepsTickPending]}>
                  {s.done && <Ionicons name="checkmark" size={11} color={Brand.greenText} />}
                </View>
                <Text style={[styles.stepsLabel, !s.done && styles.stepsLabelMuted]}>{s.label}</Text>
              </View>
            ))}
          </View>
          <ActivityIndicator color={Brand.orange} style={{ marginTop: 24 }} />
        </View>
      )}

      {/* STEP 4: Review */}
      {step === 'review' && generatedData && (
        <ScrollView contentContainerStyle={styles.stepContent}>
          <View style={styles.summaryBanner}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>MATERIALS</Text>
              <Text style={styles.summaryItemValue}>£{generatedData.subtotalMaterials}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>LABOUR</Text>
              <Text style={styles.summaryItemValue}>£{generatedData.subtotalLabour}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>VAT</Text>
              <Text style={styles.summaryItemValue}>£{generatedData.vatAmount}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryItemLabel, { color: Brand.orange }]}>TOTAL</Text>
              <Text style={[styles.summaryItemValue, { color: Brand.orange, fontSize: 16 }]}>
                £{generatedData.total.toLocaleString()}
              </Text>
            </View>
          </View>

          {(['material', 'labour'] as const).map((type) => {
            const items = generatedData.lineItems.filter((i) => i.type === type);
            const sectionTotal = items.reduce((s, i) => s + i.totalCost, 0);
            return (
              <View key={type} style={styles.lineSection}>
                <View style={styles.lineSectionHeader}>
                  <Text style={styles.lineSectionTitle}>{type === 'material' ? 'MATERIALS' : 'LABOUR'}</Text>
                  <Text style={styles.lineSectionTotal}>£{sectionTotal}</Text>
                </View>
                {items.map((item) => (
                  <View key={item.id} style={styles.lineItem}>
                    <View style={styles.lineItemLeft}>
                      <Text style={styles.lineItemName}>{item.name}</Text>
                      <Text style={styles.lineItemSub}>{item.quantity} {item.unit} × £{item.unitCost}</Text>
                    </View>
                    <Text style={styles.lineItemTotal}>£{item.totalCost}</Text>
                  </View>
                ))}
              </View>
            );
          })}

          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('send')}>
            <Text style={styles.primaryBtnText}>Continue →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* STEP 5: Send */}
      {step === 'send' && generatedData && (
        <ScrollView contentContainerStyle={styles.stepContent}>
          {/* Mini PDF preview */}
          <View style={styles.pdfPreview}>
            <View style={styles.pdfHeader}>
              <View>
                <Text style={styles.pdfBizName}>{settings.businessName}</Text>
                <Text style={styles.pdfBizContact}>{settings.phone}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.pdfQuoteLabel}>QUOTE</Text>
                <Text style={styles.pdfQuoteNumber}>{nextQuoteNumber()}</Text>
              </View>
            </View>
            <View style={styles.pdfBody}>
              <Text style={styles.pdfCustomer}>{customerName || 'Customer'}</Text>
              <Text style={styles.pdfJobTitle}>{title || `Quote for ${customerName}`}</Text>
              <View style={styles.pdfDivider} />
              {generatedData.lineItems.slice(0, 4).map((item) => (
                <View key={item.id} style={styles.pdfLineItem}>
                  <Text style={styles.pdfLineItemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.pdfLineItemTotal}>£{item.totalCost}</Text>
                </View>
              ))}
              {generatedData.lineItems.length > 4 && (
                <Text style={styles.pdfMore}>+{generatedData.lineItems.length - 4} more items...</Text>
              )}
              <View style={styles.pdfDivider} />
              <View style={styles.pdfTotalRow}>
                <Text style={styles.pdfTotalLabel}>TOTAL</Text>
                <Text style={styles.pdfTotalValue}>£{generatedData.total.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={saveQuote}>
            <Ionicons name="save-outline" size={16} color={Brand.white} />
            <Text style={styles.primaryBtnText}>Save Quote</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={saveQuote}>
            <Ionicons name="mail-outline" size={16} color={Brand.navy} />
            <Text style={styles.secondaryBtnText}>Save & Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={saveQuote}>
            <Ionicons name="share-social-outline" size={16} color={Brand.navy} />
            <Text style={styles.secondaryBtnText}>Save & Share</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Add Area Modal */}
      <Modal visible={showAddArea} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddArea(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Area</Text>
            <TouchableOpacity onPress={addArea}>
              <Text style={[styles.modalCancel, { color: Brand.orange, fontWeight: '600' }]}>Add</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>AREA LABEL</Text>
              <TextInput style={styles.input} value={areaLabel} onChangeText={setAreaLabel} placeholder="e.g. Living Room Walls" placeholderTextColor={Brand.textMuted} />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SURFACE TYPE</Text>
              <View style={styles.surfaceRow}>
                {SURFACE_TYPES.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.surfaceChip, areaSurface === s.value && styles.surfaceChipActive]}
                    onPress={() => setAreaSurface(s.value)}>
                    <Text style={[styles.surfaceChipText, areaSurface === s.value && styles.surfaceChipTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.fieldLabel}>DIMENSIONS (metres)</Text>
            <View style={styles.dimensionRow}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabelSmall}>Width (m)</Text>
                <TextInput style={styles.input} value={areaWidth} onChangeText={setAreaWidth} keyboardType="decimal-pad" placeholder="5.2" placeholderTextColor={Brand.textMuted} />
              </View>
              <Text style={styles.dimensionX}>×</Text>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabelSmall}>Height (m)</Text>
                <TextInput style={styles.input} value={areaHeight} onChangeText={setAreaHeight} keyboardType="decimal-pad" placeholder="2.4" placeholderTextColor={Brand.textMuted} />
              </View>
            </View>

            <Text style={styles.orDivider}>— or enter area directly —</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>TOTAL AREA (m²)</Text>
              <TextInput style={styles.input} value={areaM2Direct} onChangeText={setAreaM2Direct} keyboardType="decimal-pad" placeholder="e.g. 24.5" placeholderTextColor={Brand.textMuted} />
            </View>
          </ScrollView>
        </SafeAreaView>
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: Brand.navy },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
    justifyContent: 'center',
  },
  progressDot: { width: 8, height: 5, borderRadius: 3, backgroundColor: Brand.border },
  progressDotActive: { width: 24, backgroundColor: Brand.orange },
  progressDotDone: { backgroundColor: Brand.green },
  stepContent: { padding: 16, gap: 14, paddingBottom: 40 },
  hint: { fontSize: 12, color: Brand.textMuted, textAlign: 'center', marginBottom: 4 },
  fieldGroup: { gap: 5 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: Brand.textMuted, letterSpacing: 0.5 },
  fieldLabelSmall: { fontSize: 10, color: Brand.textMuted, fontWeight: '600' },
  input: {
    backgroundColor: Brand.white,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 13,
    color: Brand.navy,
  },
  inputMultiline: { minHeight: 100, paddingTop: 11 },
  primaryBtn: {
    backgroundColor: Brand.orange,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: Brand.white, fontSize: 14, fontWeight: '600' },
  secondaryBtn: {
    backgroundColor: Brand.white,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryBtnText: { color: Brand.navy, fontSize: 13, fontWeight: '500' },
  areaCard: {
    backgroundColor: Brand.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  areaCardLeft: {},
  areaLabel: { fontSize: 13, fontWeight: '600', color: Brand.navy },
  areaSurface: { fontSize: 11, color: Brand.textMuted, marginTop: 2, textTransform: 'capitalize' },
  areaCardRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  areaM2: { fontSize: 14, fontWeight: '700', color: Brand.orange },
  addAreaBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Brand.border,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addAreaText: { fontSize: 13, color: Brand.orange, fontWeight: '500' },
  totalBar: {
    backgroundColor: Brand.navy,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalBarLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  totalBarValue: { fontSize: 16, fontWeight: '700', color: Brand.white },
  processingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  processingIcon: {
    width: 84,
    height: 84,
    backgroundColor: Brand.white,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Brand.orangeLight,
  },
  processingTitle: { fontSize: 18, fontWeight: '700', color: Brand.navy },
  processingSubtitle: { fontSize: 13, color: Brand.textMuted, marginBottom: 16 },
  stepsList: {
    width: '100%',
    backgroundColor: Brand.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
  },
  stepsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Brand.borderLight,
  },
  stepsItemPending: { backgroundColor: Brand.bg },
  stepsTick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsTickDone: { backgroundColor: Brand.greenLight },
  stepsTickPending: { borderWidth: 2, borderColor: Brand.border },
  stepsLabel: { fontSize: 13, color: Brand.navy },
  stepsLabelMuted: { color: Brand.textMuted },
  summaryBanner: {
    backgroundColor: Brand.navy,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryItem: { alignItems: 'center' },
  summaryItemLabel: { fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 3 },
  summaryItemValue: { fontSize: 14, fontWeight: '700', color: Brand.white },
  lineSection: {
    backgroundColor: Brand.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
  },
  lineSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: Brand.bg,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  lineSectionTitle: { fontSize: 10, fontWeight: '700', color: Brand.navy, letterSpacing: 0.5 },
  lineSectionTotal: { fontSize: 11, color: Brand.textMuted },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Brand.borderLight,
  },
  lineItemLeft: { flex: 1, marginRight: 8 },
  lineItemName: { fontSize: 12, fontWeight: '500', color: Brand.navy },
  lineItemSub: { fontSize: 10, color: Brand.textMuted, marginTop: 1 },
  lineItemTotal: { fontSize: 13, fontWeight: '600', color: Brand.navy },
  pdfPreview: {
    backgroundColor: Brand.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
    marginBottom: 4,
  },
  pdfHeader: {
    backgroundColor: Brand.navy,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pdfBizName: { fontSize: 14, fontWeight: '700', color: Brand.white },
  pdfBizContact: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  pdfQuoteLabel: { fontSize: 9, color: 'rgba(255,255,255,0.45)' },
  pdfQuoteNumber: { fontSize: 13, fontWeight: '700', color: Brand.orange },
  pdfBody: { padding: 14, gap: 4 },
  pdfCustomer: { fontSize: 13, fontWeight: '600', color: Brand.navy },
  pdfJobTitle: { fontSize: 11, color: Brand.textSecondary, marginBottom: 4 },
  pdfDivider: { height: 1, backgroundColor: Brand.border, marginVertical: 6 },
  pdfLineItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  pdfLineItemName: { fontSize: 11, color: '#374151', flex: 1, marginRight: 8 },
  pdfLineItemTotal: { fontSize: 11, fontWeight: '500', color: Brand.navy },
  pdfMore: { fontSize: 10, color: Brand.textMuted, fontStyle: 'italic' },
  pdfTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Brand.navy,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  pdfTotalLabel: { fontSize: 11, fontWeight: '700', color: Brand.white },
  pdfTotalValue: { fontSize: 16, fontWeight: '800', color: Brand.orange },
  modalContainer: { flex: 1, backgroundColor: Brand.bg },
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
  modalCancel: { fontSize: 14, color: Brand.textSecondary },
  modalBody: { padding: 16, gap: 14 },
  surfaceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  surfaceChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: Brand.white,
  },
  surfaceChipActive: { backgroundColor: Brand.navy, borderColor: Brand.navy },
  surfaceChipText: { fontSize: 12, color: Brand.textSecondary, fontWeight: '500' },
  surfaceChipTextActive: { color: Brand.white, fontWeight: '600' },
  dimensionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  dimensionX: { fontSize: 18, color: Brand.textMuted, paddingBottom: 10 },
  orDivider: {
    textAlign: 'center',
    fontSize: 11,
    color: Brand.textMuted,
    marginVertical: 4,
  },
});
