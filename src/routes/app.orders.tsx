import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Send, Trash2, Wifi, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Panel, Pill, Meta, Empty } from "@/components/app/kit";
import { useSession } from "@/components/app/useSession";
import { MENU, menuById, employeeById, RESTAURANT, type VoidReason, type MenuItem } from "@/lib/demo/data";
import { cancelOrder, decideApproval, placeOrder } from "@/lib/demo/actions";
import { useDemo, type LiveLine, type LiveOrder } from "@/lib/demo/store";
import { pushList } from "@/lib/demo/inventory";
import { fmtUSD } from "@/lib/demo/analytics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/orders")({ head: () => pageHead("Orders", "Create tickets and send restaurant orders in SANA."), component: Orders });

const CATS = ["Starters", "Mains", "Pasta", "Desserts", "Drinks"] as const;
const MODS = ["No onion", "Gluten-free", "Extra sauce", "On the side", "Medium rare", "No nuts"];
const REASONS: VoidReason[] = ["Guest changed mind", "Wrong item entered", "Long wait time", "Quality issue", "Out of stock", "Duplicate order"];
const DRAFT_KEY = "mise-ticket-draft";

const STATUS: Record<LiveOrder["status"], { label: string; tone: "neutral" | "watch" | "ok" | "urgent" | "ember" }> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent to kitchen", tone: "neutral" },
  preparing: { label: "Preparing", tone: "watch" },
  ready: { label: "Ready", tone: "ok" },
  served: { label: "Served", tone: "neutral" },
  canceled: { label: "Canceled", tone: "urgent" },
  pending_cancel: { label: "Cancel pending approval", tone: "ember" },
};

