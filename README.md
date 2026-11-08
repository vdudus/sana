# SANA — AI back office for independent restaurants

Landing page + fully interactive investor demo. Runs 100% in the browser on synthetic data, so it deploys free to **GitHub Pages**.

## SANA identity

SANA uses a restrained Indigo-and-silver visual system inspired by [Apple’s MacBook Neo Indigo](https://www.apple.com/macbook-neo/), a custom interlocking S mark and a locally bundled restaurant photograph. The reference is directional, not an official Apple color specification or affiliation. Manrope, Public Sans and IBM Plex Mono remain in use. Branding changes preserve all demo permissions, analytics and stored state.

**Naming is not cleared:** SANA is the user-selected name. Trademark, common-law usage, domains and social handles have not been cleared. Obtain jurisdiction-specific professional review before launch. SANA does not provide statutory audit or certified accountant assurance.

## What's inside

| Spec section | Where in the demo |
|---|---|
| 4.1 AI sales assistant | `/app/assistant` — intent → approved analytics function, charts/tables, date range + data freshness, follow-ups, refusals (role, prompt injection, out of scope) |
| 4.2 Role-based login | `/demo` — Owner (email + MFA), Manager (email), Server (PIN). Role switcher in the sidebar |
| Manager tools | Hours & export, schedule builder + publish, shift swaps, bookings/events/cleaning, inventory, cancel approvals |
| Server tools | Orders by table w/ modifiers & notes, cancel rules (manager approval after kitchen start), own pay & tips, order-ready sound + banner + vibration until acknowledged |
| 4.3 Expiry alerts | `/app/inventory` — label scan (simulated OCR + manual), confirm step, Watch ≤168 h / Urgent ≤72 h, push list to servers, FIFO hints, waste report |
| 4.4 Tax assistant | `/app/tax` — GAAP vs tax basis P&L, book–tax differences, 1120-S / 941 / 8027 drafts, reconciliation, CPA-approved savings library with IRS references, Draft → Owner → CPA → Export workflow, refusal of illegal requests |
| 4.5 Privacy | `/app/settings` — users & deactivation, cost-access toggle, benchmarking opt-in (off), time-limited support access, export JSON/CSV, delete flow, append-only audit log |

Business rules live in `src/lib/demo/*` and are covered by `src/test/rules.test.ts`.

## Updated financial copilot brief — coverage

`/app/finance` adds the focused owner workflow without removing the earlier operations demo:
- Review read-only data disclosures; load synthetic QuickBooks Online and Square summaries or import the supported local CSV template.
- Inspect imported date coverage and refresh, select a month, confirm account mappings on an explicit accrual basis.
- Review integer-cent monthly P&L: revenue, booked COGS, labor, prime cost, overhead, net profit and food-cost percentage. No annualization, guessed payroll, or purchase-to-COGS assumptions.
- Missing coverage/inputs, stale snapshots, duplicate/conflicting IDs and unmapped accounts withhold affected metrics. A valid zero is distinct from missing data.
- Inspect each metric's definition, formula/version, period, timezone, source identifiers, freshness and warnings; inspect Square-to-books adjustments and unresolved differences.
- Compare verified months, read deterministic source-backed explanations, retain month-specific owner notes and next-period actions, and download standalone HTML or JSON reports. HTML can be opened, printed or shared manually; sharing is not a hosted public link.

**Supported CSV:** `id,month,account,amount`; one monthly account summary per ID; USD decimal amounts; calendar periods already assigned in America/Chicago; unquoted fields; maximum 1,000 rows/1 MB. This is a guided-pilot format, not a native arbitrary QuickBooks/Square export parser. Source imports replace snapshots safely, not append duplicate totals. Fixtures use September/October 2026. Missing prior-month data suppresses comparisons. Tax/tips remain excluded from revenue, refunds/discounts and timing are explicit; deposits are not assumed to equal sales.

**Not production features:** real account creation, OAuth/token refresh, Square/QuickBooks APIs, webhooks/background sync, cloud retention, tenant-secure storage, encryption/KMS, server authorization, MFA, backups, incident response, hosted sharing and monthly email. These cannot be safely supplied by a public, backend-free GitHub Pages demo. Local permission checks demonstrate the intended roles but are not a security boundary. Do not use real restaurant data. Real integrations/security require a separately funded backend and qualified security/privacy review. P1 natural-language monthly Q&A, P2 forecasting, and additional integrations are deferred; notes/actions and month comparisons are demonstrated. No bookkeeping writes, payments, lending or accountant replacement.

The previous `/app/tax` workspace remains a legacy synthetic illustration using estimated annual figures, **not** this verified monthly reporting engine, and has no actual CPA sign-off or filing capability. Do not interpret its simulated tax suggestions as advice. The downloadable monthly report is a synthetic investor artifact, not a certified financial statement.

## Run locally

```bash
bun install
bun run dev
bun run test
```

## Deploy to GitHub Pages

1. Push to a GitHub repo (branch `main`).
2. Repo → **Settings → Pages → Source: GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` builds a static site and publishes it to `https://<user>.github.io/<repo>/`.

All demo state is stored in the visitor's browser (`localStorage`). Use the ↺ button in the sidebar to reset.
