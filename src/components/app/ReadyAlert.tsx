import { useEffect, useRef } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/lib/demo/store";
import { acknowledgeReady } from "@/lib/demo/actions";
import { menuById } from "@/lib/demo/data";

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.18].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {
    /* audio blocked until user gesture */
  }
}

/** Sound + banner + vibration, repeating until acknowledged (spec 4.2). */
export function ReadyAlert({ userId, enabled }: { userId: string; enabled: boolean }) {
  const ready = useDemo((s) => s.liveOrders.filter((o) => o.status === "ready" && !o.acknowledged && o.waiterId === userId));
  const key = ready.map((r) => r.id).join(",");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !ready.length) return;
    const ping = () => {
      beep();
      navigator.vibrate?.([200, 100, 200]);
    };
    ping();
    timer.current = window.setInterval(ping, 4000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  if (!enabled || !ready.length) return null;
  return (
    <div className="fixed inset-x-0 top-3 z-50 mx-auto flex w-[min(560px,calc(100%-24px))] flex-col gap-2">
      {ready.map((o) => (
        <div key={o.id} className="animate-rise animate-ring-pulse flex items-center gap-4 rounded-2xl bg-ink p-4 text-paper shadow-lift">
          <div className="grid size-10 place-items-center rounded-full bg-ember text-ember-foreground"><BellRing className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Table {o.table} is ready</div>
            <div className="truncate text-xs text-paper/60">{o.lines.map((l) => `${l.qty}× ${menuById(l.itemId).name}`).join(" · ")}</div>
          </div>
          <Button variant="ember" size="sm" onClick={() => acknowledgeReady(o.id)}>Picked up</Button>
        </div>
      ))}
    </div>
  );
}
