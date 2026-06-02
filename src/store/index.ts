import { create } from 'zustand';
import type { Quote, Customer, UserSettings, Employee } from '@/types';
import {
  loadProfile, saveProfile,
  loadQuotes, upsertQuote, deleteQuoteFromDb,
  loadCustomers, upsertCustomer,
} from '@/lib/db';

const DEFAULT_SETTINGS: UserSettings = {
  businessName:  "My Business",
  ownerName:     '',
  phone:         '',
  email:         '',
  defaultMarkup: 20,
  vatRate:       20,
  validityDays:  30,
  paymentTerms:  'Payment due within 14 days of invoice.',
  employees:     [],
};

interface AppState {
  userId:       string | null;
  quotes:       Quote[];
  customers:    Customer[];
  settings:     UserSettings;
  quoteCounter: number;
  dataLoaded:   boolean;

  // Bootstrap
  loadUserData: (userId: string) => Promise<void>;
  clearData:    () => void;

  // Quotes
  addQuote:    (quote: Quote) => void;
  updateQuote: (id: string, updates: Partial<Quote>) => void;
  deleteQuote: (id: string) => void;

  // Customers
  addCustomer:    (customer: Customer) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;

  // Settings
  updateSettings:  (updates: Partial<UserSettings>) => void;
  addEmployee:     (employee: Employee) => void;
  updateEmployee:  (id: string, updates: Partial<Employee>) => void;
  removeEmployee:  (id: string) => void;

  nextQuoteNumber: () => string;
}

export const useStore = create<AppState>()((set, get) => ({
  userId:       null,
  quotes:       [],
  customers:    [],
  settings:     DEFAULT_SETTINGS,
  quoteCounter: 41,
  dataLoaded:   false,

  // ── Bootstrap ────────────────────────────────────────────────
  loadUserData: async (userId) => {
    set({ userId, dataLoaded: false });
    const [profile, quotes, customers] = await Promise.all([
      loadProfile(userId),
      loadQuotes(userId),
      loadCustomers(userId),
    ]);
    set({
      quotes,
      customers,
      settings:     profile?.settings     ?? DEFAULT_SETTINGS,
      quoteCounter: profile?.quoteCounter ?? 41,
      dataLoaded:   true,
    });
  },

  clearData: () =>
    set({
      userId:       null,
      quotes:       [],
      customers:    [],
      settings:     DEFAULT_SETTINGS,
      quoteCounter: 41,
      dataLoaded:   false,
    }),

  // ── Quotes ───────────────────────────────────────────────────
  addQuote: (quote) => {
    const newCounter = get().quoteCounter + 1;
    set((s) => ({ quotes: [quote, ...s.quotes], quoteCounter: newCounter }));
    const userId = get().userId;
    if (userId) {
      upsertQuote(quote, userId).catch(console.error);
      saveProfile(userId, get().settings, newCounter).catch(console.error);
    }
  },

  updateQuote: (id, updates) => {
    set((s) => ({
      quotes: s.quotes.map((q) => (q.id === id ? { ...q, ...updates } : q)),
    }));
    const userId = get().userId;
    if (userId) {
      const quote = get().quotes.find((q) => q.id === id);
      if (quote) upsertQuote(quote, userId).catch(console.error);
    }
  },

  deleteQuote: (id) => {
    set((s) => ({ quotes: s.quotes.filter((q) => q.id !== id) }));
    deleteQuoteFromDb(id).catch(console.error);
  },

  // ── Customers ────────────────────────────────────────────────
  addCustomer: (customer) => {
    set((s) => ({ customers: [customer, ...s.customers] }));
    const userId = get().userId;
    if (userId) upsertCustomer(customer, userId).catch(console.error);
  },

  updateCustomer: (id, updates) => {
    set((s) => ({
      customers: s.customers.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
    const userId = get().userId;
    if (userId) {
      const customer = get().customers.find((c) => c.id === id);
      if (customer) upsertCustomer(customer, userId).catch(console.error);
    }
  },

  // ── Settings ─────────────────────────────────────────────────
  updateSettings: (updates) => {
    set((s) => ({ settings: { ...s.settings, ...updates } }));
    const userId = get().userId;
    if (userId) saveProfile(userId, get().settings, get().quoteCounter).catch(console.error);
  },

  addEmployee: (employee) => {
    set((s) => ({
      settings: { ...s.settings, employees: [...s.settings.employees, employee] },
    }));
    const userId = get().userId;
    if (userId) saveProfile(userId, get().settings, get().quoteCounter).catch(console.error);
  },

  updateEmployee: (id, updates) => {
    set((s) => ({
      settings: {
        ...s.settings,
        employees: s.settings.employees.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      },
    }));
    const userId = get().userId;
    if (userId) saveProfile(userId, get().settings, get().quoteCounter).catch(console.error);
  },

  removeEmployee: (id) => {
    set((s) => ({
      settings: {
        ...s.settings,
        employees: s.settings.employees.filter((e) => e.id !== id),
      },
    }));
    const userId = get().userId;
    if (userId) saveProfile(userId, get().settings, get().quoteCounter).catch(console.error);
  },

  nextQuoteNumber: () => {
    const counter = get().quoteCounter + 1;
    const year = new Date().getFullYear();
    return `QT-${year}-${String(counter).padStart(4, '0')}`;
  },
}));
