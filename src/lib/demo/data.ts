/**
 * Deterministic mock POS dataset for the demo tenant.
 * Everything is generated from a fixed seed relative to "today" so numbers are
 * stable across reloads but always look current.
 */
import { addDays, startOfDay } from "date-fns";

export type Role = "owner" | "manager" | "waiter";
export type Channel = "dine_in" | "takeout" | "online";
export type OnlineSource = "Website" | "DoorDash" | "Uber Eats";
export type VoidReason =
  | "Guest changed mind"
  | "Wrong item entered"
  | "Long wait time"
  | "Quality issue"
  | "Out of stock"
  | "Duplicate order";

export interface MenuItem {
  id: string;
  name: string;
  category: "Starters" | "Mains" | "Pasta" | "Desserts" | "Drinks";
  price: number;
  cost: number;
  ingredients: string[]; // inventory item ids
  popularity: number;
}

export interface Employee {
  id: string;
  name: string;
  role: Role | "cook" | "host";
  title: string;
  hourlyRate: number;
  pin?: string;
  email?: string;
  initials: string;
}

export interface OrderLine {
  itemId: string;
  qty: number;
  price: number;
  voided?: boolean;
}

export interface Order {
  id: string;
  ts: number;
  channel: Channel;
  source?: OnlineSource;
  waiterId?: string;
  table?: number;
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  status: "paid" | "voided";
  voidReason?: VoidReason;
  voidedBy?: string;
}

export interface Shift {
  id: string;
  employeeId: string;
  start: number;
  end: number;
  tipsCard: number;
  tipsCash: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: "Produce" | "Dairy" | "Meat" | "Seafood" | "Bakery" | "Prep";
  unit: string;
  unitCost: number;
  upc: string;
  location: "Walk-in" | "Reach-in" | "Dry storage" | "Freezer";
}

export interface Batch {
  id: string;
  itemId: string;
  qty: number;
  receivedAt: number;
  expiresAt: number;
  scannedBy: string;
  supplier: string;
  status: "active" | "used" | "discarded" | "wasted";
  labelType: "use_by" | "best_by" | "prepared_on";
  wasteReason?: string;
  closedAt?: number;
}

export const RESTAURANT = {
  id: "tnt_8f2c1a",
  name: "Olive & Ember",
  location: "Austin, TX",
  timezone: "America/Chicago",
  entity: "S-Corporation (Form 1120-S)",
  method: "Cash method (IRC §448(c) small business)",
  ein: "84-•••••92",
  state: "TX",
  salesTaxRate: 0.0825,
  tables: 18,
};

export const EMPLOYEES: Employee[] = [
  { id: "e_owner", name: "Maya Chen", role: "owner", title: "Owner", hourlyRate: 0, email: "maya@oliveandember.com", initials: "MC" },
  { id: "e_mgr", name: "Jordan Reyes", role: "manager", title: "General Manager", hourlyRate: 28, email: "jordan@oliveandember.com", initials: "JR" },
  { id: "e_w1", name: "Sofia Alvarez", role: "waiter", title: "Server", hourlyRate: 8.5, pin: "1234", initials: "SA" },
  { id: "e_w2", name: "Marcus Bell", role: "waiter", title: "Server", hourlyRate: 8.5, pin: "2345", initials: "MB" },
  { id: "e_w3", name: "Priya Nair", role: "waiter", title: "Server", hourlyRate: 9, pin: "3456", initials: "PN" },
  { id: "e_w4", name: "Diego Santos", role: "waiter", title: "Server", hourlyRate: 8.5, pin: "4567", initials: "DS" },
  { id: "e_w5", name: "Aisha Okafor", role: "waiter", title: "Bartender", hourlyRate: 10, pin: "5678", initials: "AO" },
  { id: "e_c1", name: "Tomás Ruiz", role: "cook", title: "Head Chef", hourlyRate: 26, initials: "TR" },
  { id: "e_c2", name: "Lena Park", role: "cook", title: "Line Cook", hourlyRate: 19, initials: "LP" },
  { id: "e_h1", name: "Ethan Moore", role: "host", title: "Host", hourlyRate: 14, initials: "EM" },
];
export const WAITERS = EMPLOYEES.filter((e) => e.role === "waiter");
export const employeeById = (id?: string) => EMPLOYEES.find((e) => e.id === id);

