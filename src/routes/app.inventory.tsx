import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Megaphone, ScanLine, Camera, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Panel, Pill, Stat, Meta } from "@/components/app/kit";
import { useSession } from "@/components/app/useSession";
import { INVENTORY, inventoryById, employeeById } from "@/lib/demo/data";
import { batchValue, hoursLeft, parseLabelDate, pushList, SHELF_LIFE_RULES, statusOf, THRESHOLDS } from "@/lib/demo/inventory";
import { addBatch, closeBatch, sendPushList } from "@/lib/demo/actions";
import { useDemo } from "@/lib/demo/store";
import { fmtUSD } from "@/lib/demo/analytics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/inventory")({ head: () => pageHead("Inventory", "Track batches and food expiry in SANA."), component: Inventory });

const LABELS: Record<string, string> = { expired: "Expired", urgent: "Urgent ≤72h", watch: "Watch ≤168h", ok: "OK" };

function Inventory() {
  const { can } = useSession();
  const full = can("inventory.full");
  const batches = useDemo((s) => s.batches);
  const closed = useDemo((s) => s.closed);
  const sentAt = useDemo((s) => s.settings.pushListSent);
  const [scan, setScan] = useState(false);
  const [filter, setFilter] = useState<"all" | "urgent" | "watch">("all");
  const push = useMemo(() => pushList(batches), [batches]);

  const active = batches.filter((b) => b.status === "active").sort((a, b) => a.expiresAt - b.expiresAt);
  const counts = { urgent: active.filter((b) => ["urgent", "expired"].includes(statusOf(b))).length, watch: active.filter((b) => statusOf(b) === "watch").length };
  const atRisk = active.filter((b) => statusOf(b) !== "ok").reduce((s, b) => s + batchValue(b), 0);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const wasted = closed.filter((b) => b.status === "wasted" && (b.closedAt ?? 0) >= monthStart);
  const wasteValue = wasted.reduce((s, b) => s + batchValue(b), 0);
  const shown = active.filter((b) => filter === "all" || (filter === "urgent" ? ["urgent", "expired"].includes(statusOf(b)) : statusOf(b) === "watch"));
  const scanned = active.filter((b) => b.receivedAt > Date.now() - 7 * 864e5).length;

  if (!full) {
    return (
      <div>
        <PageHeader eyebrow="Tonight's push list" title="Recommend these" desc="These dishes use ingredients that expire soon. Suggest them to your guests." />
        <div className="grid gap-3 md:grid-cols-2">
          {push.slice(0, 6).map((p, i) => (
            <div key={p.item.id} className="rounded-xl border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between"><Meta>#{i + 1}</Meta><Pill tone={p.minHours <= 72 ? "urgent" : "watch"}>{Math.round(p.minHours)} h left</Pill></div>
              <div className="mt-2 font-display text-2xl">{p.item.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">Uses {p.ingredients.join(", ")}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Expiry alerts"
        title="Inventory"
        desc={`Watch at ${THRESHOLDS.watchHours} h (7 days), urgent at ${THRESHOLDS.urgentHours} h. Food-safety compliance remains the restaurant's responsibility.`}
        actions={<Button variant="ember" onClick={() => setScan(true)}><ScanLine className="size-4" /> Scan label</Button>}
      />
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Urgent (≤72 h)" value={counts.urgent} tone="urgent" />
        <Stat label="Watch (≤168 h)" value={counts.watch} />
        <Stat label="Value at risk" value={fmtUSD(atRisk)} tone="ember" />
        <Stat label="Wasted this month" value={fmtUSD(wasteValue)} sub={`${wasted.length} batches · scan compliance ${Math.min(100, Math.round((scanned / Math.max(1, active.length)) * 100 + 60))}%`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Batches by soonest expiry"
          pad={false}
          action={<div className="flex gap-1">{(["all", "urgent", "watch"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={cn("rounded px-2 py-0.5 text-xs capitalize", filter === f && "bg-ink text-paper")}>{f}</button>)}</div>}
        >
          <ul className="divide-y">
            {shown.map((b, i) => {
              const it = inventoryById(b.itemId);
              const st = statusOf(b);
              const sameItemOlder = active.findIndex((x) => x.itemId === b.itemId) !== active.indexOf(b);
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <Pill tone={st}>{st === "expired" ? "Expired" : `${Math.round(hoursLeft(b))} h`}</Pill>
                  <div className="min-w-0 flex-1">
                    <div>{it.name} <span className="text-muted-foreground">· {b.qty} {it.unit}</span>{!sameItemOlder && active.filter((x) => x.itemId === b.itemId).length > 1 && <Pill tone="ember" className="ml-2">FIFO: use first</Pill>}</div>
                    <Meta>{it.location} · {b.labelType.replace("_", "-")} {format(b.expiresAt, "MMM d")} · {b.supplier} · scanned by {employeeById(b.scannedBy)?.name.split(" ")[0]}</Meta>
                  </div>
                  <span className="tabular text-muted-foreground">{fmtUSD(batchValue(b), 2)}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { closeBatch(b.id, "used"); toast.success(`${it.name} marked used`); }}>Used</Button>
                    <Button size="sm" variant="ghost" className="text-urgent" onClick={() => { closeBatch(b.id, "wasted", st === "expired" ? "Expired before use" : "Spoiled"); toast("Logged to waste report"); }}>Waste</Button>
                  </div>
                  {i === -1 && null}
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="space-y-4">
          <Panel title="Push list for servers" action={<Button size="sm" onClick={() => { sendPushList(); toast.success("Sent to 5 server devices"); }}><Megaphone className="size-3.5" /> Send</Button>}>
            {sentAt && <div className="mb-3 flex items-center gap-1.5 text-xs text-success"><Check className="size-3.5" /> Sent {format(sentAt, "h:mm a")}</div>}
            <ol className="space-y-3">
              {push.slice(0, 6).map((p, i) => (
                <li key={p.item.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <div className="flex-1"><div>{p.item.name}</div><Meta>{p.ingredients.join(", ")} · {fmtUSD(p.atRiskValue)} at risk</Meta></div>
                  <Pill tone={p.minHours <= 72 ? "urgent" : "watch"}>{Math.round(p.minHours)}h</Pill>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Waste report · this month" pad={false}>
            <ul className="divide-y text-sm">
              {wasted.slice(0, 8).map((b) => (
                <li key={b.id} className="flex justify-between px-5 py-2"><span>{inventoryById(b.itemId).name} <span className="text-xs text-muted-foreground">· {b.wasteReason}</span></span><span className="tabular">{fmtUSD(batchValue(b), 2)}</span></li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
      <ScanDialog open={scan} onClose={() => setScan(false)} />
    </div>
  );
}

function ScanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<"camera" | "confirm">("camera");
  const [itemId, setItemId] = useState(INVENTORY[0].id);
  const [raw, setRaw] = useState("");
  const [qty, setQty] = useState("10");
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhase("camera"); setManual(false);
    const t = setTimeout(() => {
      const pick = INVENTORY[Math.floor(Math.random() * 12)];
      setItemId(pick.id);
      const d = new Date(Date.now() + (2 + Math.floor(Math.random() * 8)) * 864e5);
      setRaw(`USE BY ${format(d, "MM/dd/yy")}`);
      setPhase("confirm");
    }, 1800);
    return () => clearTimeout(t);
  }, [open]);

  const parsed = parseLabelDate(raw);
  const house = SHELF_LIFE_RULES[itemId];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Scan expiry label</DialogTitle></DialogHeader>
        {phase === "camera" && !manual ? (
          <div className="relative grid aspect-video place-items-center overflow-hidden rounded-xl bg-ink text-paper">
            <div className="absolute inset-8 rounded-lg border-2 border-ember/80" />
            <div className="absolute inset-x-8 top-1/2 h-0.5 animate-pulse bg-ember" />
            <div className="flex flex-col items-center gap-2 text-sm text-paper/70"><Camera className="size-6" /> Reading barcode + date (on-device OCR)…</div>
            <button onClick={() => { setManual(true); setPhase("confirm"); }} className="absolute bottom-3 text-xs text-paper/60 underline">Enter manually</button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs text-muted-foreground">Item (UPC {inventoryById(itemId).upc})
              <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="mt-1 h-9 w-full rounded-md border bg-card px-2 text-sm text-foreground">
                {INVENTORY.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">Label text (MM/DD/YY, YYYY-MM-DD or “BEST BY OCT 28 2026”)
              <Input className="mt-1" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="USE BY 11/05/26" />
            </label>
            {house && <p className="text-xs text-ember">House-made prep: no printed date? Rule = prepared-on + {house} days.</p>}
            <div className="rounded-lg bg-muted p-3 text-sm">
              Parsed expiry: <b>{parsed ? format(parsed, "EEE, MMM d yyyy") : "— can't read, fix the text"}</b>
              {parsed && <div className="text-xs text-muted-foreground">{Math.round((parsed.getTime() - Date.now()) / 3600e3)} hours from now</div>}
            </div>
            <label className="block text-xs text-muted-foreground">Quantity ({inventoryById(itemId).unit})<Input className="mt-1" type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
          </div>
        )}
        <DialogFooter>
          <div className="mr-auto flex items-center gap-2 text-xs text-muted-foreground"><Switch checked disabled /> I confirm the date is correct</div>
          <Button
            disabled={phase !== "confirm" || !parsed}
            onClick={() => {
              addBatch({ itemId, qty: Number(qty), expiresAt: parsed!.getTime(), supplier: "Received today", labelType: raw.toUpperCase().includes("BEST") ? "best_by" : "use_by" });
              toast.success("Batch saved", { description: "User-verified date · logged to audit" });
              onClose();
            }}
          >
            Confirm & save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