function Orders() {
  const { session, can } = useSession();
  const [cat, setCat] = useState<(typeof CATS)[number]>("Mains");
  const [table, setTable] = useState(5);
  const [ticket, setTicket] = useState<LiveLine[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [cancelFor, setCancelFor] = useState<LiveOrder | null>(null);
  const [reason, setReason] = useState<VoidReason>("Guest changed mind");
  const orders = useDemo((s) => s.liveOrders);
  const approvals = useDemo((s) => s.approvals.filter((a) => a.status === "pending"));
  const batches = useDemo((s) => s.batches);
  const push = useMemo(() => new Set(pushList(batches).slice(0, 5).map((p) => p.item.id)), [batches]);

  // offline-safe draft
  useEffect(() => {
    try { const d = localStorage.getItem(DRAFT_KEY); if (d) { const p = JSON.parse(d); setTicket(p.ticket); setTable(p.table); } } catch { /* */ }
    const on = () => setOnline(true), off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  useEffect(() => { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ticket, table })); }, [ticket, table]);

  const mine = orders.filter((o) => session?.role !== "waiter" || o.waiterId === session.userId);
  const active = mine.filter((o) => !["served", "canceled"].includes(o.status));
  const done = mine.filter((o) => ["served", "canceled"].includes(o.status)).slice(0, 8);
  const total = ticket.reduce((s, l) => s + menuById(l.itemId).price * l.qty, 0);

  const add = (m: MenuItem) => setTicket((t) => { const i = t.findIndex((x) => x.itemId === m.id && !x.mods.length && !x.note); if (i >= 0) return t.map((x, j) => (j === i ? { ...x, qty: x.qty + 1 } : x)); return [...t, { itemId: m.id, qty: 1, mods: [] }]; });
  const upd = (i: number, p: Partial<LiveLine>) => setTicket((t) => t.map((x, j) => (j === i ? { ...x, ...p } : x)).filter((x) => x.qty > 0));

  function send() {
    if (!online) { toast.warning("You're offline", { description: "Ticket kept as a draft. It will not be lost." }); return; }
    placeOrder(table, ticket);
    setTicket([]);
    toast.success(`Table ${table} sent to kitchen`, { description: "You'll get a sound + banner when it's ready." });
  }

  function confirmCancel() {
    if (!cancelFor) return;
    const r = cancelOrder(cancelFor.id, reason);
    toast[r === "canceled" ? "success" : "info"](r === "canceled" ? "Order canceled" : "Manager approval requested", {
      description: r === "canceled" ? `Reason: ${reason}` : "The kitchen already started this order.",
    });
    setCancelFor(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow={session?.role === "waiter" ? "Server station" : "Floor"}
        title="Orders"
        desc="Fire orders by table with modifiers and notes. Cancel before the kitchen starts; after that, a manager approves."
        actions={<Pill tone={online ? "ok" : "urgent"}>{online ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}{online ? "Online · POS connected" : "Offline · drafts saved"}</Pill>}
      />

      {can("orders.approve_cancel") && approvals.length > 0 && (
        <Panel title={`Approvals · ${approvals.length}`} className="mb-4 border-ember/40" pad={false}>
          <ul className="divide-y">
            {approvals.map((a) => {
              const o = orders.find((x) => x.id === a.orderId);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className="flex-1">{employeeById(a.requestedBy)?.name} wants to cancel <b>Table {o?.table}</b> — {a.reason}. Kitchen already started.</span>
                  <Button size="sm" variant="outline" onClick={() => decideApproval(a.id, false)}>Deny</Button>
                  <Button size="sm" onClick={() => { decideApproval(a.id, true); toast.success("Void approved and logged"); }}>Approve void</Button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel pad={false} className="min-w-0">
          <div className="flex items-center gap-2 overflow-x-auto border-b px-4 py-3">
            <span className="text-xs text-muted-foreground">Table</span>
            {Array.from({ length: RESTAURANT.tables }, (_, i) => i + 1).map((t) => (
              <button key={t} onClick={() => setTable(t)} className={cn("size-8 shrink-0 rounded-md border text-xs tabular", table === t && "border-ink bg-ink text-paper")}>{t}</button>
            ))}
          </div>
          <div className="flex gap-1 border-b px-4 py-2">
            {CATS.map((c) => <button key={c} onClick={() => setCat(c)} className={cn("rounded-md px-3 py-1.5 text-xs", cat === c ? "bg-muted font-medium" : "text-muted-foreground")}>{c}</button>)}
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
            {MENU.filter((m) => m.category === cat).map((m) => (
              <button key={m.id} onClick={() => add(m)} className="relative rounded-lg border bg-background p-3 text-left transition hover:border-foreground/40 active:scale-[0.98]">
                {push.has(m.id) && <Pill tone="ember" className="absolute right-2 top-2">Push</Pill>}
                <div className="pr-10 text-sm font-medium leading-snug">{m.name}</div>
                <div className="mt-2 text-xs text-muted-foreground tabular">{fmtUSD(m.price, 2)}</div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={`Ticket · Table ${table}`} action={ticket.length > 0 && <button onClick={() => setTicket([])} className="text-xs text-muted-foreground">Clear</button>}>
          {ticket.length === 0 ? <Empty>Tap menu items to add them.</Empty> : (
            <ul className="space-y-3">
              {ticket.map((l, i) => (
                <li key={i} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 text-sm">{menuById(l.itemId).name}</div>
                    <button onClick={() => upd(i, { qty: l.qty - 1 })} className="rounded border p-1"><Minus className="size-3" /></button>
                    <span className="w-5 text-center text-sm tabular">{l.qty}</span>
                    <button onClick={() => upd(i, { qty: l.qty + 1 })} className="rounded border p-1"><Plus className="size-3" /></button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {l.mods.map((m) => <button key={m} onClick={() => upd(i, { mods: l.mods.filter((x) => x !== m) })} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">{m}<X className="size-3" /></button>)}
                    <button onClick={() => setEditing(editing === i ? null : i)} className="rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground">+ modifier / note</button>
                  </div>
                  {editing === i && (
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-1">{MODS.filter((m) => !l.mods.includes(m)).map((m) => <button key={m} onClick={() => upd(i, { mods: [...l.mods, m] })} className="rounded-full border px-2 py-0.5 text-[11px]">{m}</button>)}</div>
                      <Input placeholder="Note for kitchen (e.g. allergy)" value={l.note ?? ""} onChange={(e) => upd(i, { note: e.target.value })} className="h-8 text-xs" />
                    </div>
                  )}
                  {l.note && editing !== i && <div className="mt-1 text-[11px] text-muted-foreground">Note: {l.note}</div>}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm">
            <span className="text-muted-foreground">Subtotal</span><span className="tabular font-medium">{fmtUSD(total, 2)}</span>
          </div>
          <Button className="mt-3 w-full" size="lg" variant="ember" disabled={!ticket.length} onClick={send}><Send className="size-4" /> Send to kitchen</Button>
        </Panel>
      </div>

      <Panel title={session?.role === "waiter" ? "My open orders" : "All open orders"} className="mt-4" pad={false}>
        {active.length === 0 ? <div className="p-5"><Empty>No open orders.</Empty></div> : (
          <ul className="divide-y">
            {active.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="w-16 font-medium">Table {o.table}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{o.lines.map((l) => `${l.qty}× ${menuById(l.itemId).name}`).join(", ")}</span>
                {session?.role !== "waiter" && <Meta>{employeeById(o.waiterId)?.name.split(" ")[0]}</Meta>}
                <Pill tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Pill>
                <Meta>{Math.round((Date.now() - o.createdAt) / 60e3)}m</Meta>
                {o.status !== "pending_cancel" && (
                  <Button size="sm" variant="ghost" onClick={() => setCancelFor(o)}><Trash2 className="size-3.5" /> Cancel</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {done.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {done.map((o) => <Pill key={o.id} tone={o.status === "canceled" ? "urgent" : "neutral"}>T{o.table} · {STATUS[o.status].label}{o.cancelReason ? ` · ${o.cancelReason}` : ""}</Pill>)}
        </div>
      )}

      <Dialog open={!!cancelFor} onOpenChange={(v) => !v && setCancelFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel Table {cancelFor?.table}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {cancelFor && ["preparing", "ready"].includes(cancelFor.status) && session?.role === "waiter"
              ? "The kitchen already started this order. Your manager will need to approve the cancellation."
              : "The kitchen hasn't started yet, so this cancels immediately."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {REASONS.map((r) => <button key={r} onClick={() => setReason(r)} className={cn("rounded-lg border px-3 py-2 text-left text-xs", reason === r && "border-ink bg-ink text-paper")}>{r}</button>)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelFor(null)}>Keep order</Button>
            <Button variant="destructive" onClick={confirmCancel}>Confirm cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
