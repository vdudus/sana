/** Domain actions — the demo equivalent of authorized API endpoints. */
import { menuById, inventoryById, employeeById, type Batch, type Role, type VoidReason } from "./data";
import { can } from "./permissions";
import { audit, getState, setState, uid, type LiveLine, type LiveOrder } from "./store";
import { parseFinanceCsv, sampleFinanceRecords, type FinanceState, type Source } from "./finance";

export class ForbiddenError extends Error {
  status = 403;
}

function require(perm: Parameters<typeof can>[1]) {
  const s = getState();
  if (!s.session || !can(s.session.role, perm, { managerCostAccess: s.settings.managerCostAccess })) {
    audit("authz.denied", `403 on ${perm}`);
    throw new ForbiddenError(`Forbidden: ${perm}`);
  }
  return s.session;
}

export function signIn(role: Role, userId: string) {
  setState((s) => ({ ...s, session: { role, userId } }));
  audit("auth.sign_in", `Signed in as ${role}`);
}
export function signOut() {
  audit("auth.sign_out", "Signed out");
  setState((s) => ({ ...s, session: null }));
}

export function placeOrder(table: number, lines: LiveLine[], channel: "dine_in" | "takeout" = "dine_in") {
  const session = require("orders.place");
  const order: LiveOrder = { id: uid("lo"), table, waiterId: session.userId, lines, status: "sent", createdAt: Date.now(), channel };
  setState((s) => ({ ...s, liveOrders: [order, ...s.liveOrders] }));
  audit("order.create", `Table ${table} · ${lines.map((l) => `${l.qty}× ${menuById(l.itemId).name}`).join(", ")}`);
  return order;
}

/**
 * Cancel rule (spec 4.2): before kitchen start → waiter cancels with reason.
 * After start → manager approval required.
 */
export function cancelOrder(orderId: string, reason: VoidReason): "canceled" | "pending_approval" {
  const session = require("orders.cancel");
  const o = getState().liveOrders.find((x) => x.id === orderId);
  if (!o) throw new Error("Order not found");
  if (session.role === "waiter" && o.waiterId !== session.userId) throw new ForbiddenError("Not your order");
  const started = o.status === "preparing" || o.status === "ready" || o.status === "served";
  if (started && session.role === "waiter") {
    setState((s) => ({
      ...s,
      liveOrders: s.liveOrders.map((x) => (x.id === orderId ? { ...x, status: "pending_cancel", cancelReason: reason } : x)),
      approvals: [{ id: uid("ap"), orderId, requestedBy: session.userId, reason, at: Date.now(), status: "pending" }, ...s.approvals],
    }));
    audit("order.cancel_requested", `Table ${o.table} · ${reason} · kitchen already started`);
    return "pending_approval";
  }
  setState((s) => ({ ...s, liveOrders: s.liveOrders.map((x) => (x.id === orderId ? { ...x, status: "canceled", cancelReason: reason } : x)) }));
  audit("order.void", `Table ${o.table} · ${reason}`);
  return "canceled";
}

export function decideApproval(id: string, approve: boolean) {
  require("orders.approve_cancel");
  const ap = getState().approvals.find((a) => a.id === id);
  if (!ap) return;
  setState((s) => ({
    ...s,
    approvals: s.approvals.map((a) => (a.id === id ? { ...a, status: approve ? "approved" : "denied" } : a)),
    liveOrders: s.liveOrders.map((o) =>
      o.id === ap.orderId ? { ...o, status: approve ? "canceled" : o.readyAt ? "ready" : "preparing", cancelReason: approve ? ap.reason : undefined } : o,
    ),
  }));
  audit(approve ? "order.void_approved" : "order.void_denied", `${employeeById(ap.requestedBy)?.name} · ${ap.reason}`);
}