export const INVENTORY: InventoryItem[] = [
  { id: "i_tomato", name: "Heirloom tomatoes", category: "Produce", unit: "lb", unitCost: 3.4, upc: "0 33383 65411 2", location: "Walk-in" },
  { id: "i_basil", name: "Fresh basil", category: "Produce", unit: "bunch", unitCost: 2.1, upc: "0 71430 00912 7", location: "Walk-in" },
  { id: "i_burrata", name: "Burrata", category: "Dairy", unit: "ea", unitCost: 4.8, upc: "0 85002 31107 4", location: "Reach-in" },
  { id: "i_mozz", name: "Fresh mozzarella", category: "Dairy", unit: "lb", unitCost: 6.2, upc: "0 85002 31005 3", location: "Reach-in" },
  { id: "i_cream", name: "Heavy cream", category: "Dairy", unit: "qt", unitCost: 4.1, upc: "0 41900 07612 0", location: "Walk-in" },
  { id: "i_salmon", name: "Atlantic salmon", category: "Seafood", unit: "lb", unitCost: 12.5, upc: "2 04411 00000 6", location: "Walk-in" },
  { id: "i_shrimp", name: "Gulf shrimp 16/20", category: "Seafood", unit: "lb", unitCost: 11.0, upc: "2 04412 00000 3", location: "Freezer" },
  { id: "i_ribeye", name: "Ribeye, prime", category: "Meat", unit: "lb", unitCost: 18.9, upc: "2 05510 00000 1", location: "Walk-in" },
  { id: "i_chicken", name: "Chicken thighs", category: "Meat", unit: "lb", unitCost: 3.9, upc: "2 05520 00000 8", location: "Walk-in" },
  { id: "i_lamb", name: "Lamb shoulder", category: "Meat", unit: "lb", unitCost: 9.6, upc: "2 05530 00000 5", location: "Walk-in" },
  { id: "i_bread", name: "Sourdough loaves", category: "Bakery", unit: "ea", unitCost: 3.2, upc: "0 72250 01121 9", location: "Dry storage" },
  { id: "i_greens", name: "Mixed greens", category: "Produce", unit: "lb", unitCost: 4.5, upc: "0 33383 10210 9", location: "Walk-in" },
  { id: "i_mushroom", name: "Wild mushrooms", category: "Produce", unit: "lb", unitCost: 9.2, upc: "0 33383 44120 1", location: "Walk-in" },
  { id: "i_lemon", name: "Lemons", category: "Produce", unit: "ea", unitCost: 0.45, upc: "0 33383 04053 4", location: "Walk-in" },
  { id: "i_pesto", name: "House pesto", category: "Prep", unit: "qt", unitCost: 7.5, upc: "HOUSE-PESTO", location: "Reach-in" },
  { id: "i_tiramisu", name: "Tiramisu base", category: "Prep", unit: "tray", unitCost: 14, upc: "HOUSE-TIRA", location: "Reach-in" },
  { id: "i_pasta", name: "Fresh tagliatelle", category: "Prep", unit: "lb", unitCost: 3.0, upc: "HOUSE-TAGL", location: "Reach-in" },
  { id: "i_berries", name: "Mixed berries", category: "Produce", unit: "pint", unitCost: 4.2, upc: "0 33383 67001 3", location: "Walk-in" },
];
export const inventoryById = (id: string) => INVENTORY.find((i) => i.id === id)!;

