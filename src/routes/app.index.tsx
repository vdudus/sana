import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { PageHeader, Panel, Pill, Stat, Meta, AssistantAvatar } from "@/components/app/kit";
import { useSession } from "@/components/app/useSession";
import { analytics, fmtNum, fmtPct, fmtUSD, lastSynced, periodPreset, voidAnomalies } from "@/lib/demo/analytics";
import { useDemo } from "@/lib/demo/store";
import { hoursLeft, statusOf } from "@/lib/demo/inventory";
import { inventoryById } from "@/lib/demo/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/")({ head: () => pageHead("Overview", "Restaurant sales and inventory priorities in SANA."), component: Overview });

const RANGES = [["today", "Today"], ["last_7", "7 days"], ["last_30", "30 days"], ["last_90", "90 days"]] as const;

function Overview() {
  const { role, user } = useSession();
  const [range, setRange] = useState<string>("last_30");
  const p = useMemo(() => periodPreset(range), [range]);
  const sum = useMemo(() => analytics.revenue_summary(p), [p]);
  const prev = useMemo(() => {
    const len = p.to - p.from;
    return analytics.revenue_summary({ from: p.from - len, to: p.from - 1, label: "" });
  }, [p]);
  const chart = useMemo(() => analytics.sales_by_day(range === "today" ? periodPreset("last_7") : p), [p, range]);
  const ch = useMemo(() => analytics.orders_by_channel(p), [p]);
  const top = useMemo(() => analytics.top_items(p, 5), [p]);
  const anomalies = useMemo(() => voidAnomalies(periodPreset("last_30")), []);
  const batches = useDemo((s) => s.batches);
  const approvals = useDemo((s) => s.approvals.filter((a) => a.status === "pending"));
  const atRisk = batches.filter((b) => b.status === "active" && ["urgent", "expired"].includes(statusOf(b))).sort((a, b) => a.expiresAt - b.expiresAt);

  if (role === "waiter") return <Navigate to="/app/orders" />;
  const delta = (a: number, b: number) => (b ? (a - b) / b : 0);
  const d = delta(sum.netSales, prev.netSales);

  return (
    <div>
      <PageHeader
        eyebrow={`Good ${new Date().getHours() < 12 ? "morning" : "evening"}, ${user?.name.split(" ")[0]}`}
        title="Overview"
        actions={
          <div className="flex rounded-lg border bg-card p-0.5">
            {RANGES.map(([k, l]) => (
              <Button size="sm" variant="ghost" key={k} onClick={() => setRange(k)} className={cn("px-3 text-xs", range === k && "bg-ink text-paper")}>{l}</Button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Net sales" value={fmtUSD(sum.netSales)} sub={<span className={d >= 0 ? "text-success" : "text-urgent"}>{d >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(d))} vs prior period</span>} />
        <Stat label="Paid orders" value={fmtNum(sum.orders)} sub={`Avg check ${fmtUSD(sum.avgCheck, 2)}`} />
        <Stat label="Canceled orders" value={fmtNum(sum.voids)} sub={`${fmtPct(sum.voids / Math.max(1, sum.orders + sum.voids))} void rate`} />
        <Stat label="Tips to staff" value={fmtUSD(sum.tips)} sub="Card + declared cash" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Panel title="Net sales by day" action={<Meta>synced {lastSynced().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Meta>}>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={chart} margin={{ left: -10, right: 4, top: 4 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--ember)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--ember)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => fmtUSD(v)} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="var(--ember)" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Order channels">
          <div className="space-y-4">
            {ch.rows.map((r) => {
              const total = ch.rows.reduce((s, x) => s + x.orders, 0);
              return (
                <div key={r.channel}>
                  <div className="flex justify-between text-sm"><span>{r.channel}</span><span className="tabular text-muted-foreground">{fmtNum(r.orders)} · {fmtUSD(r.revenue)}</span></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-ink" style={{ width: `${(r.orders / total) * 100}%` }} /></div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-1.5 pt-2">
              {Object.entries(ch.sources).map(([k, v]) => <Pill key={k}>{k} · {v}</Pill>)}
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Needs attention" pad={false}>
          <ul className="divide-y text-sm">
            {approvals.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                <Pill tone="ember">Approval</Pill><span className="flex-1">Cancel after kitchen start · {a.reason}</span>
                <Link to="/app/orders" className="text-xs text-ember">Review</Link>
              </li>
            ))}
            {atRisk.slice(0, 4).map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                <Pill tone={statusOf(b)}>{Math.max(0, Math.round(hoursLeft(b)))} h</Pill>
                <span className="flex-1">{inventoryById(b.itemId).name} · {b.qty} {inventoryById(b.itemId).unit}</span>
                <Link to="/app/inventory" className="text-xs text-ember">Act</Link>
              </li>
            ))}
            {anomalies.map((a) => (
              <li key={a.name} className="flex items-center gap-3 px-5 py-3">
                <AlertTriangle className="size-4 text-warning" />
                <span className="flex-1">{a.name}: void rate {fmtPct(a.rate)} (team {fmtPct(a.median)})</span>
                <Link to="/app/voids" className="text-xs text-ember">Inspect</Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Top sellers">
          <ol className="space-y-3 text-sm">
            {top.map((t, i) => (
              <li key={t.name} className="flex items-center gap-3">
                <span className="w-4 font-mono text-xs text-muted-foreground">{i + 1}</span>
                <span className="flex-1 truncate">{t.name}</span>
                <span className="tabular text-muted-foreground">{fmtNum(t.qty)}</span>
              </li>
            ))}
          </ol>
        </Panel>
        <Link to="/app/assistant" className="group flex flex-col justify-between rounded-xl bg-ink p-6 text-paper shadow-soft">
          <AssistantAvatar className="size-14" />
          <div>
            <div className="font-display text-3xl leading-tight">“Which dishes did we cancel most last week?”</div>
            <div className="mt-4 inline-flex items-center gap-1.5 text-sm text-paper/70 group-hover:text-paper">Ask SANA <ArrowRight className="size-4" /></div>
          </div>
        </Link>
      </div>
    </div>
  );
}
