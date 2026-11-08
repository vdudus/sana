import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Crown, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Logo, AssistantAvatar } from "@/components/app/kit";
import { EMPLOYEES, WAITERS, type Role } from "@/lib/demo/data";
import { signIn } from "@/lib/demo/actions";
import { getState } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import serviceImage from "@/assets/sana-restaurant.jpg";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Sign in — SANA live demo" },
      { name: "description", content: "Sign in to the SANA demo as an owner, manager or server and explore a fully working restaurant back office." },
      { property: "og:title", content: "SANA live demo" },
      { property: "og:description", content: "Explore the AI assistant, staff tools, expiry alerts and tax workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemoLogin,
});

const ROLES: { role: Role; icon: typeof Crown; title: string; desc: string }[] = [
  { role: "owner", icon: Crown, title: "Owner", desc: "Everything: AI, financials, tax, privacy" },
  { role: "manager", icon: ShieldCheck, title: "Manager", desc: "Staff, bookings, inventory, approvals" },
  { role: "waiter", icon: UserRound, title: "Server", desc: "Orders, cancels, tips, ready alerts" },
];

function DemoLogin() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("owner");
  const [step, setStep] = useState<"creds" | "mfa">("creds");
  const [otp, setOtp] = useState("");
  const [waiter, setWaiter] = useState(WAITERS[0].id);
  const [pin, setPin] = useState("");

  const user = role === "owner" ? EMPLOYEES[0] : role === "manager" ? EMPLOYEES[1] : (EMPLOYEES.find((e) => e.id === waiter) ?? EMPLOYEES[0]);

  function finish(r: Role, id: string) {
    if (getState().deactivated.includes(id)) {
      toast.error("This account was deactivated by the owner.");
      return;
    }
    signIn(r, id);
    navigate({ to: r === "waiter" ? "/app/orders" : r === "manager" ? "/app/staff" : "/app" });
  }

  function submitCreds(e: React.FormEvent) {
    e.preventDefault();
    if (role === "owner") setStep("mfa");
    else finish(role, user.id);
  }

  function pressPin(d: string) {
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      if (next === user.pin) finish("waiter", user.id);
      else {
        toast.error("Wrong PIN", { description: `Demo PIN for ${user.name} is ${user.pin}` });
        setTimeout(() => setPin(""), 300);
      }
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-paper md:flex">
        <img src={serviceImage} alt="Restaurant tables prepared for service" width={1920} height={1024} className="absolute inset-0 h-full w-full object-cover object-right opacity-10" />
        <Link to="/" className="relative inline-flex items-center gap-2 text-sm text-paper hover:underline"><ArrowLeft className="size-4" /> Back to site</Link>
        <div className="relative">
          <AssistantAvatar className="size-20" />
          <h1 className="mt-6 font-display text-5xl leading-tight">Olive & Ember<span className="text-citrus">.</span></h1>
          <p className="mt-3 text-paper">San Francisco, CA · 18 tables · Toast POS</p>
          <div className="mt-10 space-y-3 text-sm text-paper">
            <p>This is a fully interactive demo with ~400 days of synthetic POS data. Every action is permission-checked and written to the audit log.</p>
            <p className="font-mono text-xs text-paper">Tenant tnt_8f2c1a · data stays in your browser</p>
          </div>
        </div>
        <Logo className="relative text-paper [&_svg]:text-paper" />
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 md:hidden"><Logo /></div>
          <h2 className="font-display text-4xl">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pick a role to explore. Credentials are pre-filled.</p>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <Button
                variant="soft"
                key={r.role}
                onClick={() => { setRole(r.role); setStep("creds"); setPin(""); }}
                className={cn(
                  "h-auto flex-col items-start whitespace-normal rounded-md border bg-card p-3 text-left transition hover:border-foreground/30",
                  role === r.role && "border-ember bg-ember-soft ring-1 ring-ember",
                )}
              >
                <r.icon className="size-4" strokeWidth={1.6} />
                <div className="mt-3 text-sm font-medium">{r.title}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{r.desc}</div>
              </Button>
            ))}
          </div>

          <div className="mt-8">
            {role !== "waiter" && step === "creds" && (
              <form onSubmit={submitCreds} className="space-y-3">
                <label className="block text-xs text-muted-foreground">Email<Input className="mt-1 bg-card" defaultValue={user.email} /></label>
                <label className="block text-xs text-muted-foreground">Password<Input className="mt-1 bg-card" type="password" defaultValue="demo-password" /></label>
                <Button type="submit" className="w-full" size="lg">Continue as {user.name}</Button>
                <p className="text-center text-[11px] text-muted-foreground">Simulated sign-in only. No real authentication or MFA. Do not enter real credentials.</p>
              </form>
            )}
            {role === "owner" && step === "mfa" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm"><KeyRound className="size-4 text-ember" /> Enter the 6-digit code from your authenticator</div>
                <InputOTP maxLength={6} value={otp} onChange={(v) => { setOtp(v); if (v.length === 6) finish("owner", user.id); }} autoFocus>
                  <InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} className="size-12 bg-card text-lg" />)}</InputOTPGroup>
                </InputOTP>
                <Button variant="soft" className="w-full" onClick={() => finish("owner", user.id)}>Use demo code 482 913</Button>
              </div>
            )}
            {role === "waiter" && (
              <div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {WAITERS.map((w) => (
                    <button key={w.id} onClick={() => { setWaiter(w.id); setPin(""); }} className={cn("rounded-full border bg-card px-3 py-1.5 text-xs", waiter === w.id && "border-foreground bg-ink text-paper")}>
                      {w.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
                <div className="mb-4 flex justify-center gap-3">
                  {[0, 1, 2, 3].map((i) => <span key={i} className={cn("size-3 rounded-full border border-foreground/40", pin.length > i && "bg-foreground")} />)}
                </div>
                <div className="mx-auto grid max-w-64 grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((d, i) =>
                    d === "" ? <span key={i} /> : (
                      <button key={i} onClick={() => (d === "⌫" ? setPin(pin.slice(0, -1)) : pressPin(d))} className="h-14 rounded-xl border bg-card text-lg tabular hover:bg-accent">
                        {d}
                      </button>
                    ),
                  )}
                </div>
                <p className="mt-4 text-center text-xs text-muted-foreground">Fast PIN login on restaurant devices · Demo PIN for {user.name.split(" ")[0]}: <b className="font-mono">{user.pin}</b></p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