export const MENU: MenuItem[] = [
  { id: "m_burrata", name: "Burrata & Heirloom Tomato", category: "Starters", price: 16, cost: 5.1, ingredients: ["i_burrata", "i_tomato", "i_basil"], popularity: 9 },
  { id: "m_bruschetta", name: "Tomato Bruschetta", category: "Starters", price: 11, cost: 2.6, ingredients: ["i_tomato", "i_basil", "i_bread"], popularity: 7 },
  { id: "m_calamari", name: "Crispy Calamari", category: "Starters", price: 14, cost: 4.0, ingredients: ["i_lemon"], popularity: 6 },
  { id: "m_salad", name: "Market Greens Salad", category: "Starters", price: 12, cost: 3.1, ingredients: ["i_greens", "i_lemon"], popularity: 5 },
  { id: "m_soup", name: "Wild Mushroom Soup", category: "Starters", price: 10, cost: 2.9, ingredients: ["i_mushroom", "i_cream"], popularity: 3 },
  { id: "m_margherita", name: "Margherita Pizza", category: "Mains", price: 18, cost: 4.2, ingredients: ["i_mozz", "i_tomato", "i_basil"], popularity: 10 },
  { id: "m_ribeye", name: "Wood-fired Ribeye", category: "Mains", price: 44, cost: 16.8, ingredients: ["i_ribeye"], popularity: 6 },
  { id: "m_salmon", name: "Seared Salmon, Lemon Butter", category: "Mains", price: 31, cost: 10.4, ingredients: ["i_salmon", "i_lemon", "i_cream"], popularity: 7 },
  { id: "m_chicken", name: "Roast Chicken Thighs", category: "Mains", price: 24, cost: 5.9, ingredients: ["i_chicken", "i_lemon"], popularity: 8 },
  { id: "m_lamb", name: "Braised Lamb Shoulder", category: "Mains", price: 34, cost: 11.2, ingredients: ["i_lamb"], popularity: 3 },
  { id: "m_shrimp", name: "Shrimp Scampi", category: "Mains", price: 28, cost: 8.6, ingredients: ["i_shrimp", "i_lemon", "i_pasta"], popularity: 5 },
  { id: "m_pesto", name: "Tagliatelle al Pesto", category: "Pasta", price: 21, cost: 4.4, ingredients: ["i_pasta", "i_pesto", "i_basil"], popularity: 8 },
  { id: "m_funghi", name: "Tagliatelle ai Funghi", category: "Pasta", price: 23, cost: 6.1, ingredients: ["i_pasta", "i_mushroom", "i_cream"], popularity: 4 },
  { id: "m_carbonara", name: "Carbonara", category: "Pasta", price: 22, cost: 4.9, ingredients: ["i_pasta", "i_cream"], popularity: 7 },
  { id: "m_tiramisu", name: "Tiramisu", category: "Desserts", price: 11, cost: 2.4, ingredients: ["i_tiramisu"], popularity: 6 },
  { id: "m_panna", name: "Panna Cotta, Berries", category: "Desserts", price: 10, cost: 2.6, ingredients: ["i_cream", "i_berries"], popularity: 4 },
  { id: "m_affogato", name: "Affogato", category: "Desserts", price: 8, cost: 1.8, ingredients: [], popularity: 2 },
  { id: "m_spritz", name: "Aperol Spritz", category: "Drinks", price: 13, cost: 2.7, ingredients: [], popularity: 7 },
  { id: "m_negroni", name: "Negroni", category: "Drinks", price: 14, cost: 3.1, ingredients: [], popularity: 5 },
  { id: "m_wine", name: "House Red, glass", category: "Drinks", price: 12, cost: 3.0, ingredients: [], popularity: 8 },
  { id: "m_lemonade", name: "Basil Lemonade", category: "Drinks", price: 6, cost: 0.9, ingredients: ["i_lemon", "i_basil"], popularity: 5 },
  { id: "m_espresso", name: "Espresso", category: "Drinks", price: 4, cost: 0.5, ingredients: [], popularity: 6 },
];
export const menuById = (id: string) => MENU.find((m) => m.id === id)!;

// ---------- RNG ----------
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round2 = (n: number) => Math.round(n * 100) / 100;

function weightedPick<T>(rng: () => number, items: T[], weight: (t: T) => number): T {
  const total = items.reduce((s, i) => s + weight(i), 0);
  let r = rng() * total;
  for (const i of items) {
    r -= weight(i);
    if (r <= 0) return i;
  }
  return items[items.length - 1];
}

const HOUR_WEIGHTS: Record<number, number> = {
  11: 6, 12: 12, 13: 9, 14: 4, 15: 2, 16: 3, 17: 8, 18: 14, 19: 15, 20: 11, 21: 6, 22: 2,
};
const VOID_REASONS: VoidReason[] = [
  "Guest changed mind", "Wrong item entered", "Long wait time", "Quality issue", "Out of stock", "Duplicate order",
];

export const HISTORY_DAYS = 400; // covers last year for tax views

