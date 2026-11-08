import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { PageHeader, Panel, Pill, Stat, Meta } from "@/components/app/kit";
import { useSession } from "@/components/app/useSession";
import { analytics, fmtNum, fmtPct, fmtUSD, periodPreset, voidAnomalies } from "@/lib/demo/analytics";
import { employeeById, menuById } from "@/lib/demo/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/voids")({ head: () => pageHead("Cancellations", "Review canceled orders and their reasons in SANA."), component: Voids });

function Voids() {
  const { session, can } = useSession();
  const [range, setRange] = useState("last_30");
  const p = useMemo(() => periodPreset(range), [range]);
  const own = !can("voids.all");
  const r = useMemo(() => analytics.canceled_orders(p, own ? session?.userId : undefined), [p, own, session]);
  const anomalies = useMemo(() => (own ? [] : voidAnomalies(p)), [p, own]);

  return (
    <div>
      <PageHeader
        eyebrow={own ? "Your cancellations only" : "All staff"}
        title="Cancellations"
        actions={<div className="flex rounded-lg border bg-card p-0.5">{[["yesterday", "Yesterday"], ["last_7", "7 days"], ["last_30", "30 days"], ["last_90", "90 days"]].map(([k, l]) => <button key={k} onClick={() => setRange(k)} className={cn("rounded-md px-3 py-1.5 text-xs", range === k && "bg-ink text-paper")}>{l}</button>)}</div>}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Canceled orders" value={fmtNum(r.total)} />
        <Stat label="Voided value" value={fmtUSD(r.value)} tone="urgent" />
        <Stat label="Top reason" value={<span className="text-xl">{r.byReason[0]?.reason ?? "—"}</span>} />
      </div>
      {anomalies.map((a) => (
        <div key={a.name} className="mt-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 text-warning" />
          <div><b>Unusual cancel pattern: {a.name}</b> — {a.voids} voids, rate {fmtPct(a.rate)} vs team median {fmtPct(a.median)}. Most are “Guest changed mind” with no manager present. Review recommended.</div>
        </div>
      ))}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="By reason">
          <div className="space-y-3">
            {r.byReason.map((x) => (
              <div key={x.reason}>
                <div className="flex justify-between text-sm"><span>{x.reason}</span><span className="tabular text-muted-foreground">{x.count} · {fmtUSD(x.value)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-urgent/70" style={{ width: `${(x.count / Math.max(1, r.byReason[0].count)) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Panel>
        {!own && (
          <Panel title="By employee">
            <ul className="space-y-2 text-sm">{r.byEmployee.map((e) => <li key={e.name} className="flex justify-between"><span>{e.name}</span><span className="tabular">{e.count}</span></li>)}</ul>
          </Panel>
        )}
      </div>
      <Panel title="Recent" className="mt-4" pad={false}>
        <ul className="divide-y text-sm">
          {r.orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
              <Meta>{new Date(o.ts).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</Meta>
              <span className="flex-1 truncate">{o.lines.map((l) => menuById(l.itemId).name).join(", ")}</span>
              <Pill>{o.channel.replace("_", "-")}</Pill>
              <Pill tone="urgent">{o.voidReason}</Pill>
              {!own && <Meta>{employeeById(o.voidedBy)?.name ?? "Manager"}</Meta>}
              <span className="tabular">{fmtUSD(o.subtotal, 2)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
