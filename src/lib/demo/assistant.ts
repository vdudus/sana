/**
 * Deterministic assistant orchestrator.
 * Production: an LLM chooses a tool from the approved catalog; tenant + role
 * are injected server-side. Demo: an intent router does the same mapping
 * offline so the demo runs on static hosting. The model never produces numbers.
 */
import { analytics, fmtNum, fmtPct, fmtUSD, lastSynced, periodPreset, voidAnomalies, type Period } from "./analytics";
import type { Channel, Role } from "./data";
import { can } from "./permissions";
import { pushList, statusOf } from "./inventory";
import type { Batch } from "./data";

export type Intent =
  | "top_items" | "bottom_items" | "canceled_orders" | "orders_by_channel" | "revenue_by_hour"
  | "revenue_summary" | "item_profitability" | "waiter_performance" | "expiring_inventory" | "sales_by_day";

export interface AssistantAnswer {
  kind: "answer" | "refusal" | "clarify";
  text: string;
  fn?: Intent;
  period?: Period;
  filters?: string[];
  table?: { columns: string[]; rows: (string | number)[][] };
  chart?: { type: "bar" | "line"; data: Record<string, string | number>[]; x: string; y: string; yLabel: string };
  syncedAt?: Date;
  notes?: string[];
}

export interface Ctx {
  role: Role;
  managerCostAccess: boolean;
  lastIntent?: Intent;
  lastChannel?: Channel;
  batches: Batch[];
}

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

export function detectPeriod(q: string): Period | undefined {
  if (has(q, "yesterday", "вчера")) return periodPreset("yesterday");
  if (has(q, "today", "сегодня", "tonight")) return periodPreset("today");
  if (has(q, "last week", "previous week", "прошлой неделе", "прошлую неделю")) return periodPreset("last_week");
  if (has(q, "this week", "эту неделю", "этой неделе")) return periodPreset("this_week");
  if (has(q, "last month", "previous month", "прошлый месяц", "прошлом месяце")) return periodPreset("last_month");
  if (has(q, "this month", "этот месяц", "этом месяце", "mtd")) return periodPreset("this_month");
  if (has(q, "last quarter", "прошлый квартал")) return periodPreset("last_quarter");
  if (has(q, "quarter", "квартал", "qtd")) return periodPreset("this_quarter");
  if (has(q, "this year", "ytd", "year to date", "этот год")) return periodPreset("ytd");
  if (has(q, "90 days", "3 months", "три месяца")) return periodPreset("last_90");
  if (has(q, "7 days", "week", "недел")) return periodPreset("last_7");
  if (has(q, "30 days", "month", "месяц")) return periodPreset("last_30");
  return undefined;
}

function detectChannel(q: string): Channel | undefined {
  if (has(q, "takeout", "to-go", "to go", "pickup", "навынос", "с собой")) return "takeout";
  if (has(q, "online", "doordash", "uber", "delivery", "онлайн", "доставк")) return "online";
  if (has(q, "dine-in", "dine in", "в зале")) return "dine_in";
  return undefined;
}

export function detectIntent(q: string): Intent | undefined {
  if (has(q, "profit", "margin", "cost", "food cost", "прибыл", "маржа", "себестоим")) return "item_profitability";
  if (has(q, "cancel", "void", "refund", "отмен", "возврат")) return "canceled_orders";
  if (has(q, "expir", "going bad", "spoil", "waste", "inventory", "срок", "испорт", "склад")) return "expiring_inventory";
  if (has(q, "server", "waiter", "staff perf", "официант", "who sold")) return "waiter_performance";
  if (has(q, "hour", "busiest", "peak", "rush", "час", "пик")) return "revenue_by_hour";
  if (has(q, "least", "worst", "slowest", "bottom", "lowest", "меньше всего", "хуже")) return "bottom_items";
  if (has(q, "most", "best", "top", "popular", "больше всего", "лучш", "популяр")) return "top_items";
  if (has(q, "channel", "online", "takeout", "dine", "compare", "delivery", "онлайн", "навынос", "сравн")) return "orders_by_channel";
  if (has(q, "trend", "daily", "per day", "by day", "по дням", "тренд")) return "sales_by_day";
  if (has(q, "revenue", "sales", "how much", "summary", "average check", "выручк", "продаж", "сколько", "средний чек")) return "revenue_summary";
  return undefined;
}

const INJECTION = /(ignore (all|previous)|system prompt|you are now|disregard|jailbreak|show .*other restaurant|all tenants)/i;
const OUT_OF_SCOPE = /(weather|stock market|bitcoin|write (a|me) (poem|essay)|politic|recipe for)/i;

