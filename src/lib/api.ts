import axios from 'axios';
import type { Quote } from '@/types';

// When running locally: backend on 8000, frontend on 8081
// Change this to your production URL when deployed
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export interface GenerateQuotePayload {
  job_description: string;
  measurements: { label: string; surface_type: string; area_m2: number }[];
  employees: { name: string; role: string; hourly_rate: number }[];
  markup_percent: number;
  vat_rate: number;
}

export interface GenerateQuoteResult {
  line_items: {
    id: string;
    type: 'material' | 'labour';
    name: string;
    quantity: number;
    unit: string;
    unit_cost: number;
    total_cost: number;
  }[];
  subtotal_materials: number;
  subtotal_labour: number;
  markup_amount: number;
  subtotal: number;
  vat_amount: number;
  total: number;
  ai_notes?: string;
}

export async function generateQuoteFromAI(
  payload: GenerateQuotePayload,
): Promise<GenerateQuoteResult> {
  const response = await api.post<GenerateQuoteResult>('/quotes/generate', payload);
  return response.data;
}

export interface GeneratePDFPayload {
  quote: Quote;
  settings: {
    businessName: string;
    ownerName: string;
    phone: string;
    email: string;
    paymentTerms: string;
  };
}

export interface GeneratePDFResult {
  pdf_base64: string;
  filename: string;
}

export async function generateQuotePDF(
  payload: GeneratePDFPayload,
): Promise<GeneratePDFResult> {
  const response = await api.post<GeneratePDFResult>('/quotes/pdf', payload);
  return response.data;
}

export interface DraftEmailPayload {
  quote: Quote;
  settings: {
    businessName: string;
    ownerName: string;
    phone: string;
    email: string;
    paymentTerms: string;
  };
}

export interface DraftEmailResult {
  subject: string;
  body: string;
}

export async function draftQuoteEmail(
  payload: DraftEmailPayload,
): Promise<DraftEmailResult> {
  const response = await api.post<DraftEmailResult>('/quotes/draft-email', payload);
  return response.data;
}

// ── Billing ───────────────────────────────────────────────────────────────

export async function createCheckoutSession(payload: {
  userId: string;
  email: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; customerId: string }> {
  const response = await api.post('/billing/checkout', payload);
  return response.data;
}

export async function createPortalSession(payload: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const response = await api.post('/billing/portal', payload);
  return response.data;
}

export async function getBillingStatus(
  customerId: string,
): Promise<{ tier: 'free' | 'pro' | 'team'; active: boolean }> {
  const response = await api.get(`/billing/status?customerId=${customerId}`);
  return response.data;
}
