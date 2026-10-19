"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PALETTE = ["#7c6cf6", "#5aa9f6", "#3ecf8e", "#f5a524", "#f0616d", "#b18cf5", "#4dd0e1", "#8d93a3"];
const AXIS = { stroke: "#8d93a3", fontSize: 11 } as const;

const tooltipStyle = {
  contentStyle: { background: "#14161c", border: "1px solid #262a34", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#ececf1" },
  itemStyle: { color: "#ececf1" },
  cursor: { fill: "rgb(124 108 246 / 0.08)" },
};

function fmtDate(v: string) {
  if (/^\d{4}-\d{2}$/.test(v)) return `${v.slice(5)}/${v.slice(2, 4)}`;
  const [, m, d] = v.split("-");
  return d ? `${d}/${m}` : v;
}

export function TimeSeries({ data, dataKey, label, kind = "area" }: { data: Record<string, string | number>[]; dataKey: string; label: string; kind?: "area" | "line" }) {
  const common = { data, margin: { top: 8, right: 8, left: -20, bottom: 0 } };
  return (
    <div className="h-64 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        {kind === "area" ? (
          <AreaChart {...common}>
            <defs>
              <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c6cf6" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#7c6cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#262a34" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtDate} {...AXIS} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} {...AXIS} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} labelFormatter={(l) => fmtDate(String(l))} />
            <Area type="monotone" dataKey={dataKey} name={label} stroke="#7c6cf6" strokeWidth={2} fill={`url(#g-${dataKey})`} />
          </AreaChart>
        ) : (
          <LineChart {...common}>
            <CartesianGrid stroke="#262a34" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtDate} {...AXIS} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} {...AXIS} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} labelFormatter={(l) => fmtDate(String(l))} />
            <Line type="monotone" dataKey={dataKey} name={label} stroke="#5aa9f6" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function HBar({ data, label, height = 256 }: { data: { name: string; value: number }[]; label: string; height?: number }) {
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#262a34" horizontal={false} />
          <XAxis type="number" allowDecimals={false} {...AXIS} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={110} {...AXIS} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="value" name="Leads" fill="#7c6cf6" radius={[0, 4, 4, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, label }: { data: { name: string; value: number }[]; label: string }) {
  return (
    <div className="flex h-64 w-full flex-col items-center gap-2 sm:flex-row" role="img" aria-label={label}>
      <div className="h-full min-h-40 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1.5 text-xs sm:w-40">
        {data.slice(0, 8).map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="truncate text-muted-foreground">{d.name}</span></span>
            <span className="tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FunnelBars({ data }: { data: { name: string; count: number; rate: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-2.5" aria-label="Funil de conversão por etapa">
      {data.map((d, i) => (
        <li key={d.name}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span>{d.name}</span>
            <span className="tabular-nums text-muted-foreground">{d.count}{i > 0 && <span className="ml-2 text-[11px]">({d.rate.toFixed(0)}% da etapa anterior)</span>}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-gradient-to-r from-primary to-info transition-all" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
