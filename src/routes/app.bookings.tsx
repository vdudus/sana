import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { Plus, Brush as Broom } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Panel, Pill, Meta } from "@/components/app/kit";
import { useSession } from "@/components/app/useSession";
import { RESTAURANT } from "@/lib/demo/data";
import { audit, setState, uid, useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/bookings")({ head: () => pageHead("Bookings", "Manage restaurant reservations and events in SANA."), component: Bookings });

function Bookings() {
  const { can } = useSession();
  const edit = can("reservations.edit");
  const res = useDemo((s) => s.reservations);
  const cleaning = useDemo((s) => s.cleaning);
  const [day, setDay] = useState(startOfDay(new Date()).getTime());
  const [dlg, setDlg] = useState<null | "reservation" | "event" | "cleaning">(null);
  const [form, setForm] = useState({ name: "", party: "4", time: "19:00", tables: "6", date: format(new Date(), "yyyy-MM-dd"), note: "", vendor: "In-house closing crew" });

  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i).getTime());
  const todays = res.filter((r) => r.date >= day && r.date < day + 864e5).sort((a, b) => a.date - b.date);
  const blocked = new Set(todays.flatMap((r) => r.tables ?? [r.table]));

  function save() {
    const [h, m] = form.time.split(":").map(Number);
    const base = new Date(form.date + "T00:00");
    const date = base.getTime() + h * 3600e3 + m * 60e3;
    const tables = form.tables.split(/[ ,]+/).map(Number).filter(Boolean);
    if (dlg === "cleaning") {
      setState((s) => ({ ...s, cleaning: [...s.cleaning, { id: uid("cl"), date, area: form.name || "Deep clean", vendor: form.vendor, status: "scheduled" }] }));
      audit("cleaning.book", `${form.name} · ${form.vendor} · ${format(date, "MMM d p")}`);
    } else {
      setState((s) => ({ ...s, reservations: [...s.reservations, { id: uid("rs"), name: form.name || "Guest", party: Number(form.party), date, table: tables[0] ?? 1, tables: dlg === "event" ? tables : undefined, kind: dlg!, note: form.note }] }));
      audit(dlg === "event" ? "event.block" : "reservation.create", `${form.name} · party ${form.party} · tables ${tables.join(",")}`);
    }
    toast.success("Saved");
    setDlg(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow={edit ? "Front of house" : "View only"}
        title="Bookings"
        desc="Table reservations, private events with blocked tables, and cleaning on one calendar."
        actions={edit && <><Button variant="soft" onClick={() => setDlg("cleaning")}><Broom className="size-4" /> Book cleaning</Button><Button variant="soft" onClick={() => setDlg("event")}>Block for event</Button><Button onClick={() => setDlg("reservation")}><Plus className="size-4" /> Reservation</Button></>}
      />
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {days.map((d) => {
          const n = res.filter((r) => r.date >= d && r.date < d + 864e5).length;
          return (
            <button key={d} onClick={() => setDay(d)} className={cn("min-w-20 rounded-lg border bg-card px-3 py-2 text-left", day === d && "border-ink bg-ink text-paper")}>
              <div className="text-[11px] opacity-70">{format(d, "EEE")}</div>
              <div className="text-lg tabular">{format(d, "d")}</div>
              <div className="text-[10px] opacity-70">{n} booked</div>
            </button>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Panel title="Floor plan">
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: RESTAURANT.tables }, (_, i) => i + 1).map((t) => {
              const r = todays.find((x) => (x.tables ?? [x.table]).includes(t));
              return (
                <div key={t} className={cn("grid aspect-square place-items-center rounded-lg border text-xs", blocked.has(t) && (r?.kind === "event" ? "border-ember bg-ember-soft text-ember" : "bg-muted font-medium"))} title={r?.name}>
                  {t}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground"><span><span className="mr-1 inline-block size-2 rounded-sm bg-muted" />Reserved</span><span><span className="mr-1 inline-block size-2 rounded-sm bg-ember-soft" />Blocked for event</span></div>
        </Panel>
        <Panel title={format(day, "EEEE, MMM d")} pad={false}>
          {todays.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No bookings.</p> : (
            <ul className="divide-y text-sm">
              {todays.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <Meta>{format(r.date, "h:mm a")}</Meta>
                  <span className="flex-1">{r.name}{r.note && <span className="text-xs text-muted-foreground"> · {r.note}</span>}</span>
                  <Pill tone={r.kind === "event" ? "ember" : "neutral"}>{r.kind === "event" ? `Event · T${r.tables?.join(",")}` : `T${r.table}`}</Pill>
                  <span className="tabular text-muted-foreground">{r.party}p</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="Cleaning" className="mt-4" pad={false}>
        <ul className="divide-y text-sm">
          {[...cleaning].sort((a, b) => a.date - b.date).map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-5 py-3">
              <Meta>{format(c.date, "EEE MMM d, h:mm a")}</Meta>
              <span className="flex-1">{c.area} <span className="text-xs text-muted-foreground">· {c.vendor}{c.recurring ? ` · ${c.recurring}` : ""}</span></span>
              <Pill tone={c.status === "done" ? "ok" : "neutral"}>{c.status}</Pill>
              {edit && c.status === "scheduled" && <Button size="sm" variant="ghost" onClick={() => { setState((s) => ({ ...s, cleaning: s.cleaning.map((x) => (x.id === c.id ? { ...x, status: "done" } : x)) })); audit("cleaning.done", c.area); }}>Mark done</Button>}
            </li>
          ))}
        </ul>
      </Panel>

      <Dialog open={!!dlg} onOpenChange={(v) => !v && setDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dlg === "cleaning" ? "Book cleaning" : dlg === "event" ? "Block tables for an event" : "New reservation"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Input placeholder={dlg === "cleaning" ? "Area (e.g. Kitchen deep clean)" : "Name"} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
            {dlg === "cleaning" ? <Input placeholder="Vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /> : (
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Party size" value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} />
                <Input placeholder={dlg === "event" ? "Tables e.g. 14,15,16" : "Table"} value={form.tables} onChange={(e) => setForm({ ...form, tables: e.target.value })} />
              </div>
            )}
            {dlg !== "cleaning" && <Input placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />}
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