export function advanceKitchen(orderId: string) {
  const o = getState().liveOrders.find((x) => x.id === orderId);
  if (!o) return;
  const next = o.status === "sent" ? "preparing" : o.status === "preparing" ? "ready" : o.status === "ready" ? "served" : o.status;
  setState((s) => ({
    ...s,
    liveOrders: s.liveOrders.map((x) =>
      x.id === orderId
        ? { ...x, status: next, startedAt: next === "preparing" ? Date.now() : x.startedAt, readyAt: next === "ready" ? Date.now() : x.readyAt, acknowledged: next === "ready" ? false : x.acknowledged }
        : x,
    ),
  }));
  audit("kitchen.status", `Table ${o.table} → ${next}`);
}

export function acknowledgeReady(orderId: string) {
  setState((s) => ({ ...s, liveOrders: s.liveOrders.map((x) => (x.id === orderId ? { ...x, acknowledged: true } : x)) }));
  audit("order.ready_ack", `Acknowledged ready alert`);
}

export function addBatch(b: Omit<Batch, "id" | "status" | "receivedAt" | "scannedBy">) {
  const session = require("inventory.full");
  setState((s) => ({ ...s, batches: [{ ...b, id: uid("bt"), status: "active", receivedAt: Date.now(), scannedBy: session.userId }, ...s.batches] }));
  audit("inventory.scan", `${inventoryById(b.itemId).name} · ${b.qty} · expires ${new Date(b.expiresAt).toLocaleDateString()}`);
}

export function closeBatch(id: string, status: "used" | "discarded" | "wasted", reason?: string) {
  require("inventory.full");
  const b = getState().batches.find((x) => x.id === id);
  if (!b) return;
  setState((s) => ({
    ...s,
    batches: s.batches.filter((x) => x.id !== id),
    closed: [{ ...b, status, wasteReason: reason, closedAt: Date.now() }, ...s.closed],
  }));
  audit(`inventory.${status}`, `${inventoryById(b.itemId).name}${reason ? ` · ${reason}` : ""}`);
}

export function sendPushList() {
  require("inventory.full");
  setState((s) => ({ ...s, settings: { ...s.settings, pushListSent: Date.now() } }));
  audit("inventory.push_list", "Push list sent to waiter devices");
}

export function updateSettings(patch: Partial<ReturnType<typeof getState>["settings"]>) {
  require("admin.privacy");
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  audit("settings.update", Object.entries(patch).map(([k, v]) => `${k}=${String(v)}`).join(", "));
}

export function toggleUser(id: string) {
  require("admin.users");
  const off = getState().deactivated.includes(id);
  setState((s) => ({ ...s, deactivated: off ? s.deactivated.filter((x) => x !== id) : [...s.deactivated, id] }));
  audit("permission.change", `${off ? "Reactivated" : "Deactivated"} ${employeeById(id)?.name} · sessions revoked`);
}

export function updateFinance(patch: Partial<Pick<FinanceState, "month" | "mappings" | "confirmed" | "notes" | "actions">>) {
  require("finance.owner");
  setState((s) => ({ ...s, finance: { ...s.finance, ...patch } }));
  audit("finance.update", `Monthly report configuration: ${Object.keys(patch).join(", ")}`);
}

export function importFinance(source: Source, csv?: string) {
  require("finance.owner");
  const records = csv === undefined ? sampleFinanceRecords(source) : parseFinanceCsv(csv, source);
  setState((s) => ({ ...s, finance: {
    ...s.finance, confirmed: false,
    records: [...s.finance.records.filter((r) => r.source !== source), ...records],
    connections: { ...s.finance.connections, [source]: { status: "connected", refreshedAt: Date.now(), months: [...new Set(records.map((r) => r.month))].sort() } },
  } }));
  audit("finance.import", `${source} · ${records.length} synthetic or local CSV summaries · source snapshot replaced`);
}

export function disconnectFinance(source: Source) {
  require("finance.owner");
  setState((s) => ({ ...s, finance: { ...s.finance, connections: { ...s.finance.connections, [source]: { ...s.finance.connections[source], status: "revoked" } } } }));
  audit("finance.disconnect", `${source} demo access revoked; reports withheld until reimport`);
}

export function exportFinanceAudit() {
  require("finance.owner");
  audit("finance.export", "Downloaded monthly report with source references and quality status");
}
