export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
export type SurfaceType = 'walls' | 'ceiling' | 'woodwork' | 'exterior';
export type LineItemType = 'material' | 'labour';

export interface QuoteLineItem {
  id: string;
  type: LineItemType;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

export interface Measurement {
  id: string;
  label: string;
  surfaceType: SurfaceType;
  areaM2: number;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  title: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  status: QuoteStatus;
  jobDescription: string;
  lineItems: QuoteLineItem[];
  measurements: Measurement[];
  subtotalMaterials: number;
  subtotalLabour: number;
  markupAmount: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  markupPercent: number;
  vatRate: number;
  createdAt: string;
  validUntil: string;
  notes?: string;
  aiNotes?: string;
  sentAt?: string;
  acceptedAt?: string;
  declinedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  hourlyRate: number;
}

export interface UserSettings {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  defaultMarkup: number;
  vatRate: number;
  validityDays: number;
  paymentTerms: string;
  employees: Employee[];
}
