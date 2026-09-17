# Sales & Menu Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real data-entry features on top of the foundation: menu item management (in Settings) and the Sales screen (log a sale with line items, view/filter sale history).

**Architecture:** Two new pure-logic modules (currency formatting, date-range math), a reusable `DateRangeFilter` UI component built on the date-range module, and three feature components (`MenuItemsSection`, `SaleForm`, `SalesList`) that read/write through the foundation's existing `useDataStore.mutate()` — no new persistence code. All new layouts are mobile-first (stacked by default, row layout from `sm:` up), and the foundation's `Nav` component is fixed to wrap on narrow screens instead of scrolling with no affordance.

**Tech Stack:** Same as the foundation — React 18, TypeScript 5 (strict), Zustand, Tailwind, Vitest + Testing Library. No new dependencies.

This is the second of four planned increments (see [the original design spec](2026-09-17-cloud-kitchen-management-app-design.md) and [this increment's spec](2026-09-17-sales-menu-items-design.md)). It builds directly on the foundation plan's `AppData` types, `useDataStore`, and app shell — all already implemented and deployed.

## Global Constraints

- No changes to the `AppData`/`MenuItem`/`Sale`/`SaleLineItem` shapes defined in `src/types.ts` — this plan implements CRUD against the existing shape only.
- All menu item and sale mutations go through `useDataStore`'s existing `mutate: (mutator: (data: AppData) => AppData, message: string) => Promise<void>` — no new sync/persistence logic.
- Menu item deletion is blocked (client-side check, no request sent) if the item's `id` appears in any `sale.lineItems[].menuItemId`.
- Sale line item price defaults from the selected menu item's `defaultPrice` but remains editable per line.
- Zomato commission auto-calculates as `(subtotal * settings.defaultZomatoCommissionPct) / 100` when channel is `"zomato"`, with a per-sale override; absent entirely when channel is `"direct"`.
- Currency displays as `₹` using Indian digit grouping via `Intl`/`toLocaleString("en-IN", ...)` — verified output: `(1234.5).toLocaleString("en-IN", {minimumFractionDigits:2,maximumFractionDigits:2})` → `"1,234.50"`; `(1234567.891)` → `"12,34,567.89"`.
- Date-range math uses **local** calendar dates (not UTC) for "today", so filtering matches what the user visually expects as "today" in their own timezone.
- `crypto.randomUUID()` is available and verified working in this project's Vitest + jsdom environment — use it for new entity IDs (menu items, sales), consistent with no new ID-generation dependency.
- CSV export, Inventory, Expenses, Dashboard, P&L, and Insights are explicitly out of scope for this plan.
- **Mobile-first layout.** This app is used on a phone. Every form row in this plan stacks vertically (`flex-col`) by default and only becomes a horizontal row at the `sm:` breakpoint (640px) and up; inputs are full-width (`w-full`) by default and only take a fixed compact width at `sm:` and up. This applies to every new component in this plan (Tasks 3–6) and to the existing `Nav` component from the foundation (Task 7), which currently cuts off tabs on a 375px-wide screen (`overflow-x-auto` with no scroll affordance) — verified directly against the deployed app.

---

### Task 1: Currency Formatting Helper

**Files:**
- Create: `src/lib/currency.ts`
- Test: `src/lib/currency.test.ts`

**Interfaces:**
- Produces: `formatCurrency(amount: number): string`. Consumed by `MenuItemsSection`, `SaleForm`, and `SalesList` in later tasks.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/currency.test.ts
import { describe, it, expect } from "vitest";
import { formatCurrency } from "./currency";

describe("formatCurrency", () => {
  it("formats a small amount with two decimal places and the rupee symbol", () => {
    expect(formatCurrency(1234.5)).toBe("₹1,234.50");
  });

  it("formats a large amount using Indian digit grouping", () => {
    expect(formatCurrency(1234567.891)).toBe("₹12,34,567.89");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("₹0.00");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/currency.test.ts`
Expected: FAIL — cannot resolve `./currency`.

- [ ] **Step 3: Write `src/lib/currency.ts`**

```typescript
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/currency.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/currency.ts src/lib/currency.test.ts
git commit -m "Add currency formatting helper"
```

---

### Task 2: Date Range Helpers

**Files:**
- Create: `src/lib/dateRange.ts`
- Test: `src/lib/dateRange.test.ts`

**Interfaces:**
- Produces: `DateRange { start: string; end: string }` (both `YYYY-MM-DD`, inclusive, local calendar dates), `presetToRange(preset: "today" | "week" | "month", now?: Date): DateRange`, `isWithinRange(isoDateTime: string, range: DateRange | null): boolean` (`null` range means "all time", always `true`). Consumed by `DateRangeFilter` (Task 3) and `SalesList` (Task 6).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/dateRange.test.ts
import { describe, it, expect } from "vitest";
import { presetToRange, isWithinRange } from "./dateRange";

describe("presetToRange", () => {
  const fixedNow = new Date(2026, 2, 15); // March 15, 2026 (local)

  it("returns today's date for both start and end", () => {
    expect(presetToRange("today", fixedNow)).toEqual({ start: "2026-03-15", end: "2026-03-15" });
  });

  it("returns a 7-day rolling window ending today for 'week'", () => {
    expect(presetToRange("week", fixedNow)).toEqual({ start: "2026-03-09", end: "2026-03-15" });
  });

  it("returns the calendar month to date for 'month'", () => {
    expect(presetToRange("month", fixedNow)).toEqual({ start: "2026-03-01", end: "2026-03-15" });
  });
});

describe("isWithinRange", () => {
  it("returns true for any date when the range is null (all time)", () => {
    expect(isWithinRange("2020-01-01T12:00:00.000Z", null)).toBe(true);
  });

  it("returns true when the date falls within the range (inclusive)", () => {
    const range = { start: "2026-03-01", end: "2026-03-15" };
    expect(isWithinRange("2026-03-01T12:00:00.000Z", range)).toBe(true);
    expect(isWithinRange("2026-03-15T12:00:00.000Z", range)).toBe(true);
  });

  it("returns false when the date falls outside the range", () => {
    const range = { start: "2026-03-01", end: "2026-03-15" };
    expect(isWithinRange("2026-02-28T12:00:00.000Z", range)).toBe(false);
    expect(isWithinRange("2026-03-16T12:00:00.000Z", range)).toBe(false);
  });
});
```

Note: test fixtures use noon UTC (`T12:00:00.000Z`) rather than times near midnight, so the local-date conversion inside `isWithinRange` doesn't flip to an adjacent day depending on the machine's timezone.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/dateRange.test.ts`
Expected: FAIL — cannot resolve `./dateRange`.

- [ ] **Step 3: Write `src/lib/dateRange.ts`**

```typescript
export interface DateRange {
  start: string; // YYYY-MM-DD, inclusive, local calendar date
  end: string; // YYYY-MM-DD, inclusive, local calendar date
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function presetToRange(preset: "today" | "week" | "month", now: Date = new Date()): DateRange {
  const end = toDateString(now);
  if (preset === "today") return { start: end, end };
  if (preset === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { start: toDateString(start), end };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: toDateString(start), end };
}

export function isWithinRange(isoDateTime: string, range: DateRange | null): boolean {
  if (!range) return true;
  const d = toDateString(new Date(isoDateTime));
  return d >= range.start && d <= range.end;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/dateRange.test.ts`
Expected: PASS — 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dateRange.ts src/lib/dateRange.test.ts
git commit -m "Add date-range preset and filtering helpers"
```

---

### Task 3: DateRangeFilter Component

**Files:**
- Create: `src/components/DateRangeFilter.tsx`
- Test: `src/components/DateRangeFilter.test.tsx`

**Interfaces:**
- Consumes: `DateRange`, `presetToRange` from `../lib/dateRange`.
- Produces: default export `DateRangeFilter({ onChange }: { onChange: (range: DateRange | null) => void })`. Renders 5 buttons — `"All Time"`, `"Today"`, `"This Week"`, `"This Month"`, `"Custom"` — and, only when "Custom" is selected, two date inputs labeled `"Start date"` and `"End date"`. Calls `onChange(null)` for All Time, `onChange(presetToRange(...))` for the three presets, and `onChange({ start, end })` once both custom dates are filled. Consumed by `SalesList` (Task 6).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/DateRangeFilter.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DateRangeFilter from "./DateRangeFilter";
import { presetToRange } from "../lib/dateRange";

afterEach(() => {
  vi.useRealTimers();
});

describe("DateRangeFilter", () => {
  it("calls onChange with null for All Time", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "All Time" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("calls onChange with today's range when Today is selected", () => {
    const fixedNow = new Date(2026, 2, 15, 10, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const onChange = vi.fn();
    render(<DateRangeFilter onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Today" }));

    expect(onChange).toHaveBeenCalledWith(presetToRange("today", fixedNow));
  });

  it("calls onChange with this week's range when This Week is selected", () => {
    const fixedNow = new Date(2026, 2, 15, 10, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const onChange = vi.fn();
    render(<DateRangeFilter onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "This Week" }));

    expect(onChange).toHaveBeenCalledWith(presetToRange("week", fixedNow));
  });

  it("calls onChange with this month's range when This Month is selected", () => {
    const fixedNow = new Date(2026, 2, 15, 10, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const onChange = vi.fn();
    render(<DateRangeFilter onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "This Month" }));

    expect(onChange).toHaveBeenCalledWith(presetToRange("month", fixedNow));
  });

  it("calls onChange with a custom range once both start and end dates are set", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));

    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-01-01" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-01-31" } });
    expect(onChange).toHaveBeenCalledWith({ start: "2026-01-01", end: "2026-01-31" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/DateRangeFilter.test.tsx`
Expected: FAIL — cannot resolve `./DateRangeFilter`.

- [ ] **Step 3: Write `src/components/DateRangeFilter.tsx`**

```tsx
import { useState } from "react";
import { DateRange, presetToRange } from "../lib/dateRange";

type Mode = "all" | "today" | "week" | "month" | "custom";

const LABELS: Record<Mode, string> = {
  all: "All Time",
  today: "Today",
  week: "This Week",
  month: "This Month",
  custom: "Custom",
};

interface Props {
  onChange: (range: DateRange | null) => void;
}

export default function DateRangeFilter({ onChange }: Props) {
  const [mode, setMode] = useState<Mode>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  function selectPreset(next: Mode) {
    setMode(next);
    if (next === "all") {
      onChange(null);
    } else if (next === "today" || next === "week" || next === "month") {
      onChange(presetToRange(next));
    }
  }

  function applyCustom(start: string, end: string) {
    setCustomStart(start);
    setCustomEnd(end);
    if (start && end) {
      onChange({ start, end });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {(["all", "today", "week", "month", "custom"] as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => selectPreset(m)}
          className={`rounded px-3 py-1 ${mode === m ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-700"}`}
        >
          {LABELS[m]}
        </button>
      ))}
      {mode === "custom" && (
        <span className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            Start date
            <input
              type="date"
              aria-label="Start date"
              value={customStart}
              onChange={(e) => applyCustom(e.target.value, customEnd)}
              className="rounded border border-gray-300 p-1"
            />
          </label>
          <label className="flex items-center gap-1">
            End date
            <input
              type="date"
              aria-label="End date"
              value={customEnd}
              onChange={(e) => applyCustom(customStart, e.target.value)}
              className="rounded border border-gray-300 p-1"
            />
          </label>
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/DateRangeFilter.test.tsx`
Expected: PASS — 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/DateRangeFilter.tsx src/components/DateRangeFilter.test.tsx
git commit -m "Add reusable DateRangeFilter component"
```

---

### Task 4: Menu Items Management

**Files:**
- Create: `src/components/MenuItemsSection.tsx`
- Test: `src/components/MenuItemsSection.test.tsx`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/Settings.test.tsx`

**Interfaces:**
- Consumes: `useDataStore` from `../store/useDataStore`; `AppData`, `MenuItem` from `../types`; `formatCurrency` from `../lib/currency`.
- Produces: default export `MenuItemsSection` (no props) — reads `data.menuItems`/`data.sales` and `mutate` from the store directly. Renders an `<h2>` with text `"Menu Items"`, a list of items (each with visible `"Edit"` and `"Delete"` buttons), and a form with fields labeled `"Name"`, `"Category"`, `"Default Price"`, and a submit button labeled `"Add Item"` (or `"Update Item"` while editing).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/MenuItemsSection.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MenuItemsSection from "./MenuItemsSection";
import { useDataStore } from "../store/useDataStore";
import { emptyAppData } from "../types";

const config = { token: "t", owner: "me", repo: "cloud-kitchen-data", path: "data.json" };

beforeEach(() => {
  useDataStore.setState({
    data: emptyAppData(),
    sha: "sha1",
    status: "saved",
    error: null,
    config,
    pendingSave: null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubSuccessfulSave() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ content: { sha: "new-sha" } }),
    })
  );
}

describe("MenuItemsSection", () => {
  it("adds a new menu item", async () => {
    stubSuccessfulSave();
    render(<MenuItemsSection />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Paneer Roll" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Rolls" } });
    fireEvent.change(screen.getByLabelText("Default Price"), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Item" }));

    await waitFor(() =>
      expect(useDataStore.getState().data.menuItems).toEqual([
        expect.objectContaining({ name: "Paneer Roll", category: "Rolls", defaultPrice: 120 }),
      ])
    );
    expect(await screen.findByText(/Paneer Roll/)).toBeInTheDocument();
  });

  it("shows a validation error for an invalid price and does not add the item", async () => {
    render(<MenuItemsSection />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Bad Item" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Test" } });
    fireEvent.change(screen.getByLabelText("Default Price"), { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Item" }));

    expect(await screen.findByText(/Enter a name, category, and a valid price/)).toBeInTheDocument();
    expect(useDataStore.getState().data.menuItems).toEqual([]);
  });

  it("edits an existing menu item", async () => {
    stubSuccessfulSave();
    useDataStore.setState({
      data: {
        ...emptyAppData(),
        menuItems: [{ id: "m1", name: "Old Name", category: "Old Cat", defaultPrice: 50 }],
      },
    });
    render(<MenuItemsSection />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Item" }));

    await waitFor(() =>
      expect(useDataStore.getState().data.menuItems).toEqual([
        { id: "m1", name: "New Name", category: "Old Cat", defaultPrice: 50 },
      ])
    );
  });

  it("blocks deleting a menu item referenced by an existing sale", async () => {
    useDataStore.setState({
      data: {
        ...emptyAppData(),
        menuItems: [{ id: "m1", name: "Referenced Item", category: "Cat", defaultPrice: 50 }],
        sales: [
          {
            id: "s1",
            date: "2026-01-01T00:00:00.000Z",
            channel: "direct",
            lineItems: [{ menuItemId: "m1", qty: 1, price: 50 }],
          },
        ],
      },
    });
    render(<MenuItemsSection />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText(/used in an existing sale/)).toBeInTheDocument();
    expect(useDataStore.getState().data.menuItems).toHaveLength(1);
  });

  it("deletes an unreferenced menu item", async () => {
    stubSuccessfulSave();
    useDataStore.setState({
      data: {
        ...emptyAppData(),
        menuItems: [{ id: "m1", name: "Unused Item", category: "Cat", defaultPrice: 50 }],
      },
    });
    render(<MenuItemsSection />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(useDataStore.getState().data.menuItems).toEqual([]));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/MenuItemsSection.test.tsx`
Expected: FAIL — cannot resolve `./MenuItemsSection`.

- [ ] **Step 3: Write `src/components/MenuItemsSection.tsx`**

```tsx
import { FormEvent, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { AppData, MenuItem } from "../types";
import { formatCurrency } from "../lib/currency";

function generateId(): string {
  return crypto.randomUUID();
}

export default function MenuItemsSection() {
  const menuItems = useDataStore((s) => s.data.menuItems);
  const sales = useDataStore((s) => s.data.sales);
  const mutate = useDataStore((s) => s.mutate);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category);
    setDefaultPrice(String(item.defaultPrice));
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setCategory("");
    setDefaultPrice("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const price = Number(defaultPrice);
    if (!name.trim() || !category.trim() || !Number.isFinite(price) || price < 0) {
      setError("Enter a name, category, and a valid price.");
      return;
    }
    setError(null);

    if (editingId) {
      const updated: MenuItem = {
        id: editingId,
        name: name.trim(),
        category: category.trim(),
        defaultPrice: price,
      };
      await mutate(
        (data: AppData) => ({
          ...data,
          menuItems: data.menuItems.map((m) => (m.id === editingId ? updated : m)),
        }),
        `Update menu item: ${updated.name}`
      );
    } else {
      const newItem: MenuItem = {
        id: generateId(),
        name: name.trim(),
        category: category.trim(),
        defaultPrice: price,
      };
      await mutate(
        (data: AppData) => ({ ...data, menuItems: [...data.menuItems, newItem] }),
        `Add menu item: ${newItem.name}`
      );
    }
    resetForm();
  }

  async function handleDelete(id: string) {
    const isReferenced = sales.some((sale) => sale.lineItems.some((li) => li.menuItemId === id));
    if (isReferenced) {
      setError("Can't delete this item — it's used in an existing sale.");
      return;
    }
    setError(null);
    await mutate(
      (data: AppData) => ({ ...data, menuItems: data.menuItems.filter((m) => m.id !== id) }),
      "Delete menu item"
    );
  }

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">Menu Items</h2>
      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
      <ul className="mb-4 divide-y divide-gray-200">
        {menuItems.map((item) => (
          <li key={item.id} className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span>
              {item.name} <span className="text-gray-500">({item.category})</span> —{" "}
              {formatCurrency(item.defaultPrice)}
            </span>
            <span className="flex gap-3">
              <button type="button" onClick={() => startEdit(item)} className="text-orange-700 underline">
                Edit
              </button>
              <button type="button" onClick={() => handleDelete(item.id)} className="text-red-700 underline">
                Delete
              </button>
            </span>
          </li>
        ))}
        {menuItems.length === 0 && <li className="py-2 text-sm text-gray-500">No menu items yet.</li>}
      </ul>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col text-sm">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
          />
        </label>
        <label className="flex flex-col text-sm">
          Category
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
          />
        </label>
        <label className="flex flex-col text-sm">
          Default Price
          <input
            type="number"
            step="0.01"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-28"
          />
        </label>
        <button type="submit" className="rounded bg-orange-600 px-4 py-2 text-white">
          {editingId ? "Update Item" : "Add Item"}
        </button>
        {editingId && (
          <button type="button" onClick={resetForm} className="rounded border border-gray-300 px-4 py-2">
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/MenuItemsSection.test.tsx`
Expected: PASS — 5 tests passed.

- [ ] **Step 5: Wire it into Settings — modify `src/pages/Settings.tsx`**

Add the import at the top (alongside the existing `useDataStore` import):

```tsx
import MenuItemsSection from "../components/MenuItemsSection";
```

Add this line right after the existing `{status === "error" && ...}` block, before the closing `</div>` of the component's returned JSX:

```tsx
      {status === "saved" && <MenuItemsSection />}
```

- [ ] **Step 6: Add a failing test for the wiring — modify `src/pages/Settings.test.tsx`**

Add this test inside the existing `describe("Settings", ...)` block, after the last existing test:

```tsx
  it("renders the Menu Items section once connected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ content: utf8ToBase64(JSON.stringify(emptyAppData())), sha: "abc123" }),
      })
    );

    render(<Settings />);
    fillAndSubmit();

    expect(await screen.findByText("Menu Items")).toBeInTheDocument();
  });
```

- [ ] **Step 7: Run the full Settings test file to verify it passes**

Run: `npm test -- src/pages/Settings.test.tsx`
Expected: PASS — 4 tests passed (3 existing + 1 new).

- [ ] **Step 8: Commit**

```bash
git add src/components/MenuItemsSection.tsx src/components/MenuItemsSection.test.tsx src/pages/Settings.tsx src/pages/Settings.test.tsx
git commit -m "Add menu item management to Settings"
```

---

### Task 5: Sale Entry Form

**Files:**
- Create: `src/components/SaleForm.tsx`
- Test: `src/components/SaleForm.test.tsx`

**Interfaces:**
- Consumes: `useDataStore` from `../store/useDataStore`; `AppData`, `Sale`, `SaleChannel`, `SaleLineItem` from `../types`; `formatCurrency` from `../lib/currency`.
- Produces: default export `SaleForm` (no props) — reads `data.menuItems`, `data.settings.defaultZomatoCommissionPct`, and `mutate` from the store. Renders a field labeled `"Channel"` (select, `"direct"`/`"zomato"`), one or more line-item rows each with fields labeled `"Item"`, `"Qty"`, `"Price"` and (when more than one line) a `"Remove"` button, an `"Add another item"` control, and — only when channel is `"zomato"` — a field labeled `"Zomato Commission"`. Submit button labeled `"Log Sale"`. If `data.menuItems` is empty, renders a prompt instead of the form. Consumed by `src/pages/Sales.tsx` (Task 6).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/SaleForm.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SaleForm from "./SaleForm";
import { useDataStore } from "../store/useDataStore";
import { emptyAppData } from "../types";

const config = { token: "t", owner: "me", repo: "cloud-kitchen-data", path: "data.json" };

function stubSuccessfulSave() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ content: { sha: "new-sha" } }),
    })
  );
}

beforeEach(() => {
  useDataStore.setState({
    data: {
      ...emptyAppData(),
      menuItems: [
        { id: "m1", name: "Paneer Roll", category: "Rolls", defaultPrice: 120 },
        { id: "m2", name: "Veg Biryani", category: "Mains", defaultPrice: 180 },
      ],
      settings: { defaultZomatoCommissionPct: 20 },
    },
    sha: "sha1",
    status: "saved",
    error: null,
    config,
    pendingSave: null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SaleForm", () => {
  it("prompts to add a menu item first when none exist", () => {
    useDataStore.setState({ data: emptyAppData() });
    render(<SaleForm />);
    expect(screen.getByText(/Add a menu item in Settings/i)).toBeInTheDocument();
  });

  it("prefills the line price from the selected menu item's default price", () => {
    render(<SaleForm />);
    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "m1" } });
    expect(screen.getByLabelText("Price")).toHaveValue(120);
  });

  it("logs a direct sale with a single line item", async () => {
    stubSuccessfulSave();
    render(<SaleForm />);

    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "m1" } });
    fireEvent.change(screen.getByLabelText("Qty"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Sale" }));

    await waitFor(() => expect(useDataStore.getState().data.sales).toHaveLength(1));
    const sale = useDataStore.getState().data.sales[0];
    expect(sale.channel).toBe("direct");
    expect(sale.lineItems).toEqual([{ menuItemId: "m1", qty: 2, price: 120 }]);
    expect(sale.zomatoCommission).toBeUndefined();
  });

  it("auto-calculates Zomato commission from the default percentage, with override", async () => {
    stubSuccessfulSave();
    render(<SaleForm />);

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "zomato" } });
    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "m2" } });
    fireEvent.change(screen.getByLabelText("Qty"), { target: { value: "1" } });

    expect(screen.getByLabelText("Zomato Commission")).toHaveValue(36);

    fireEvent.change(screen.getByLabelText("Zomato Commission"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Sale" }));

    await waitFor(() => expect(useDataStore.getState().data.sales).toHaveLength(1));
    expect(useDataStore.getState().data.sales[0].zomatoCommission).toBe(40);
  });

  it("supports adding and removing line items", () => {
    render(<SaleForm />);
    expect(screen.getAllByLabelText("Item")).toHaveLength(1);

    fireEvent.click(screen.getByText("Add another item"));
    expect(screen.getAllByLabelText("Item")).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(screen.getAllByLabelText("Item")).toHaveLength(1);
  });

  it("shows a validation error and does not submit when qty is zero", async () => {
    render(<SaleForm />);
    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "m1" } });
    fireEvent.change(screen.getByLabelText("Qty"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Sale" }));

    expect(
      await screen.findByText(/Each line needs a menu item, a quantity greater than 0/)
    ).toBeInTheDocument();
    expect(useDataStore.getState().data.sales).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/SaleForm.test.tsx`
Expected: FAIL — cannot resolve `./SaleForm`.

- [ ] **Step 3: Write `src/components/SaleForm.tsx`**

```tsx
import { FormEvent, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { AppData, Sale, SaleChannel, SaleLineItem } from "../types";
import { formatCurrency } from "../lib/currency";

interface DraftLine {
  menuItemId: string;
  qty: string;
  price: string;
}

function generateId(): string {
  return crypto.randomUUID();
}

function emptyLine(): DraftLine {
  return { menuItemId: "", qty: "1", price: "" };
}

export default function SaleForm() {
  const menuItems = useDataStore((s) => s.data.menuItems);
  const defaultCommissionPct = useDataStore((s) => s.data.settings.defaultZomatoCommissionPct);
  const mutate = useDataStore((s) => s.mutate);

  const [channel, setChannel] = useState<SaleChannel>("direct");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [commission, setCommission] = useState("");
  const [commissionTouched, setCommissionTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = lines.reduce((sum, l) => {
    const qty = Number(l.qty);
    const price = Number(l.price);
    return sum + (Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0);
  }, 0);

  const autoCommission = (subtotal * defaultCommissionPct) / 100;
  const effectiveCommission = commissionTouched ? Number(commission) : autoCommission;

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function selectMenuItem(index: number, menuItemId: string) {
    const item = menuItems.find((m) => m.id === menuItemId);
    updateLine(index, { menuItemId, price: item ? String(item.defaultPrice) : "" });
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const parsedLines: SaleLineItem[] = [];
    for (const l of lines) {
      const qty = Number(l.qty);
      const price = Number(l.price);
      if (!l.menuItemId || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
        setError("Each line needs a menu item, a quantity greater than 0, and a valid price.");
        return;
      }
      parsedLines.push({ menuItemId: l.menuItemId, qty, price });
    }
    setError(null);

    const sale: Sale = {
      id: generateId(),
      date: new Date().toISOString(),
      channel,
      lineItems: parsedLines,
      ...(channel === "zomato" ? { zomatoCommission: effectiveCommission } : {}),
    };

    await mutate((data: AppData) => ({ ...data, sales: [...data.sales, sale] }), "Log sale");

    setChannel("direct");
    setLines([emptyLine()]);
    setCommission("");
    setCommissionTouched(false);
  }

  if (menuItems.length === 0) {
    return <p className="text-sm text-gray-500">Add a menu item in Settings before logging a sale.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-3">
      {error && <p className="text-sm text-red-700">{error}</p>}
      <label className="flex flex-col text-sm">
        Channel
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as SaleChannel)}
          className="mt-1 rounded border border-gray-300 p-2"
        >
          <option value="direct">Direct</option>
          <option value="zomato">Zomato</option>
        </select>
      </label>

      {lines.map((line, index) => (
        <div key={index} className="flex flex-col gap-2 border-b border-gray-100 pb-2 sm:flex-row sm:flex-wrap sm:items-end sm:border-b-0 sm:pb-0">
          <label className="flex flex-col text-sm">
            Item
            <select
              value={line.menuItemId}
              onChange={(e) => selectMenuItem(index, e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
            >
              <option value="">Select item</option>
              {menuItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            Qty
            <input
              type="number"
              value={line.qty}
              onChange={(e) => updateLine(index, { qty: e.target.value })}
              className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-20"
            />
          </label>
          <label className="flex flex-col text-sm">
            Price
            <input
              type="number"
              step="0.01"
              value={line.price}
              onChange={(e) => updateLine(index, { price: e.target.value })}
              className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-28"
            />
          </label>
          {lines.length > 1 && (
            <button type="button" onClick={() => removeLine(index)} className="self-start text-red-700 underline">
              Remove
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={addLine} className="self-start text-sm text-orange-700 underline">
        Add another item
      </button>

      <p className="text-sm font-medium">Subtotal: {formatCurrency(subtotal)}</p>

      {channel === "zomato" && (
        <label className="flex flex-col text-sm">
          Zomato Commission
          <input
            type="number"
            step="0.01"
            value={commissionTouched ? commission : autoCommission.toFixed(2)}
            onChange={(e) => {
              setCommissionTouched(true);
              setCommission(e.target.value);
            }}
            className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-28"
          />
        </label>
      )}

      <button type="submit" className="self-start rounded bg-orange-600 px-4 py-2 text-white">
        Log Sale
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/SaleForm.test.tsx`
Expected: PASS — 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/SaleForm.tsx src/components/SaleForm.test.tsx
git commit -m "Add sale entry form with line items and Zomato commission"
```

---

### Task 6: Sales List, Date Filtering, and Page Composition

**Files:**
- Create: `src/components/SalesList.tsx`
- Test: `src/components/SalesList.test.tsx`
- Modify: `src/pages/Sales.tsx`

**Interfaces:**
- Consumes: `useDataStore` from `../store/useDataStore`; `DateRange`, `isWithinRange` from `../lib/dateRange`; `formatCurrency` from `../lib/currency`; default export `DateRangeFilter` from `./DateRangeFilter` (Task 3).
- Produces: default export `SalesList` (no props) — reads `data.sales`/`data.menuItems` from the store, renders a `DateRangeFilter` above a list of sales (newest first), each showing date, channel (`"Zomato"`/`"Direct"`), an item summary (`"<qty>x <name>"` per line, comma-separated), the sale total, and commission (if present). Shows `"No sales in this range."` when the filtered list is empty. Consumed by `src/pages/Sales.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/SalesList.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SalesList from "./SalesList";
import { useDataStore } from "../store/useDataStore";
import { emptyAppData } from "../types";

beforeEach(() => {
  useDataStore.setState({
    data: {
      ...emptyAppData(),
      menuItems: [{ id: "m1", name: "Paneer Roll", category: "Rolls", defaultPrice: 120 }],
      sales: [
        {
          id: "s-old",
          date: "2020-01-01T12:00:00.000Z",
          channel: "direct",
          lineItems: [{ menuItemId: "m1", qty: 1, price: 120 }],
        },
        {
          id: "s-recent",
          date: new Date().toISOString(),
          channel: "zomato",
          lineItems: [{ menuItemId: "m1", qty: 2, price: 120 }],
          zomatoCommission: 48,
        },
      ],
    },
    sha: "sha1",
    status: "saved",
    error: null,
    config: { token: "t", owner: "me", repo: "cloud-kitchen-data", path: "data.json" },
    pendingSave: null,
  });
});

describe("SalesList", () => {
  it("lists all sales, newest first, with item summary and totals", () => {
    render(<SalesList />);
    expect(screen.getAllByText(/Paneer Roll/)).toHaveLength(2);
    expect(screen.getByText(/Commission: ₹48\.00/)).toBeInTheDocument();
  });

  it("filters out sales outside the selected date range", () => {
    render(<SalesList />);
    fireEvent.click(screen.getByRole("button", { name: "Today" }));

    expect(screen.getAllByText(/Paneer Roll/)).toHaveLength(1);
    expect(screen.getByText(/Zomato/)).toBeInTheDocument();
  });

  it("shows a message when no sales fall in the selected range", () => {
    render(<SalesList />);
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2099-01-01" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2099-01-02" } });

    expect(screen.getByText("No sales in this range.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/SalesList.test.tsx`
Expected: FAIL — cannot resolve `./SalesList`.

- [ ] **Step 3: Write `src/components/SalesList.tsx`**

```tsx
import { useMemo, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { DateRange, isWithinRange } from "../lib/dateRange";
import { formatCurrency } from "../lib/currency";
import DateRangeFilter from "./DateRangeFilter";
import type { Sale } from "../types";

export default function SalesList() {
  const sales = useDataStore((s) => s.data.sales);
  const menuItems = useDataStore((s) => s.data.menuItems);
  const [range, setRange] = useState<DateRange | null>(null);

  const filtered = useMemo(
    () =>
      sales
        .filter((sale) => isWithinRange(sale.date, range))
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date)),
    [sales, range]
  );

  function itemsSummary(sale: Sale): string {
    return sale.lineItems
      .map((li) => {
        const item = menuItems.find((m) => m.id === li.menuItemId);
        return `${li.qty}x ${item ? item.name : "Unknown item"}`;
      })
      .join(", ");
  }

  function saleTotal(sale: Sale): number {
    return sale.lineItems.reduce((sum, li) => sum + li.qty * li.price, 0);
  }

  return (
    <div>
      <DateRangeFilter onChange={setRange} />
      <ul className="mt-4 divide-y divide-gray-200">
        {filtered.map((sale) => (
          <li key={sale.id} className="py-2 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span>
                {new Date(sale.date).toLocaleDateString()} · {sale.channel === "zomato" ? "Zomato" : "Direct"}
              </span>
              <span>{formatCurrency(saleTotal(sale))}</span>
            </div>
            <div className="text-gray-500">{itemsSummary(sale)}</div>
            {sale.zomatoCommission !== undefined && (
              <div className="text-gray-500">Commission: {formatCurrency(sale.zomatoCommission)}</div>
            )}
          </li>
        ))}
        {filtered.length === 0 && <li className="py-2 text-sm text-gray-500">No sales in this range.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/SalesList.test.tsx`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Compose the Sales page — modify `src/pages/Sales.tsx`**

Replace the entire file content:

```tsx
import SaleForm from "../components/SaleForm";
import SalesList from "../components/SalesList";

export default function Sales() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Sales</h1>
      <SaleForm />
      <SalesList />
    </div>
  );
}
```

- [ ] **Step 6: Run the full test suite and verify the build**

Run: `npm test`
Expected: PASS — all test files pass (the foundation's existing files plus this plan's new ones: `currency.test.ts`, `dateRange.test.ts`, `DateRangeFilter.test.tsx`, `MenuItemsSection.test.tsx`, `SaleForm.test.tsx`, `SalesList.test.tsx`, and the updated `Settings.test.tsx`).

Run: `npm run build`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/SalesList.tsx src/components/SalesList.test.tsx src/pages/Sales.tsx
git commit -m "Add sales list with date filtering and compose the Sales page"
```

---

### Task 7: Mobile Nav Layout Fix

**Files:**
- Modify: `src/components/Nav.tsx`
- Test: `src/components/Nav.test.tsx`

**Interfaces:**
- No signature changes — `Nav` still takes no props and renders the same 7 links. Only the wrapping `<nav>` element's CSS classes change.

**Context:** Verified directly against the deployed app at a 375px viewport width: the current `<nav className="flex gap-4 overflow-x-auto ...">` requires horizontal scrolling to reach later tabs, with no visual indication that more tabs exist off-screen — "Settings" and part of "Insights" are cut off. Switching to `flex-wrap` lets the 7 links wrap onto a second line instead, which is legible without any scroll interaction.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/Nav.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Nav from "./Nav";

describe("Nav", () => {
  it("wraps onto multiple lines instead of scrolling horizontally", () => {
    render(
      <MemoryRouter>
        <Nav />
      </MemoryRouter>
    );
    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("flex-wrap");
    expect(nav.className).not.toContain("overflow-x-auto");
  });

  it("still renders all 7 nav links", () => {
    render(
      <MemoryRouter>
        <Nav />
      </MemoryRouter>
    );
    for (const label of ["Dashboard", "Sales", "Inventory", "Expenses", "P&L", "Insights", "Settings"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/Nav.test.tsx`
Expected: FAIL — `nav.className` still contains `overflow-x-auto` and not `flex-wrap`.

- [ ] **Step 3: Modify `src/components/Nav.tsx`**

Change the `<nav>` element's `className` from:

```tsx
    <nav className="flex gap-4 overflow-x-auto border-b border-orange-200 bg-orange-50 px-4 py-2">
```

to:

```tsx
    <nav className="flex flex-wrap gap-x-4 gap-y-2 border-b border-orange-200 bg-orange-50 px-4 py-2">
```

The rest of the file (the `links` array and the `NavLink` mapping) is unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/Nav.test.tsx`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Manually verify at mobile width**

This is a layout change best confirmed visually, not just by class assertions. Run `npm run dev`, open the app in a browser, and use devtools' device toolbar (or resize the window) to ~375px wide. Confirm the 7 nav links wrap onto one or two lines with no horizontal scrollbar on the nav bar, and that every link is fully visible and tappable.

- [ ] **Step 6: Run the full test suite and verify the build**

Run: `npm test`
Expected: PASS — all test files from this plan plus the foundation's, including the new `Nav.test.tsx`.

Run: `npm run build`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/Nav.tsx src/components/Nav.test.tsx
git commit -m "Make nav wrap instead of horizontally scrolling on narrow screens"
```

---

## Self-Review Notes

- **Spec coverage:** this plan covers every item in the Sales & Menu Items spec's "In scope" list — menu item add/edit/delete (with referenced-item delete guard), the sale entry form (line items, price prefill/override, Zomato commission auto-calc/override, validation), the sales history list, date-range filtering, and currency formatting. CSV export and all other screens are explicitly deferred, matching the spec's "Out of scope" section.
- **Placeholder scan:** no TBD/TODO markers; every step has complete, runnable code, verified against the actual current foundation code (`Settings.tsx`, `useDataStore.ts`, `types.ts` were read directly before writing this plan) and against real `Intl`/date-math output (verified via `node -e` before writing the exact test expectations) and `crypto.randomUUID()` availability (verified via a throwaway Vitest run in this project).
- **Type consistency:** `AppData`, `MenuItem`, `Sale`, `SaleChannel`, `SaleLineItem`, `DateRange` are imported with identical names/shapes across every task that uses them. `mutate`'s signature (`(mutator: (data: AppData) => AppData, message: string) => Promise<void>`) matches the foundation's actual implementation in every call site in this plan.
- **Mobile-first layout:** added after reviewing the deployed app at 375px width, which showed the nav bar cutting off tabs. Every new form row (Tasks 3–6) stacks vertically below the `sm:` breakpoint and every input is full-width by default; Task 7 fixes the existing `Nav` component's horizontal-scroll-with-no-affordance problem by switching it to wrap.
