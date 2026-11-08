/**
 * Client-side demo store (useSyncExternalStore + localStorage).
 * Mirrors what the production API would hold per tenant; every mutation writes
 * an append-only audit entry like the real backend.
 */
import { useRef, useSyncExternalStore } from "react";
import { addDays, startOfDay, startOfWeek } from "date-fns";
import { EMPLOYEES, seedBatches, seedWaste, WAITERS, type Batch, type Role, type VoidReason } from "./data";
import { seedFinance, type FinanceState } from "./finance";

export type LiveStatus = "draft" | "sent" | "preparing" | "ready" | "served" | "canceled" | "pending_cancel";
export interface LiveLine { itemId: string; qty: number; mods: string[]; note?: string }
export interface LiveOrder {
  id: string;
  table: number;
  waiterId: string;
  lines: LiveLine[];
  status: LiveStatus;
  createdAt: number;
  startedAt?: number;
  readyAt?: number;
  acknowledged?: boolean;
  cancelReason?: VoidReason;
  channel: "dine_in" | "takeout";
}
export interface Approval { id: string; orderId: string; requestedBy: string; reason: VoidReason; at: number; status: "pending" | "approved" | "denied" }
export interface Reservation { id: string; name: string; party: number; date: number; table: number; kind: "reservation" | "event"; note?: string; tables?: number[] }
export interface Cleaning { id: string; date: number; area: string; vendor: string; recurring?: string; status: "scheduled" | "done" }
export interface ShiftPlan { id: string; employeeId: string; day: number; start: string; end: string; published: boolean }
export interface SwapRequest { id: string; shiftId: string; from: string; to: string; status: "pending" | "approved" | "denied" }
export interface AuditEntry { id: string; at: number; actor: string; role: Role | "system" | "support"; action: string; detail: string; device: string }
export type TaxStage = "draft" | "owner_review" | "cpa_review" | "signed_off";

export interface DemoState {
  finance: FinanceState;
  session: { role: Role; userId: string } | null;
  liveOrders: LiveOrder[];
  approvals: Approval[];
  batches: Batch[];
  closed: Batch[];
  reservations: Reservation[];
  cleaning: Cleaning[];
  schedule: ShiftPlan[];
  swaps: SwapRequest[];
  audit: AuditEntry[];
  settings: {
    managerCostAccess: boolean;
    benchmarkingOptIn: boolean;
    supportAccessUntil: number | null;
    ownerAlertsEnabled: boolean;
    quietHours: boolean;
    pushListSent: number | null;
  };
  deactivated: string[];
  tax: { stage: TaxStage; ownerAck: boolean; cpaName?: string; signedAt?: number };
  deletionRequestedAt: number | null;
}

const KEY = "mise-demo-v1";
const DEVICE = typeof navigator !== "undefined" ? (/(iPhone|Android)/.test(navigator.userAgent) ? "Mobile" : "Web dashboard") : "Server";

