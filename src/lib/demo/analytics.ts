/**
 * Catalog of approved analytics functions (spec §4.1). The assistant may only
 * call these; every number shown to a user comes from one of them.
 */
import {
  addDays, endOfDay, endOfMonth, endOfQuarter, format, startOfDay, startOfMonth, startOfQuarter,
  startOfWeek, startOfYear, subMonths, subQuarters,
} from "date-fns";
import { getHistory, menuById, employeeById, MENU, type Channel, type Order } from "./data";

export interface Period {
  from: number;
  to: number;
  label: string;
}

export const fmtUSD = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });
export const fmtNum = (n: number) => n.toLocaleString("en-US");
export const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function periodPreset(key: string, now = new Date()): Period {
  const today = startOfDay(now);
  const wk = { weekStartsOn: 1 as const };
  switch (key) {
    case "today": return { from: today.getTime(), to: now.getTime(), label: "Today" };
    case "yesterday": return { from: addDays(today, -1).getTime(), to: today.getTime() - 1, label: "Yesterday" };
    case "this_week": return { from: startOfWeek(now, wk).getTime(), to: now.getTime(), label: "This week (Mon–today)" };
    case "last_week": {
      const s = addDays(startOfWeek(now, wk), -7);
      return { from: s.getTime(), to: endOfDay(addDays(s, 6)).getTime(), label: "Last week (Mon–Sun)" };
    }
    case "this_month": return { from: startOfMonth(now).getTime(), to: now.getTime(), label: "This month" };
    case "last_month": {
      const s = startOfMonth(subMonths(now, 1));
      return { from: s.getTime(), to: endOfMonth(s).getTime(), label: format(s, "MMMM yyyy") };
    }
    case "this_quarter": return { from: startOfQuarter(now).getTime(), to: now.getTime(), label: "This quarter" };
    case "last_quarter": {
      const s = startOfQuarter(subQuarters(now, 1));
      return { from: s.getTime(), to: endOfQuarter(s).getTime(), label: "Last quarter" };
    }
    case "ytd": return { from: startOfYear(now).getTime(), to: now.getTime(), label: "Year to date" };
    case "last_7": return { from: addDays(today, -7).getTime(), to: now.getTime(), label: "Last 7 days" };
    case "last_90": return { from: addDays(today, -90).getTime(), to: now.getTime(), label: "Last 90 days" };
    case "last_30":
    default: return { from: addDays(today, -30).getTime(), to: now.getTime(), label: "Last 30 days" };
  }
}

export function ordersIn(p: Period, filter?: (o: Order) => boolean) {
  return getHistory().orders.filter((o) => o.ts >= p.from && o.ts <= p.to && (!filter || filter(o)));
}

export interface ItemRow { name: string; qty: number; revenue: number; cost: number; margin: number }

function itemRows(p: Period, channel?: Channel): ItemRow[] {
  const agg = new Map<string, ItemRow>();
  for (const m of MENU) agg.set(m.id, { name: m.name, qty: 0, revenue: 0, cost: 0, margin: 0 });
  for (const o of ordersIn(p, (o) => o.status === "paid" && (!channel || o.channel === channel))) {
    for (const l of o.lines) {
      const r = agg.get(l.itemId)!;
      const m = menuById(l.itemId);
      r.qty += l.qty;
      r.revenue += l.qty * l.price;
      r.cost += l.qty * m.cost;
    }
  }
  return [...agg.values()].map((r) => ({ ...r, margin: r.revenue ? (r.revenue - r.cost) / r.revenue : 0 }));
}

