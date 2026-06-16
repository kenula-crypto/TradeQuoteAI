import { create } from 'zustand';
import type { Quote, Customer, UserSettings, Employee } from '@/types';
import {
  loadProfile, saveProfile, saveBilling,
  loadQuotes, upsertQuote, deleteQuoteFromDb,
  loadCustomers, upsertCustomer, deleteCustomerFromDb,
  type BillingInfo,
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

  // Billing
  subscriptionTier:    BillingInfo['subscriptionTier'];
  stripeCustomerId:    string | null;
  quoteCountThisMonth: number;
  quoteMonth:          string;

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
  removeCustomer: (id: string) => void;

  // Settings
  updateSettings:  (updates: Partial<UserSettings>) => void;
  addEmployee:     (employee: Employee) => void;
  updateEmployee:  (id: string, updates: Partial<Employee>) => void;
  removeEmployee:  (id: string) => void;

  // Billing
  updateBilling: (info: Partial<BillingInfo>) => void;
  incrementQuoteCount: () => void;

  nextQuoteNumber: () => string;
}

export const useStore = create<AppState>()((set, get) => ({
  userId:       null,
  quotes:       [],
  customers:    [],
  settings:     DEFAULT_SETTINGS,
  quoteCounter: 41,
  dataLoaded:   false,

  subscriptionTier:    'free',
  stripeCustomerId:    null,
  quoteCountThisMonth: 0,
  quoteMonth:          '',

  // ── Bootstrap ────────────────────────────────────────────────
  loadUserData: async (userId) => {
    set({ userId, dataLoaded: false });
    const [profile, rawQuotes, customers] = await Promise.all([
      loadProfile(userId),
      loadQuotes(userId),
      loadCustomers(userId),
    ]);

    // Auto-expire quotes whose validity period has passed
    const now = new Date().toISOString();
    const quotes = rawQuotes.map((q) => {
      if ((q.status === 'draft' || q.status === 'sent') && q.validUntil < now) {
        return { ...q, status: 'expired' as const };
      }
      return q;
    });
    const expired = quotes.filter((q, i) => q.status === 'expired' && rawQuotes[i].status !== 'expired');
    expired.forEach((q) => upsertQuote(q, userId).catch(console.error));

    set({
      quotes,
      customers,
      settings:            profile?.settings            ?? DEFAULT_SETTINGS,
      quoteCounter:        profile?.quoteCounter        ?? 41,
      subscriptionTier:    profile?.billing.subscriptionTier    ?? 'free',
      stripeCustomerId:    profile?.billing.stripeCustomerId    ?? null,
      quoteCountThisMonth: profile?.billing.quoteCountThisMonth ?? 0,
      quoteMonth:          profile?.billing.quoteMonth          ?? '',
      dataLoaded:   true,
    });
  },

  clearData: () =>
    set({
      userId:              null,
      quotes:              [],
      customers:           [],
      settings:            DEFAULT_SETTINGS,
      quoteCounter:        41,
      dataLoaded:          false,
      subscriptionTier:    'free',
      stripeCustomerId:    null,
      quoteCountThisMonth: 0,
      quoteMonth:          '',
    }),

  // ── Billing ──────────────────────────────────────────────────
  updateBilling: (info) => {
    set((s) => ({
      subscriptionTier:    info.subscriptionTier    ?? s.subscriptionTier,
      stripeCustomerId:    info.stripeCustomerId    ?? s.stripeCustomerId,
      quoteCountThisMonth: info.quoteCountThisMonth ?? s.quoteCountThisMonth,
      quoteMonth:          info.quoteMonth          ?? s.quoteMonth,
    }));
    const userId = get().userId;
    if (userId) saveBilling(userId, info).catch(console.error);
  },

  incrementQuoteCount: () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { quoteMonth, quoteCountThisMonth, userId } = get();
    const newCount = quoteMonth === currentMonth ? quoteCountThisMonth + 1 : 1;
    set({ quoteCountThisMonth: newCount, quoteMonth: currentMonth });
    if (userId) {
      saveBilling(userId, { quoteCountThisMonth: newCount, quoteMonth: currentMonth })
        .catch(console.error);
    }
  },

  // ── Quotes ───────────────────────────────────────────────────
  addQuote: (quote) => {
    const newCounter = get().quoteCounter + 1;
    set((s) => ({ quotes: [quote, ...s.quotes], quoteCounter: newCounter }));
    get().incrementQuoteCount();
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

  removeCustomer: (id) => {
    set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }));
    deleteCustomerFromDb(id).catch(console.error);
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
