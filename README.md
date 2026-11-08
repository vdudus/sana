# SANA — AI back office for independent restaurants

[**Live Demo**](https://vdudus.github.io/sana/demo) · [Website](https://vdudus.github.io/sana/)

SANA is an AI back-office workspace and financial companion for independent restaurants. It connects POS sales, operations, inventory, and payroll into verified accrual-basis books and deterministic sales analytics.

Runs 100% in the browser on synthetic data for instant investor & partner evaluation.

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

## Financial Engine & Coverage

`/app/finance` provides a focused financial cockpit:
- Inspect imported date coverage, select calendar months, and review account mappings on an explicit accrual basis.
- Review integer-cent monthly P&L: revenue, booked COGS, labor, prime cost, overhead, net profit and food-cost percentage.
- Compare verified months, read deterministic source-backed explanations, and download standalone HTML or JSON reports.
- Discrepancy detection between Square POS receipts and QuickBooks accounting ledger.

> **Evaluation note:** To provide an instant, friction-free demo with zero server setup, all backend services (OAuth sync, POS webhooks, and ledger storage) are simulated client-side with 400+ days of synthetic POS fixtures. Business logic is covered by 33 automated tests.

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
