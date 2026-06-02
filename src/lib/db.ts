import { supabase } from './supabase';
import type { Quote, Customer, UserSettings } from '@/types';

// ── Profile ────────────────────────────────────────────────────────────────

export interface BillingInfo {
  subscriptionTier:    'free' | 'pro' | 'team';
  stripeCustomerId:    string | null;
  quoteCountThisMonth: number;
  quoteMonth:          string;
}

export async function loadProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (!data) return null;
  return {
    settings: {
      businessName:  data.business_name  ?? '',
      ownerName:     data.owner_name     ?? '',
      phone:         data.phone          ?? '',
      email:         data.email          ?? '',
      defaultMarkup: data.default_markup ?? 20,
      vatRate:       data.vat_rate       ?? 20,
      validityDays:  data.validity_days  ?? 30,
      paymentTerms:  data.payment_terms  ?? 'Payment due within 14 days of invoice.',
      employees:     data.employees      ?? [],
    } as UserSettings,
    quoteCounter: (data.quote_counter ?? 41) as number,
    billing: {
      subscriptionTier:    (data.subscription_tier    ?? 'free') as BillingInfo['subscriptionTier'],
      stripeCustomerId:    (data.stripe_customer_id   ?? null),
      quoteCountThisMonth: (data.quote_count_this_month ?? 0) as number,
      quoteMonth:          (data.quote_month          ?? '') as string,
    } as BillingInfo,
  };
}

export async function saveProfile(
  userId: string,
  settings: UserSettings,
  quoteCounter: number,
) {
  await supabase.from('profiles').upsert({
    id:             userId,
    business_name:  settings.businessName,
    owner_name:     settings.ownerName,
    phone:          settings.phone,
    email:          settings.email,
    default_markup: settings.defaultMarkup,
    vat_rate:       settings.vatRate,
    validity_days:  settings.validityDays,
    payment_terms:  settings.paymentTerms,
    employees:      settings.employees,
    quote_counter:  quoteCounter,
  });
}

export async function saveBilling(userId: string, billing: Partial<BillingInfo>) {
  const update: Record<string, unknown> = {};
  if (billing.subscriptionTier    !== undefined) update.subscription_tier      = billing.subscriptionTier;
  if (billing.stripeCustomerId    !== undefined) update.stripe_customer_id     = billing.stripeCustomerId;
  if (billing.quoteCountThisMonth !== undefined) update.quote_count_this_month = billing.quoteCountThisMonth;
  if (billing.quoteMonth          !== undefined) update.quote_month            = billing.quoteMonth;
  if (Object.keys(update).length === 0) return;
  await supabase.from('profiles').update(update).eq('id', userId);
}

// ── Quotes ─────────────────────────────────────────────────────────────────

function dbToQuote(row: Record<string, unknown>): Quote {
  return {
    id:                 row.id as string,
    quoteNumber:        row.quote_number as string,
    title:              (row.title as string)              ?? '',
    customerName:       (row.customer_name as string)      ?? '',
    customerEmail:      (row.customer_email as string)     ?? undefined,
    customerPhone:      (row.customer_phone as string)     ?? undefined,
    customerAddress:    (row.customer_address as string)   ?? undefined,
    status:             (row.status as Quote['status'])    ?? 'draft',
    jobDescription:     (row.job_description as string)    ?? '',
    lineItems:          (row.line_items as Quote['lineItems'])      ?? [],
    measurements:       (row.measurements as Quote['measurements']) ?? [],
    subtotalMaterials:  (row.subtotal_materials as number) ?? 0,
    subtotalLabour:     (row.subtotal_labour as number)    ?? 0,
    markupAmount:       (row.markup_amount as number)      ?? 0,
    markupPercent:      (row.markup_percent as number)     ?? 20,
    subtotal:           (row.subtotal as number)           ?? 0,
    vatAmount:          (row.vat_amount as number)         ?? 0,
    vatRate:            (row.vat_rate as number)           ?? 20,
    total:              (row.total as number)              ?? 0,
    createdAt:          row.created_at as string,
    validUntil:         row.valid_until as string,
    sentAt:             (row.sent_at as string)            ?? undefined,
    acceptedAt:         (row.accepted_at as string)        ?? undefined,
    declinedAt:         (row.declined_at as string)        ?? undefined,
  };
}

function quoteToDb(quote: Quote, userId: string) {
  return {
    id:                 quote.id,
    user_id:            userId,
    quote_number:       quote.quoteNumber,
    title:              quote.title,
    customer_name:      quote.customerName,
    customer_email:     quote.customerEmail    ?? null,
    customer_phone:     quote.customerPhone    ?? null,
    customer_address:   quote.customerAddress  ?? null,
    status:             quote.status,
    job_description:    quote.jobDescription,
    line_items:         quote.lineItems,
    measurements:       quote.measurements,
    subtotal_materials: quote.subtotalMaterials,
    subtotal_labour:    quote.subtotalLabour,
    markup_amount:      quote.markupAmount,
    markup_percent:     quote.markupPercent,
    subtotal:           quote.subtotal,
    vat_amount:         quote.vatAmount,
    vat_rate:           quote.vatRate,
    total:              quote.total,
    valid_until:        quote.validUntil,
    sent_at:            quote.sentAt           ?? null,
    accepted_at:        quote.acceptedAt       ?? null,
    declined_at:        quote.declinedAt       ?? null,
  };
}

export async function loadQuotes(userId: string): Promise<Quote[]> {
  const { data } = await supabase
    .from('quotes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []).map(dbToQuote);
}

export async function upsertQuote(quote: Quote, userId: string) {
  await supabase.from('quotes').upsert(quoteToDb(quote, userId));
}

export async function deleteQuoteFromDb(id: string) {
  await supabase.from('quotes').delete().eq('id', id);
}

// ── Customers ──────────────────────────────────────────────────────────────

function dbToCustomer(row: Record<string, unknown>): Customer {
  return {
    id:          row.id as string,
    name:        row.name as string,
    companyName: (row.company_name as string) ?? undefined,
    email:       (row.email as string)        ?? undefined,
    phone:       (row.phone as string)        ?? undefined,
    address:     (row.address as string)      ?? undefined,
    createdAt:   row.created_at as string,
  };
}

export async function loadCustomers(userId: string): Promise<Customer[]> {
  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []).map(dbToCustomer);
}

export async function upsertCustomer(customer: Customer, userId: string) {
  await supabase.from('customers').upsert({
    id:           customer.id,
    user_id:      userId,
    name:         customer.name,
    company_name: customer.companyName ?? null,
    email:        customer.email       ?? null,
    phone:        customer.phone       ?? null,
    address:      customer.address     ?? null,
  });
}
