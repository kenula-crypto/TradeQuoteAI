import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Quote, Customer, UserSettings, Employee } from '@/types';

const DEFAULT_SETTINGS: UserSettings = {
  businessName: "Mike's Decorating",
  ownerName: 'Mike',
  phone: '07700 900 123',
  email: 'mike@mikesdec.co.uk',
  defaultMarkup: 20,
  vatRate: 20,
  validityDays: 30,
  paymentTerms: 'Payment due within 14 days of invoice.',
  employees: [
    { id: 'e1', name: 'Mike', role: 'Painter', hourlyRate: 18 },
    { id: 'e2', name: 'Jack', role: 'Apprentice', hourlyRate: 12 },
  ],
};

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    phone: '07700 900 001',
    address: '14 Maple Close, Leeds, LS1 1AA',
    createdAt: '2026-05-01T10:00:00Z',
  },
  {
    id: 'c2',
    name: 'R&T Properties',
    companyName: 'R&T Properties Ltd',
    email: 'info@rtproperties.co.uk',
    phone: '0113 200 0001',
    address: '5 Business Park, Leeds, LS2 2BB',
    createdAt: '2026-04-15T10:00:00Z',
  },
  {
    id: 'c3',
    name: 'Dave Clarke',
    email: 'dave.clarke@example.com',
    phone: '07700 900 003',
    address: '8 Oak Avenue, Leeds, LS3 3CC',
    createdAt: '2026-05-10T10:00:00Z',
  },
  {
    id: 'c4',
    name: 'Lisa Patel',
    email: 'lisa.patel@example.com',
    phone: '07700 900 004',
    address: '22 Birch Road, Leeds, LS4 4DD',
    createdAt: '2026-05-20T10:00:00Z',
  },
];

const MOCK_QUOTES: Quote[] = [
  {
    id: 'q1',
    quoteNumber: 'QT-2026-0039',
    title: 'Full interior repaint',
    customerName: 'Sarah Johnson',
    customerEmail: 'sarah.johnson@example.com',
    customerPhone: '07700 900 001',
    customerAddress: '14 Maple Close, Leeds',
    status: 'accepted',
    jobDescription: 'Full repaint of 3-bed semi. All walls and ceilings in Dulux white. Skirting boards and door frames in gloss.',
    lineItems: [
      { id: 'li1', type: 'material', name: 'Dulux Trade Matt 10L × 4', quantity: 4, unit: 'tin', unitCost: 42, totalCost: 168 },
      { id: 'li2', type: 'material', name: 'Ceiling White 10L × 2', quantity: 2, unit: 'tin', unitCost: 34, totalCost: 68 },
      { id: 'li3', type: 'material', name: 'Gloss White 2.5L × 2', quantity: 2, unit: 'tin', unitCost: 28, totalCost: 56 },
      { id: 'li4', type: 'material', name: 'Sandpaper + Masking tape', quantity: 1, unit: 'set', unitCost: 14, totalCost: 14 },
      { id: 'li5', type: 'material', name: 'Sugar Soap & Dust Sheets', quantity: 1, unit: 'set', unitCost: 10, totalCost: 10 },
      { id: 'li6', type: 'labour', name: 'Mike — Painter', quantity: 24, unit: 'hr', unitCost: 18, totalCost: 432 },
      { id: 'li7', type: 'labour', name: 'Jack — Apprentice', quantity: 12, unit: 'hr', unitCost: 12, totalCost: 144 },
    ],
    measurements: [
      { id: 'm1', label: 'Living Room Walls', surfaceType: 'walls', areaM2: 45.8 },
      { id: 'm2', label: 'Living Room Ceiling', surfaceType: 'ceiling', areaM2: 21.3 },
      { id: 'm3', label: 'Master Bedroom Walls', surfaceType: 'walls', areaM2: 36.2 },
    ],
    subtotalMaterials: 316,
    subtotalLabour: 576,
    markupAmount: 32,
    subtotal: 924,
    vatAmount: 185,
    total: 1109,
    markupPercent: 20,
    vatRate: 20,
    createdAt: '2026-05-28T10:00:00Z',
    validUntil: '2026-06-28T10:00:00Z',
    acceptedAt: '2026-05-30T14:00:00Z',
  },
  {
    id: 'q2',
    quoteNumber: 'QT-2026-0040',
    title: '3x rental flats repaint',
    customerName: 'R&T Properties',
    customerEmail: 'info@rtproperties.co.uk',
    customerAddress: '5 Business Park, Leeds',
    status: 'sent',
    jobDescription: 'Full repaint of 3 rental flats. Magnolia throughout. All walls, ceilings and woodwork.',
    lineItems: [
      { id: 'li8', type: 'material', name: 'Dulux Trade Matt 10L × 18', quantity: 18, unit: 'tin', unitCost: 42, totalCost: 756 },
      { id: 'li9', type: 'material', name: 'Ceiling White 10L × 6', quantity: 6, unit: 'tin', unitCost: 34, totalCost: 204 },
      { id: 'li10', type: 'material', name: 'Consumables & Prep', quantity: 1, unit: 'set', unitCost: 80, totalCost: 80 },
      { id: 'li11', type: 'labour', name: 'Mike — Painter', quantity: 72, unit: 'hr', unitCost: 18, totalCost: 1296 },
      { id: 'li12', type: 'labour', name: 'Jack — Apprentice', quantity: 48, unit: 'hr', unitCost: 12, totalCost: 576 },
    ],
    measurements: [],
    subtotalMaterials: 1040,
    subtotalLabour: 1872,
    markupAmount: 0,
    subtotal: 2912,
    vatAmount: 582,
    total: 3494,
    markupPercent: 0,
    vatRate: 20,
    createdAt: '2026-05-30T11:00:00Z',
    validUntil: '2026-06-30T11:00:00Z',
    sentAt: '2026-05-30T12:00:00Z',
  },
  {
    id: 'q3',
    quoteNumber: 'QT-2026-0041',
    title: 'Exterior masonry + trim',
    customerName: 'Dave Clarke',
    customerPhone: '07700 900 003',
    customerAddress: '8 Oak Avenue, Leeds',
    status: 'draft',
    jobDescription: 'Exterior masonry repaint and all woodwork/trim. Weather shield paint required.',
    lineItems: [
      { id: 'li13', type: 'material', name: 'Dulux Weathershield 10L × 3', quantity: 3, unit: 'tin', unitCost: 58, totalCost: 174 },
      { id: 'li14', type: 'material', name: 'Gloss White 2.5L × 3', quantity: 3, unit: 'tin', unitCost: 28, totalCost: 84 },
      { id: 'li15', type: 'labour', name: 'Mike — Painter', quantity: 18, unit: 'hr', unitCost: 18, totalCost: 324 },
      { id: 'li16', type: 'labour', name: 'Jack — Apprentice', quantity: 10, unit: 'hr', unitCost: 12, totalCost: 120 },
    ],
    measurements: [],
    subtotalMaterials: 258,
    subtotalLabour: 444,
    markupAmount: 50,
    subtotal: 752,
    vatAmount: 150,
    total: 902,
    markupPercent: 20,
    vatRate: 20,
    createdAt: '2026-06-01T09:00:00Z',
    validUntil: '2026-07-01T09:00:00Z',
  },
  {
    id: 'q4',
    quoteNumber: 'QT-2026-0038',
    title: 'Kitchen + hallway repaint',
    customerName: 'Lisa Patel',
    customerEmail: 'lisa.patel@example.com',
    status: 'declined',
    jobDescription: 'Kitchen and hallway repaint. Specialist kitchen paint for kitchen, standard emulsion for hallway.',
    lineItems: [
      { id: 'li17', type: 'material', name: 'Dulux Kitchen Matt 2.5L × 2', quantity: 2, unit: 'tin', unitCost: 26, totalCost: 52 },
      { id: 'li18', type: 'material', name: 'Dulux Trade Matt 5L × 1', quantity: 1, unit: 'tin', unitCost: 24, totalCost: 24 },
      { id: 'li19', type: 'labour', name: 'Mike — Painter', quantity: 10, unit: 'hr', unitCost: 18, totalCost: 180 },
    ],
    measurements: [],
    subtotalMaterials: 76,
    subtotalLabour: 180,
    markupAmount: 15,
    subtotal: 271,
    vatAmount: 54,
    total: 325,
    markupPercent: 20,
    vatRate: 20,
    createdAt: '2026-05-20T14:00:00Z',
    validUntil: '2026-06-20T14:00:00Z',
    declinedAt: '2026-05-25T09:00:00Z',
  },
];