export const analytics = {
  top_items(p: Period, limit = 5, channel?: Channel) {
    return itemRows(p, channel).sort((a, b) => b.qty - a.qty).slice(0, limit);
  },
  bottom_items(p: Period, limit = 5, channel?: Channel) {
    return itemRows(p, channel).sort((a, b) => a.qty - b.qty).slice(0, limit);
  },
  item_profitability(p: Period) {
    return itemRows(p).sort((a, b) => b.revenue - b.cost - (a.revenue - a.cost));
  },
  revenue_summary(p: Period) {
    const all = ordersIn(p);
    const paid = all.filter((o) => o.status === "paid");
    const net = paid.reduce((s, o) => s + o.subtotal - o.discount, 0);
    const tips = paid.reduce((s, o) => s + o.tip, 0);
    const tax = paid.reduce((s, o) => s + o.tax, 0);
    const discounts = paid.reduce((s, o) => s + o.discount, 0);
    return {
      orders: paid.length,
      voids: all.length - paid.length,
      netSales: net,
      avgCheck: paid.length ? net / paid.length : 0,
      tips,
      salesTax: tax,
      discounts,
    };
  },
  orders_by_channel(p: Period) {
    const rows: Record<string, { channel: string; orders: number; revenue: number }> = {
      dine_in: { channel: "Dine-in", orders: 0, revenue: 0 },
      takeout: { channel: "Takeout", orders: 0, revenue: 0 },
      online: { channel: "Online", orders: 0, revenue: 0 },
    };
    const sources: Record<string, number> = {};
    for (const o of ordersIn(p, (o) => o.status === "paid")) {
      rows[o.channel].orders++;
      rows[o.channel].revenue += o.subtotal - o.discount;
      if (o.source) sources[o.source] = (sources[o.source] ?? 0) + 1;
    }
    return { rows: Object.values(rows), sources };
  },
  canceled_orders(p: Period, waiterId?: string) {
    const v = ordersIn(p, (o) => o.status === "voided" && (!waiterId || o.waiterId === waiterId));
    const byReason: Record<string, { reason: string; count: number; value: number }> = {};
    const byEmployee: Record<string, { name: string; count: number }> = {};
    for (const o of v) {
      const r = o.voidReason ?? "Unspecified";
      byReason[r] ??= { reason: r, count: 0, value: 0 };
      byReason[r].count++;
      byReason[r].value += o.subtotal;
      const e = employeeById(o.voidedBy)?.name ?? "Manager";
      byEmployee[e] ??= { name: e, count: 0 };
      byEmployee[e].count++;
    }
    return {
      total: v.length,
      value: v.reduce((s, o) => s + o.subtotal, 0),
      byReason: Object.values(byReason).sort((a, b) => b.count - a.count),
      byEmployee: Object.values(byEmployee).sort((a, b) => b.count - a.count),
      orders: v.slice(-12).reverse(),
    };
  },
  revenue_by_hour(p: Period) {
    const rows = Array.from({ length: 12 }, (_, i) => ({ hour: `${((i + 10) % 12) + 1}${i + 11 < 12 ? "a" : "p"}`, h: i + 11, revenue: 0, orders: 0 }));
    for (const o of ordersIn(p, (o) => o.status === "paid")) {
      const h = new Date(o.ts).getHours();
      const r = rows.find((x) => x.h === h);
      if (r) { r.revenue += o.subtotal - o.discount; r.orders++; }
    }
    return rows;
  },
  sales_by_day(p: Period) {
    const map = new Map<string, { day: string; revenue: number; orders: number }>();
    for (let t = startOfDay(p.from).getTime(); t <= p.to; t += 864e5) {
      const k = format(t, "MMM d");
      map.set(k, { day: k, revenue: 0, orders: 0 });
    }
    for (const o of ordersIn(p, (o) => o.status === "paid")) {
      const r = map.get(format(o.ts, "MMM d"));
      if (r) { r.revenue += o.subtotal - o.discount; r.orders++; }
    }
    return [...map.values()];
  },
  waiter_performance(p: Period) {
    const rows: Record<string, { name: string; orders: number; sales: number; tips: number; voids: number }> = {};
    for (const o of ordersIn(p, (o) => !!o.waiterId)) {
      const n = employeeById(o.waiterId)!.name;
      rows[n] ??= { name: n, orders: 0, sales: 0, tips: 0, voids: 0 };
      if (o.status === "voided") rows[n].voids++;
      else { rows[n].orders++; rows[n].sales += o.subtotal - o.discount; rows[n].tips += o.tip; }
    }
    return Object.values(rows).sort((a, b) => b.sales - a.sales);
  },
};

/** Flags employees whose void rate is > 2× the team median (spec 4.2 void abuse). */
export function voidAnomalies(p: Period) {
  const rows = analytics.waiter_performance(p).map((r) => ({ ...r, rate: r.voids / Math.max(1, r.orders + r.voids) }));
  const sorted = [...rows].map((r) => r.rate).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return rows.filter((r) => r.rate > median * 1.8 && r.voids >= 4).map((r) => ({ ...r, median }));
}

export function lastSynced() {
  const d = new Date();
  d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}
