import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Check, Download, FileJson, FileText, Link2, Plus, RefreshCw, Unplug, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Forbidden } from "@/components/app/Forbidden";
import { PageHeader, Pill, Stat } from "@/components/app/kit";
import { useSession } from "@/components/app/useSession";
import { useDemo } from "@/lib/demo/store";
import { disconnectFinance, exportFinanceAudit, importFinance, updateFinance } from "@/lib/demo/actions";
import { buildFinanceReport, CATEGORIES, financeSampleCsv, type Category, type FinanceMetric, type Source } from "@/lib/demo/finance";
import { pageHead } from "@/lib/page-head";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/finance")({ head: () => pageHead("Monthly financial report", "Review source-backed monthly profitability, accounting mappings and data-quality checks in SANA."), component: Finance });

const money = (cents: number | null) => cents === null ? "Not available" : (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Finance() {
  const { can } = useSession();
  const state = useDemo((s) => s.finance);
  const report = useMemo(() => buildFinanceReport(state), [state]);
  const [tab, setTab] = useState<"report" | "sources" | "mapping">("sources");
  const [selected, setSelected] = useState("revenue");
  const [uploadSource, setUploadSource] = useState<Source>("QuickBooks");
  const [consent, setConsent] = useState(false);
  const [task, setTask] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const accounts = [...new Set(state.records.filter((r) => r.source === "QuickBooks").map((r) => r.account))];
  const months = [...new Set([state.month, ...Object.values(state.connections).flatMap((c) => c.months)])].sort().reverse();
  const metric = report.metrics.find((m) => m.key === selected) ?? report.metrics[0];
  const sourceRows = report.records.filter((r) => metric.sourceIds.includes(r.id));

  if (!can("finance.owner")) return <Forbidden perm="finance.owner" />;

  function load(source: Source) {
    importFinance(source);
    toast.success(`${source} sample imported`);
  }
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 1024 * 1024) { toast.error("CSV must be smaller than 1 MB."); return; }
    try { importFinance(uploadSource, await file.text()); toast.success(`${uploadSource} CSV imported`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Import failed"); }
    if (fileInput.current) fileInput.current.value = "";
  }
  function exportReport(format: "html" | "json") {
    exportFinanceAudit();
    const payload = { demo: true, ...report, notes: state.notes[state.month] ?? "", actions: state.actions.filter((a) => a.month === state.month) };
    if (format === "json") { download(`sana-monthly-${state.month}.json`, JSON.stringify(payload, null, 2), "application/json"); return; }
    const escape = (value: unknown) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const rows = report.metrics.map((m) => `<tr><td>${escape(m.name)}</td><td>${escape(formatMetric(m))}</td><td>${escape(m.status)}</td></tr>`).join("");
    const evidence = report.metrics.map((m) => `<h3>${escape(m.name)}</h3><p>${escape(m.definition)} Formula: ${escape(m.formula)}.</p><p>Source IDs: ${escape(m.sourceIds.join(", "))}</p><p>${escape(m.warnings.join(" "))}</p>`).join("");
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>SANA monthly report ${escape(state.month)}</title><body><h1>Olive &amp; Ember · ${escape(state.month)}</h1><p>Synthetic demo — not an accounting statement or tax advice.</p><p>${escape(report.basis)} · ${escape(report.timezone)} · ${escape(report.version)} · Refreshed ${escape(report.refreshedAt ? new Date(report.refreshedAt).toISOString() : "never")}</p><table><tr><th>Metric</th><th>Value</th><th>Quality</th></tr>${rows}</table><h2>Operating story</h2>${report.narrative.map((n) => `<p>${escape(n)}</p>`).join("")}<h2>Quality warnings</h2>${report.issues.map((i) => `<p>${escape(i.message)}</p>`).join("")}<h2>Reconciliation</h2><p>${escape(report.reconciliation.status)}</p>${report.reconciliation.rows.map((r) => `<p>${escape(r.name)}: ${escape(money(r.cents))}</p>`).join("")}<h2>Metric evidence</h2>${evidence}<h2>Source summaries</h2>${report.records.map((r) => `<p>${escape(r.source)} · ${escape(r.id)} · ${escape(r.month)} · ${escape(r.account)} · ${escape(money(r.cents))}</p>`).join("")}<h2>Owner notes</h2><p>${escape(payload.notes)}</p><h2>Next-period actions</h2>${payload.actions.map((a) => `<p>${a.done ? "Done" : "Open"}: ${escape(a.text)}</p>`).join("")}<p>Mapping version: ${escape(report.mappingVersion)}</p></body></html>`;
    download(`sana-monthly-${state.month}.html`, html, "text/html");
  }

  return <div className="min-w-0">
    <PageHeader title="Monthly finances" eyebrow="Owner · Olive & Ember" actions={<>
      <label className="text-xs"><span className="sr-only">Reporting month</span><select aria-label="Reporting month" className="h-9 rounded-md border bg-card px-3 text-sm" value={state.month} onChange={(e) => updateFinance({ month: e.target.value })}>{months.map((m) => <option key={m}>{m}</option>)}</select></label>
      <Button variant="outline" onClick={() => exportReport("html")}><FileText /> Report</Button>
      <Button variant="outline" size="icon" title="Download report data" aria-label="Download report data" onClick={() => exportReport("json")}><FileJson /></Button>
    </>} />
    <div className="mb-6 border-l-2 border-warning bg-warning-soft px-4 py-3 text-xs leading-relaxed">Synthetic, browser-only pilot. QuickBooks and Square connections are simulated; no OAuth, cloud security or real account access. CSVs stay on this device. Do not upload private financial data.</div>
    <div className="mb-6 flex gap-2 overflow-x-auto border-b pb-3">{([ ["sources", "Data sources"], ["mapping", "Account mapping"], ["report", "Monthly report"] ] as const).map(([key, label]) => <Button key={key} variant={tab === key ? "default" : "ghost"} onClick={() => setTab(key)}>{label}</Button>)}</div>

    {tab === "sources" && <section>
      <h2 className="font-display text-2xl">Reporting data</h2>
      <div className="mt-4 max-w-2xl space-y-3 text-sm text-muted-foreground"><p>Read-only source summaries: recognized sales, booked COGS, payroll expenses and operating costs from QuickBooks; sales, refunds, discounts, tax and tips from Square. No accounting write access.</p><p>No external transfer or model training. Imported summaries remain in this browser until reset or deletion in Privacy & access. No server backups are provided.</p><label className="flex items-start gap-2 text-foreground"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 shrink-0 accent-primary" />I understand this is a synthetic local demo and will not provide real account credentials or sensitive data.</label></div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">{(["QuickBooks", "Square"] as Source[]).map((source) => {
        const connection = state.connections[source];
        return <article key={source} className="min-w-0 rounded-lg border bg-card p-5">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><h3 className="font-display text-xl">{source === "QuickBooks" ? "QuickBooks Online" : source}</h3><Pill tone={connection.status === "connected" ? "ok" : "neutral"}>{connection.status === "connected" ? "Local sample ready" : connection.status === "revoked" ? "Revoked (demo)" : "Not loaded"}</Pill></header>
          <dl className="mt-4 space-y-2 text-xs"><div><dt className="text-muted-foreground">Coverage · calendar months, America/Los_Angeles</dt><dd>{connection.months.join(", ") || "No coverage"}</dd></div><div><dt className="text-muted-foreground">Last local refresh</dt><dd>{connection.refreshedAt ? new Date(connection.refreshedAt).toLocaleString() : "Never"}</dd></div><div><dt className="text-muted-foreground">Imported summaries</dt><dd>{state.records.filter((r) => r.source === source).length}</dd></div></dl>
          <div className="mt-5 flex flex-wrap gap-2"><Button disabled={!consent} onClick={() => load(source)} variant="ember">{connection.status === "connected" ? <RefreshCw /> : <Link2 />}{connection.status === "connected" ? "Refresh sample" : "Load sample"}</Button><Button disabled={!consent} variant="outline" onClick={() => { setUploadSource(source); fileInput.current?.click(); }}><Upload /> CSV</Button><Button variant="ghost" size="icon" title={`Download ${source} CSV template`} aria-label={`Download ${source} CSV template`} onClick={() => download(`${source.toLowerCase()}-sample.csv`, financeSampleCsv(source), "text/csv")}><Download /></Button>{connection.status === "connected" && <Button variant="ghost" size="icon" title={`Revoke ${source} demo access`} aria-label={`Revoke ${source} demo access`} onClick={() => disconnectFinance(source)}><Unplug /></Button>}</div>
        </article>;
      })}</div>
      <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" aria-label="Upload source CSV" onChange={(e) => { void upload(e.target.files?.[0]); }} />
      <p className="mt-4 text-xs text-muted-foreground">Supported pilot CSV: id,month,account,amount; monthly summaries in USD, unquoted fields. Each import replaces that source’s snapshot; repeated IDs are flagged, never summed silently.</p>
      <Button className="mt-6" variant="citrus" disabled={!accounts.length} onClick={() => setTab("mapping")}>Review account mapping</Button>
    </section>}

    {tab === "mapping" && <section>
      <h2 className="font-display text-2xl">Accounting categories</h2>
      <p className="mt-2 text-sm text-muted-foreground">Accrual basis · full calendar month · USD · America/Los_Angeles. QuickBooks is authoritative for the P&amp;L; Square is reconciled, never added to accounting revenue. COGS must already be booked using your agreed inventory method.</p>
      <div className="mt-5 divide-y border-y">{accounts.map((account) => <div key={account} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_240px] sm:items-center"><span className="min-w-0 text-sm">{account}</span><select aria-label={`Category for ${account}`} className="h-9 min-w-0 rounded-md border bg-card px-2 text-sm" value={state.mappings[account] ?? "unmapped"} onChange={(e) => updateFinance({ mappings: { ...state.mappings, [account]: e.target.value as Category | "unmapped" }, confirmed: false })}><option value="unmapped">Unmapped — needs review</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}</select></div>)}{!accounts.length && <p className="py-5 text-sm text-muted-foreground">No accounting summaries imported.</p>}</div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><Button disabled={!accounts.length || accounts.some((a) => !state.mappings[a] || state.mappings[a] === "unmapped")} onClick={() => { updateFinance({ confirmed: true }); setTab("report"); }} variant="ember"><Check /> Confirm mapping & review</Button>{state.confirmed && <Pill tone="ok">Mapping confirmed</Pill>}</div>
    </section>}

    {tab === "report" && <section>
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"><span>{state.month} · full calendar month</span><span>{report.basis}</span><span>{report.timezone}</span><span>{report.version}</span><span>Refreshed {report.refreshedAt ? new Date(report.refreshedAt).toLocaleString() : "never"}</span></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{report.metrics.filter((m) => ["revenue", "cogs", "labor", "prime", "net", "food_pct"].includes(m.key)).map((m) => <Stat key={m.key} label={m.name} value={<span className={m.value === null ? "text-lg text-muted-foreground" : ""}>{formatMetric(m)}</span>} sub={<span>{m.status === "verified" ? "Verified source summaries" : "Required inputs need attention"}</span>} tone={m.key === "net" && m.value !== null ? (m.value >= 0 ? "success" : "urgent") : undefined} />)}</div>
      <section className="mt-8 border-y py-5"><h2 className="font-display text-xl">Data quality <Pill tone={report.issues.length ? "watch" : "ok"}>{report.issues.length ? `${report.issues.length} issues` : "Checks passed"}</Pill></h2>{report.issues.length ? <ul className="mt-3 space-y-2 text-sm">{report.issues.map((i, n) => <li key={`${i.code}-${n}`}><span className="font-mono text-xs text-warning">{i.code.toUpperCase()}</span> · {i.message}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No missing coverage, stale snapshots, repeated IDs or unmapped accounts detected.</p>}<p className="mt-3 text-xs text-muted-foreground">Quality checks apply to imported summaries, not an audit of the original books. No missing numbers are estimated. Refreshes older than seven days are withheld.</p></section>
      <section className="mt-8"><h2 className="font-display text-2xl">Monthly P&amp;L</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3 text-left">Metric</th><th className="py-3 text-right">{state.month}</th><th className="py-3 text-right">{report.priorMonth}</th><th className="py-3 text-right">Change</th></tr></thead><tbody>{report.metrics.map((m) => <tr key={m.key} className="border-b"><td className="py-3"><Button variant="link" className="h-auto p-0" onClick={() => setSelected(m.key)}>{m.name}</Button></td><td className="py-3 text-right tabular">{formatMetric(m)}</td><td className="py-3 text-right tabular">{m.prior === null ? "Not available" : formatMetric({ ...m, value: m.prior })}</td><td className="py-3 text-right tabular">{m.value === null || m.prior === null ? "—" : m.key === "food_pct" ? `${(m.value - m.prior).toFixed(2)} pp` : money(m.value - m.prior)}</td></tr>)}</tbody></table></div></section>
      <section className="mt-8 border-b pb-6" aria-label="Metric evidence"><h2 className="font-display text-xl">{metric.name} · source evidence</h2><p className="mt-3 text-sm">{metric.definition}</p><p className="mt-2 font-mono text-xs text-muted-foreground">{metric.formula} · {report.version} · {state.month} · {report.timezone} · {report.basis}</p><p className="mt-2 text-xs text-muted-foreground">Status: {metric.status} · Refresh: {report.refreshedAt ? new Date(report.refreshedAt).toISOString() : "never"}</p>{metric.warnings.map((w) => <p key={w} className="mt-2 text-xs text-warning">{w}</p>)}<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[500px] text-xs"><thead className="border-b text-muted-foreground"><tr><th className="py-2 text-left">Source record ID</th><th className="py-2 text-left">Account</th><th className="py-2 text-right">USD</th></tr></thead><tbody>{sourceRows.map((r, i) => <tr key={`${r.id}-${i}`} className="border-b"><td className="py-2 font-mono">{r.id}</td><td className="py-2">{r.source} · {r.account}</td><td className="py-2 text-right tabular">{money(r.cents)}</td></tr>)}</tbody></table></div><details className="mt-3 text-xs text-muted-foreground"><summary>Confirmed mapping snapshot</summary><pre className="mt-2 whitespace-pre-wrap break-all">{JSON.stringify(state.mappings, null, 2)}</pre></details></section>
      <section className="mt-8"><div className="flex flex-wrap items-center gap-3"><h2 className="font-display text-2xl">Square → books</h2><Pill tone={report.reconciliation.difference === 0 ? "ok" : "watch"}>{report.reconciliation.status}</Pill></div><div className="mt-4 max-w-xl divide-y border-y">{report.reconciliation.rows.map((r) => <div key={r.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.5 text-sm"><span>{r.name}</span><span className="tabular">{money(r.cents)}</span></div>)}</div><p className="mt-3 max-w-2xl text-xs text-muted-foreground">Gross sales less discounts and refunds, adjusted for recognition timing. Tax and tips are excluded from revenue. Processing fees are booked as expenses, not subtracted twice. Differences are not silently corrected; this is not a bank-deposit reconciliation.</p><details className="mt-3 text-xs"><summary>Square source references</summary>{report.records.filter((r) => r.source === "Square").map((r, i) => <p key={`${r.id}-${i}`} className="mt-2 break-words font-mono text-muted-foreground">{r.id} · {r.account} · {money(r.cents)}</p>)}</details></section>
      <section className="mt-8 border-t pt-6"><h2 className="font-display text-2xl">The operating story</h2><div className="mt-4 max-w-3xl space-y-3 text-sm leading-relaxed">{report.narrative.map((n) => <p key={n}>{n}</p>)}</div><p className="mt-3 text-xs text-muted-foreground">Deterministic explanation of verified results · no external language model or unsupported forecasts.</p></section>
      <section className="mt-8 border-t pt-6"><h2 className="font-display text-xl">Owner notes · {state.month}</h2><Textarea aria-label="Owner report notes" className="mt-4 max-w-3xl bg-card" placeholder="Questions for your bookkeeper" value={state.notes[state.month] ?? ""} onChange={(e) => updateFinance({ notes: { ...state.notes, [state.month]: e.target.value } })} /><h3 className="mt-6 text-sm font-medium">Actions for the next reporting period</h3><form className="mt-3 grid max-w-3xl grid-cols-[minmax(0,1fr)_auto] gap-2" onSubmit={(e) => { e.preventDefault(); if (!task.trim()) return; updateFinance({ actions: [...state.actions, { id: crypto.randomUUID(), month: state.month, text: task.trim(), done: false }] }); setTask(""); }}><Input aria-label="New report action" value={task} onChange={(e) => setTask(e.target.value)} placeholder="Follow up on booked food costs" /><Button type="submit" size="icon" title="Add action" aria-label="Add action" disabled={!task.trim()}><Plus /></Button></form><ul className="mt-4 max-w-3xl divide-y">{state.actions.filter((a) => a.month === state.month).map((a) => <li key={a.id} className="flex items-start gap-3 py-3 text-sm"><input aria-label={`Complete ${a.text}`} type="checkbox" checked={a.done} onChange={(e) => updateFinance({ actions: state.actions.map((x) => x.id === a.id ? { ...x, done: e.target.checked } : x) })} className="mt-1 shrink-0 accent-primary" /><span className={cn("min-w-0 break-words", a.done && "text-muted-foreground line-through")}>{a.text}</span></li>)}</ul></section>
    </section>}
  </div>;
}
function formatMetric(metric: FinanceMetric) { return metric.value === null ? "Not available" : metric.key === "food_pct" ? `${metric.value.toFixed(2)}%` : money(metric.value); }