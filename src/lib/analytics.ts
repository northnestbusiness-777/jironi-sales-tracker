import { Category, LedgerEntry, PaymentMode, PAYMENT_MODES } from "@/types";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
} from "date-fns";

export const CHART = {
  income: "#0F766E",
  expense: "#C2410C",
  prev: "#CDC9BF",
  grid: "#EDE8DD",
  tick: "#78716C",
};

export const OTA_SHADES = [
  "#0F766E",
  "#15907C",
  "#2BA892",
  "#5CBFA9",
  "#8ED4C2",
  "#BFE7DB",
];

export interface NamedTotal {
  name: string;
  value: number;
  isUncat?: boolean;
  excludeFromRevenue?: boolean;
}

export function catTotals(
  entries: LedgerEntry[],
  cats: Category[],
  side: "credit" | "debit",
): NamedTotal[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.side !== side) continue;
    const c = cats.find((x) => x.id === e.categoryId);
    const label = c ? c.name : "Uncategorized";
    map.set(label, (map.get(label) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([name, value]) => ({
      name,
      value,
      isUncat: !cats.find((x) => x.name === name),
      excludeFromRevenue: !!cats.find(
        (x) => x.name === name && x.excludeFromRevenue,
      ),
    }))
    .sort((a, b) => b.value - a.value);
}

export function modeTotals(entries: LedgerEntry[]) {
  const map = new Map<PaymentMode, number>();
  for (const e of entries) map.set(e.paymentMode, (map.get(e.paymentMode) ?? 0) + e.amount);
  return PAYMENT_MODES.map((mode) => ({ mode, total: map.get(mode) ?? 0 })).filter(
    (r) => r.total > 0,
  );
}

export function otaStats(entries: LedgerEntry[], cats: Category[]) {
  const otaCat = cats.find((c) => /ota/i.test(c.name) && c.side === "income");
  const roomCat = cats.find((c) => /room sale/i.test(c.name) && c.side === "income");
  const otaEntries = otaCat
    ? entries.filter((e) => e.side === "credit" && e.categoryId === otaCat.id)
    : [];
  const platforms = new Map<string, number>();
  for (const e of otaEntries) {
    const k = e.subTag?.trim() || "Unspecified platform";
    platforms.set(k, (platforms.get(k) ?? 0) + e.amount);
  }
  const total = otaEntries.reduce((s, e) => s + e.amount, 0);
  const roomDirect = roomCat
    ? entries
        .filter((e) => e.side === "credit" && e.categoryId === roomCat.id)
        .reduce((s, e) => s + e.amount, 0)
    : 0;
  return {
    total,
    roomDirect,
    pctOfRoom: roomDirect + total > 0 ? (total / (roomDirect + total)) * 100 : 0,
    platforms: [...platforms.entries()]
      .map(([platform, value]) => ({ platform, value }))
      .sort((a, b) => b.value - a.value),
  };
}

export function kpis(entries: LedgerEntry[], cats: Category[]) {
  const credit = entries.filter((e) => e.side === "credit");
  const debit = entries.filter((e) => e.side === "debit");
  const incomeAll = credit.reduce((s, e) => s + e.amount, 0);
  const openingBal = credit
    .filter((e) => {
      const c = cats.find((x) => x.id === e.categoryId);
      return c?.excludeFromRevenue;
    })
    .reduce((s, e) => s + e.amount, 0);
  const ownerCat = cats.find((c) => /owner/i.test(c.name));
  const ownerDraw = debit
    .filter((e) => e.categoryId === ownerCat?.id)
    .reduce((s, e) => s + e.amount, 0);
  const expensesAll = debit.reduce((s, e) => s + e.amount, 0);
  return {
    income: incomeAll - openingBal,
    openingBal,
    expensesAll,
    expensesOp: expensesAll - ownerDraw,
    ownerDraw,
    net: incomeAll - openingBal - expensesAll,
  };
}

export function cashTrend(
  reports: { date: string; cashInHand: number; propertyId: string; status: string }[],
  propertyId: string,
  limit = 14,
) {
  return reports
    .filter((r) => r.propertyId === propertyId && r.status === "saved")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-limit)
    .map((r) => ({
      label: format(parseISO(r.date), "d MMM"),
      cash: r.cashInHand,
    }));
}

/** All dates in the month up to today (or month end if past). */
export function monthDays(ym: string): string[] {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return [];
  const start = new Date(y, m - 1, 1);
  const end = endOfMonth(start);
  const now = new Date();
  const upto = now < end ? now : end;
  if (upto < start) return [];
  return eachDayOfInterval({ start, end: upto }).map((d) => format(d, "yyyy-MM-dd"));
}

export function missingDays(
  reports: { date: string; propertyId: string; status: string }[],
  propertyId: string,
  ym: string,
): string[] {
  const have = new Set(
    reports
      .filter(
        (r) => r.propertyId === propertyId && r.status === "saved" && r.date.startsWith(ym),
      )
      .map((r) => r.date),
  );
  return monthDays(ym).filter((d) => !have.has(d));
}

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
}