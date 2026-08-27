import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO, subMonths } from "date-fns";
import { CalendarX2, FileSpreadsheet } from "lucide-react";
import { useApp } from "@/store/AppContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART, missingDays, monthDays, toCsv } from "@/lib/analytics";
import { download } from "@/lib/storage";
import { inr, inrCompact, slugify } from "@/lib/utils";
import { format as fmt } from "date-fns";

const ymNow = () => fmt(new Date(), "yyyy-MM");

function totalsByName(
  entries: ReturnType<typeof Object> extends never ? never : import("@/types").LedgerEntry[],
  cats: import("@/types").Category[],
  side: "credit" | "debit",
) {
  const map = new Map<string, { value: number; isUncat: boolean; excl: boolean }>();
  for (const e of entries) {
    if (e.side !== side) continue;
    const c = cats.find((x) => x.id === e.categoryId);
    const label = c ? c.name : "Uncategorized";
    const prev = map.get(label) ?? { value: 0, isUncat: !c, excl: !!c?.excludeFromRevenue };
    map.set(label, { value: prev.value + e.amount, isUncat: prev.isUncat, excl: prev.excl });
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.value - a.value);
}

export default function Monthly() {
  const { state } = useApp();
  const [ym, setYm] = useState(ymNow);
  const [pid, setPid] = useState("__all__");

  const scopedReports = useMemo(
    () =>
      state.reports.filter(
        (r) => r.status === "saved" && r.date.startsWith(ym) && (pid === "__all__" || r.propertyId === pid),
      ),
    [state.reports, ym, pid],
  );
  const reportIds = new Set(scopedReports.map((r) => r.id));
  const entries = useMemo(
    () => state.entries.filter((e) => reportIds.has(e.reportId)),
    [state.entries, reportIds],
  );
  const cats = useMemo(
    () =>
      pid === "__all__"
        ? state.categories
        : state.categories.filter((c) => c.propertyId === pid),
    [state.categories, pid],
  );

  const income = useMemo(
    () => totalsByName(entries, cats, "credit").filter((c) => !c.excl),
    [entries, cats],
  );
  const opening = useMemo(
    () => totalsByName(entries, cats, "credit").filter((c) => c.excl),
    [entries, cats],
  );
  const expenses = useMemo(() => totalsByName(entries, cats, "debit"), [entries, cats]);
  const incomeTotal = income.reduce((s, c) => s + c.value, 0);
  const expenseTotal = expenses.reduce((s, c) => s + c.value, 0);

  const prevYm = fmt(subMonths(parseISO(`${ym}-01`), 1), "yyyy-MM");
  const prevEntries = useMemo(() => {
    const ids = new Set(
      state.reports
        .filter(
          (r) =>
            r.status === "saved" &&
            r.date.startsWith(prevYm) &&
            (pid === "__all__" || r.propertyId === pid),
        )
        .map((r) => r.id),
    );
    return state.entries.filter((e) => ids.has(e.reportId));
  }, [state.reports, state.entries, prevYm, pid]);

  const momData = useMemo(() => {
    const cur = new Map<string, number>();
    for (const c of [...income, ...expenses]) cur.set(c.name, c.value);
    const prev = new Map<string, number>();
    for (const c of [...totalsByName(prevEntries, cats, "credit").filter((x) => !x.excl), ...totalsByName(prevEntries, cats, "debit")])
      prev.set(c.name, c.value);
    return [...cur.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({
        name: name.replace(" (non-revenue)", "").replace(/ & .*$/, ""),
        Current: value,
        Previous: prev.get(name) ?? 0,
      }));
  }, [income, expenses, prevEntries, cats]);

  const missing = useMemo(
    () => (pid === "__all__" ? [] : missingDays(state.reports, pid, ym)),
    [state.reports, pid, ym],
  );
  const expected = monthDays(ym).length;

  const exportCsv = () => {
    const propName =
      pid === "__all__" ? "all-properties" : slugify(state.properties.find((p) => p.id === pid)?.name ?? "property");
    const rows: (string | number)[][] = [
      ["Date", "Property", "Side", "Category", "Sub-tag", "Description", "Payment Mode", "Amount"],
    ];
    for (const e of entries) {
      const rep = state.reports.find((r) => r.id === e.reportId);
      const prop = state.properties.find((p) => p.id === rep?.propertyId);
      const cat = cats.find((c) => c.id === e.categoryId);
      rows.push([
        rep?.date ?? "",
        prop?.name ?? "",
        e.side,
        cat?.name ?? "Uncategorized",
        e.subTag ?? "",
        e.description,
        e.paymentMode,
        e.amount,
      ]);
    }
    download(`dsr-${propName}-${ym}.csv`, toCsv(rows), "text/csv");
  };

  const Table = ({
    title,
    data,
    total,
    tint,
  }: {
    title: string;
    data: { name: string; value: number; isUncat: boolean }[];
    total: number;
    tint: string;
  }) => (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <span className={`size-2.5 rounded-full ${tint}`} /> {title}
        </CardTitle>
        <span className="tabular text-sm font-semibold">{inr(total)}</span>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">Nothing recorded this month.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {data.map((c) => (
                <tr
                  key={c.name}
                  className={`border-b border-border/60 last:border-0 ${c.isUncat && c.value > 0 ? "bg-amber-50/60" : ""}`}
                >
                  <td className="py-2 pr-2">
                    {c.name}
                    {c.isUncat && c.value > 0 && (
                      <Link to="/upload" className="ml-2 text-xs text-amber-700 underline">
                        review
                      </Link>
                    )}
                  </td>
                  <td className="tabular py-2 text-right text-muted-foreground">
                    {total > 0 ? ((c.value / total) * 100).toFixed(0) : 0}%
                  </td>
                  <td className="tabular py-2 pl-3 text-right font-medium">{inr(c.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Monthly sale report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Auto-compiled from every saved daily report.
          </p>
        </div>
        <Button variant="outline" className="rounded-xl" onClick={exportCsv} disabled={!entries.length}>
          <FileSpreadsheet size={15} /> Export CSV (Excel)
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="month"
          value={ym}
          onChange={(e) => e.target.value && setYm(e.target.value)}
          className="tabular h-9 rounded-xl border border-input bg-card px-3 text-sm font-medium shadow-sm"
        />
        <select
          value={pid}
          onChange={(e) => setPid(e.target.value)}
          className="h-9 rounded-xl border border-input bg-card px-3 text-sm font-medium shadow-sm"
        >
          {state.properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="__all__">Combined (both properties)</option>
        </select>
        <Badge variant="secondary" className="tabular ml-auto rounded-full px-3 py-1.5">
          {pid === "__all__"
            ? `${scopedReports.length} reports`
            : `${scopedReports.length}/${expected} days reported`}
        </Badge>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Income", value: incomeTotal, tint: "text-teal-700" },
          { label: "Expenses", value: expenseTotal, tint: "text-orange-700" },
          { label: "Net", value: incomeTotal - expenseTotal, tint: "text-foreground" },
        ].map((k) => (
          <Card key={k.label} className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {k.label}
              </p>
              <p className={`tabular mt-1 truncate text-lg font-semibold sm:text-xl ${k.tint}`}>
                {inr(k.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {opening.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Opening balance recorded this month: {inr(opening.reduce((s, o) => s + o.value, 0))} —
          excluded from income above.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Table title="Income by category" data={income} total={incomeTotal} tint="bg-teal-600" />
        <Table title="Expenses by category" data={expenses} total={expenseTotal} tint="bg-orange-700" />
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base">
            Month-over-month — top categories
          </CardTitle>
        </CardHeader>
        <CardContent>
          {momData.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No data for this month yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={momData} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke={CHART.grid} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tick={{ fontSize: 11, fill: CHART.tick }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  formatter={(v: unknown) => inr(Number(v))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #E7E2D8",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Previous" fill={CHART.prev} radius={[4, 8, 8, 4]} barSize={10} />
                <Bar dataKey="Current" fill={CHART.income} radius={[4, 8, 8, 4]} barSize={10}>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {missing.length > 0 && (
        <Card className="rounded-2xl border-amber-200 shadow-sm">
          <CardHeader className="flex-row items-center gap-2 space-y-0 pb-2">
            <CalendarX2 size={16} className="text-amber-700" />
            <CardTitle className="font-display text-base text-amber-900">
              Missing daily reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {missing.slice(0, 12).map((d) => (
                <span
                  key={d}
                  className="tabular rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900"
                >
                  {fmt(parseISO(d), "d MMM")}
                </span>
              ))}
              {missing.length > 12 && (
                <span className="text-xs text-muted-foreground">+{missing.length - 12} more</span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              These gaps are reflected in the totals above — upload them for a complete month.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}