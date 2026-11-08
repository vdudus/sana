import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { Download, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Forbidden } from "@/components/app/Forbidden";
import { PageHeader, Panel, Pill, Meta } from "@/components/app/kit";
import { useSession } from "@/components/app/useSession";
import { EMPLOYEES, getHistory, RESTAURANT } from "@/lib/demo/data";
import { PERMISSION_TABLE } from "@/lib/demo/permissions";
import { toggleUser, updateSettings } from "@/lib/demo/actions";
import { audit, getState, setState, useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/settings")({ head: () => pageHead("Privacy & access", "Review data access and exports in SANA."), component: Settings });

const SUBPROCESSORS = [
  ["Cloud hosting / database", "Production requirement", "Not connected"],
  ["LLM provider", "Production requirement", "No external AI calls"],
  ["Push notification provider", "Production requirement", "Not connected"],
  ["Email provider", "Production requirement", "Not connected"],
];

function Settings() {
  const { can } = useSession();
  const settings = useDemo((s) => s.settings);
  const deactivated = useDemo((s) => s.deactivated);
  const auditLog = useDemo((s) => s.audit);
  const deletion = useDemo((s) => s.deletionRequestedAt);
  const [confirm, setConfirm] = useState("");
  const [filter, setFilter] = useState("");
  if (!can("admin.privacy")) return <Forbidden perm="admin.privacy" />;

  function exportAll(kind: "json" | "csv") {
    const s = getState();
    const h = getHistory();
    const data = { tenant: RESTAURANT, exportedAt: new Date().toISOString(), finance: s.finance, orders: h.orders, shifts: h.shifts, batches: [...s.batches, ...s.closed], reservations: s.reservations, cleaning: s.cleaning, schedule: s.schedule, audit: s.audit };
    const body = kind === "json" ? JSON.stringify(data) : ["id,ts,channel,source,waiter,subtotal,discount,tax,tip,status,void_reason", ...h.orders.map((o) => [o.id, new Date(o.ts).toISOString(), o.channel, o.source ?? "", o.waiterId ?? "", o.subtotal, o.discount, o.tax, o.tip, o.status, o.voidReason ?? ""].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: kind === "json" ? "application/json" : "text/csv" }));
    a.download = `olive-and-ember-export.${kind}`;
    a.click();
    audit("privacy.export", `Full export (${kind.toUpperCase()})`);
  }

  const rows = auditLog.filter((a) => !filter || `${a.action} ${a.detail} ${a.actor}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <PageHeader eyebrow="Owner only" title="Privacy & access" desc="Your data belongs to your restaurant. Never sold, never shared, never used to train AI models." />
      <p className="mb-6 border-l-2 border-warning bg-warning-soft px-4 py-3 text-xs">Static synthetic demo: roles, sign-in and audit events are browser simulations, not security controls. No real MFA, tenant-secure database, KMS, cloud backups or third-party data sharing.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Team & roles" pad={false}>
          <ul className="divide-y text-sm">
            {EMPLOYEES.filter((e) => e.role !== "cook" && e.role !== "host").map((e) => {
              const off = deactivated.includes(e.id);
              return (
                <li key={e.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="grid size-7 place-items-center rounded-full bg-muted text-[10px]">{e.initials}</div>
                  <span className={cn("flex-1", off && "text-muted-foreground line-through")}>{e.name}</span>
                  <Pill>{e.role === "waiter" ? "Server · PIN" : e.role === "owner" ? "Owner · MFA" : "Manager · MFA"}</Pill>
                  {e.role !== "owner" && <Button size="sm" variant="ghost" className={off ? "" : "text-urgent"} onClick={() => { toggleUser(e.id); toast(off ? "Access restored" : "Access revoked instantly — sessions ended"); }}>{off ? "Reactivate" : "Deactivate"}</Button>}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Data controls">
          <div className="space-y-4 text-sm">
            <Toggle label="Managers can see cost & profit" desc="Off by default. Affects AI answers and reports." checked={settings.managerCostAccess} onChange={(v) => updateSettings({ managerCostAccess: v })} />
            <Toggle label="Anonymized benchmarking" desc="Share aggregated, anonymized metrics to see peer comparisons. Default off." checked={settings.benchmarkingOptIn} onChange={(v) => updateSettings({ benchmarkingOptIn: v })} />
            <Toggle label="Urgent inventory alerts to owner" desc="Managers always receive them." checked={settings.ownerAlertsEnabled} onChange={(v) => updateSettings({ ownerAlertsEnabled: v })} />
            <Toggle label="Quiet hours (11pm–7am)" desc="Watch-level digests wait until morning." checked={settings.quietHours} onChange={(v) => updateSettings({ quietHours: v })} />
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div><div className="font-medium">SANA support access</div><div className="text-xs text-muted-foreground">{settings.supportAccessUntil && settings.supportAccessUntil > Date.now() ? `Granted until ${format(settings.supportAccessUntil, "MMM d, h:mm a")} · logged` : "Off. Grant time-limited access only when you ask for help."}</div></div>
              {settings.supportAccessUntil && settings.supportAccessUntil > Date.now()
                ? <Button size="sm" variant="outline" onClick={() => updateSettings({ supportAccessUntil: null })}>Revoke</Button>
                : <Button size="sm" variant="outline" onClick={() => updateSettings({ supportAccessUntil: Date.now() + 4 * 3600e3 })}>Grant 4 h</Button>}
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Export or delete">
          <div className="flex flex-wrap gap-2">
            <Button variant="soft" onClick={() => exportAll("json")}><Download className="size-4" /> Export all (JSON)</Button>
            <Button variant="soft" onClick={() => exportAll("csv")}><Download className="size-4" /> Orders (CSV)</Button>
          </div>
          <div className="mt-6 rounded-lg border border-urgent/30 p-4">
            <div className="flex items-center gap-2 font-medium text-urgent"><Trash2 className="size-4" /> Delete restaurant account</div>
            {deletion ? (
              <p className="mt-2 text-sm">Deletion scheduled. Hard delete by <b>{format(deletion + 30 * 864e5, "MMM d")}</b>, backups purged by <b>{format(deletion + 90 * 864e5, "MMM d")}</b>. <button className="underline" onClick={() => { setState((s) => ({ ...s, deletionRequestedAt: null })); audit("privacy.delete_cancel", "Canceled deletion"); }}>Cancel</button></p>
            ) : (
              <>
                <p className="mt-1 text-xs text-muted-foreground">Payroll records required by law are retained. Type the restaurant name to confirm.</p>
                <div className="mt-3 flex gap-2"><Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={RESTAURANT.name} /><Button variant="destructive" disabled={confirm !== RESTAURANT.name} onClick={() => { setState((s) => ({ ...s, deletionRequestedAt: Date.now() })); audit("privacy.delete_request", "Account deletion requested"); setConfirm(""); }}>Delete</Button></div>
              </>
            )}
          </div>
        </Panel>
        <Panel title="Production security requirements">
          <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
            {[["Synthetic tenant ID", RESTAURANT.id], ["Server-enforced isolation", "Not implemented"], ["Encryption / KMS", "Not implemented"], ["External model training", "No data sent"]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-muted p-2.5"><div className="text-muted-foreground">{k}</div><div className="mt-0.5 flex items-center gap-1 font-medium"><Lock className="size-3" />{v}</div></div>
            ))}
          </div>
          <ul className="space-y-2 text-xs">{SUBPROCESSORS.map(([n, p, d]) => <li key={n} className="flex justify-between gap-3"><span><b>{n}</b> · {p}</span><span className="text-muted-foreground">{d}</span></li>)}</ul>
        </Panel>
      </div>

      <Panel title="Permission matrix" className="mt-4" pad={false}>
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Capability", "Owner", "Manager", "Server"].map((h) => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody>{PERMISSION_TABLE.map((r) => <tr key={r.label} className="border-t"><td className="px-4 py-2">{r.label}</td><td className="px-4 py-2 text-muted-foreground">{r.owner}</td><td className="px-4 py-2 text-muted-foreground">{r.manager}</td><td className="px-4 py-2 text-muted-foreground">{r.waiter}</td></tr>)}</tbody>
        </table>
      </Panel>

      <Panel title={<span className="flex items-center gap-2"><ShieldCheck className="size-4" /> Local demo audit log</span>} className="mt-4" pad={false} action={<Input className="h-8 w-48 text-xs" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />}>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted text-muted-foreground"><tr>{["Time", "User", "Role", "Action", "Detail", "Device"].map((h) => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="whitespace-nowrap px-4 py-2"><Meta>{format(a.at, "MMM d HH:mm:ss")}</Meta></td>
                  <td className="px-4 py-2">{a.actor}</td>
                  <td className="px-4 py-2 capitalize">{a.role}</td>
                  <td className="px-4 py-2"><Pill tone={a.action.includes("denied") || a.action.includes("refusal") ? "urgent" : "neutral"}>{a.action}</Pill></td>
                  <td className="px-4 py-2">{a.detail}</td>
                  <td className="px-4 py-2 text-muted-foreground">{a.device}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4">
      <div><div className="font-medium">{label}</div><div className="text-xs text-muted-foreground">{desc}</div></div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
