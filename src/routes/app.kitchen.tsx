import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Meta } from "@/components/app/kit";
import { useDemo } from "@/lib/demo/store";
import { advanceKitchen } from "@/lib/demo/actions";
import { employeeById, menuById } from "@/lib/demo/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/kitchen")({ head: () => pageHead("Kitchen display", "Follow kitchen tickets through service in SANA."), component: Kitchen });

const COLS = [
  { key: "sent", title: "New", next: "Start" },
  { key: "preparing", title: "Preparing", next: "Mark ready" },
  { key: "ready", title: "Ready for pickup", next: "Served" },
] as const;

function Kitchen() {
  const orders = useDemo((s) => s.liveOrders);
  return (
    <div>
      <PageHeader eyebrow="KDS" title="Kitchen display" desc="Orders auto-advance in the demo (new → preparing in 20s → ready in 35s). Advance manually to trigger the server's ready alert instantly." />
      <div className="grid gap-4 md:grid-cols-3">
        {COLS.map((c) => {
          const list = orders.filter((o) => o.status === c.key);
          return (
            <div key={c.key} className="rounded-xl border bg-muted/40 p-3">
              <div className="mb-3 flex items-center justify-between px-1 text-sm font-medium">{c.title}<span className="text-xs text-muted-foreground">{list.length}</span></div>
              <div className="space-y-2">
                {list.map((o) => {
                  const mins = Math.round((Date.now() - o.createdAt) / 60e3);
                  return (
                    <div key={o.id} className={cn("rounded-lg border bg-card p-3 shadow-soft", mins > 15 && c.key !== "ready" && "border-urgent/50")}>
                      <div className="flex items-center justify-between">
                        <div className="font-medium">Table {o.table}</div>
                        <Meta>{mins}m · {employeeById(o.waiterId)?.name.split(" ")[0]}</Meta>
                      </div>
                      <ul className="mt-2 space-y-1 text-sm">
                        {o.lines.map((l, i) => (
                          <li key={i}>
                            <b className="tabular">{l.qty}×</b> {menuById(l.itemId).name}
                            {l.mods.length > 0 && <div className="text-xs text-ember">{l.mods.join(" · ")}</div>}
                            {l.note && <div className="text-xs text-urgent">⚠ {l.note}</div>}
                          </li>
                        ))}
                      </ul>
                      <Button size="sm" variant={c.key === "preparing" ? "ember" : "outline"} className="mt-3 w-full" onClick={() => advanceKitchen(o.id)}>
                        {c.next} <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
