import { inventoryById, MENU, type Batch, type MenuItem } from "./data";

export const THRESHOLDS = { urgentHours: 72, watchHours: 168 };
export type ExpiryStatus = "expired" | "urgent" | "watch" | "ok";

export const hoursLeft = (b: Batch, now = Date.now()) => (b.expiresAt - now) / 3600e3;

export function statusOf(b: Batch, now = Date.now(), t = THRESHOLDS): ExpiryStatus {
  const h = hoursLeft(b, now);
  if (h <= 0) return "expired";
  if (h <= t.urgentHours) return "urgent";
  if (h <= t.watchHours) return "watch";
  return "ok";
}

/** House-made prep: prepared-on date + shelf-life rule (spec 4.3 edge case). */
export const SHELF_LIFE_RULES: Record<string, number> = { i_pesto: 5, i_tiramisu: 4, i_pasta: 3 };

export function batchValue(b: Batch) {
  return b.qty * inventoryById(b.itemId).unitCost;
}

export interface PushItem {
  item: MenuItem;
  ingredients: string[];
  minHours: number;
  atRiskValue: number;
  score: number;
}

/** Rank menu items that use expiring ingredients (urgent weighted 3×). */
export function pushList(batches: Batch[], now = Date.now()): PushItem[] {
  const atRisk = batches.filter((b) => b.status === "active" && ["urgent", "watch"].includes(statusOf(b, now)));
  const out: PushItem[] = [];
  for (const m of MENU) {
    const hits = atRisk.filter((b) => m.ingredients.includes(b.itemId));
    if (!hits.length) continue;
    const minHours = Math.min(...hits.map((b) => hoursLeft(b, now)));
    const atRiskValue = hits.reduce((s, b) => s + batchValue(b), 0);
    const score = hits.reduce((s, b) => s + (statusOf(b, now) === "urgent" ? 3 : 1) * batchValue(b), 0) + (m.price - m.cost);
    out.push({ item: m, ingredients: [...new Set(hits.map((b) => inventoryById(b.itemId).name))], minHours, atRiskValue, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Parse common label formats: MM/DD/YY, MM/DD/YYYY, YYYY-MM-DD, "BEST BY OCT 28 2026". */
export function parseLabelDate(text: string): Date | null {
  const t = text.trim().toUpperCase();
  let m = t.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(y, Number(m[1]) - 1, Number(m[2]), 23, 59);
    return isNaN(d.getTime()) ? null : d;
  }
  m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  m = t.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.?\s+(\d{1,2}),?\s+(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return new Date(y, months.indexOf(m[1]), Number(m[2]), 23, 59);
  }
  return null;
}
