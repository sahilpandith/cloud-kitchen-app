# Sales & Menu Items — Design

## Purpose

Second increment of the Cloud Kitchen Manager app. Builds on the [foundation](2026-09-17-cloud-kitchen-management-app-design.md) (project scaffold, GitHub-sync data layer, app shell, Settings/connection screen — all live and deployed) to deliver the first real data-entry feature: logging sales (per line item, Zomato or Direct) and managing the menu items those sales reference.

## Scope

In scope:
- Menu item management (add / edit / delete) inside the Settings screen.
- The Sales screen: log a sale with one or more line items, view/filter past sales.
- A small reusable date-range filter component, since Sales needs one now and Plan 4 (Dashboard/P&L/Insights) will reuse it later.
- Currency formatting (₹) used across sale amounts.

Out of scope (deferred to later plans, per the original design's phasing):
- CSV export (deferred to a later plan covering Sales/Inventory/Expenses export together, rather than building it three separate times).
- Inventory, Expenses, Dashboard, P&L, Insights screens — still stubs.
- Any inventory auto-deduction tied to sales (the original design already rules this out — inventory is an independent stock ledger).

## Key Decisions

- **Menu item deletion is blocked if referenced by any existing sale.** Rather than snapshotting item names into `SaleLineItem` (which would require a data-model change to the already-deployed `AppData` shape), a menu item that appears in any sale's `lineItems` cannot be deleted — the UI shows why. This keeps `SaleLineItem { menuItemId, qty, price }` unchanged from the foundation's schema.
- **Sale line item price defaults from the menu item's `defaultPrice` but is editable per line**, per the original spec — prices can vary sale-to-sale (discounts, promos) without changing the item's catalog price.
- **Zomato commission auto-calculates from `settings.defaultZomatoCommissionPct`** (as a percentage of the sale's line-item total) when channel is "zomato", with a per-sale override field. Not shown/used when channel is "direct".
- **Date-range filter is built now, generically**, so Plan 4 can reuse the same component for Dashboard/P&L/Insights rather than rebuilding it.
- **All CRUD goes through the existing `useDataStore.mutate()`** from the foundation — no new sync/persistence code, only new mutator functions.

## Data Model

No changes to the `AppData` shape defined in the foundation (`src/types.ts`). This plan implements CRUD against the existing `menuItems` and `sales` arrays:

```ts
MenuItem { id, name, category, defaultPrice }
Sale { id, date, channel: "zomato"|"direct", lineItems: SaleLineItem[], zomatoCommission?: number }
SaleLineItem { menuItemId, qty, price }
```

## Components & Files (high level — the implementation plan will pin exact paths)

- **`DateRangeFilter`** — a shared component taking a value (`{ start: string; end: string } | null` meaning "all time") and presets (Today / This Week / This Month / Custom), emitting the selected range. Pure UI + date-math, no store dependency, fully unit-testable.
- **`formatCurrency`** — a small helper (`(amount: number) => string`) rendering `₹1,234.50`-style output, used everywhere a monetary amount is shown.
- **Settings additions** — a "Menu Items" section: list (name, category, price), an add-item inline form, and per-row edit/delete. Delete is blocked (with an inline error) if the item's `id` appears in any `sale.lineItems[].menuItemId`.
- **Sales page** (replacing the current stub):
  - A form: channel selector, a repeatable line-item row (menu item dropdown sourced from `menuItems`, quantity, price prefilled from the selected item's `defaultPrice` but editable), an "add line" control, a computed subtotal, and — only when channel is "zomato" — a commission field pre-filled from `settings.defaultZomatoCommissionPct * subtotal / 100` with manual override.
  - Validation: at least one line item, each with a selected menu item, `qty > 0`, `price >= 0`.
  - A past-sales list below the form: newest first, each row showing date, channel, an item-count/summary, total, and commission (if any); filtered by the `DateRangeFilter`.
  - If no menu items exist yet, the form shows a prompt to add one in Settings first (the line-item dropdown has nothing to select otherwise).

## Error Handling

- Deleting a referenced menu item: inline error, no request sent (client-side check against current `data.sales`, no server round-trip needed).
- Sale submission validation errors: inline, per-field, form does not submit until resolved.
- Persistence errors (save failures, conflicts): already handled by the foundation's `useDataStore` (optimistic update + conflict retry + `SyncIndicator`) — nothing new needed here, both menu-item and sale mutations flow through the same `mutate()` path.

## Testing

- `DateRangeFilter` and `formatCurrency`: unit tests (pure logic/UI, no mocking needed beyond a fixed "today" date for preset calculations).
- Menu item CRUD (add/edit/delete, including the blocked-delete case): component tests against the Settings page, using the real store with a mocked `fetch` (same pattern the foundation's `Settings.test.tsx` already established).
- Sales form (line-item add/remove, commission auto-calc/override, validation, submission): component tests against the Sales page, same real-store-mocked-fetch pattern.
- Sales list filtering: component test asserting the list narrows correctly when a date range is applied.

## Out of Scope (explicit)

- CSV export.
- Any change to the `AppData`/`Sale`/`MenuItem` type shapes from the foundation.
- Inventory, Expenses, Dashboard, P&L, Insights.
- Multi-user access, login gates, or anything beyond the foundation's single-user GitHub-token model.
