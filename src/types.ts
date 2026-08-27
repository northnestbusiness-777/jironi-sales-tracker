export type Side = "credit" | "debit";
export type CategorySide = "income" | "expense";

export const PAYMENT_MODES = [
  "Cash",
  "HDFC UPI",
  "HDFC Card",
  "HDFC A/C",
  "SBI UPI",
  "SBI Card",
  "PNB UPI",
  "PNB Card",
  "BTC",
  "Room Posting",
  "Credit Purchase",
  "MD Sir A/C",
] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number];

export interface Property {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  propertyId: string;
  name: string;
  side: CategorySide;
  keywords: string[];
  /** e.g. Opening Balance — tracked for reconciliation but excluded from revenue KPIs */
  excludeFromRevenue?: boolean;
}

export interface LedgerEntry {
  id: string;
  reportId: string;
  side: Side;
  description: string;
  /** null = Uncategorized (needs review) */
  categoryId: string | null;
  /** OTA platform, staff department, "MD Sir" flag, etc. */
  subTag?: string;
  amount: number;
  paymentMode: PaymentMode;
  /** 0–1 */
  confidence: number;
  flagged: boolean;
}

export interface DailyReport {
  id: string;
  propertyId: string;
  /** YYYY-MM-DD */
  date: string;
  cashInHand: number;
  status: "draft" | "saved";
  /** The sheet's own printed grand totals, used for the reconciliation cross-check */
  printedCreditTotal?: number;
  printedDebitTotal?: number;
}

export interface AppState {
  properties: Property[];
  categories: Category[];
  reports: DailyReport[];
  entries: LedgerEntry[];
  /** propertyId -> normalized description -> categoryId (remembered corrections) */
  corrections: Record<string, Record<string, string>>;
}

/**
 * Shape of an exported/imported backup file. Deliberately excludes the API
 * key: credentials never travel inside backup files in either direction.
 */
export type BackupData = Omit<AppState, "apiKey">;