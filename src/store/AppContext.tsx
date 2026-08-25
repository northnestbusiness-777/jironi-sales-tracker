import React, { createContext, useContext, useEffect, useState } from "react";
import {
  AppState,
  BackupData,
  Category,
  DailyReport,
  LedgerEntry,
  Property,
} from "@/types";
import {
  clearState,
  loadSessionKey,
  loadState,
  saveSessionKey,
  saveState,
} from "@/lib/storage";
import { seedCategories, seedState } from "@/lib/seed";
import { normDesc } from "@/lib/categorize";
import { uid } from "@/lib/utils";

export interface EntryDraft extends Omit<LedgerEntry, "reportId"> {}

interface ReportArgs {
  propertyId: string;
  date: string;
  cashInHand: number;
  printedCreditTotal?: number;
  printedDebitTotal?: number;
  entries: EntryDraft[];
}

interface AppCtx {
  state: AppState;
  /** Session-only Gemini API key — never persisted to localStorage or backups. */
  apiKey: string;
  setApiKey: (k: string) => void;
  addProperty: (name: string) => void;
  renameProperty: (id: string, name: string) => void;
  addCategory: (c: Omit<Category, "id">) => void;
  updateCategory: (c: Category) => void;
  /** returns false if the category is referenced by saved entries */
  deleteCategory: (id: string) => boolean;
  createDraft: (args: ReportArgs) => string;
  saveReport: (args: ReportArgs & { reportId: string }) => void;
  deleteReport: (id: string) => void;
  learnCorrection: (propertyId: string, desc: string, categoryId: string) => void;
  resetAll: () => void;
  importState: (s: BackupData) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState() ?? seedState());
  const [apiKey, setApiKeyState] = useState<string>(() => loadSessionKey());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const value: AppCtx = {
    state,
    apiKey,

    setApiKey: (k) => {
      const trimmed = k.trim();
      saveSessionKey(trimmed);
      setApiKeyState(trimmed);
    },

    addProperty: (name) =>
      setState((p) => {
        const prop: Property = { id: uid("prop"), name: name.trim() };
        return {
          ...p,
          properties: [...p.properties, prop],
          categories: [...p.categories, ...seedCategories(prop)],
        };
      }),

    renameProperty: (id, name) =>
      setState((p) => ({
        ...p,
        properties: p.properties.map((x) =>
          x.id === id ? { ...x, name: name.trim() || x.name } : x,
        ),
      })),

    addCategory: (c) =>
      setState((p) => ({
        ...p,
        categories: [...p.categories, { ...c, id: uid("cat") }],
      })),

    updateCategory: (c) =>
      setState((p) => ({
        ...p,
        categories: p.categories.map((x) => (x.id === c.id ? c : x)),
      })),

    deleteCategory: (id) => {
      const inUse = state.entries.some((e) => e.categoryId === id);
      if (inUse) return false;
      setState((p) => ({ ...p, categories: p.categories.filter((c) => c.id !== id) }));
      return true;
    },

    createDraft: (args) => {
      const id = uid("rep");
      setState((p) => {
        // Replace any other report (draft or saved) for the same property+date
        const reports = p.reports.filter(
          (r) => !(r.propertyId === args.propertyId && r.date === args.date && r.id !== id),
        );
        const report: DailyReport = {
          id,
          propertyId: args.propertyId,
          date: args.date,
          cashInHand: args.cashInHand,
          status: "draft",
          printedCreditTotal: args.printedCreditTotal,
          printedDebitTotal: args.printedDebitTotal,
        };
        const keptIds = new Set(reports.map((r) => r.id));
        return {
          ...p,
          reports: [...reports, report],
          entries: [
            ...p.entries.filter((e) => keptIds.has(e.reportId)),
            ...args.entries.map((e) => ({ ...e, reportId: id })),
          ],
        };
      });
      return id;
    },

    saveReport: ({ reportId, ...args }) =>
      setState((p) => {
        const reports = p.reports.filter(
          (r) =>
            !(r.propertyId === args.propertyId && r.date === args.date && r.id !== reportId),
        );
        const report: DailyReport = {
          id: reportId,
          propertyId: args.propertyId,
          date: args.date,
          cashInHand: args.cashInHand,
          status: "saved",
          printedCreditTotal: args.printedCreditTotal,
          printedDebitTotal: args.printedDebitTotal,
        };
        const exists = reports.some((r) => r.id === reportId);
        const nextReports = exists
          ? reports.map((r) => (r.id === reportId ? report : r))
          : [...reports, report];
        return {
          ...p,
          reports: nextReports,
          entries: [
            ...p.entries.filter((e) => e.reportId !== reportId),
            ...args.entries.map((e) => ({ ...e, reportId })),
          ],
        };
      }),

    deleteReport: (id) =>
      setState((p) => ({
        ...p,
        reports: p.reports.filter((r) => r.id !== id),
        entries: p.entries.filter((e) => e.reportId !== id),
      })),

    learnCorrection: (propertyId, desc, categoryId) => {
      const key = normDesc(desc);
      if (!key || !categoryId) return;
      setState((p) => ({
        ...p,
        corrections: {
          ...p.corrections,
          [propertyId]: { ...(p.corrections[propertyId] ?? {}), [key]: categoryId },
        },
      }));
    },

    resetAll: () => {
      clearState();
      setState(seedState());
    },

    // Backups are validated upstream and carry no credentials, so importing
    // can never swap in an attacker-chosen API key.
    importState: (s) => setState(() => ({ ...s })),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}