function seed(): DemoState {
  const today = startOfDay(new Date()).getTime();
  const H = 3600e3;
  const D = 864e5;
  const now = Date.now();
  const mon = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 }).getTime();
  const schedule: ShiftPlan[] = [];
  const staff = EMPLOYEES.filter((e) => e.role !== "owner");
  staff.forEach((e, i) => {
    for (let d = 0; d < 7; d++) {
      if ((i + d) % 3 === 0 && e.role !== "manager") continue;
      if (e.role === "manager" && d === 0) continue;
      const lunch = (i + d) % 2 === 0;
      schedule.push({ id: `sp_${e.id}_${d}`, employeeId: e.id, day: mon + d * D, start: lunch ? "10:30" : "16:00", end: lunch ? "16:00" : "23:00", published: false });
    }
  });
  return {
    finance: seedFinance(),
    session: null,
    liveOrders: [
      { id: "lo_9001", table: 4, waiterId: "e_w1", lines: [{ itemId: "m_margherita", qty: 1, mods: [] }, { itemId: "m_spritz", qty: 2, mods: [] }], status: "preparing", createdAt: now - 9 * 60e3, startedAt: now - 6 * 60e3, channel: "dine_in" },
      { id: "lo_9002", table: 7, waiterId: "e_w1", lines: [{ itemId: "m_burrata", qty: 1, mods: [] }], status: "sent", createdAt: now - 2 * 60e3, channel: "dine_in" },
      { id: "lo_9003", table: 11, waiterId: "e_w2", lines: [{ itemId: "m_ribeye", qty: 2, mods: ["Medium rare"] }], status: "preparing", createdAt: now - 14 * 60e3, startedAt: now - 10 * 60e3, channel: "dine_in" },
      { id: "lo_9004", table: 2, waiterId: "e_w3", lines: [{ itemId: "m_pesto", qty: 1, mods: ["No nuts"], note: "Allergy: tree nuts" }], status: "ready", createdAt: now - 18 * 60e3, startedAt: now - 15 * 60e3, readyAt: now - 60e3, channel: "dine_in" },
    ],
    approvals: [
      { id: "ap_1", orderId: "lo_9003", requestedBy: "e_w2", reason: "Long wait time", at: now - 4 * 60e3, status: "pending" },
    ],
    batches: seedBatches(),
    closed: seedWaste(),
    reservations: [
      { id: "rs_1", name: "Patel, 8:00 pm", party: 4, date: today + 20 * H, table: 6, kind: "reservation" },
      { id: "rs_2", name: "Nguyen", party: 2, date: today + 19.5 * H, table: 3, kind: "reservation", note: "Anniversary" },
      { id: "rs_3", name: "Kim", party: 6, date: today + 18.5 * H, table: 12, kind: "reservation" },
      { id: "rs_4", name: "Stripe team offsite", party: 22, date: today + 2 * D + 18 * H, table: 14, tables: [14, 15, 16, 17, 18], kind: "event", note: "Prix-fixe, private back room" },
      { id: "rs_5", name: "Rodriguez birthday", party: 10, date: today + 4 * D + 19 * H, table: 9, tables: [9, 10], kind: "event", note: "Cake at 9pm" },
      { id: "rs_6", name: "Walker", party: 3, date: today + D + 19 * H, table: 5, kind: "reservation" },
    ],
    cleaning: [
      { id: "cl_1", date: today + D + 7 * H, area: "Kitchen hood & ducts", vendor: "Bay Area Hood Pros", status: "scheduled" },
      { id: "cl_2", date: today + 3 * D + 6 * H, area: "Deep clean — dining room", vendor: "In-house closing crew", recurring: "Weekly", status: "scheduled" },
      { id: "cl_3", date: today - 2 * D + 6 * H, area: "Grease trap service", vendor: "NorCal Grease Service", status: "done" },
    ],
    schedule,
    swaps: [{ id: "sw_1", shiftId: schedule.find((s) => s.employeeId === "e_w1")?.id ?? "", from: "e_w1", to: "e_w3", status: "pending" }],
    audit: [
      { id: "au_1", at: now - 3 * D, actor: "Maya Chen", role: "owner", action: "permission.change", detail: "Invited Jordan Reyes as Manager", device: "Web dashboard" },
      { id: "au_2", at: now - D, actor: "System", role: "system", action: "pos.sync", detail: "Toast adapter synced 1,284 records", device: "Server" },
      { id: "au_3", at: now - 5 * H, actor: "Lena Park", role: "system", action: "inventory.scan", detail: "Scanned Burrata · use-by confirmed", device: "Kitchen iPad" },
    ],
    settings: { managerCostAccess: false, benchmarkingOptIn: false, supportAccessUntil: null, ownerAlertsEnabled: true, quietHours: true, pushListSent: null },
    deactivated: [],
    tax: { stage: "draft", ownerAck: false },
    deletionRequestedAt: null,
  };
}

let state: DemoState = seed();
let hydrated = false;
const listeners = new Set<() => void>();

function load() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...seed(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function getState() {
  load();
  return state;
}

export function setState(fn: (s: DemoState) => DemoState) {
  load();
  state = fn(state);
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const serverSnapshot = seed();
/** Selector results are cached per state identity so derived arrays stay referentially stable. */
export function useDemo<T>(sel: (s: DemoState) => T): T {
  const client = useRef<{ s?: DemoState; v?: T }>({});
  const server = useRef<{ s?: DemoState; v?: T }>({});
  const pick = (ref: typeof client, s: DemoState) => {
    if (ref.current.s !== s) ref.current = { s, v: sel(s) };
    return ref.current.v as T;
  };
  return useSyncExternalStore(subscribe, () => pick(client, getState()), () => pick(server, serverSnapshot));
}

export function resetDemo() {
  const session = state.session;
  state = { ...seed(), session };
  persist();
  listeners.forEach((l) => l());
}

export function actorName() {
  const s = getState().session;
  return EMPLOYEES.find((e) => e.id === s?.userId)?.name ?? "Unknown";
}

export function audit(action: string, detail: string) {
  const s = getState().session;
  setState((st) => ({
    ...st,
    audit: [
      { id: `au_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), actor: actorName(), role: (s?.role ?? "system") as AuditEntry["role"], action, detail, device: DEVICE },
      ...st.audit,
    ].slice(0, 500),
  }));
}

export const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const DEFAULT_WAITER = WAITERS[0];