let cache: { key: string; orders: Order[]; shifts: Shift[] } | null = null;

export function getHistory() {
  const today = startOfDay(new Date());
  const key = today.toISOString();
  if (cache?.key === key) return cache;
  const rng = mulberry32(20261101);
  const orders: Order[] = [];
  const shifts: Shift[] = [];
  let seq = 100000;

  for (let d = HISTORY_DAYS; d >= 0; d--) {
    const day = addDays(today, -d);
    const dow = day.getDay();
    const seasonal = 1 + 0.12 * Math.sin((day.getMonth() / 12) * Math.PI * 2);
    const growth = 0.82 + 0.18 * ((HISTORY_DAYS - d) / HISTORY_DAYS);
    const base = dow === 5 || dow === 6 ? 140 : dow === 1 ? 70 : 98;
    // today: only orders up to now
    const n = Math.round(base * seasonal * growth * (0.9 + rng() * 0.2));
    const nowH = new Date().getHours() + new Date().getMinutes() / 60;

    for (let k = 0; k < n; k++) {
      const hour = Number(weightedPick(rng, Object.keys(HOUR_WEIGHTS), (h) => HOUR_WEIGHTS[Number(h)]));
      const minute = Math.floor(rng() * 60);
      if (d === 0 && hour + minute / 60 > nowH) continue;
      const ts = day.getTime() + hour * 3600e3 + minute * 60e3;
      const cr = rng();
      const channel: Channel = cr < 0.62 ? "dine_in" : cr < 0.8 ? "takeout" : "online";
      const source: OnlineSource | undefined =
        channel === "online" ? (rng() < 0.4 ? "Website" : rng() < 0.6 ? "DoorDash" : "Uber Eats") : undefined;
      const waiter = channel === "dine_in" ? WAITERS[Math.floor(rng() * WAITERS.length)] : undefined;
      const lineCount = channel === "dine_in" ? 2 + Math.floor(rng() * 4) : 1 + Math.floor(rng() * 3);
      const lines: OrderLine[] = [];
      for (let l = 0; l < lineCount; l++) {
        const item = weightedPick(rng, MENU, (m) => {
          if (channel !== "dine_in" && m.category === "Drinks" && m.id !== "m_lemonade") return 0.3;
          return m.popularity;
        });
        const existing = lines.find((x) => x.itemId === item.id);
        if (existing) existing.qty++;
        else lines.push({ itemId: item.id, qty: 1, price: item.price });
      }
      const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.price, 0));
      const discount = rng() < 0.05 ? round2(subtotal * 0.15) : 0;
      const tax = round2((subtotal - discount) * RESTAURANT.salesTaxRate);
      const tipPct = channel === "dine_in" ? 0.15 + rng() * 0.08 : channel === "takeout" ? rng() * 0.1 : rng() * 0.12;
      const voidChance = channel === "online" ? 0.045 : 0.028;
      const voided = rng() < voidChance;
      const voidReason = voided
        ? (weightedPick(rng, VOID_REASONS, (r) =>
            r === "Long wait time" && channel === "online" ? 5 : r === "Guest changed mind" ? 4 : r === "Wrong item entered" ? 3 : 1.5,
          ) as VoidReason)
        : undefined;
      // Void-abuse pattern for anomaly detection: Diego voids more often recently
      const abuse = waiter?.id === "e_w4" && d < 21 && rng() < 0.05;
      orders.push({
        id: `ord_${seq++}`,
        ts,
        channel,
        source,
        waiterId: waiter?.id,
        table: waiter ? 1 + Math.floor(rng() * RESTAURANT.tables) : undefined,
        lines,
        subtotal,
        discount,
        tax,
        tip: voided || abuse ? 0 : round2((subtotal - discount) * tipPct),
        status: voided || abuse ? "voided" : "paid",
        voidReason: abuse ? "Guest changed mind" : voidReason,
        voidedBy: voided || abuse ? (waiter?.id ?? "e_mgr") : undefined,
      });
    }

    // shifts (time clock) — last 60 days only
    if (d <= 60 && d >= 1) {
      for (const w of WAITERS) {
        if (rng() < (dow === 1 ? 0.45 : 0.68)) {
          const lunch = rng() < 0.4;
          const start = day.getTime() + (lunch ? 10.5 : 16) * 3600e3 + Math.floor(rng() * 4) * 15 * 60e3;
          const len = (lunch ? 5.5 : 6.5) + rng() * 2;
          const dayTips = orders
            .filter((o) => o.waiterId === w.id && o.ts >= day.getTime() && o.ts < day.getTime() + 864e5)
            .reduce((s, o) => s + o.tip, 0);
          shifts.push({
            id: `sh_${w.id}_${d}`,
            employeeId: w.id,
            start,
            end: start + len * 3600e3,
            tipsCard: round2(dayTips * 0.82),
            tipsCash: round2(dayTips * 0.18),
          });
        }
      }
    }
  }
  cache = { key, orders, shifts };
  return cache;
}

