import { beforeEach, describe, expect, it } from "vitest";
import { buildFinanceReport, parseFinanceCsv, sampleFinanceRecords, seedFinance, type FinanceState } from "@/lib/demo/finance";
import { disconnectFinance, importFinance, signIn, updateFinance } from "@/lib/demo/actions";
import { getState, resetDemo } from "@/lib/demo/store";

function ready(): FinanceState {
  const state = seedFinance();
  state.records = [...sampleFinanceRecords("QuickBooks"), ...sampleFinanceRecords("Square")];
  state.confirmed = true;
  for (const source of ["QuickBooks", "Square"] as const) state.connections[source] = { status: "connected", refreshedAt: Date.now(), months: ["2026-10", "2026-09"] };
  return state;
}
const value = (state: FinanceState, key: string) => buildFinanceReport(state).metrics.find((m) => m.key === key)?.value;
describe("monthly financial integrity", () => {
  it("calculates booked revenue without double counting POS sales", () => expect(value(ready(), "revenue")).toBe(13000000));
  it("calculates COGS from booked food and beverage costs", () => expect(value(ready(), "cogs")).toBe(3500000));
  it("calculates labor from wages and payroll taxes, not sales", () => expect(value(ready(), "labor")).toBe(3850000));
  it("defines prime cost as COGS plus labor", () => expect(value(ready(), "prime")).toBe(7350000));
  it("subtracts all mapped costs for accounting net profit", () => expect(value(ready(), "net")).toBe(3600000));
  it("divides food COGS by food sales, not all revenue", () => expect(value(ready(), "food_pct")).toBeCloseTo(29));
  it("withholds COGS, prime and net when food COGS is missing", () => {
    const state = ready(); state.records = state.records.filter((r) => r.account !== "Food COGS");
    for (const key of ["cogs", "prime", "net"]) expect(value(state, key)).toBeNull();
    expect(value(state, "revenue")).toBe(13000000);
  });
  it("preserves a verified zero expense", () => {
    const state = ready(); state.records = state.records.map((r) => r.account === "Food COGS" ? { ...r, cents: 0 } : r);
    expect(value(state, "food_pct")).toBe(0);
  });
  it("withholds a ratio with a zero denominator", () => {
    const state = ready(); state.records = state.records.map((r) => r.account === "Food sales" ? { ...r, cents: 0 } : r);
    expect(value(state, "food_pct")).toBeNull();
  });
  it("flags duplicate source IDs instead of adding them", () => {
    const state = ready(); const row = state.records[0]; state.records.push({ ...row });
    expect(buildFinanceReport(state).issues.some((i) => i.code === "duplicate")).toBe(true);
    expect(value(state, "revenue")).toBeNull();
  });
  it("flags conflicting amounts for a source ID", () => {
    const state = ready(); state.records.push({ ...state.records[0], cents: 1 });
    expect(buildFinanceReport(state).issues.some((i) => i.code === "conflict")).toBe(true);
  });
  it("withholds unmapped accounting data", () => {
    const state = ready(); state.mappings.Rent = "unmapped";
    expect(value(state, "net")).toBeNull();
  });
  it("requires owner-confirmed mapping", () => {
    const state = ready(); state.confirmed = false;
    expect(value(state, "revenue")).toBeNull();
  });
  it("withholds snapshots older than seven days", () => {
    const state = ready(); state.connections.QuickBooks.refreshedAt = Date.now() - 8 * 864e5;
    expect(value(state, "net")).toBeNull();
  });
  it("reconciles refunds discounts and timing while excluding tax and tips", () => {
    const report = buildFinanceReport(ready());
    expect(report.reconciliation.difference).toBe(0);
    expect(report.reconciliation.rows.find((r) => r.name === "Square net, adjusted")?.cents).toBe(13000000);
  });
  it("shows unresolved differences without modifying accounting revenue", () => {
    const state = ready(); state.records = state.records.map((r) => r.source === "Square" && r.account === "Refunds" ? { ...r, cents: -200000 } : r);
    expect(buildFinanceReport(state).reconciliation.difference).toBe(-50000);
    expect(value(state, "revenue")).toBe(13000000);
  });
  it("does not substitute missing previous-month figures", () => {
    const state = ready(); state.records = state.records.filter((r) => r.month !== "2026-09");
    expect(buildFinanceReport(state).metrics.find((m) => m.key === "net")?.prior).toBeNull();
  });
  it("isolates source rows by tenant and month", () => {
    const state = ready(); state.records.push({ ...state.records[0], tenant: "another-restaurant", cents: 99999999 });
    expect(value(state, "revenue")).toBe(13000000);
  });
  it("attaches evidence and explicit period/basis/version to computed metrics", () => {
    const report = buildFinanceReport(ready());
    expect(report.timezone).toBe("America/Chicago"); expect(report.month).toBe("2026-10");
    expect(report.version).toBe("monthly-v1.0");
    expect(report.metrics[0].sourceIds).toEqual(["qbo-2026-10-food-sales", "qbo-2026-10-beverage-sales"]);
  });
  it("validates monthly CSV and preserves decimal cents", () => {
    expect(parseFinanceCsv("id,month,account,amount\na,2026-10,Rent,9500.01", "QuickBooks")[0].cents).toBe(950001);
    expect(() => parseFinanceCsv("id,month,account,amount\na,2026-13,Rent,1", "QuickBooks")).toThrow();
  });
});
describe("owner finance actions", () => {
  beforeEach(() => resetDemo());
  it("restricts finance imports and mapping to the owner", () => {
    signIn("manager", "e_mgr"); expect(() => importFinance("QuickBooks")).toThrow("Forbidden");
    signIn("waiter", "e_w1"); expect(() => updateFinance({ confirmed: true })).toThrow("Forbidden");
  });
  it("replaces source snapshots idempotently", () => {
    signIn("owner", "e_owner"); importFinance("QuickBooks"); importFinance("QuickBooks");
    expect(getState().finance.records).toHaveLength(20);
  });
  it("withholds accounting metrics after revocation", () => {
    signIn("owner", "e_owner"); importFinance("QuickBooks"); importFinance("Square"); updateFinance({ confirmed: true });
    expect(value(getState().finance, "net")).toBe(3600000);
    disconnectFinance("QuickBooks"); expect(value(getState().finance, "net")).toBeNull();
  });
});