export function answer(raw: string, ctx: Ctx): AssistantAnswer {
  const q = raw.toLowerCase().trim();
  const synced = lastSynced();

  if (!can(ctx.role, "assistant.use")) {
    return { kind: "refusal", text: "The AI assistant is available to owners and managers only. Your role (waiter) can see your own orders, pay and tips." };
  }
  if (INJECTION.test(raw)) {
    return {
      kind: "refusal",
      text: "I can't do that. I only answer questions about Olive & Ember's own data, scoped to your role. Requests to override rules or access other tenants are refused and logged.",
      notes: ["Logged to audit trail as policy.refusal"],
    };
  }
  if (OUT_OF_SCOPE.test(raw)) {
    return { kind: "refusal", text: "That's outside what I can help with. Ask me about sales, menu items, cancellations, order channels, peak hours, staff performance or inventory." };
  }

  let intent = detectIntent(q);
  const period = detectPeriod(q) ?? periodPreset("last_30");
  const channel = detectChannel(q) ?? (intent === undefined ? ctx.lastChannel : undefined);
  // Follow-ups like "and last month?" reuse the previous function.
  if (!intent && detectPeriod(q) && ctx.lastIntent) intent = ctx.lastIntent;
  if (!intent && channel && ctx.lastIntent) intent = ctx.lastIntent;
  if (!intent) {
    return {
      kind: "clarify",
      text: "I'm not sure which report you mean. Try one of: top sellers, least sold items, canceled orders, online vs takeout vs dine-in, busiest hours, or what's expiring soon.",
    };
  }

  const base = { fn: intent, period, syncedAt: synced, filters: [channel ? `channel = ${channel}` : "all channels", "tenant = Olive & Ember"] };

  if (intent === "item_profitability" && !can(ctx.role, "analytics.cost_profit", { managerCostAccess: ctx.managerCostAccess })) {
    return { kind: "refusal", text: "Cost and profit data is restricted to the owner. The owner can grant managers access in Settings → Privacy & access.", fn: intent, notes: ["403 analytics.cost_profit · logged"] };
  }

  switch (intent) {
    case "top_items":
    case "bottom_items": {
      const rows = intent === "top_items" ? analytics.top_items(period, 5, channel) : analytics.bottom_items(period, 5, channel);
      const lead = rows[0];
      return {
        ...base, kind: "answer",
        text: intent === "top_items"
          ? `**${lead.name}** was your best seller — ${fmtNum(lead.qty)} sold for ${fmtUSD(lead.revenue)} in net sales. The top 5 are below.`
          : `**${lead.name}** sold the least — only ${fmtNum(lead.qty)} units (${fmtUSD(lead.revenue)}). Consider a menu refresh or pairing it with a server push.`,
        table: { columns: ["Item", "Qty", "Net sales"], rows: rows.map((r) => [r.name, fmtNum(r.qty), fmtUSD(r.revenue)]) },
        chart: { type: "bar", data: rows.map((r) => ({ name: r.name.split(",")[0], qty: r.qty })), x: "name", y: "qty", yLabel: "Units" },
      };
    }
    case "item_profitability": {
      const rows = analytics.item_profitability(period).slice(0, 8);
      return {
        ...base, kind: "answer",
        text: `Highest gross profit: **${rows[0].name}** at ${fmtUSD(rows[0].revenue - rows[0].cost)} (${fmtPct(rows[0].margin)} margin). Costs use recipe-level plate cost.`,
        table: { columns: ["Item", "Qty", "Revenue", "Plate cost", "Margin"], rows: rows.map((r) => [r.name, fmtNum(r.qty), fmtUSD(r.revenue), fmtUSD(r.cost), fmtPct(r.margin)]) },
      };
    }
    case "canceled_orders": {
      const waiterScope = ctx.role === "waiter";
      const r = analytics.canceled_orders(period);
      const anomalies = voidAnomalies(period);
      return {
        ...base, kind: "answer",
        text: `${fmtNum(r.total)} orders were canceled (${fmtUSD(r.value)} in voided sales). Top reason: **${r.byReason[0]?.reason ?? "—"}**.${anomalies.length ? ` ⚠ ${anomalies[0].name}'s void rate is ${fmtPct(anomalies[0].rate)} vs a team median of ${fmtPct(anomalies[0].median)}.` : ""}`,
        table: { columns: ["Reason", "Count", "Value"], rows: r.byReason.map((x) => [x.reason, x.count, fmtUSD(x.value)]) },
        chart: { type: "bar", data: r.byReason.map((x) => ({ name: x.reason, count: x.count })), x: "name", y: "count", yLabel: "Voids" },
        notes: waiterScope ? ["Scoped to your own orders"] : undefined,
      };
    }
    case "orders_by_channel": {
      const { rows, sources } = analytics.orders_by_channel(period);
      const total = rows.reduce((s, r) => s + r.orders, 0);
      const online = rows.find((r) => r.channel === "Online")!;
      const takeout = rows.find((r) => r.channel === "Takeout")!;
      return {
        ...base, kind: "answer",
        text: `Of ${fmtNum(total)} paid orders, takeout was ${fmtPct(takeout.orders / total)} and online ${fmtPct(online.orders / total)}. Online came from ${Object.entries(sources).map(([k, v]) => `${k} (${v})`).join(", ")}.`,
        table: { columns: ["Channel", "Orders", "Net sales", "Avg check"], rows: rows.map((r) => [r.channel, fmtNum(r.orders), fmtUSD(r.revenue), fmtUSD(r.revenue / Math.max(1, r.orders), 2)]) },
        chart: { type: "bar", data: rows.map((r) => ({ name: r.channel, revenue: Math.round(r.revenue) })), x: "name", y: "revenue", yLabel: "Net sales" },
      };
    }
    case "revenue_by_hour": {
      const rows = analytics.revenue_by_hour(period);
      const peak = [...rows].sort((a, b) => b.revenue - a.revenue)[0];
      return {
        ...base, kind: "answer",
        text: `Your busiest hour is **${peak.hour}** with ${fmtUSD(peak.revenue)} in net sales across ${fmtNum(peak.orders)} orders.`,
        chart: { type: "bar", data: rows.map((r) => ({ name: r.hour, revenue: Math.round(r.revenue) })), x: "name", y: "revenue", yLabel: "Net sales" },
      };
    }
    case "sales_by_day": {
      const rows = analytics.sales_by_day(period);
      return {
        ...base, kind: "answer",
        text: `Daily net sales for ${period.label.toLowerCase()}. Best day: **${[...rows].sort((a, b) => b.revenue - a.revenue)[0]?.day}**.`,
        chart: { type: "line", data: rows.map((r) => ({ name: r.day, revenue: Math.round(r.revenue) })), x: "name", y: "revenue", yLabel: "Net sales" },
      };
    }
    case "revenue_summary": {
      const s = analytics.revenue_summary(period);
      return {
        ...base, kind: "answer",
        text: `Net sales were **${fmtUSD(s.netSales)}** from ${fmtNum(s.orders)} orders — an average check of ${fmtUSD(s.avgCheck, 2)}.`,
        table: {
          columns: ["Metric", "Value"],
          rows: [["Net sales", fmtUSD(s.netSales)], ["Paid orders", fmtNum(s.orders)], ["Average check", fmtUSD(s.avgCheck, 2)], ["Discounts & comps", fmtUSD(s.discounts)], ["Tips", fmtUSD(s.tips)], ["Sales tax collected", fmtUSD(s.salesTax)], ["Canceled orders", fmtNum(s.voids)]],
        },
      };
    }
    case "waiter_performance": {
      const rows = analytics.waiter_performance(period);
      return {
        ...base, kind: "answer",
        text: `**${rows[0].name}** led sales with ${fmtUSD(rows[0].sales)} across ${fmtNum(rows[0].orders)} checks.`,
        table: { columns: ["Server", "Checks", "Sales", "Tips", "Voids"], rows: rows.map((r) => [r.name, r.orders, fmtUSD(r.sales), fmtUSD(r.tips), r.voids]) },
      };
    }
    case "expiring_inventory": {
      const active = ctx.batches.filter((b) => b.status === "active");
      const urgent = active.filter((b) => statusOf(b) === "urgent").length;
      const watch = active.filter((b) => statusOf(b) === "watch").length;
      const push = pushList(ctx.batches).slice(0, 5);
      return {
        ...base, kind: "answer", period: undefined, filters: ["active batches", "window 72–168 h"],
        text: `${urgent} batches are **urgent** (≤72 h) and ${watch} are on **watch** (≤168 h). Push these dishes tonight to use them up:`,
        table: { columns: ["Dish", "Uses expiring", "Hours left", "Score"], rows: push.map((p) => [p.item.name, p.ingredients.join(", "), Math.round(p.minHours), p.score.toFixed(0)]) },
      };
    }
  }
}

export const SUGGESTIONS = [
  "What sold the most last month?",
  "Which items sold the least this week?",
  "How many orders were canceled yesterday and why?",
  "Compare online, takeout and dine-in this quarter",
  "What are our busiest hours?",
  "What's expiring soon and what should we push?",
  "Which dishes make the most profit?",
  "Show net sales for the last 7 days",
];
