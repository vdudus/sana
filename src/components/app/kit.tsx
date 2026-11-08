import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ExpiryStatus } from "@/lib/demo/inventory";


export function BrandMark({ className }: { className?: string }) {
  return <svg viewBox="0 0 32 32" fill="none" className={cn("size-6", className)} aria-hidden="true"><path d="M25 8H13a6 6 0 0 0 0 12h6a6 6 0 0 0 0-12M7 24h12a6 6 0 0 0 0-12h-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>;
}

export function AssistantAvatar({ className }: { className?: string }) {
  return <span role="img" aria-label="SANA assistant" className={cn("inline-flex items-center justify-center rounded-md border border-primary/20 bg-secondary text-primary", className)}><BrandMark className="h-3/5 w-3/5" /></span>;
}

export function Logo({ className }: { className?: string }) {
  return <span className={cn("inline-flex items-center gap-2.5 font-display text-xl", className)}><BrandMark className="size-8 text-primary" />SANA</span>;
}

export function PageHeader({ title, desc, actions, eyebrow }: { title: string; desc?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-8 flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</div>}
        <h1 className="font-display text-4xl leading-none md:text-5xl">{title}</h1>
        {desc && <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{desc}</p>}
      </div>
      {actions && <div className="flex min-w-0 shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className, pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-soft", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
          <h2 className="text-sm font-medium">{title}</h2>
          {action}
        </header>
      )}
      <div className={cn(pad && "p-5")}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ember" | "urgent" | "success" }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-5 shadow-soft">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-2 break-words text-3xl font-medium tabular",
          tone === "ember" && "text-ember",
          tone === "urgent" && "text-urgent",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

const PILL: Record<string, string> = {
  expired: "bg-ink text-paper",
  urgent: "bg-urgent-soft text-urgent",
  watch: "bg-warning-soft text-warning",
  ok: "bg-success-soft text-success",
  neutral: "bg-muted text-muted-foreground",
  ember: "bg-ember-soft text-ember",
};
export function Pill({ tone = "neutral", children, className }: { tone?: ExpiryStatus | "neutral" | "ember"; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", PILL[tone], className)}>{children}</span>;
}

export function Meta({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[11px] text-muted-foreground">{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>;
}
