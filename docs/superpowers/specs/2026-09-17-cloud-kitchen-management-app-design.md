# Cloud Kitchen Management App — Design

## Purpose

A personal-use web app to manage a home/cloud kitchen business: track sales (including Zomato vs. direct), manage inventory, log expenses, view profit/loss, and surface sales insights. Accessed via Chrome (desktop and mobile), hosted for free on GitHub Pages.

## Constraints & Key Decisions

- **Not React Native.** React Native builds native mobile apps and cannot run in Chrome or be hosted on GitHub Pages (static hosting only). This is a **React web app** instead, installable as a PWA for an app-like feel on mobile.
- **Personal, single-user.** No multi-user auth, no backend server.
- **Data persistence:** GitHub Pages is static-only and can't write files. Data is stored as JSON and synced via the **GitHub Contents API**, using a personal access token (PAT) the user generates once and stores in the browser's `localStorage`.
- **Data privacy:** Business financial data (sales, expenses, profit) must not sit in a public repo. Two repos are used (see Architecture).
- **Sale granularity:** Sales are logged per line item (menu item + qty + price), not just order totals, to support "top-selling item" insights.
- **Inventory model:** Simple stock ledger (stock-in / stock-out entries against a running quantity per item), independent of sales — no recipe-based auto-deduction.
- **P&L formula:** `Profit = Total Sales − Total Expenses − Total Zomato Commission` — i.e., cash-flow based. Inventory purchases are logged as an expense category ("Ingredients"), not as separate COGS. No per-unit costing required. Zomato commission is stored per-sale (not as a separate expense record) and added into the P&L calculation from the `sales` data.
- **Zomato commission:** Entered manually per order at time of sale entry (either typed in or auto-calculated from a default commission % set in Settings, with per-order override).

## Architecture

- **`cloud-kitchen-app`** (public GitHub repo): React + Vite + TypeScript source. Deployed to GitHub Pages via GitHub Actions on push to `main`. Contains no business data.
- **`cloud-kitchen-data`** (private GitHub repo): holds `data.json` (the full dataset — see Data Model). No GitHub Pages needed on this repo; it's accessed purely via the Contents API.
- **Auth:** a fine-grained GitHub PAT scoped to only the `cloud-kitchen-data` repo, read+write contents permission. Entered once in the app's Settings screen, stored in `localStorage` on the user's device. Never transmitted anywhere except to GitHub's API.
- **Sync model:** every write (add/edit/delete a record) does: GET current file (to get latest content + SHA) → merge the change into the in-memory dataset → PUT the updated JSON back with the SHA (optimistic concurrency). If the PUT is rejected due to a stale SHA (e.g., edited from two tabs/devices), the app re-fetches the latest version, re-applies the change, and retries — it never blind-overwrites.
- **State/UI:** Zustand for app state, react-router for navigation, Tailwind for styling. Optimistic local updates with a small "saving / saved / error" sync indicator.
- **PWA:** manifest + service worker (via `vite-plugin-pwa`) so the app can be installed to a phone home screen from Chrome. Note: since all writes require network access to GitHub's API, the app is not meaningfully usable offline — the PWA install is for the app-like icon/fullscreen experience, not offline editing.

**Acknowledged tradeoff:** storing a PAT in `localStorage` is appropriate for personal, single-device-at-a-time use in one's own browser, but is not enterprise-grade secret storage (readable via browser devtools by anyone with access to the device/profile). Acceptable given the personal-use, single-owner context.

## Data Model

Single `data.json` in the private data repo:

```jsonc
{
  "menuItems": [
    { "id": "string", "name": "string", "category": "string", "defaultPrice": 0 }
  ],
  "sales": [
    {
      "id": "string",
      "date": "ISO-8601",
      "channel": "zomato | direct",
      "lineItems": [
        { "menuItemId": "string", "qty": 0, "price": 0 }
      ],
      "zomatoCommission": 0 // present only when channel = zomato
    }
  ],
  "inventory": [
    { "id": "string", "name": "string", "unit": "string", "currentQty": 0, "lowStockThreshold": 0 }
  ],
  "stockMoves": [
    { "id": "string", "date": "ISO-8601", "inventoryItemId": "string", "type": "in | out", "qty": 0, "note": "string" }
  ],
  "expenses": [
    { "id": "string", "date": "ISO-8601", "category": "string", "amount": 0, "note": "string" }
  ],
  "settings": {
    "defaultZomatoCommissionPct": 0
  }
}
```

Expense categories: `Ingredients`, `Rent`, `Utilities`, `Staff`, `Packaging`, `Zomato Commission` (auto-derived from sales for reporting, not manually entered as an expense record), `Other`.

## Screens & Features

- **Dashboard** — snapshot for today/this week/this month: total sales, total expenses, profit, Zomato vs. Direct split, low-stock warning banner.
- **Sales** — log a sale (channel, line items with qty/price prefilled from menu item defaults, Zomato commission auto-calculated with override); list/filter past sales by date range.
- **Inventory** — list of items with current stock and low-stock flag; log stock-in (purchase — with a prompt to also log it as an "Ingredients" expense) and stock-out (usage/waste); per-item ledger view.
- **Expenses** — log an expense (category, amount, date, note); list/filter by category and date range.
- **P&L** — for a selected date range: Sales − Expenses (incl. Zomato commission) = Profit, with a trend chart (day/week/month).
- **Insights** — top-selling menu items by revenue and by quantity (date-range filterable); Zomato vs. Direct revenue split and cumulative commission paid; expense breakdown by category (chart).
- **Settings** — GitHub PAT entry, default Zomato commission %, manage menu items list, manage inventory items list (incl. low-stock thresholds).

## Value-Adds (included)

- **PWA install support** — installable to phone home screen from Chrome.
- **CSV export** — export sales/expenses/inventory tables for backup or tax purposes.
- **Reusable date-range presets** (Today / This Week / This Month / Custom) shared across Dashboard, P&L, and Insights.
- **Low-stock banner** on the Dashboard.

## Error Handling & Sync

- Stale-SHA conflicts on save: re-fetch, re-apply, retry (never blind-overwrite).
- Missing/invalid PAT: block data screens and prompt for token entry in Settings.
- Network/API failure on save: surface an inline error and keep the change in local state so the user can retry rather than losing the edit.

## Testing

Pragmatic, given personal-tool scope:
- Unit tests for P&L/insights calculation logic and the GitHub sync module (SHA-conflict handling).
- No automated UI component tests; manual testing in Chrome (desktop + mobile viewport) for screens and flows.

## Out of Scope (for this spec)

- Recipe-based inventory auto-deduction.
- Multi-user access / login.
- Offline editing (requires network for every write, by design).
- Zomato CSV import (manual per-order entry only, per decision above).
