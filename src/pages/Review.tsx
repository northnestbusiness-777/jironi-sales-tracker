import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useApp } from "@/store/AppContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_MODES, Side } from "@/types";
import { inr, uid } from "@/lib/utils";
import { showError, showSuccess } from "@/utils/toast";
import { cn } from "@/lib/utils";

type Row = Omit<import("@/types").LedgerEntry, "reportId"> & {
  origCatId: string | null;
};

const SIDE_META: Record<
  Side,
  { title: string; dot: string; income: boolean }
> = {
  credit: { title: "Money In (Credit)", dot: "bg-teal-600", income: true },
  debit: { title: "Money Out (Debit)", dot: "bg-orange-700", income: false },
};

export default function Review() {
  const { reportId } = useParams();
  const nav = useNavigate();
  const { state, saveReport, deleteReport, learnCorrection } = useApp();
  const report = state.reports.find((r) => r.id === reportId);

  const [rows, setRows] = useState<Row[]>([]);
  const [cash, setCash] = useState("0");
  const [pCredit, setPCredit] = useState("");
  const [pDebit, setPDebit] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!report) return;
    setRows(
      state.entries
        .filter((e) => e.reportId === report.id)
        .map((e) => ({ ...e, origCatId: e.categoryId })),
    );
    setCash(String(report.cashInHand ?? 0));
    setPCredit(report.printedCreditTotal ? String(report.printedCreditTotal) : "");
    setPDebit(report.printedDebitTotal ? String(report.printedDebitTotal) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  if (!report) {
    return (
      <Card className="mx-auto max-w-md rounded-2xl">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-display text-lg font-semibold">Report not found</p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/">
              <ArrowLeft size={14} /> Back to dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const property = state.properties.find((p) => p.id === report.propertyId);
  const cats = state.categories.filter((c) => c.propertyId === report.propertyId);

  const patch = (id: string, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remove = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));
  const addRow = (side: Side) =>
    setRows((rs) => [
      ...rs,
      {
        id: uid("ent"),
        side,
        description: "",
        categoryId: null,
        amount: 0,
        paymentMode: "Cash",
        confidence: 0,
        flagged: true,
        origCatId: null,
      },
    ]);

  const forSide = (side: Side) =>
    rows
      .filter((r) => r.side === side)
      .slice()
      .sort((a, b) => Number(b.flagged) - Number(a.flagged));

  const sum = (side: Side) =>
    rows.filter((r) => r.side === side).reduce((s, r) => s + (r.amount || 0), 0);

  const flaggedCount = rows.filter((r) => r.flagged).length;

  const onSave = () => {
    if (!rows.length) {
      showError("Add at least one line item before saving.");
      return;
    }
    // Remember corrections so the same description auto-tags next time
    for (const r of rows) {
      const d = r.description.trim();
      if (!d) continue;
      if (r.origCatId !== r.categoryId && r.categoryId) {
        learnCorrection(report.propertyId, d, r.categoryId);
      }
    }
    saveReport({
      reportId: report.id,
      propertyId: report.propertyId,
      date: report.date,
      cashInHand: Number(cash) || 0,
      printedCreditTotal: pCredit === "" ? undefined : Number(pCredit),
      printedDebitTotal: pDebit === "" ? undefined : Number(pDebit),
      entries: rows.map(({ origCatId: _o, ...e }) => e),
    });
    showSuccess("Daily report saved.");
    nav(`/?property=${report.propertyId}&date=${report.date}`);
  };

  const Section = ({ side }: { side: Side }) => {
    const list = forSide(side);
    const meta = SIDE_META[side];
    const options = cats.filter((c) =>
      meta.income ? c.side === "income" : c.side === "expense",
    );
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <span className={cn("size-2.5 rounded-full", meta.dot)} />
            {meta.title}
            <span className="text-sm font-normal text-muted-foreground">
              ({list.length})
            </span>
          </CardTitle>
          <span className="tabular text-sm font-semibold">{inr(sum(side))}</span>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Desktop header */}
          <div className="hidden gap-2 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_180px_150px_110px_32px]">
            <span>Description</span>
            <span>Category</span>
            <span>Settled via</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          {list.map((r) => (
            <div
              key={r.id}
              className={cn(
                "grid grid-cols-2 items-center gap-2 rounded-xl border p-2 md:grid-cols-[minmax(0,1fr)_180px_150px_110px_32px]",
                r.flagged
                  ? "border-amber-300 bg-amber-50/70"
                  : "border-transparent bg-secondary/30",
              )}
            >
              <div className="col-span-2 md:col-span-1">
                <Input
                  value={r.description}
                  onChange={(e) => patch(r.id, { description: e.target.value })}
                  placeholder="Line item description…"
                  className="h-8 border-none bg-transparent text-sm shadow-none focus-visible:ring-1"
                />
                {r.flagged && (
                  <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                    Needs attention
                  </span>
                )}
              </div>
              <select
                value={r.categoryId ?? ""}
                onChange={(e) => patch(r.id, { categoryId: e.target.value || null })}
                className="h-8 w-full rounded-md border border-input bg-card px-2 text-xs"
              >
                <option value="">Uncategorized</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={r.paymentMode}
                onChange={(e) =>
                  patch(r.id, { paymentMode: e.target.value as Row["paymentMode"] })
                }
                className="h-8 w-full rounded-md border border-input bg-card px-2 text-xs"
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={r.amount}
                onChange={(e) =>
                  patch(r.id, { amount: e.target.value === "" ? 0 : Number(e.target.value) })
                }
                className="tabular h-8 border-none bg-transparent text-right text-sm shadow-none focus-visible:ring-1"
              />
              <button
                onClick={() => remove(r.id)}
                className="justify-self-end text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Delete row"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl text-primary hover:bg-teal-50 hover:text-primary"
            onClick={() => addRow(side)}
          >
            <Plus size={14} /> Add line item
          </Button>
        </CardContent>
      </Card>
    );
  };

  const reconBadge = (printedStr: string, computed: number) => {
    if (printedStr === "") return <span className="text-xs italic text-muted-foreground">not provided</span>;
    const printed = Number(printedStr);
    const diff = printed - computed;
    return Math.abs(diff) <= 1 ? (
      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
        Matches
      </Badge>
    ) : (
      <Badge className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-50">
        Off by {inr(Math.abs(diff))}
      </Badge>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="rounded-xl">
          <Link to="/"><ArrowLeft size={18} /></Link>
        </Button>
        <div>
          <h1 className="font-display text-xl font-semibold">
            {property?.name} · {format(parseISO(report.date), "EEEE, d MMM yyyy")}
          </h1>
          <p className="text-xs text-muted-foreground">
            Confirm every line before saving — corrections are remembered for next time.
          </p>
        </div>
        <Badge
          className={cn(
            "ml-auto rounded-full",
            report.status === "saved"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-900",
          )}
        >
          {report.status === "saved" ? "Saved" : "Draft"}
        </Badge>
      </div>

      {flaggedCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-medium">{flaggedCount} line item{flaggedCount > 1 ? "s" : ""}</span>{" "}
          need attention — low confidence, unrecognized, or possibly bundled (two
          categories in one line). They're sorted to the top of each section.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section side="credit" />
        <Section side="debit" />
      </div>

      {/* Closing + reconciliation */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">
            Closing position & reconciliation
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cash in hand (closing)
            </label>
            <Input
              type="number"
              inputMode="decimal"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              className="tabular rounded-xl"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sheet's printed credit total
            </label>
            <Input
              type="number"
              inputMode="decimal"
              value={pCredit}
              onChange={(e) => setPCredit(e.target.value)}
              placeholder="Optional"
              className="tabular rounded-xl"
            />
            <div className="mt-1.5">{reconBadge(pCredit, sum("credit"))}</div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sheet's printed debit total
            </label>
            <Input
              type="number"
              inputMode="decimal"
              value={pDebit}
              onChange={(e) => setPDebit(e.target.value)}
              placeholder="Optional"
              className="tabular rounded-xl"
            />
            <div className="mt-1.5">{reconBadge(pDebit, sum("debit"))}</div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <Button
          variant="ghost"
          className="rounded-xl text-destructive hover:bg-red-50 hover:text-destructive"
          onClick={() => {
            if (confirmDel) {
              deleteReport(report.id);
              showSuccess("Report deleted.");
              nav("/");
            } else {
              setConfirmDel(true);
              setTimeout(() => setConfirmDel(false), 3000);
            }
          }}
        >
          <Trash2 size={14} /> {confirmDel ? "Tap again to confirm delete" : "Delete report"}
        </Button>
        <Button size="lg" className="rounded-xl px-8" onClick={onSave}>
          Save report
        </Button>
      </div>
    </div>
  );
}