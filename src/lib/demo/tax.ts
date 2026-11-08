/**
 * Deterministic tax & accounting engine (spec §4.4).
 * All amounts are computed here; AI only explains. Rules versioned per tax year.
 */
import { endOfYear, startOfYear, subYears, format } from "date-fns";
import { getHistory, menuById, RESTAURANT } from "./data";

export const RULES_VERSION = "TY2025 · rules v2026.1 · reviewed by CPA (demo) on Jan 14, 2026";
export const DISCLAIMER =
  "Draft for review only. Not tax, legal or accounting advice. Figures must be reviewed and signed off by a licensed CPA before filing. Olive & Ember remains responsible for its return.";

export interface Ledger {
  year: number;
  grossReceipts: number;
  refunds: number;
  salesTaxCollected: number;
  tipsReported: number;
  cardSales: number;
  cogsFood: number;
  cogsBeverage: number;
  officerComp: number;
  wages: number;
  payrollTaxes: number;
  rent: number;
  utilities: number;
  cardFees: number;
  supplies: number;
  repairs: number;
  advertising: number;
  insurance: number;
  software: number;
  licenses: number;
  equipment: number; // placed in service this year
  priorDepreciation: number;
  accruedUnpaid: number; // vendor invoices received in Dec, paid in Jan
  giftCardsOutstanding: number;
  monthly: { month: string; pos: number; deposits: number; k1099: number }[];
}

export function buildLedger(year = subYears(new Date(), 1).getFullYear()): Ledger {
  const from = startOfYear(new Date(year, 0, 1)).getTime();
  const to = endOfYear(new Date(year, 0, 1)).getTime();
  const orders = getHistory().orders.filter((o) => o.ts >= from && o.ts <= to);
  const paid = orders.filter((o) => o.status === "paid");
  // Scale: history covers ~400 days, so prior year may be partial — annualize to 12 months.
  const firstTs = getHistory().orders[0].ts;
  const coveredDays = Math.max(1, (to - Math.max(from, firstTs)) / 864e5);
  const k = 365 / coveredDays;
  let gross = 0, food = 0, bev = 0, tax = 0, tips = 0;
  const monthly: Record<string, { pos: number }> = {};
  for (const o of paid) {
    const net = o.subtotal - o.discount;
    gross += net; tax += o.tax; tips += o.tip;
    const m = format(o.ts, "MMM");
    monthly[m] ??= { pos: 0 };
    monthly[m].pos += net + o.tax;
    for (const l of o.lines) {
      const c = menuById(l.itemId).cost * l.qty * 1.07; // 7% waste/yield loss
      if (menuById(l.itemId).category === "Drinks") bev += c; else food += c;
    }
  }
  gross *= k; food *= k; bev *= k; tax *= k; tips *= k;
  const refunds = orders.filter((o) => o.status === "voided").length * 6.5 * k;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const avgMonth = (gross + tax) / 12;
  const monthRows = months.map((m, i) => {
    const pos = monthly[m]?.pos ? monthly[m].pos * k : avgMonth * (0.92 + ((i * 7) % 10) / 60);
    const variance = i === 7 ? -0.018 : i === 10 ? 0.0 : ((i * 13) % 7 - 3) / 1000; // Aug has a gap
    const deposits = pos * 0.973 * (1 + variance); // net of card fees
    return { month: m, pos, deposits, k1099: pos * 0.79 * (i === 3 ? 1.04 : 1) };
  });
  const wages = gross * 0.255;
  return {
    year,
    grossReceipts: gross,
    refunds,
    salesTaxCollected: tax,
    tipsReported: tips,
    cardSales: gross * 0.82,
    cogsFood: food,
    cogsBeverage: bev,
    officerComp: 72000,
    wages,
    payrollTaxes: (wages + 72000) * 0.0765 + tips * 0.0765,
    rent: 9500 * 12,
    utilities: 2150 * 12,
    cardFees: gross * 0.82 * 0.027,
    supplies: gross * 0.016,
    repairs: 7400,
    advertising: 14400,
    insurance: 10200,
    software: 5400,
    licenses: 2850,
    equipment: 24000,
    priorDepreciation: 11800,
    accruedUnpaid: 6820,
    giftCardsOutstanding: 3150,
    monthly: monthRows,
  };
}

