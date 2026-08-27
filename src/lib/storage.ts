import {
  AppState,
  BackupData,
  Category,
  DailyReport,
  LedgerEntry,
  Property,
} from "@/types";

const KEY = "ledger-dsr-v1";
const SESSION_KEY = "ledger-dsr-apikey-session";

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState & { apiKey?: string };
    // Older versions stored the Gemini API key inside the app state — drop it.
    // The key now lives in sessionStorage only and is never exported.
    delete parsed.apiKey;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(s: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full/unavailable — app still works in-memory */
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * The API key is deliberately kept in sessionStorage: it disappears when the
 * tab closes and is never written into the persistent app-state backup.
 */
export function loadSessionKey(): string {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveSessionKey(key: string): void {
  try {
    if (key) sessionStorage.setItem(SESSION_KEY, key);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

const isObj = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);

const isProp = (p: unknown): p is Property =>
  isObj(p) && typeof p.id === "string" && typeof p.name === "string";

const isCat = (c: unknown): c is Category =>
  isObj(c) &&
  typeof c.id === "string" &&
  typeof c.propertyId === "string" &&
  typeof c.name === "string" &&
  (c.side === "income" || c.side === "expense") &&
  Array.isArray(c.keywords);

const isReport = (r: unknown): r is DailyReport =>
  isObj(r) &&
  typeof r.id === "string" &&
  typeof r.propertyId === "string" &&
  typeof r.date === "string" &&
  typeof r.cashInHand === "number" &&
  (r.status === "draft" || r.status === "saved");

const isEntry = (e: unknown): e is LedgerEntry =>
  isObj(e) &&
  typeof e.id === "string" &&
  typeof e.reportId === "string" &&
  (e.side === "credit" || e.side === "debit") &&
  typeof e.description === "string" &&
  typeof e.amount === "number" &&
  typeof e.paymentMode === "string";

/** Strict shape check so a tampered or mistaken file can't wipe real records. */
export function isValidBackup(v: unknown): v is BackupData {
  if (!isObj(v)) return false;
  const { properties, categories, reports, entries, corrections } = v;
  if (
    !Array.isArray(properties) ||
    !Array.isArray(categories) ||
    !Array.isArray(reports) ||
    !Array.isArray(entries) ||
    !isObj(corrections)
  )
    return false;
  return (
    properties.every(isProp) &&
    categories.every(isCat) &&
    reports.every(isReport) &&
    entries.every(isEntry) &&
    Object.values(corrections).every(
      (m) => isObj(m) && Object.values(m).every((x) => typeof x === "string"),
    )
  );
}

export function download(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}