/** Seed inventory batches spread across expiry windows (hours from now). */
export function seedBatches(): Batch[] {
  const now = Date.now();
  const H = 3600e3;
  const plan: [string, number, number, Batch["labelType"], string][] = [
    ["i_burrata", 12, 38, "use_by", "Lucky Dairy Co."],
    ["i_salmon", 14, 52, "use_by", "Gulf Coast Seafood"],
    ["i_basil", 8, 61, "best_by", "Hill Country Farms"],
    ["i_pesto", 3, 66, "prepared_on", "In-house"],
    ["i_cream", 6, 96, "use_by", "Lucky Dairy Co."],
    ["i_mushroom", 5, 110, "best_by", "Hill Country Farms"],
    ["i_tomato", 22, 128, "best_by", "Hill Country Farms"],
    ["i_tiramisu", 2, 140, "prepared_on", "In-house"],
    ["i_greens", 9, 158, "best_by", "Hill Country Farms"],
    ["i_mozz", 10, 190, "use_by", "Lucky Dairy Co."],
    ["i_chicken", 30, 210, "use_by", "Texas Poultry"],
    ["i_ribeye", 18, 260, "use_by", "Prime Cuts Austin"],
    ["i_lamb", 12, 30, "use_by", "Prime Cuts Austin"],
    ["i_bread", 14, 44, "best_by", "Easy Tiger Bakery"],
    ["i_berries", 10, 80, "best_by", "Hill Country Farms"],
    ["i_pasta", 8, 150, "prepared_on", "In-house"],
    ["i_lemon", 120, 400, "best_by", "Hill Country Farms"],
    ["i_shrimp", 20, 900, "use_by", "Gulf Coast Seafood"],
    ["i_mozz", 6, 340, "use_by", "Lucky Dairy Co."],
    ["i_cream", 4, 300, "use_by", "Lucky Dairy Co."],
  ];
  const scanners = ["e_c1", "e_c2", "e_mgr"];
  return plan.map(([itemId, qty, hrs, labelType, supplier], idx) => ({
    id: `bt_${1000 + idx}`,
    itemId,
    qty,
    receivedAt: now - (24 + idx * 5) * H,
    expiresAt: now + hrs * H,
    scannedBy: scanners[idx % 3],
    supplier,
    status: "active",
    labelType,
  }));
}

/** Historic waste log for the current month (closed batches). */
export function seedWaste(): Batch[] {
  const now = Date.now();
  const D = 864e5;
  const rows: [string, number, number, string][] = [
    ["i_greens", 6, 2, "Expired before use"],
    ["i_salmon", 3.5, 4, "Expired before use"],
    ["i_berries", 8, 6, "Spoiled / mold"],
    ["i_cream", 3, 9, "Expired before use"],
    ["i_basil", 10, 11, "Wilted"],
    ["i_burrata", 5, 13, "Expired before use"],
    ["i_mushroom", 2.5, 15, "Spoiled / mold"],
    ["i_tomato", 7, 18, "Over-ripe"],
    ["i_bread", 6, 20, "Stale"],
    ["i_pesto", 1.5, 24, "Past house shelf-life"],
  ];
  return rows.map(([itemId, qty, ago, reason], i) => ({
    id: `bw_${i}`,
    itemId,
    qty,
    receivedAt: now - (ago + 6) * D,
    expiresAt: now - ago * D,
    scannedBy: "e_c2",
    supplier: "—",
    status: "wasted",
    labelType: "use_by",
    wasteReason: reason,
    closedAt: now - ago * D,
  }));
}
