import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Ban, CalendarDays, ChefHat, ClipboardList, DollarSign, FileText, LayoutGrid, LogOut, Menu, MessageSquare,
  Package, RotateCcw, Settings, Users, X,
} from "lucide-react";
import { Logo } from "@/components/app/kit";
import { ReadyAlert } from "@/components/app/ReadyAlert";
import { useHydrated, useSession } from "@/components/app/useSession";
import type { Permission } from "@/lib/demo/permissions";
import { getState, resetDemo, setState, useDemo } from "@/lib/demo/store";
import { signIn, signOut } from "@/lib/demo/actions";
import { EMPLOYEES, RESTAURANT, type Role } from "@/lib/demo/data";
import { statusOf } from "@/lib/demo/inventory";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Olive & Ember — SANA" },
      { name: "description", content: "SANA restaurant back office demo." },
      { property: "og:title", content: "SANA demo workspace" },
      { property: "og:description", content: "Role-based restaurant back office with an AI sales assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppLayout,
});

type AppPath = "/app" | "/app/finance" | "/app/assistant" | "/app/orders" | "/app/kitchen" | "/app/voids" | "/app/earnings" | "/app/staff" | "/app/bookings" | "/app/inventory" | "/app/tax" | "/app/settings";
type NavItem = { to: AppPath; label: string; icon: typeof LayoutGrid; perm?: Permission; roles?: Role[]; badge?: () => number };

function useNav(): NavItem[] {
  const urgent = useDemo((s) => s.batches.filter((b) => b.status === "active" && ["urgent", "expired"].includes(statusOf(b))).length);
  const approvals = useDemo((s) => s.approvals.filter((a) => a.status === "pending").length);
  return [
    { to: "/app", label: "Overview", icon: LayoutGrid, roles: ["owner", "manager"] },
    { to: "/app/finance", label: "Monthly finances", icon: FileText, perm: "finance.owner" },
    { to: "/app/assistant", label: "Ask SANA", icon: MessageSquare, perm: "assistant.use" },
    { to: "/app/orders", label: "Orders", icon: ClipboardList, perm: "orders.place", badge: () => approvals },
    { to: "/app/kitchen", label: "Kitchen display", icon: ChefHat },
    { to: "/app/voids", label: "Cancellations", icon: Ban, perm: "voids.own" },
    { to: "/app/earnings", label: "My earnings", icon: DollarSign, roles: ["waiter"] },
    { to: "/app/staff", label: "Staff & schedule", icon: Users },
    { to: "/app/bookings", label: "Bookings", icon: CalendarDays, perm: "reservations.view" },
    { to: "/app/inventory", label: "Inventory", icon: Package, perm: "inventory.pushlist", badge: () => urgent },
    { to: "/app/tax", label: "Tax & books", icon: FileText, perm: "tax.view" },
    { to: "/app/settings", label: "Privacy & access", icon: Settings, perm: "admin.privacy" },
  ];
}

/** Simulated kitchen: sent → preparing (20s) → ready (35s). */
function useKitchenSimulator() {
  useEffect(() => {
    const t = window.setInterval(() => {
      const now = Date.now();
      const s = getState();
      let changed = false;
      const liveOrders = s.liveOrders.map((o) => {
        if (o.status === "sent" && now - o.createdAt > 20e3) { changed = true; return { ...o, status: "preparing" as const, startedAt: now }; }
        if (o.status === "preparing" && o.startedAt && now - o.startedAt > 35e3) { changed = true; return { ...o, status: "ready" as const, readyAt: now, acknowledged: false }; }
        return o;
      });
      if (changed) setState((st) => ({ ...st, liveOrders }));
    }, 2000);
    return () => window.clearInterval(t);
  }, []);
}

function AppLayout() {
  const hydrated = useHydrated();
  const { session, user, can } = useSession();
  const navigate = useNavigate();
  const nav = useNav();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  useKitchenSimulator();

  useEffect(() => {
    if (hydrated && !session) navigate({ to: "/demo" });
  }, [hydrated, session, navigate]);
  useEffect(() => setOpen(false), [path]);

  if (!hydrated || !session || !user) return <div className="min-h-screen bg-background" />;

  const items = nav.filter((n) => (n.perm ? can(n.perm) : true) && (n.roles ? n.roles.includes(session.role) : true));
  const isActive = (to: string) => (to === "/app" ? /\/app\/?$/.test(path) : path.includes(to));

  const switchTo = (role: Role) => {
    const id = role === "owner" ? "e_owner" : role === "manager" ? "e_mgr" : "e_w1";
    signIn(role, id);
    navigate({ to: role === "waiter" ? "/app/orders" : "/app" });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between px-5">
        <Logo />
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Close navigation" onClick={() => setOpen(false)}><X className="size-5" /></Button>
      </div>
      <div className="mx-3 mb-5 border-y border-sidebar-border px-2 py-4">
        <div className="text-sm font-medium">{RESTAURANT.name}</div>
        <div className="text-[11px] text-muted-foreground">{RESTAURANT.location} · Toast POS · synced</div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {items.map((n) => {
          const b = n.badge?.() ?? 0;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground",
                isActive(n.to) && "bg-ink font-medium text-paper hover:bg-ink hover:text-paper",
              )}
            >
              <n.icon className="size-4" strokeWidth={1.7} />
              <span className="flex-1">{n.label}</span>
              {b > 0 && <span className="rounded-full bg-citrus px-1.5 text-[10px] font-medium text-ink">{b}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <div className="mb-2 px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Demo · view as</div>
        <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {(["owner", "manager", "waiter"] as Role[]).map((r) => (
            <Button variant="ghost" key={r} onClick={() => switchTo(r)} className={cn("h-7 rounded-md px-1 py-1 text-[11px] capitalize", session.role === r && "bg-citrus font-medium text-ink shadow-soft")}>
              {r === "waiter" ? "Server" : r}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2.5 px-1">
          <div className="grid size-8 place-items-center rounded-full bg-ink text-[11px] text-paper">{user.initials}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{user.name}</div>
            <div className="text-[11px] capitalize text-muted-foreground">{user.title}</div>
          </div>
          <Button variant="ghost" size="icon" title="Reset demo data" aria-label="Reset demo data" onClick={() => resetDemo()} className="size-7 text-muted-foreground"><RotateCcw className="size-3.5" /></Button>
          <Button variant="ghost" size="icon" title="Sign out" aria-label="Sign out" onClick={() => { signOut(); navigate({ to: "/demo" }); }} className="size-7 text-muted-foreground"><LogOut className="size-3.5" /></Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <ReadyAlert userId={user.id} enabled={session.role === "waiter" || EMPLOYEES.some((e) => e.id === user.id && e.role === "waiter")} />
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-sidebar md:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-sidebar shadow-lift">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:hidden">
          <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu className="size-5" /></Button>
          <Logo />
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-10 md:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

