# Inventory & Expenses — Design

## Purpose

Third increment of the Cloud Kitchen Manager app. Builds on the [foundation](2026-09-17-cloud-kitchen-management-app-design.md) and [Sales & Menu Items](2026-09-17-sales-menu-items-design.md) increments (both live and deployed) to add the two remaining data-entry screens: Inventory (a stock ledger) and Expenses. Together with Sales, this completes the raw data this app needs — Plan 4 (Dashboard/P&L/Insights) is pure reporting on top of what these three increments capture.

## Scope

In scope:
- Inventory item management (add/edit/delete) inside the Settings screen, mirroring the existing Menu Items pattern.
- The Inventory screen: log stock-in/stock-out moves, view current stock with a low-stock flag, view a filterable stock-move history.
- A linked "log this stock-in as an Ingredients expense too" flow, creating both a `StockMove` and an `Expense` in a single save.
- The Expenses screen: log an expense (category/amount/date/note), view a filterable expense history (by category and date range).

Out of scope (deferred to Plan 4): Dashboard, P&L, Insights, the low-stock banner (Dashboard-level rollup), CSV export.

## Key Decisions

- **Inventory items are managed in Settings**, same pattern as menu items: add/edit/delete, delete blocked if the item has any `StockMove` referencing it (same integrity approach as the menu-item/sale delete guard from Plan 2 — no data-model change needed).
- **Stock moves require a pre-existing inventory item** (selected from a dropdown), not free-text entry — keeps `unit`/`lowStockThreshold` meaningful and matches how Sales already requires a pre-existing menu item.
- **`currentQty` is maintained by applying each stock move** at log time: `"in"` adds `qty`, `"out"` subtracts it. No separate recalculation/reconciliation step — the stored `currentQty` is always the running total.
- **Stock-in can optionally also log an Ingredients expense in the same action.** When logging a stock-in, a checkbox reveals an amount field; on submit, both the `StockMove` and the `Expense` (category `"Ingredients"`) are added in a single `mutate()` call (one optimistic update, one save) — not two separate saves, to avoid a partial-write window where only one side landed.
- **Inventory history is one flat, filterable list** (all items' moves together, reusing `DateRangeFilter`), not a per-item drill-down page — consistent with how the Sales list already works, and avoids adding new routes.
- **Expense categories available for manual entry**: `Ingredients`, `Rent`, `Utilities`, `Staff`, `Packaging`, `Other`. `"Zomato Commission"` is excluded from the manual-entry dropdown — it's auto-derived from `Sale.zomatoCommission` for P&L purposes (Plan 4), never a manually-created `Expense` record, per the foundation's Global Constraints (P&L formula reads commission from `sales`, not `expenses`).
- **Expense list filters by category and date range** — category via a dropdown (including "All"), date range via the existing `DateRangeFilter`.

## Data Model

No changes to the `AppData` shape from the foundation (`src/types.ts`). This plan implements CRUD against the existing `inventory`, `stockMoves`, and `expenses` arrays:

```ts
InventoryItem { id, name, unit, currentQty, lowStockThreshold }
StockMove { id, date, inventoryItemId, type: "in"|"out", qty, note }
Expense { id, date, category: ExpenseCategory, amount, note }
```

## Components & Files (high level — the implementation plan pins exact paths)

- **Settings additions** — an "Inventory Items" section (parallel structure to the existing `MenuItemsSection`): list (name, unit, current qty, low-stock flag), add-item inline form (name, unit, low-stock threshold — `currentQty` starts at 0, only stock moves change it thereafter), per-row edit/delete. Delete blocked (inline error) if the item's `id` appears in any `stockMoves[].inventoryItemId`.
- **Inventory page** (replacing the current stub):
  - Item list with a low-stock visual flag (`currentQty <= lowStockThreshold`).
  - A stock-move form: item dropdown (from `inventory`), type (In/Out), quantity, note; when type is "In", a checkbox reveals an "Ingredients expense amount" field. Validation: item selected, `qty > 0`; if the expense checkbox is checked, amount must be a valid non-negative number.
  - A stock-move history list below, newest first, filtered by `DateRangeFilter`, showing date, item name, type, qty, note.
  - If no inventory items exist yet, the move form shows a prompt to add one in Settings first (same pattern as `SaleForm`'s empty-menu-items prompt).
- **Expenses page** (replacing the current stub):
  - An expense form: category (dropdown, the 5 manually-loggable categories), amount, date (defaults to today, editable — unlike sales, which are always "now", expenses are often logged after the fact, e.g. paying rent), note. Validation: category selected, amount is a valid non-negative number.
  - An expense list below, newest first, filtered by category dropdown ("All" + the 6 categories, since past-logged Zomato-commission-labeled expenses — none will exist, but the filter dropdown for *viewing* isn't the same list as the entry dropdown) and `DateRangeFilter`.

## Error Handling

- Deleting a referenced inventory item: inline error, no request sent (client-side check against `data.stockMoves`, same as the menu-item guard).
- Stock-in-with-expense: single `mutate()` call constructs both new records and appends them together; if the save fails, the foundation's existing retry/conflict handling covers it exactly as it does for every other mutation — no new persistence logic.
- Form validation: inline, per-field, matching the existing `SaleForm`/`MenuItemsSection` patterns (block submit, show error, don't clear the form on failure).
- Submit buttons disable while `status === "saving"` — same double-submit protection added to `SaleForm`/`MenuItemsSection` in Plan 2's final-review fixes; applied here from the start rather than retrofitted.

## Testing

- Inventory item CRUD (add/edit/delete, blocked-delete case): component tests against the new Inventory Items Settings section, same real-store-mocked-fetch pattern as `MenuItemsSection.test.tsx`.
- Stock-move form (in/out, currentQty updates correctly, the linked-expense checkbox creates both records in one save, validation): component tests against the Inventory page's move form.
- Stock-move list filtering: component test asserting the list narrows correctly by date range, mirroring `SalesList.test.tsx`.
- Expense form (category/amount/date/note, validation): component tests against the Expenses page's form.
- Expense list filtering: component test asserting narrowing by both category and date range.

## Out of Scope (explicit)

- Dashboard, P&L, Insights, and the low-stock banner (all Plan 4).
- CSV export.
- Per-item cost tracking / COGS costing beyond the flat "log the purchase as an expense" link — no per-unit cost history on `InventoryItem`.
- Any change to the `AppData`/`InventoryItem`/`StockMove`/`Expense` type shapes from the foundation.
- Backdating sales (unrelated to this plan — sales still always stamp "now", per Plan 2).
