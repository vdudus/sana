import type { Role } from "./data";

/**
 * Central permission matrix (spec §3). In production this is enforced in the
 * API + Postgres RLS on every request; the UI only mirrors it.
 */
export type Permission =
  | "finance.owner"
  | "assistant.use"
  | "analytics.cost_profit"
  | "voids.all"
  | "voids.own"
  | "staff.hours.all"
  | "staff.schedule.edit"
  | "pay.all"
  | "pay.own"
  | "reservations.edit"
  | "reservations.view"
  | "inventory.full"
  | "inventory.pushlist"
  | "orders.place"
  | "orders.cancel"
  | "orders.approve_cancel"
  | "tax.view"
  | "admin.users"
  | "admin.privacy"
  | "audit.view";

const MATRIX: Record<Role, Permission[]> = {
  owner: [
    "finance.owner",
    "assistant.use", "analytics.cost_profit", "voids.all", "voids.own", "staff.hours.all", "staff.schedule.edit",
    "pay.all", "pay.own", "reservations.edit", "reservations.view", "inventory.full", "inventory.pushlist",
    "orders.place", "orders.cancel", "orders.approve_cancel", "tax.view", "admin.users", "admin.privacy", "audit.view",
  ],
  manager: [
    "assistant.use", "voids.all", "voids.own", "staff.hours.all", "staff.schedule.edit", "reservations.edit",
    "reservations.view", "inventory.full", "inventory.pushlist", "orders.place", "orders.cancel", "orders.approve_cancel",
  ],
  waiter: ["voids.own", "pay.own", "reservations.view", "inventory.pushlist", "orders.place", "orders.cancel"],
};

export function can(role: Role, perm: Permission, opts?: { managerCostAccess?: boolean }): boolean {
  if (perm === "analytics.cost_profit" && role === "manager") return !!opts?.managerCostAccess;
  return MATRIX[role].includes(perm);
}

export const PERMISSION_TABLE: { label: string; owner: string; manager: string; waiter: string }[] = [
  { label: "AI assistant & sales analytics", owner: "Full", manager: "Yes (no cost/profit unless enabled)", waiter: "—" },
  { label: "Canceled / voided orders", owner: "All", manager: "All", waiter: "Own only" },
  { label: "Employee hours & schedules", owner: "All", manager: "All", waiter: "Own schedule" },
  { label: "Pay rates & payroll", owner: "All", manager: "—", waiter: "Own pay & tips" },
  { label: "Reservations, events, cleaning", owner: "Full", manager: "Full", waiter: "View only" },
  { label: "Inventory & expiry", owner: "Full", manager: "Full", waiter: "Push list only" },
  { label: "Place / cancel orders", owner: "Yes", manager: "Yes", waiter: "Yes, with rules" },
  { label: "Tax assistant & financials", owner: "Full", manager: "—", waiter: "—" },
  { label: "Users, settings, export / delete", owner: "Full", manager: "—", waiter: "—" },
];
