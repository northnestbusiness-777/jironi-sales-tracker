import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART } from "@/lib/analytics";
import { inr, inrCompact } from "@/lib/utils";

export interface Datum {
  name: string;
  value: number;
  color?: string;
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #E7E2D8",
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
};

export function CategoryBars({
  data,
  color,
  height = 240,
}: {
  data: Datum[];
  color: string;
  height?: number;
}) {
  if (!data.length)
    return (
      <div
        className="grid place-items-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No entries yet
      </div>
    );
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 44, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tickLine={false}
          axisLine={false}
          interval={0}
          tick={{ fontSize: 11, fill: CHART.tick }}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          formatter={(v: unknown) => inr(Number(v))}
          contentStyle={tooltipStyle}
        />
        <Bar dataKey="value" radius={[4, 8, 8, 4]} barSize={14}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? color} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v: unknown) => inrCompact(Number(v))}
            style={{ fontSize: 10, fill: CHART.tick }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashTrendLine({
  data,
}: {
  data: { label: string; cash: number }[];
}) {
  if (data.length < 2)
    return (
      <div className="grid h-[200px] place-items-center text-sm text-muted-foreground">
        Save at least two daily reports to see the trend
      </div>
    );
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: CHART.tick }}
        />
        <YAxis hide domain={["auto", "auto"]} />
        <Tooltip
          formatter={(v: unknown) => inr(Number(v))}
          contentStyle={tooltipStyle}
        />
        <Line
          type="monotone"
          dataKey="cash"
          stroke={CHART.income}
          strokeWidth={2.5}
          dot={{ r: 3, fill: CHART.income, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}