interface AppState {
  quotes: Quote[];
  customers: Customer[];
  settings: UserSettings;
  quoteCounter: number;

  addQuote: (quote: Quote) => void;
  updateQuote: (id: string, updates: Partial<Quote>) => void;
  deleteQuote: (id: string) => void;

  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;

  updateSettings: (updates: Partial<UserSettings>) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  removeEmployee: (id: string) => void;

  nextQuoteNumber: () => string;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      quotes: MOCK_QUOTES,
      customers: MOCK_CUSTOMERS,
      settings: DEFAULT_SETTINGS,
      quoteCounter: 42,

      addQuote: (quote) =>
        set((state) => ({
          quotes: [quote, ...state.quotes],
          quoteCounter: state.quoteCounter + 1,
        })),

      updateQuote: (id, updates) =>
        set((state) => ({
          quotes: state.quotes.map((q) => (q.id === id ? { ...q, ...updates } : q)),
        })),

      deleteQuote: (id) =>
        set((state) => ({ quotes: state.quotes.filter((q) => q.id !== id) })),

      addCustomer: (customer) =>
        set((state) => ({ customers: [customer, ...state.customers] })),

      updateCustomer: (id, updates) =>
        set((state) => ({
          customers: state.customers.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),

      updateSettings: (updates) =>
        set((state) => ({ settings: { ...state.settings, ...updates } })),

      addEmployee: (employee) =>
        set((state) => ({
          settings: {
            ...state.settings,
            employees: [...state.settings.employees, employee],
          },
        })),

      updateEmployee: (id, updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            employees: state.settings.employees.map((e) =>
              e.id === id ? { ...e, ...updates } : e,
            ),
          },
        })),

      removeEmployee: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            employees: state.settings.employees.filter((e) => e.id !== id),
          },
        })),

      nextQuoteNumber: () => {
        const counter = get().quoteCounter + 1;
        return `QT-2026-${String(counter).padStart(4, '0')}`;
      },
    }),
    {
      name: 'tradequoteai-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
