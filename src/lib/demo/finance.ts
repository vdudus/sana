/** Monthly reporting engine. Integer cents, explicit inputs, no estimated financial values. */
export const FINANCE_VERSION = "monthly-v1.0";
export const FINANCE_TENANT = "tnt_8f2c1a";
export const FINANCE_MONTHS = ["2026-10", "2026-09"];
export type Source = "QuickBooks" | "Square";
export type Category = "revenue" | "food_sales" | "food_cogs" | "beverage_cogs" | "wages" | "payroll_tax" | "overhead" | "excluded";
export const CATEGORIES: Category[] = ["revenue", "food_sales", "food_cogs", "beverage_cogs", "wages", "payroll_tax", "overhead", "excluded"];
export interface FinanceRecord { tenant: string; source: Source; id: string; month: string; account: string; cents: number }
export interface FinanceConnection { status: "disconnected" | "connected" | "revoked"; refreshedAt: number | null; months: string[] }
export interface FinanceState {
  month: string;
  basis: "accrual";
  connections: Record<Source, FinanceConnection>;
  records: FinanceRecord[];
  mappings: Record<string, Category | "unmapped">;
  confirmed: boolean;
  notes: Record<string, string>;
  actions: { id: string; month: string; text: string; done: boolean }[];
}
export const DEFAULT_MAPPINGS: FinanceState["mappings"] = {
  "Food sales": "food_sales", "Beverage sales": "revenue", "Food COGS": "food_cogs",
  "Beverage COGS": "beverage_cogs", "Wages": "wages", "Payroll taxes": "payroll_tax",
  "Rent": "overhead", "Utilities": "overhead", "Processing fees": "overhead", "Other operating expenses": "overhead",
};
export function seedFinance(): FinanceState {
  return { month: "2026-10", basis: "accrual", connections: { QuickBooks: { status: "disconnected", refreshedAt: null, months: [] }, Square: { status: "disconnected", refreshedAt: null, months: [] } }, records: [], mappings: { ...DEFAULT_MAPPINGS }, confirmed: false, notes: {}, actions: [] };
}
export function sampleFinanceRecords(source: Source): FinanceRecord[] {
  // Literal synthetic source summaries; COGS is booked COGS, never inferred from purchases or menu prices.
  const amounts: Record<string, [number, number]> = source === "QuickBooks" ? {
    "Food sales": [10000000, 9600000], "Beverage sales": [3000000, 2900000],
    "Food COGS": [2900000, 2600000], "Beverage COGS": [600000, 570000],
    "Wages": [3500000, 3400000], "Payroll taxes": [350000, 340000],
    "Rent": [950000, 950000], "Utilities": [220000, 210000],
    "Processing fees": [330000, 320000], "Other operating expenses": [550000, 500000],
  } : {
    "Gross sales": [13500000, 12900000], "Discounts": [-300000, -250000],
    "Refunds": [-150000, -100000], "Timing adjustment": [-50000, -50000],
    "Sales tax": [1076625, 1035375], "Tips": [1800000, 1750000],
  };
  return Object.entries(amounts).flatMap(([account, values]) => FINANCE_MONTHS.map((month, i) => ({ tenant: FINANCE_TENANT, source, id: `${source === "QuickBooks" ? "qbo" : "sq"}-${month}-${account.replaceAll(" ", "-").toLowerCase()}`, month, account, cents: values[i] })));
}
export interface QualityIssue { code: "missing" | "stale" | "duplicate" | "unmapped" | "conflict" | "mapping"; message: string; source?: Source }
export interface FinanceMetric { key: string; name: string; definition: string; formula: string; value: number | null; prior: number | null; sourceIds: string[]; status: "verified" | "unavailable"; warnings: string[] }
export interface FinanceReport {
  month: string; priorMonth: string; timezone: string; basis: string; version: string; mappingVersion: string;
  refreshedAt: number | null; generatedAt: number; issues: QualityIssue[]; metrics: FinanceMetric[];
  records: FinanceRecord[]; reconciliation: { rows: { name: string; cents: number | null }[]; difference: number | null; status: string };
  narrative: string[];
}
const sum = (rows: FinanceRecord[]) => rows.reduce((total, row) => total + row.cents, 0);
const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
export function buildFinanceReport(state: FinanceState, now = Date.now()): FinanceReport {
  const month = state.month;
  const [year, mon] = month.split("-").map(Number);
  const priorMonth = `${mon === 1 ? year - 1 : year}-${String(mon === 1 ? 12 : mon - 1).padStart(2, "0")}`;
  const records = state.records.filter((row) => row.tenant === FINANCE_TENANT && row.month === month);
  const issues: QualityIssue[] = [];
  for (const source of ["QuickBooks", "Square"] as Source[]) {
    const connection = state.connections[source];
    if (connection.status !== "connected" || !connection.months.includes(month) || !records.some((r) => r.source === source)) issues.push({ code: "missing", source, message: `${source}: reporting-period coverage missing or access revoked.` });
    if (connection.refreshedAt !== null && now - connection.refreshedAt > 7 * 864e5) issues.push({ code: "stale", source, message: `${source}: last refresh is older than 7 days.` });
  }
  if (!state.confirmed) issues.push({ code: "mapping", source: "QuickBooks", message: "Confirm accounting categories before generating verified metrics." });
  const seen = new Map<string, FinanceRecord>();
  for (const record of records) {
    const key = `${record.source}:${record.id}`;
    const previous = seen.get(key);
    if (previous) issues.push({ code: previous.cents === record.cents && previous.account === record.account ? "duplicate" : "conflict", source: record.source, message: `${record.source}: repeated source ID ${record.id}${previous.cents !== record.cents ? " has conflicting amounts" : ""}.` });
    seen.set(key, record);
    if (record.source === "QuickBooks" && (!state.mappings[record.account] || state.mappings[record.account] === "unmapped")) issues.push({ code: "unmapped", source: record.source, message: `Unmapped account: ${record.account}.` });
  }
  const blocked = (source: Source) => issues.some((issue) => issue.source === source);
  function inputs(period: string, categories: Category[]) {
    return state.records.filter((r) => r.tenant === FINANCE_TENANT && r.month === period && r.source === "QuickBooks" && categories.includes(state.mappings[r.account] as Category));
  }
  function metric(key: string, name: string, definition: string, formula: string, groups: Category[][], operation: (values: number[]) => number): FinanceMetric {
    const rows = groups.map((categories) => inputs(month, categories));
    const missing = groups.filter((_, i) => rows[i].length === 0);
    const warnings = issues.filter((i) => i.source === "QuickBooks").map((i) => i.message);
    missing.forEach((group) => warnings.push(`Missing input: ${group.join(" / ")}.`));
    const valid = !blocked("QuickBooks") && missing.length === 0;
    const priorRows = groups.map((categories) => inputs(priorMonth, categories));
    const priorAll = state.records.filter((r) => r.tenant === FINANCE_TENANT && r.month === priorMonth && r.source === "QuickBooks");
    const priorIds = priorAll.map((r) => r.id);
    const priorValid = valid && state.connections.QuickBooks.months.includes(priorMonth) && priorRows.every((r) => r.length > 0) && new Set(priorIds).size === priorIds.length && priorAll.every((r) => state.mappings[r.account] && state.mappings[r.account] !== "unmapped");
    return { key, name, definition, formula, value: valid ? operation(rows.map(sum)) : null, prior: priorValid ? operation(priorRows.map(sum)) : null, sourceIds: [...new Set(rows.flat().map((r) => r.id))], status: valid ? "verified" : "unavailable", warnings };
  }
  const metrics = [
    metric("revenue", "Revenue", "Recognized food and beverage sales; excludes taxes and tips.", "Food sales + beverage sales", [["food_sales"], ["revenue"]], ([food, beverage]) => food + beverage),
    metric("cogs", "COGS", "Booked food and beverage cost of goods sold; purchases alone are not COGS.", "Food COGS + beverage COGS", [["food_cogs"], ["beverage_cogs"]], ([a, b]) => a + b),
    metric("labor", "Labor cost", "Booked wages and employer payroll taxes, including owner compensation when booked as wages.", "Wages + payroll taxes", [["wages"], ["payroll_tax"]], ([a, b]) => a + b),
    metric("prime", "Prime cost", "Combined booked COGS and labor costs for the same period.", "Food COGS + beverage COGS + wages + payroll taxes", [["food_cogs"], ["beverage_cogs"], ["wages"], ["payroll_tax"]], (values) => values.reduce((a, b) => a + b, 0)),
    metric("overhead", "Operating expenses", "Mapped non-labor operating expenses, including rent and processing fees.", "Sum of mapped overhead accounts", [["overhead"]], ([v]) => v),
    metric("net", "Net profit", "Mapped accounting net income, not cash balance or owner take-home pay.", "Revenue − COGS − labor − operating expenses", [["food_sales"], ["revenue"], ["food_cogs"], ["beverage_cogs"], ["wages"], ["payroll_tax"], ["overhead"]], ([sales, drinks, food, bev, wages, tax, overhead]) => sales + drinks - food - bev - wages - tax - overhead),
    metric("food_pct", "Food cost %", "Food COGS as a percentage of consistently defined food sales.", "Food COGS ÷ food sales × 100", [["food_cogs"], ["food_sales"]], ([cost, sales]) => sales > 0 ? cost / sales * 100 : NaN),
  ];
  for (const metric of metrics) if (metric.value !== null && !Number.isFinite(metric.value)) { metric.value = null; metric.status = "unavailable"; metric.warnings.push("Food sales denominator must be greater than zero."); }
  for (const metric of metrics) if (metric.prior !== null && !Number.isFinite(metric.prior)) metric.prior = null;
  const square = records.filter((r) => r.source === "Square");
  const squareValue = (account: string) => !blocked("Square") && square.some((r) => r.account === account) ? sum(square.filter((r) => r.account === account)) : null;
  const reconciliationRows = ["Gross sales", "Discounts", "Refunds", "Timing adjustment"].map((name) => ({ name, cents: squareValue(name) }));
  const squareNet = reconciliationRows.every((r) => r.cents !== null) ? reconciliationRows.reduce((total, r) => total + (r.cents ?? 0), 0) : null;
  const qboRevenue = metrics[0].value;
  const difference = squareNet !== null && qboRevenue !== null ? squareNet - qboRevenue : null;
  const narrative = metrics.filter((m) => m.value !== null && m.prior !== null && m.key !== "food_pct").map((m) => `${m.name} [${m.key}] was ${usd(m.value ?? 0)}, ${usd(Math.abs((m.value ?? 0) - (m.prior ?? 0)))} ${(m.value ?? 0) >= (m.prior ?? 0) ? "higher" : "lower"} than ${priorMonth}.`);
  if (metrics.some((m) => m.value === null)) narrative.push("Incomplete metrics are withheld. Resolve the listed input and quality warnings before drawing conclusions.");
  narrative.push("Changes describe association, not causation. Review booked food costs, payroll and timing with your bookkeeper.");
  const refreshes = Object.values(state.connections).map((c) => c.refreshedAt).filter((v): v is number => v !== null);
  return { month, priorMonth, timezone: "America/Chicago", basis: "Accrual · booked accounting P&L", version: FINANCE_VERSION, mappingVersion: JSON.stringify(Object.entries(state.mappings).sort()), refreshedAt: refreshes.length ? Math.min(...refreshes) : null, generatedAt: now, issues, metrics, records, reconciliation: { rows: [...reconciliationRows, { name: "Square net, adjusted", cents: squareNet }, { name: "QuickBooks revenue", cents: qboRevenue }, { name: "Difference", cents: difference }, { name: "Sales tax (excluded)", cents: squareValue("Sales tax") }, { name: "Tips (excluded)", cents: squareValue("Tips") }], difference, status: difference === null ? "Unavailable" : difference === 0 ? "Reconciled" : "Difference needs review" }, narrative };
}

/** Supported pilot CSV: one monthly account summary per source ID. No guessed columns. */
export function parseFinanceCsv(text: string, source: Source): FinanceRecord[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines[0] !== "id,month,account,amount") throw new Error("Expected CSV header: id,month,account,amount");
  if (lines.length < 2 || lines.length > 1001) throw new Error("Provide 1–1,000 monthly account-summary rows.");
  return lines.slice(1).map((line, index) => {
    const cells = line.split(",");
    const [id, month, account, amount] = cells;
    if (cells.length !== 4 || !id || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !account?.trim() || !/^-?\d+(\.\d{1,2})?$/.test(amount)) throw new Error(`Invalid CSV row ${index + 2}. Use unquoted fields and decimal dollar amounts.`);
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isSafeInteger(cents)) throw new Error(`Amount out of range at row ${index + 2}.`);
    return { tenant: FINANCE_TENANT, source, id, month, account: account.trim(), cents };
  });
}
export function financeSampleCsv(source: Source): string {
  return "id,month,account,amount\n" + sampleFinanceRecords(source).map((r) => `${r.id},${r.month},${r.account},${(r.cents / 100).toFixed(2)}`).join("\n");
}