export function pnl(l: Ledger, basis: "gaap" | "tax") {
  const revenue = l.grossReceipts - l.refunds - (basis === "gaap" ? l.giftCardsOutstanding * 0 : 0);
  const cogs = l.cogsFood + l.cogsBeverage;
  const depreciation = basis === "gaap" ? l.priorDepreciation + l.equipment / 7 / 2 : l.priorDepreciation + l.equipment; // §179
  const accrual = basis === "gaap" ? l.accruedUnpaid : 0;
  const opex = [
    ["Officer compensation", l.officerComp],
    ["Salaries & wages", l.wages],
    ["Payroll taxes", l.payrollTaxes],
    ["Rent", l.rent],
    ["Utilities", l.utilities],
    ["Credit card processing fees", l.cardFees],
    ["Supplies & smallwares", l.supplies],
    ["Repairs & maintenance", l.repairs],
    ["Advertising & marketing", l.advertising],
    ["Insurance", l.insurance],
    ["Software & POS", l.software],
    ["Licenses & permits", l.licenses],
    ["Depreciation", depreciation],
    ["Accrued vendor invoices (Dec)", accrual],
  ] as [string, number][];
  const totalOpex = opex.reduce((s, [, v]) => s + v, 0);
  return { revenue, cogs, gross: revenue - cogs, opex, totalOpex, net: revenue - cogs - totalOpex, depreciation };
}

