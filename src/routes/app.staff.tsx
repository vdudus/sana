import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { Download, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Pill, Stat } from "@/components/app/kit";
import { useSession } from "@/components/app/useSession";
import { EMPLOYEES, employeeById, getHistory } from "@/lib/demo/data";
import { fmtUSD } from "@/lib/demo/analytics";
import { audit, setState, useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/staff")({ head: () => pageHead("Staff & schedule", "Coordinate restaurant hours and shifts in SANA."), component: Staff });

function downloadCsv(name: string, rows: (string | number)[][]) {
  const blob = new Blob([rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

function Staff() {
  const { can, session } = useSession();
  const [days, setDays] = useState(14);
  const schedule = useDemo((s) => s.schedule);
  const swaps = useDemo((s) => s.swaps);
  const all = can("staff.hours.all");
  const showPay = can("pay.all");

  const hours = useMemo(() => {
    const from = Date.now() - days * 864e5;
    const map: Record<string, { hours: number; shifts: number; tips: number }> = {};
    for (const s of getHistory().shifts) {
      if (s.start < from) continue;
      map[s.employeeId] ??= { hours: 0, shifts: 0, tips: 0 };
      map[s.employeeId].hours += (s.end - s.start) / 3600e3;
      map[s.employeeId].shifts++;
      map[s.employeeId].tips += s.tipsCard + s.tipsCash;
    }
    return Object.entries(map).map(([id, v]) => ({ e: employeeById(id)!, ...v })).sort((a, b) => b.hours - a.hours);
  }, [days]);

  const mon = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
  const week = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const people = EMPLOYEES.filter((e) => e.role !== "owner" && (all || e.id === session?.userId));
  const published = schedule.some((s) => s.published);

  function publish() {
    setState((s) => ({ ...s, schedule: s.schedule.map((x) => ({ ...x, published: true })) }));
    audit("schedule.publish", `Published week of ${format(mon, "MMM d")}`);
    toast.success("Schedule published", { description: "Staff notified on their devices." });
  }
  function toggleShift(empId: string, day: number) {
    if (!can("staff.schedule.edit")) return;
    const ex = schedule.find((s) => s.employeeId === empId && s.day === day);
    setState((s) => ({
      ...s,
      schedule: ex
        ? ex.start === "10:30" ? s.schedule.map((x) => (x.id === ex.id ? { ...x, start: "16:00", end: "23:00", published: false } : x)) : s.schedule.filter((x) => x.id !== ex.id)
        : [...s.schedule, { id: `sp_${empId}_${day}`, employeeId: empId, day, start: "10:30", end: "16:00", published: false }],
    }));
  }
  function decideSwap(id: string, ok: boolean) {
    setState((s) => ({ ...s, swaps: s.swaps.map((x) => (x.id === id ? { ...x, status: ok ? "approved" : "denied" } : x)) }));
    audit("schedule.swap", `${ok ? "Approved" : "Denied"} shift swap`);
  }

  return (
    <div>
      <PageHeader
        eyebrow={all ? "Team" : "Your schedule"}
        title="Staff & schedule"
        actions={all && <Button variant="soft" onClick={() => downloadCsv(`hours-${days}d.csv`, [["Employee", "Role", "Shifts", "Hours", ...(showPay ? ["Rate", "Wages", "Tips"] : [])], ...hours.map((h) => [h.e.name, h.e.title, h.shifts, h.hours.toFixed(2), ...(showPay ? [h.e.hourlyRate, (h.hours * h.e.hourlyRate).toFixed(2), h.tips.toFixed(2)] : [])])])}><Download className="size-4" /> Export hours</Button>}
      />

      {all && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Stat label={`Total hours · ${days} days`} value={hours.reduce((s, h) => s + h.hours, 0).toFixed(0)} />
            <Stat label="Shifts worked" value={hours.reduce((s, h) => s + h.shifts, 0)} />
            {showPay ? <Stat label="Est. labor cost (servers)" value={fmtUSD(hours.reduce((s, h) => s + h.hours * h.e.hourlyRate, 0))} /> : <Stat label="Pay data" value={<span className="text-base text-muted-foreground">Owner only</span>} />}
          </div>
          <Panel title="Hours worked (POS time clock)" className="mt-4" pad={false} action={<div className="flex gap-1">{[7, 14, 30].map((d) => <button key={d} onClick={() => setDays(d)} className={cn("rounded px-2 py-0.5 text-xs", days === d && "bg-ink text-paper")}>{d}d</button>)}</div>}>
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Employee", "Shifts", "Hours", "Avg shift", ...(showPay ? ["Rate", "Wages", "Tips"] : [])].map((h) => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {hours.map((h) => (
                  <tr key={h.e.id} className="border-t">
                    <td className="px-4 py-2.5">{h.e.name} <span className="text-xs text-muted-foreground">· {h.e.title}</span></td>
                    <td className="px-4 py-2.5 tabular">{h.shifts}</td>
                    <td className="px-4 py-2.5 tabular font-medium">{h.hours.toFixed(1)}</td>
                    <td className="px-4 py-2.5 tabular">{(h.hours / h.shifts).toFixed(1)} h</td>
                    {showPay && <><td className="px-4 py-2.5 tabular">{fmtUSD(h.e.hourlyRate, 2)}</td><td className="px-4 py-2.5 tabular">{fmtUSD(h.hours * h.e.hourlyRate)}</td><td className="px-4 py-2.5 tabular">{fmtUSD(h.tips)}</td></>}
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}

      <Panel
        title={`Week of ${format(mon, "MMM d")}`}
        className="mt-4"
        pad={false}
        action={can("staff.schedule.edit") ? <Button size="sm" variant={published ? "outline" : "ember"} onClick={publish}><Send className="size-3.5" /> {published ? "Republish" : "Publish schedule"}</Button> : <Pill tone={published ? "ok" : "neutral"}>{published ? "Published" : "Draft"}</Pill>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead><tr className="text-muted-foreground"><th className="px-4 py-2 text-left font-medium">Employee</th>{week.map((d) => <th key={d.getTime()} className="px-2 py-2 text-left font-medium">{format(d, "EEE d")}</th>)}</tr></thead>
            <tbody>
              {people.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-4 py-2 text-sm">{e.name}</td>
                  {week.map((d) => {
                    const s = schedule.find((x) => x.employeeId === e.id && x.day === d.getTime());
                    return (
                      <td key={d.getTime()} className="px-1 py-1.5">
                        <button onClick={() => toggleShift(e.id, d.getTime())} className={cn("h-9 w-full rounded-md border border-dashed text-[11px]", s && (s.start === "10:30" ? "border-solid bg-warning-soft" : "border-solid bg-ember-soft"), !s && "text-muted-foreground/50")}>
                          {s ? `${s.start}–${s.end}` : can("staff.schedule.edit") ? "+" : "off"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {can("staff.schedule.edit") && <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">Click a cell to cycle: off → lunch → dinner → off.</p>}
      </Panel>

      {all && (
        <Panel title="Shift-swap requests" className="mt-4" pad={false}>
          <ul className="divide-y text-sm">
            {swaps.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex-1">{employeeById(s.from)?.name} → {employeeById(s.to)?.name}</span>
                {s.status === "pending" ? (<><Button size="sm" variant="outline" onClick={() => decideSwap(s.id, false)}>Deny</Button><Button size="sm" onClick={() => decideSwap(s.id, true)}>Approve</Button></>) : <Pill tone={s.status === "approved" ? "ok" : "urgent"}>{s.status}</Pill>}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
