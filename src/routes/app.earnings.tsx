import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Forbidden } from "@/components/app/Forbidden";
import { PageHeader, Panel, Pill, Stat, Meta } from "@/components/app/kit";
import { useSession } from "@/components/app/useSession";
import { getHistory } from "@/lib/demo/data";
import { fmtUSD } from "@/lib/demo/analytics";
import { useDemo } from "@/lib/demo/store";

export const Route = createFileRoute("/app/earnings")({ head: () => pageHead("My earnings", "Review personal wages and tips in SANA."), component: Earnings });

function Earnings() {
  const { user, can } = useSession();
  const schedule = useDemo((s) => s.schedule.filter((x) => x.employeeId === user?.id && x.published));
  const shifts = useMemo(() => getHistory().shifts.filter((s) => s.employeeId === user?.id).sort((a, b) => b.start - a.start), [user]);
  if (!can("pay.own") || !user) return <Forbidden perm="pay.own" />;

  const periodStart = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), -7).getTime();
  const inPeriod = shifts.filter((s) => s.start >= periodStart);
  const hours = inPeriod.reduce((s, x) => s + (x.end - x.start) / 3600e3, 0);
  const wages = hours * user.hourlyRate;
  const card = inPeriod.reduce((s, x) => s + x.tipsCard, 0);
  const cash = inPeriod.reduce((s, x) => s + x.tipsCash, 0);
  const chart = shifts.slice(0, 14).reverse().map((s) => ({ d: format(s.start, "MMM d"), tips: Math.round(s.tipsCard + s.tipsCash) }));

  return (
    <div>
      <PageHeader eyebrow="Only you can see this" title="My earnings" desc="Current pay period (2 weeks). Figures are estimated until payroll closes." />
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Hours worked" value={hours.toFixed(1)} sub={`@ ${fmtUSD(user.hourlyRate, 2)}/h tipped wage`} />
        <Stat label="Wages (est.)" value={fmtUSD(wages, 2)} />
        <Stat label="Card tips" value={fmtUSD(card, 2)} tone="ember" />
        <Stat label="Declared cash tips" value={fmtUSD(cash, 2)} sub="Reported for Form 4070" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Tips per shift">
          <div className="h-56"><ResponsiveContainer><BarChart data={chart}><XAxis dataKey="d" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip formatter={(v: number) => fmtUSD(v)} /><Bar dataKey="tips" fill="var(--ember)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="My upcoming shifts">
          {schedule.length === 0 ? <p className="text-sm text-muted-foreground">Next week's schedule hasn't been published yet.</p> : (
            <ul className="space-y-2 text-sm">{schedule.map((s) => <li key={s.id} className="flex justify-between"><span>{format(s.day, "EEE, MMM d")}</span><span className="tabular text-muted-foreground">{s.start}–{s.end}</span></li>)}</ul>
          )}
        </Panel>
      </div>
      <Panel title="Shift history" className="mt-4" pad={false}>
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Date", "Clock in–out", "Hours", "Wages", "Card tips", "Cash tips", ""].map((h) => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {shifts.slice(0, 12).map((s, i) => {
              const h = (s.end - s.start) / 3600e3;
              return (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2">{format(s.start, "EEE MMM d")}</td>
                  <td className="px-4 py-2"><Meta>{format(s.start, "h:mma")}–{format(s.end, "h:mma")}</Meta></td>
                  <td className="px-4 py-2 tabular">{h.toFixed(1)}</td>
                  <td className="px-4 py-2 tabular">{fmtUSD(h * user.hourlyRate, 2)}</td>
                  <td className="px-4 py-2 tabular">{fmtUSD(s.tipsCard, 2)}</td>
                  <td className="px-4 py-2 tabular">{fmtUSD(s.tipsCash, 2)}</td>
                  <td className="px-4 py-2">{s.start >= periodStart ? <Pill tone="watch">Estimated</Pill> : i >= 0 && <Pill tone="ok">Paid</Pill>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
