import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, Check, ChefHat, FileText, Lock, MessageSquare, ScanLine, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, AssistantAvatar } from "@/components/app/kit";
import { PERMISSION_TABLE } from "@/lib/demo/permissions";
import serviceImage from "@/assets/sana-restaurant.jpg";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "SANA — Your restaurant financial companion" },
    { name: "description", content: "Meet SANA, the restaurant financial assistant. Explore source-backed monthly reports, sales analytics and restaurant operations in an interactive demo." },
    { property: "og:title", content: "SANA — Your restaurant financial companion" },
    { property: "og:description", content: "From the first order to the final close: one workspace for an independent restaurant." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Landing,
});

const FEATURES = [
  { icon: MessageSquare, title: "A clearer picture of service.", body: "Best sellers. Quiet dishes. Cancellations. Ask a question and get a dated answer, with the numbers behind it.", label: "01 / SALES INTELLIGENCE" },
  { icon: ScanLine, title: "Good food. Less waste.", body: "Track each batch from receiving. See what needs attention and send tonight’s priority dishes to the floor.", label: "02 / INVENTORY & EXPIRY" },
  { icon: Users, title: "A team in sync.", body: "Orders, kitchen updates, bookings, shifts and tips. Everyone gets the right view of the same restaurant.", label: "03 / PEOPLE & SERVICE" },
  { icon: FileText, title: "Close with confidence.", body: "Keep books and tax drafts together. Review the details, then export a clean package for your CPA.", label: "04 / TAX & BOOKS" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6 md:px-10">
          <Logo className="text-2xl" />
          <div className="hidden items-center gap-8 text-sm md:flex">
            <a href="#product" className="hover:text-ember">The workspace</a>
            <a href="#roles" className="hover:text-ember">Your team</a>
            <a href="#pricing" className="hover:text-ember">Pricing</a>
          </div>
          <Button asChild variant="default"><Link to="/demo">Explore SANA <ArrowRight /></Link></Button>
        </div>
      </nav>

      <header className="sana-hero relative flex items-center overflow-hidden bg-hero-surface text-paper">
        <img src={serviceImage} alt="An independent restaurant set for evening service" width={1920} height={1024} fetchPriority="high" className="sana-cover absolute inset-0 h-full w-full object-cover" />
        <div className="hero-shade absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-7xl px-6 py-10 md:px-10 md:py-14">
          <div className="mb-5 flex items-center gap-3 font-mono text-[10px] uppercase text-paper/80"><span className="h-px w-8 bg-paper/60" /> Restaurant intelligence</div>
          <h1 className="sana-name font-display">SANA</h1>
          <p className="mt-5 max-w-md font-display text-3xl leading-tight md:text-4xl">Service in sync.<br />Numbers in focus.</p>
          <p className="mt-5 max-w-[290px] text-sm leading-relaxed text-paper/80 md:max-w-sm">Meet your restaurant’s financial companion. Monthly books, sales and the details that deserve a closer look.</p>
          <Button asChild size="lg" className="mt-7"><Link to="/demo">Open the workspace <ArrowRight /></Link></Button>
          <div className="mt-4 font-mono text-[10px] text-paper/70">INTERACTIVE DEMO · SYNTHETIC DATA</div>
        </div>
      </header>

      <div className="border-b bg-citrus text-ink">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-6 py-5 md:px-10">
          <span className="font-display text-lg">Made for the people who run the restaurant.</span>
          <a href="#product" aria-label="Discover the workspace" className="shrink-0"><ArrowDown className="size-5" /></a>
        </div>
      </div>

      <section id="product" className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-24">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><Eyebrow>A closer look at the numbers</Eyebrow><h2 className="landing-title mt-4 max-w-xl font-display">Your books.<br />A little more clarity.</h2></div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">From the first order to the final close, SANA brings the moving parts of an independent restaurant into focus.</p>
        </div>
        <div className="mt-12 grid gap-10 border-t pt-8 lg:grid-cols-[1.1fr_1fr]">
          <div className="min-w-0">
            <div className="flex items-center justify-between border-b pb-4 text-sm"><Logo /><span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-success" />Olive & Ember</span></div>
            <div className="py-7"><span className="font-mono text-[10px] text-muted-foreground">YOUR SALES, IN FOCUS</span><h3 className="mt-2 font-display text-2xl">A question worth asking.</h3></div>
            <div className="ml-auto max-w-xs rounded-lg bg-lilac px-4 py-3 text-sm">What sold least last week?</div>
            <div className="mt-6 flex items-start gap-3"><AssistantAvatar className="size-10 shrink-0" /><div className="text-sm leading-relaxed"><strong>Wild Mushroom Soup</strong> sold 41 units. Those mushrooms expire in 4 days — a good dish to put on tonight’s priority list.</div></div>
            <div className="mt-7 border-y py-4"><div className="mb-3 flex justify-between font-mono text-[10px] text-muted-foreground"><span>UNITS SOLD / LAST WEEK</span><span>DEMO DATA</span></div>{[["Mushroom soup", "41", "w-[22%]"], ["Burrata", "96", "w-[50%]"], ["Herb pasta", "184", "w-[90%]"]].map(([name, qty, width]) => <div key={name} className="mb-3 grid grid-cols-[125px_1fr_30px] items-center gap-3 text-xs"><span>{name}</span><div className="h-5 bg-muted"><div className={`h-full bg-ember ${width}`} /></div><span className="text-right font-mono">{qty}</span></div>)}</div>
            <Button asChild variant="link" className="mt-3 px-0"><Link to="/demo">Ask your first question <ArrowRight /></Link></Button>
          </div>
          <div className="grid gap-0 sm:grid-cols-2">
            {FEATURES.map((f) => <article key={f.title} className="border-b p-5 first:bg-secondary even:bg-muted last:bg-secondary sm:p-6"><div className="flex items-center justify-between"><f.icon className="size-5" strokeWidth={1.5} /><span className="font-mono text-[9px] text-foreground/65">{f.label.split(" / ")[0]}</span></div><h3 className="mt-7 font-display text-xl leading-tight">{f.title}</h3><p className="mt-3 text-xs leading-relaxed text-foreground/70">{f.body}</p></article>)}
          </div>
        </div>
      </section>

      <section id="roles" className="border-y bg-secondary">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-24">
          <div className="grid items-start gap-10 lg:grid-cols-[0.75fr_1.25fr]">
            <div><Eyebrow>A place for everyone</Eyebrow><h2 className="landing-title mt-4 font-display">One restaurant.<br />Different perspectives.</h2><p className="mt-6 max-w-xs text-sm leading-relaxed text-muted-foreground">The owner sees the whole picture. The manager keeps service moving. The server stays close to the guest.</p><Button asChild variant="default" className="mt-7"><Link to="/demo">Meet your workspace <ArrowRight /></Link></Button></div>
            <div className="min-w-0 overflow-x-auto"><table className="w-full min-w-[470px] text-xs"><thead><tr className="border-b border-foreground/30"><th className="py-4 pr-4 text-left font-normal text-muted-foreground">The right access</th>{["Owner", "Manager", "Server"].map(t => <th key={t} className="px-3 py-4 text-left font-display text-sm">{t}</th>)}</tr></thead><tbody>{PERMISSION_TABLE.map(r => <tr key={r.label} className="border-b"><td className="py-3 pr-4 font-medium">{r.label}</td>{[r.owner, r.manager, r.waiter].map((v,i) => <td key={i} className="px-3 py-3 text-muted-foreground">{v}</td>)}</tr>)}</tbody></table></div>
          </div>
        </div>
      </section>

      <section id="privacy" className="bg-ink text-paper">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-[1.1fr_1fr] md:px-10 md:py-24">
          <div><Lock className="size-6 text-citrus" /><h2 className="landing-title mt-6 font-display">Your restaurant.<br />Your data.<br /><span className="text-citrus">Always.</span></h2></div>
          <div className="space-y-7 self-center">{[["Not for sale.", "Your restaurant’s information is not a product for someone else."], ["Not for training.", "Your numbers belong to your business, not an AI training dataset."], ["Not locked away.", "Export your data and review access from your own workspace."]].map(([t,d]) => <div key={t} className="border-t border-paper/20 pt-5"><h3 className="font-display text-xl">{t}</h3><p className="mt-2 text-sm leading-relaxed text-paper/60">{d}</p></div>)}</div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-24">
        <Eyebrow>Room to grow</Eyebrow><h2 className="landing-title mt-4 font-display">Your next chapter, on the menu.</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { n: "Core", p: "$149", d: "The everyday essentials", f: ["AI sales assistant", "Staff roles & expiry alerts", "1 location · unlimited staff"] },
            { n: "Pro", p: "$299", d: "Service, with the full picture", f: ["Everything in Core", "Tax & bookkeeping workspace", "CPA-ready drafts & exports"], hi: true },
            { n: "Group", p: "Let’s talk", d: "For your growing restaurant family", f: ["Multi-location reporting", "SSO & audit export", "Dedicated onboarding"] },
          ].map(t => <article key={t.n} className={`rounded-lg border p-7 ${t.hi ? "border-citrus bg-citrus" : "bg-card"}`}><div className="flex items-center justify-between"><h3 className="font-display text-xl">{t.n}</h3>{t.hi && <ChefHat className="size-5" />}</div><p className="mt-2 text-xs text-foreground/65">{t.d}</p><div className="mt-7 font-display text-4xl">{t.p}<span className="font-sans text-xs font-normal">{t.p.startsWith("$") ? " / month" : ""}</span></div><ul className="mt-7 space-y-3 border-t border-foreground/15 pt-5 text-xs">{t.f.map(x => <li key={x} className="flex items-start gap-2"><Check className="size-3.5 shrink-0" />{x}</li>)}</ul></article>)}
        </div>
        <p className="mt-4 font-mono text-[10px] text-muted-foreground">ILLUSTRATIVE PRICING · DEMO ONLY</p>
      </section>

      <section className="brand-pattern bg-lilac">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-14 md:flex-row md:items-center md:px-10"><div><Eyebrow>Ready for service</Eyebrow><h2 className="mt-3 font-display text-3xl md:text-4xl">Pull up a chair.</h2></div><Button asChild variant="default" size="lg"><Link to="/demo">Explore the live demo <ArrowRight /></Link></Button></div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-6 py-8 md:flex-row md:items-center md:px-10"><Logo /><p className="text-[11px] text-muted-foreground">© {new Date().getFullYear()} SANA · Synthetic demo data. Not tax advice.</p><a href="#privacy" className="text-xs">Your data, always yours ↗</a></footer>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[10px] uppercase tracking-widest text-ember">{children}</div>;
}
