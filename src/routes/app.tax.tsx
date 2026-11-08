import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, Check, Download, FileText, Printer, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Forbidden } from "@/components/app/Forbidden";
import { PageHeader, Panel, Pill, Stat, Meta } from "@/components/app/kit";
import { useSession } from "@/components/app/useSession";
import { bookTaxDifferences, buildLedger, DISCLAIMER, form1120S, form941, pnl, RULES_VERSION, suggestions, TAX_REFUSAL_PATTERNS } from "@/lib/demo/tax";
import { fmtUSD, fmtPct } from "@/lib/demo/analytics";
import { RESTAURANT } from "@/lib/demo/data";
import { batchValue } from "@/lib/demo/inventory";
import { audit, setState, useDemo, type TaxStage } from "@/lib/demo/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/tax")({ head: () => pageHead("Tax & books", "Review bookkeeping and tax drafts in SANA."), component: Tax });

const STAGES: { key: TaxStage; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "owner_review", label: "Owner review" },
  { key: "cpa_review", label: "CPA review" },
  { key: "signed_off", label: "Signed off · export" },
];

function Tax() {
  const { can } = useSession();
  const tax = useDemo((s) => s.tax);
  const closed = useDemo((s) => s.closed);
  const l = useMemo(() => buildLedger(), []);
  const gaap = useMemo(() => pnl(l, "gaap"), [l]);
  const tb = useMemo(() => pnl(l, "tax"), [l]);
  const waste = closed.filter((b) => b.status === "wasted").reduce((s, b) => s + batchValue(b), 0) * 12;
  const sugg = useMemo(() => suggestions(l, waste), [l, waste]);
  const [cpa, setCpa] = useState("");
  const [q, setQ] = useState("");
  const [reply, setReply] = useState<{ refused: boolean; text: string } | null>(null);
  if (!can("tax.view")) return <Forbidden perm="tax.view" />;

  const stageIdx = STAGES.findIndex((s) => s.key === tax.stage);
  const advance = (stage: TaxStage, patch: Partial<typeof tax> = {}) => {
    setState((s) => ({ ...s, tax: { ...s.tax, stage, ...patch } }));
    audit("tax.workflow", `→ ${stage}${patch.cpaName ? ` by ${patch.cpaName}` : ""}`);
  };

  function exportPackage() {
    if (tax.stage !== "signed_off") return;
    const pkg = { tenant: RESTAURANT.name, entity: RESTAURANT.entity, method: RESTAURANT.method, taxYear: l.year, rulesVersion: RULES_VERSION, disclaimer: DISCLAIMER, cpaSignOff: { name: tax.cpaName, at: tax.signedAt }, form1120S: form1120S(l), form941: form941(l), salesTax: { state: "TX", collected: l.salesTaxCollected }, suggestions: sugg };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" }));
    a.download = `tax-package-${l.year}.json`;
    a.click();
    audit("tax.export", `Exported TY${l.year} package`);
  }

  function askTax() {
    if (!q.trim()) return;
    if (TAX_REFUSAL_PATTERNS.test(q)) {
      setReply({ refused: true, text: "I can't help with that. Under-reporting income or tips is tax evasion (IRC §7201). I can show legal options like the §45B FICA tip credit instead. This request was logged." });
      audit("tax.refusal", `Refused: “${q.slice(0, 60)}”`);
    } else {
      setReply({ refused: false, text: `Based on deterministic figures for TY${l.year}: ordinary business income is ${fmtUSD(tb.net)} (tax basis) vs ${fmtUSD(gaap.net)} (GAAP). The biggest lever is the §45B FICA tip credit (~${fmtUSD(sugg[0].impact[1])}). Discuss eligibility with your CPA.` });
    }
    setQ("");
  }

  return (
    <div>
      <PageHeader
        eyebrow={`Tax year ${l.year} · ${RESTAURANT.entity}`}
        title="Tax & books"
        desc={RESTAURANT.method}
        actions={<><Button variant="soft" onClick={() => window.print()}><Printer className="size-4" /> Print</Button><Button disabled={tax.stage !== "signed_off"} onClick={exportPackage}><Download className="size-4" /> Export package</Button></>}
      />

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-xs"><AlertTriangle className="size-4 shrink-0 text-warning" /><div>{DISCLAIMER}<div className="mt-1 font-mono text-[10px] opacity-70">{RULES_VERSION}</div></div></div>

      {/* Workflow */}
      <Panel className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {STAGES.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-xs", i < stageIdx && "border-success bg-success-soft text-success", i === stageIdx && "border-ink bg-ink text-paper")}>
                {i < stageIdx ? <Check className="size-3" /> : <span className="font-mono">{i + 1}</span>} {s.label}
              </div>
              {i < STAGES.length - 1 && <span className="h-px w-6 bg-border" />}
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4 text-sm">
          {tax.stage === "draft" && <Button onClick={() => advance("owner_review")}>Start owner review</Button>}
          {tax.stage === "owner_review" && (<>
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={tax.ownerAck} onCheckedChange={(v) => setState((s) => ({ ...s, tax: { ...s.tax, ownerAck: !!v } }))} /> I reviewed the figures and understand this is a draft, not tax advice.</label>
            <Button disabled={!tax.ownerAck} onClick={() => advance("cpa_review")}>Send to CPA</Button>
          </>)}
          {tax.stage === "cpa_review" && (<>
            <Input className="max-w-60" placeholder="CPA name & license #" value={cpa} onChange={(e) => setCpa(e.target.value)} />
            <Button disabled={cpa.length < 3} onClick={() => advance("signed_off", { cpaName: cpa, signedAt: Date.now() })}>Record CPA sign-off</Button>
            <span className="text-xs text-muted-foreground">Demo: in production the CPA signs in with their own account.</span>
          </>)}
          {tax.stage === "signed_off" && <span className="text-success">Signed off by {tax.cpaName} on {tax.signedAt && format(tax.signedAt, "MMM d, yyyy")}. Export unlocked.</span>}
          {tax.stage !== "draft" && <button className="ml-auto text-xs text-muted-foreground underline" onClick={() => advance("draft", { ownerAck: false, cpaName: undefined, signedAt: undefined })}>Reset workflow</button>}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Gross receipts" value={fmtUSD(l.grossReceipts)} />
        <Stat label="Net income · GAAP" value={fmtUSD(gaap.net)} />
        <Stat label="Taxable income · tax basis" value={fmtUSD(tb.net)} tone="ember" />
        <Stat label="Est. savings identified" value={fmtUSD(sugg.reduce((s, x) => s + x.impact[0], 0))} sub="Low end of ranges" tone="success" />
      </div>

      <Tabs defaultValue="savings" className="mt-6">
        <TabsList>
          <TabsTrigger value="savings">Legal savings</TabsTrigger>
          <TabsTrigger value="pnl">P&L · GAAP vs tax</TabsTrigger>
          <TabsTrigger value="forms">Form drafts</TabsTrigger>
          <TabsTrigger value="recon">Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="savings" className="mt-4 space-y-3">
          {sugg.map((s) => (
            <div key={s.id} className="rounded-xl border bg-card p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><h3 className="font-medium">{s.title}</h3><Pill tone={s.status === "eligible" ? "ok" : s.status === "applied" ? "ember" : "watch"}>{s.status.replace("_", " ")}</Pill></div>
                  <Meta>{s.ref} · {s.form} · source: {s.source}</Meta>
                </div>
                <div className="text-right"><div className="tabular text-lg">{fmtUSD(s.impact[0])}–{fmtUSD(s.impact[1])}</div><Meta>estimated impact</Meta></div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{s.what}</p>
              <div className="mt-3 grid gap-3 text-xs md:grid-cols-2">
                <ul className="space-y-1">{s.conditions.map((c) => <li key={c} className="flex gap-1.5"><Check className="mt-0.5 size-3 text-success" />{c}</li>)}</ul>
                <div className="rounded-lg bg-muted p-2.5"><b>Risk: {s.risk}.</b> {s.riskNote}</div>
              </div>
            </div>
          ))}
          <Panel title="Ask about your taxes">
            <div className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && askTax()} placeholder="e.g. What's my biggest deduction? (try: how do I not report cash tips)" /><Button onClick={askTax}>Ask</Button></div>
            {reply && <div className={cn("mt-3 flex gap-2 rounded-lg p-3 text-sm", reply.refused ? "bg-urgent-soft" : "bg-muted")}>{reply.refused ? <ShieldAlert className="size-4 shrink-0 text-urgent" /> : <FileText className="size-4 shrink-0" />}{reply.text}</div>}
          </Panel>
        </TabsContent>

        <TabsContent value="pnl" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Profit & loss" pad={false}>
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-4 py-2 text-left font-medium">Account</th><th className="px-4 py-2 text-right font-medium">GAAP</th><th className="px-4 py-2 text-right font-medium">Tax basis</th></tr></thead>
              <tbody>
                <Row k="Revenue" a={gaap.revenue} b={tb.revenue} bold />
                <Row k="Cost of goods sold" a={gaap.cogs} b={tb.cogs} />
                <Row k={`Gross profit (${fmtPct(gaap.gross / gaap.revenue)})`} a={gaap.gross} b={tb.gross} bold />
                {gaap.opex.map(([k, v], i) => <Row key={k} k={k} a={v} b={tb.opex[i][1]} />)}
                <Row k="Net income" a={gaap.net} b={tb.net} bold />
              </tbody>
            </table>
          </Panel>
          <Panel title="Book–tax differences (Schedule M-1)" pad={false}>
            <ul className="divide-y text-sm">
              {bookTaxDifferences(l).map((d) => (
                <li key={d.item} className="px-5 py-3">
                  <div className="font-medium">{d.item}</div>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><div>GAAP: {d.gaap}</div><div>Tax: {d.tax}</div></div>
                  {d.effect !== 0 && <Meta>effect on taxable income: {d.effect > 0 ? "−" : "+"}{fmtUSD(Math.abs(d.effect))}</Meta>}
                </li>
              ))}
            </ul>
          </Panel>
        </TabsContent>

        <TabsContent value="forms" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title={<span>Form 1120-S <Pill className="ml-2">DRAFT</Pill></span>} pad={false}>
            <table className="w-full text-sm"><tbody>
              {form1120S(l).map(([ln, k, v]) => <tr key={ln} className="border-t first:border-0"><td className="w-12 px-4 py-2 font-mono text-xs text-muted-foreground">{ln}</td><td className="py-2">{k}</td><td className="px-4 py-2 text-right tabular">{fmtUSD(v)}</td></tr>)}
            </tbody></table>
          </Panel>
          <div className="space-y-4">
            <Panel title="Form 941 · quarterly payroll" pad={false}>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground"><tr>{["Qtr", "Wages", "Tips", "FICA", "Fed. w/h"].map((h) => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}</tr></thead>
                <tbody>{form941(l).map((r) => <tr key={r.quarter} className="border-t"><td className="px-4 py-2">{r.quarter}</td><td className="px-4 py-2 tabular">{fmtUSD(r.wages)}</td><td className="px-4 py-2 tabular">{fmtUSD(r.tips)}</td><td className="px-4 py-2 tabular">{fmtUSD(r.fica)}</td><td className="px-4 py-2 tabular">{fmtUSD(r.withholding)}</td></tr>)}</tbody>
              </table>
            </Panel>
            <Panel title="Other drafts">
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between"><span>Form 8027 · tip income (large food establishment)</span><Pill tone="watch">Check: &gt;10 employees</Pill></li>
                <li className="flex justify-between"><span>W-2 data · 9 employees</span><Pill tone="ok">Ready</Pill></li>
                <li className="flex justify-between"><span>Texas sales tax · collected {fmtUSD(l.salesTaxCollected)}</span><Pill tone="ok">8.25%</Pill></li>
                <li className="flex justify-between"><span>Form 4562 · §179 combi oven</span><Pill tone="ember">Applied</Pill></li>
              </ul>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="recon" className="mt-4">
          <Panel title="POS totals vs bank deposits vs 1099-K · tolerance 0.5%" pad={false}>
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Month", "POS (incl. tax)", "Expected deposit", "Bank deposits", "Variance", "1099-K", ""].map((h) => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {l.monthly.map((m) => {
                  const exp = m.pos * 0.973;
                  const v = (m.deposits - exp) / exp;
                  const bad = Math.abs(v) > 0.005;
                  const kBad = m.k1099 > m.pos * 0.82;
                  return (
                    <tr key={m.month} className="border-t">
                      <td className="px-4 py-2">{m.month}</td>
                      <td className="px-4 py-2 tabular">{fmtUSD(m.pos)}</td>
                      <td className="px-4 py-2 tabular">{fmtUSD(exp)}</td>
                      <td className="px-4 py-2 tabular">{fmtUSD(m.deposits)}</td>
                      <td className={cn("px-4 py-2 tabular", bad && "text-urgent")}>{(v * 100).toFixed(2)}%</td>
                      <td className="px-4 py-2 tabular">{fmtUSD(m.k1099)}</td>
                      <td className="px-4 py-2">{bad ? <Pill tone="urgent">Missing deposit?</Pill> : kBad ? <Pill tone="watch">1099-K &gt; card sales</Pill> : <Pill tone="ok">Matched</Pill>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ k, a, b, bold }: { k: string; a: number; b: number; bold?: boolean }) {
  return (
    <tr className={cn("border-t", bold && "font-medium")}>
      <td className="px-4 py-2">{k}</td>
      <td className="px-4 py-2 text-right tabular">{fmtUSD(a)}</td>
      <td className={cn("px-4 py-2 text-right tabular", Math.round(a) !== Math.round(b) && "text-ember")}>{fmtUSD(b)}</td>
    </tr>
  );
}
