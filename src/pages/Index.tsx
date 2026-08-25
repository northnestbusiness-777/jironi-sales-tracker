import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { addDays, format, parseISO } from "date-fns";
import {
  ArrowLeftRight,
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Pencil,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useApp } from "@/store/AppContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryBars, CashTrendLine } from "@/components/charts";
import {
  catTotals,
  cashTrend,
  CHART,
  kpis,
  missingDays,
  modeTotals,
  OTA_SHADES,
  otaStats,
} from "@/lib/analytics";
import { inr, todayISO, uid } from "@/lib/utils";
import { showSuccess } from "@/utils/toast";
import { cn } from "@/lib/utils";

function Kpi({
  label,
  value,
  icon: Icon,
  tint,
  note,
}: {
  label: string;
  value: string;
  icon: typeof Banknote;
  tint: string;
  note?: string;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="tabular mt-1 truncate text-xl font-semibold sm:text-2xl">{value}</p>
          {note && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
        </div>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", tint)}>
          <Icon size={17} />
        </span>
      </CardContent>
    </Card>
  );
}

function ModeTable({
  title,
  dotClass,
  rows,
  printed,
  computed,
}: {
  title: string;
  dotClass: string;
  rows: { mode: string; total: number }[];
  printed?: number;
  computed: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={cn("size-2 rounded-full", dotClass)} />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      {rows.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">No entries.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.mode} className="border-b border-border/60 last:border-0">
                <td className="py-1.5 pr-2 text-muted-foreground">{r.mode}</td>
                <td className="tabular py-1.5 text-right font-medium">{inr(r.total)}</td>
              </tr>
            ))}
            <tr>
              <td className="pt-2 pr-2 font-medium">Computed total</td>
              <td className="tabular pt-2 text-right font-semibold">{inr(computed)}</td>
            </tr>
          </tbody>
        </table>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">vs sheet's printed total</span>
        {!printed ? (
          <span className="italic text-muted-foreground">not provided</span>
        ) : Math.abs(printed - computed) <= 1 ? (
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
            Matches
          </Badge>
        ) : (
          <Badge className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-50">
            Off by {inr(Math.abs(printed - computed))}
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function Index() {
  const { state, createDraft } = useApp();
  const [search] = useSearchParams();
  const [pid, setPid] = useState(
    () => search.get("property") ?? state.properties[0]?.id ?? "",
  );
  const [date, setDate] = useState(() => search.get("date") ?? todayISO());

  const property =
    state.properties.find((p) => p.id === pid) ?? state.properties[0];
  const propertyId = property?.id ?? "";
  const cats = state.categories.filter((c) => c.propertyId === propertyId);
  const report = state.reports.find(
    (r) => r.propertyId === propertyId && r.date === date,
  );
  const entries = useMemo(
    () => (report ? state.entries.filter((e) => e.reportId === report.id) : []),
    [report, state.entries],
  );

  const k = useMemo(() => kpis(entries, cats), [entries, cats]);
  const incChart = useMemo(
    () =>
      catTotals(entries, cats, "credit")
        .filter((c) => !c.excludeFromRevenue)
        .map((c) => ({ name: c.name, value: c.value })),
    [entries, cats],
  );
  const expChart = useMemo(
    () =>
      catTotals(entries, cats, "debit").map((c) => ({
        name: c.name,
        value: c.value,
        color: c.isUncat ? "#D97706" : undefined,
      })),
    [entries, cats],
  );
  const modes = useMemo(() => modeTotals(entries), [entries]);
  const ota = useMemo(() => otaStats(entries, cats), [entries, cats]);
  const trend = useMemo(() => cashTrend(state.reports, propertyId), [state.reports, propertyId]);
  const missing = useMemo(
    () => missingDays(state.reports, propertyId, format(parseISO(date), "yyyy-MM")),
    [state.reports, propertyId, date],
  );

  const shift = (delta: number) =>
    setDate(format(addDays(parseISO(date), delta), "yyyy-MM-dd"));

  const startManual = () => {
    const id = createDraft({
      propertyId,
      date,
      cashInHand: 0,
      entries: [],
    });
    showSuccess("Blank report created — add line items in the review screen.");
    window.location.hash = "";
    window.history.replaceState(null, "", `/review/${id}`);
    window.location.reload();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={propertyId}
          onChange={(e) => setPid(e.target.value)}
          className="h-9 rounded-xl border border-input bg-card px-3 text-sm font-medium shadow-sm"
        >
          {state.properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex items-center rounded-xl border border-input bg-card shadow-sm">
          <button
            onClick={() => shift(-1)}
            className="grid size-9 place-items-center text-muted-foreground hover:text-foreground"
            aria-label="Previous day"
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="tabular h-9 bg-transparent px-1 text-sm font-medium"
          />
          <button
            onClick={() => shift(1)}
            className="grid size-9 place-items-center text-muted-foreground hover:text-foreground"
            aria-label="Next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="ml-auto flex gap-2">
          {report && (
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to={`/review/${report.id}`}>
                <Pencil size={14} /> Edit entries
              </Link>
            </Button>
          )}
          <Button asChild size="sm" className="rounded-xl">
            <Link to={`/upload?property=${propertyId}&date=${date}`}>
              Upload DSR
            </Link>
          </Button>
        </div>
      </div>

      {!report ? (
        <Card className="rounded-2xl border-2 border-dashed bg-card/60 shadow-none">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
              <CalendarDays size={22} />
            </span>
            <div>
              <p className="font-display text-lg font-semibold">
                No DSR saved for {format(parseISO(date), "EEEE, d MMM yyyy")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload the nightly report photo, or enter it manually.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild className="rounded-xl">
                <Link to={`/upload?property=${propertyId}&date=${date}`}>
                  Upload photo
                </Link>
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={startManual}>
                Enter manually
              </Button>
            </div>
            {missing.length > 0 && (
              <div className="mt-2 max-w-md">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Missing days this month
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {missing.slice(0, 8).map((d) => (
                    <span
                      key={d}
                      className="tabular rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900"
                    >
                      {format(parseISO(d), "d MMM")}
                    </span>
                  ))}
                  {missing.length > 8 && (
                    <span className="text-xs text-muted-foreground">
                      +{missing.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Income"
              value={inr(k.income)}
              icon={TrendingUp}
              tint="bg-teal-50 text-teal-700"
              note={k.openingBal > 0 ? `excl. opening bal ${inr(k.openingBal)}` : undefined}
            />
            <Kpi
              label="Expenses"
              value={inr(k.expensesAll)}
              icon={TrendingDown}
              tint="bg-orange-50 text-orange-700"
              note={
                k.ownerDraw > 0
                  ? `operating ${inr(k.expensesOp)} · MD Sir ${inr(k.ownerDraw)}`
                  : undefined
              }
            />
            <Kpi
              label="Net"
              value={inr(k.net)}
              icon={ArrowLeftRight}
              tint={k.net >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}
            />
            <Kpi
              label="Cash in hand"
              value={inr(report.cashInHand)}
              icon={Banknote}
              tint="bg-sky-50 text-sky-700"
            />
          </div>

          {/* Category charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">
                  Income by category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBars data={incChart} color={CHART.income} />
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">
                  Expenses by category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBars data={expChart} color={CHART.expense} />
              </CardContent>
            </Card>
          </div>

          {/* OTA + reconciliation */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">OTA business</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end justify-between">
                  <p className="tabular text-2xl font-semibold">{inr(ota.total)}</p>
                  <p className="text-sm text-muted-foreground">
                    {ota.pctOfRoom.toFixed(0)}% of room revenue
                  </p>
                </div>
                {ota.platforms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No OTA settlements today.</p>
                ) : (
                  <div className="space-y-2">
                    {ota.platforms.map((p, i) => (
                      <div key={p.platform}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="font-medium">{p.platform}</span>
                          <span className="tabular text-muted-foreground">{inr(p.value)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${ota.total ? (p.value / ota.total) * 100 : 0}%`,
                              backgroundColor: OTA_SHADES[i % OTA_SHADES.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Direct room sales: {inr(ota.roomDirect)}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">
                  Payment-mode reconciliation
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2">
                <ModeTable
                  title="Money in"
                  dotClass="bg-teal-600"
                  rows={modes.filter((m) => entries.some((e) => e.side === "credit" && e.paymentMode === m.mode))}
                  printed={report.printedCreditTotal}
                  computed={entries.filter((e) => e.side === "credit").reduce((s, e) => s + e.amount, 0)}
                />
                <ModeTable
                  title="Money out"
                  dotClass="bg-orange-700"
                  rows={modes.filter((m) => entries.some((e) => e.side === "debit" && e.paymentMode === m.mode))}
                  printed={report.printedDebitTotal}
                  computed={entries.filter((e) => e.side === "debit").reduce((s, e) => s + e.amount, 0)}
                />
              </CardContent>
            </Card>
          </div>

          {/* Cash trend */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">
                Cash in hand — recent days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CashTrendLine data={trend} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}