export function bookTaxDifferences(l: Ledger) {
  return [
    { item: "Combi oven ($24,000) — depreciation", gaap: "7-yr straight-line, half-year: " + usd(l.equipment / 14), tax: "§179 expensing: " + usd(l.equipment), effect: l.equipment - l.equipment / 14 },
    { item: "December vendor invoices, paid in January", gaap: "Accrued expense: " + usd(l.accruedUnpaid), tax: "Cash method — deducted next year", effect: -l.accruedUnpaid },
    { item: "Gift cards sold, not redeemed", gaap: "Deferred revenue (ASC 606)", tax: "Cash method: income when received (Rev. Proc. 2004-34 deferral may apply)", effect: 0 },
    { item: "Meals with vendors", gaap: "Fully expensed", tax: "50% deductible (§274(n))", effect: -620 },
  ];
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function form1120S(l: Ledger) {
  const p = pnl(l, "tax");
  const lines: [string, string, number][] = [
    ["1a", "Gross receipts or sales", l.grossReceipts],
    ["1b", "Returns and allowances", l.refunds],
    ["1c", "Balance (1a − 1b)", l.grossReceipts - l.refunds],
    ["2", "Cost of goods sold (Form 1125-A)", p.cogs],
    ["3", "Gross profit", p.gross],
    ["7", "Compensation of officers (Form 1125-E)", l.officerComp],
    ["8", "Salaries and wages (less employment credits)", l.wages],
    ["9", "Repairs and maintenance", l.repairs],
    ["11", "Rents", l.rent],
    ["12", "Taxes and licenses", l.payrollTaxes + l.licenses],
    ["14", "Depreciation (Form 4562, incl. §179)", p.depreciation],
    ["16", "Advertising", l.advertising],
    ["19", "Other deductions (statement)", l.utilities + l.cardFees + l.supplies + l.insurance + l.software],
    ["20", "Total deductions", p.totalOpex],
    ["21", "Ordinary business income (loss)", p.net],
  ];
  return lines;
}

export function form941(l: Ledger) {
  return [1, 2, 3, 4].map((q) => {
    const wages = (l.wages + l.officerComp) / 4;
    const tips = l.tipsReported / 4;
    return { quarter: `Q${q}`, wages, tips, fica: (wages + tips) * 0.153, withholding: wages * 0.11 };
  });
}

export interface Suggestion {
  id: string;
  title: string;
  ref: string;
  form: string;
  what: string;
  conditions: string[];
  impact: [number, number];
  risk: "Low" | "Medium";
  riskNote: string;
  status: "eligible" | "needs_info" | "applied";
  source: string;
}

export function suggestions(l: Ledger, wasteValue: number): Suggestion[] {
  const tipCredit = l.tipsReported * 0.0765 * 0.92;
  return [
    {
      id: "45b", title: "FICA tip credit", ref: "IRC §45B", form: "Form 8846", status: "eligible",
      what: "Credit for employer Social Security & Medicare tax paid on tips above the federal minimum wage ($5.15/h for this credit).",
      conditions: ["Food or beverage establishment where tipping is customary", "Tips reported by employees (Form 4070 / POS)", "Cannot also deduct the same FICA amount"],
      impact: [tipCredit * 0.85, tipCredit], risk: "Low", riskNote: "Requires accurate tip reporting; reduces payroll-tax deduction dollar-for-dollar.", source: "POS tips · payroll import",
    },
    {
      id: "179", title: "Section 179 expensing for kitchen equipment", ref: "IRC §179", form: "Form 4562", status: "applied",
      what: "Deduct the full $24,000 combi oven in the year placed in service instead of depreciating over 7 years.",
      conditions: ["Equipment used >50% for business", "Placed in service during the tax year", "Limited to business taxable income"],
      impact: [24000 * 0.21, 24000 * 0.37], risk: "Low", riskNote: "Recapture applies if business use drops to 50% or below. Bonus depreciation is an alternative.", source: "Invoice INV-2207 · Mar 12",
    },
    {
      id: "199a", title: "Qualified business income deduction", ref: "IRC §199A", form: "Form 8995 (owner level)", status: "eligible",
      what: "Owners of pass-through entities may deduct up to 20% of qualified business income.",
      conditions: ["Pass-through entity (S-corp K-1)", "Taxable income thresholds / W-2 wage limits", "Reasonable officer compensation in place"],
      impact: [6000, 14000], risk: "Low", riskNote: "Computed on the owner's personal return; coordinate with CPA.", source: "Form 1120-S line 21",
    },
    {
      id: "170e3", title: "Enhanced deduction for donated food inventory", ref: "IRC §170(e)(3)", form: "Schedule K / Form 8283", status: "needs_info",
      what: "Donating wholesome, soon-to-expire food to qualified charities can earn a deduction up to basis + ½ of markup (max 2× basis). Pairs directly with expiry alerts.",
      conditions: ["Recipient is a 501(c)(3) serving the ill, needy or infants", "Written acknowledgment from the charity", "Food meets FDA standards at donation"],
      impact: [wasteValue * 0.4, wasteValue * 1.2], risk: "Low", riskNote: "Needs donation logs. Mark at-risk batches as 'donated' in Inventory to track.", source: "Inventory waste log",
    },
    {
      id: "deminimis", title: "De minimis safe harbor election", ref: "Treas. Reg. §1.263(a)-1(f)", form: "Election statement with return", status: "eligible",
      what: "Expense smallwares and equipment costing ≤ $2,500 per item/invoice instead of capitalizing.",
      conditions: ["Annual election attached to timely filed return", "Consistent accounting policy"],
      impact: [900, 2400], risk: "Low", riskNote: "Must be elected every year.", source: "AP invoices",
    },
    {
      id: "wotc", title: "Work Opportunity Tax Credit", ref: "IRC §51", form: "Form 5884 (+ Form 8850 within 28 days of hire)", status: "needs_info",
      what: "Credit of up to $2,400 per eligible new hire from targeted groups (e.g., veterans, SNAP recipients, youth).",
      conditions: ["Pre-screening Form 8850 filed with state agency within 28 days of start date", "Employee works ≥120 hours"],
      impact: [0, 4800], risk: "Low", riskNote: "Missed 28-day deadlines cannot be cured.", source: "HR onboarding",
    },
    {
      id: "45e", title: "Small employer retirement plan startup credit", ref: "IRC §45E", form: "Form 8881", status: "needs_info",
      what: "Credit for costs of starting a 401(k)/SIMPLE plan, plus auto-enrollment credit.",
      conditions: ["≤100 employees", "No plan in prior 3 years"],
      impact: [1500, 5000], risk: "Low", riskNote: "Plan setup and admin costs apply.", source: "—",
    },
  ];
}

export const TAX_REFUSAL_PATTERNS = /(hide|not report|unreported|skim|off the books|cash under|avoid reporting|fake|underreport|без отчет|скрыть|в конверт)/i;
