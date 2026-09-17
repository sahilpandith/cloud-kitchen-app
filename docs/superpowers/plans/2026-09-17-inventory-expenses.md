# Inventory & Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Inventory (stock ledger, with optional linked expense logging) and Expenses screens on top of the foundation and Sales & Menu Items increments.

**Architecture:** Six new feature components following the exact patterns already established in the Sales & Menu Items increment — `InventoryItemsSection` mirrors `MenuItemsSection`, `StockMovesList`/`ExpensesList` mirror `SalesList` (reusing the existing `DateRangeFilter`), and `StockMoveForm`/`ExpenseForm` mirror `SaleForm`. All mutations go through the existing `useDataStore.mutate()` — no new persistence code.

**Tech Stack:** Same as prior increments — React 18, TypeScript 5 (strict), Zustand, Tailwind, Vitest + Testing Library. No new dependencies.

This is the third of four planned increments (see [the original design spec](2026-09-17-cloud-kitchen-management-app-design.md) and [this increment's spec](2026-09-17-inventory-expenses-design.md)). It builds directly on the foundation's `AppData` types/`useDataStore`/app shell and the Sales & Menu Items increment's `DateRangeFilter`/`formatCurrency`/`dateRange` helpers — all already implemented and deployed.

## Global Constraints

- No changes to the `AppData`/`InventoryItem`/`StockMove`/`Expense` shapes defined in `src/types.ts` — this plan implements CRUD against the existing shape only.
- All mutations go through `useDataStore`'s existing `mutate: (mutator: (data: AppData) => AppData, message: string) => Promise<void>` — no new sync/persistence logic.
- Inventory item deletion is blocked (client-side check, no request sent) if the item's `id` appears in any `stockMoves[].inventoryItemId` — same pattern as the menu-item delete guard.
- `InventoryItem.currentQty` is updated by applying the move at log time: `"in"` adds `qty`, `"out"` subtracts it. No separate reconciliation step.
- Logging a stock-in with the linked-expense checkbox checked creates both the `StockMove` and the `Expense` (category `"Ingredients"`) in a **single** `mutate()` call — one optimistic update, one save, never two separate saves for one user action.
- `ExpenseCategory` (from `src/types.ts`) is exactly `"Ingredients" | "Rent" | "Utilities" | "Staff" | "Packaging" | "Other"` — all six are valid for manual entry. There is no `"Zomato Commission"` member of this type at all (it's a P&L-reporting concept computed from `Sale.zomatoCommission`, never an actual `Expense` record) — don't add one.
- Submit buttons disable while `status === "saving"` (`disabled={status === "saving"}` with `disabled:opacity-50`) on every new form in this plan, from the start — this was a final-review fix retrofitted onto `SaleForm`/`MenuItemsSection` in the prior increment; here it's built in directly.
- Mobile-first layout: every new form row stacks vertically (`flex-col`) by default and only becomes a horizontal row at the `sm:` breakpoint (640px); every input is full-width (`w-full`) by default, fixed/auto width only at `sm:` and up — exactly the pattern already used in `MenuItemsSection.tsx`, `SaleForm.tsx`, and `DateRangeFilter.tsx` (all read directly before writing this plan).
- `crypto.randomUUID()` is available and verified working in this project's Vitest + jsdom environment (established in the foundation plan) — use it for new entity IDs.
- Currency displays via the existing `formatCurrency` from `src/lib/currency.ts` (verified output: `(500).toLocaleString("en-IN", {minimumFractionDigits:2,maximumFractionDigits:2})` → `"500.00"`, so `formatCurrency(500)` → `"₹500.00"`).
- CSV export, Dashboard, P&L, Insights, and the low-stock banner are explicitly out of scope for this plan.

---

### Task 1: Inventory Item Management (Settings)

**Files:**
- Create: `src/components/InventoryItemsSection.tsx`
- Test: `src/components/InventoryItemsSection.test.tsx`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/Settings.test.tsx`

**Interfaces:**
- Consumes: `useDataStore` from `../store/useDataStore`; `AppData`, `InventoryItem` from `../types`.
- Produces: default export `InventoryItemsSection` (no props) — reads `data.inventory`/`data.stockMoves`/`status` and `mutate` from the store directly. Renders an `<h2>` with text `"Inventory Items"`, a list of items (each with visible `"Edit"` and `"Delete"` buttons), and a form with fields labeled `"Name"`, `"Unit"`, `"Low-Stock Threshold"`, and a submit button labeled `"Add Item"` (or `"Update Item"` while editing).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/InventoryItemsSection.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InventoryItemsSection from "./InventoryItemsSection";
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

describe("InventoryItemsSection", () => {
  it("adds a new inventory item with currentQty starting at 0", async () => {
    stubSuccessfulSave();
    render(<InventoryItemsSection />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Paneer" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "kg" } });
    fireEvent.change(screen.getByLabelText("Low-Stock Threshold"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Item" }));

    await waitFor(() =>
      expect(useDataStore.getState().data.inventory).toEqual([
        expect.objectContaining({ name: "Paneer", unit: "kg", currentQty: 0, lowStockThreshold: 5 }),
      ])
    );
  });

  it("shows a validation error for a missing threshold and does not add the item", async () => {
    render(<InventoryItemsSection />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Bad Item" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "kg" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Item" }));

    expect(
      await screen.findByText(/Enter a name, unit, and a valid low-stock threshold/)
    ).toBeInTheDocument();
    expect(useDataStore.getState().data.inventory).toEqual([]);
  });

  it("edits an existing inventory item while preserving currentQty", async () => {
    stubSuccessfulSave();
    useDataStore.setState({
      data: {
        ...emptyAppData(),
        inventory: [{ id: "i1", name: "Old Name", unit: "kg", currentQty: 12, lowStockThreshold: 3 }],
      },
    });
    render(<InventoryItemsSection />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Item" }));

    await waitFor(() =>
      expect(useDataStore.getState().data.inventory).toEqual([
        { id: "i1", name: "New Name", unit: "kg", currentQty: 12, lowStockThreshold: 3 },
      ])
    );
  });

  it("blocks deleting an inventory item referenced by a stock move", async () => {
    useDataStore.setState({
      data: {
        ...emptyAppData(),
        inventory: [{ id: "i1", name: "Referenced Item", unit: "kg", currentQty: 5, lowStockThreshold: 2 }],
        stockMoves: [
          {
            id: "m1",
            date: "2026-01-01T00:00:00.000Z",
            inventoryItemId: "i1",
            type: "in",
            qty: 5,
            note: "",
          },
        ],
      },
    });
    render(<InventoryItemsSection />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText(/has stock move history/)).toBeInTheDocument();
    expect(useDataStore.getState().data.inventory).toHaveLength(1);
  });

  it("deletes an unreferenced inventory item", async () => {
    stubSuccessfulSave();
    useDataStore.setState({
      data: {
        ...emptyAppData(),
        inventory: [{ id: "i1", name: "Unused Item", unit: "kg", currentQty: 0, lowStockThreshold: 2 }],
      },
    });
    render(<InventoryItemsSection />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(useDataStore.getState().data.inventory).toEqual([]));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/InventoryItemsSection.test.tsx`
Expected: FAIL — cannot resolve `./InventoryItemsSection`.

- [ ] **Step 3: Write `src/components/InventoryItemsSection.tsx`**

```tsx
import { FormEvent, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { AppData, InventoryItem } from "../types";

function generateId(): string {
  return crypto.randomUUID();
}

export default function InventoryItemsSection() {
  const inventory = useDataStore((s) => s.data.inventory);
  const stockMoves = useDataStore((s) => s.data.stockMoves);
  const mutate = useDataStore((s) => s.mutate);
  const status = useDataStore((s) => s.status);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [error, setError] = useState<string | null>(null);

  function startEdit(item: InventoryItem) {
    setEditingId(item.id);
    setName(item.name);
    setUnit(item.unit);
    setLowStockThreshold(String(item.lowStockThreshold));
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setUnit("");
    setLowStockThreshold("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const threshold = Number(lowStockThreshold);
    if (
      !name.trim() ||
      !unit.trim() ||
      !lowStockThreshold.trim() ||
      !Number.isFinite(threshold) ||
      threshold < 0
    ) {
      setError("Enter a name, unit, and a valid low-stock threshold.");
      return;
    }
    setError(null);

    if (editingId) {
      const current = inventory.find((i) => i.id === editingId);
      const updated: InventoryItem = {
        id: editingId,
        name: name.trim(),
        unit: unit.trim(),
        currentQty: current ? current.currentQty : 0,
        lowStockThreshold: threshold,
      };
      await mutate(
        (data: AppData) => ({
          ...data,
          inventory: data.inventory.map((i) => (i.id === editingId ? updated : i)),
        }),
        `Update inventory item: ${updated.name}`
      );
    } else {
      const newItem: InventoryItem = {
        id: generateId(),
        name: name.trim(),
        unit: unit.trim(),
        currentQty: 0,
        lowStockThreshold: threshold,
      };
      await mutate(
        (data: AppData) => ({ ...data, inventory: [...data.inventory, newItem] }),
        `Add inventory item: ${newItem.name}`
      );
    }
    resetForm();
  }

  async function handleDelete(id: string) {
    const isReferenced = stockMoves.some((move) => move.inventoryItemId === id);
    if (isReferenced) {
      setError("Can't delete this item — it has stock move history.");
      return;
    }
    setError(null);
    await mutate(
      (data: AppData) => ({ ...data, inventory: data.inventory.filter((i) => i.id !== id) }),
      "Delete inventory item"
    );
  }

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">Inventory Items</h2>
      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
      <ul className="mb-4 divide-y divide-gray-200">
        {inventory.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span>
              {item.name} <span className="text-gray-500">({item.unit})</span> — {item.currentQty}{" "}
              {item.unit} in stock, low-stock at {item.lowStockThreshold}
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
        {inventory.length === 0 && <li className="py-2 text-sm text-gray-500">No inventory items yet.</li>}
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
          Unit
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
          />
        </label>
        <label className="flex flex-col text-sm">
          Low-Stock Threshold
          <input
            type="number"
            step="0.01"
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-28"
          />
        </label>
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded bg-orange-600 px-4 py-2 text-white disabled:opacity-50"
        >
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

Run: `npm test -- src/components/InventoryItemsSection.test.tsx`
Expected: PASS — 5 tests passed.

- [ ] **Step 5: Wire it into Settings — modify `src/pages/Settings.tsx`**

Add the import at the top, alongside the existing `MenuItemsSection` import:

```tsx
import InventoryItemsSection from "../components/InventoryItemsSection";
```

Add this line immediately after the existing `{connected && <MenuItemsSection />}` line, before the closing `</div>`:

```tsx
      {connected && <InventoryItemsSection />}
```

- [ ] **Step 6: Add a failing test for the wiring — modify `src/pages/Settings.test.tsx`**

Add this test inside the existing `describe("Settings", ...)` block, after the last existing test:

```tsx
  it("renders the Inventory Items section once connected", async () => {
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

    expect(await screen.findByText("Inventory Items")).toBeInTheDocument();
  });
```

- [ ] **Step 7: Run the full Settings test file to verify it passes**

Run: `npm test -- src/pages/Settings.test.tsx`
Expected: PASS — 7 tests passed (6 existing + 1 new).

- [ ] **Step 8: Commit**

```bash
git add src/components/InventoryItemsSection.tsx src/components/InventoryItemsSection.test.tsx src/pages/Settings.tsx src/pages/Settings.test.tsx
git commit -m "Add inventory item management to Settings"
```

---

### Task 2: Current Stock List (Inventory Page)

**Files:**
- Create: `src/components/InventoryStockList.tsx`
- Test: `src/components/InventoryStockList.test.tsx`

**Interfaces:**
- Consumes: `useDataStore` from `../store/useDataStore`.
- Produces: default export `InventoryStockList` (no props) — read-only view of `data.inventory`, showing each item's current quantity and flagging it with visible text `"Low stock"` when `currentQty <= lowStockThreshold`. Consumed by `src/pages/Inventory.tsx` (Task 4).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/InventoryStockList.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import InventoryStockList from "./InventoryStockList";
import { useDataStore } from "../store/useDataStore";
import { emptyAppData } from "../types";

beforeEach(() => {
  useDataStore.setState({
    data: {
      ...emptyAppData(),
      inventory: [
        { id: "i1", name: "Paneer", unit: "kg", currentQty: 2, lowStockThreshold: 5 },
        { id: "i2", name: "Rice", unit: "kg", currentQty: 20, lowStockThreshold: 5 },
      ],
    },
    sha: "sha1",
    status: "saved",
    error: null,
    config: { token: "t", owner: "me", repo: "cloud-kitchen-data", path: "data.json" },
    pendingSave: null,
  });
});

describe("InventoryStockList", () => {
  it("shows current stock for each item", () => {
    render(<InventoryStockList />);
    expect(screen.getByText(/Paneer — 2 kg/)).toBeInTheDocument();
    expect(screen.getByText(/Rice — 20 kg/)).toBeInTheDocument();
  });

  it("flags an item at or below its low-stock threshold", () => {
    render(<InventoryStockList />);
    const paneerRow = screen.getByText(/Paneer — 2 kg/).closest("li");
    expect(paneerRow).not.toBeNull();
    expect(paneerRow!.textContent).toContain("Low stock");
  });

  it("does not flag an item above its low-stock threshold", () => {
    render(<InventoryStockList />);
    const riceRow = screen.getByText(/Rice — 20 kg/).closest("li");
    expect(riceRow).not.toBeNull();
    expect(riceRow!.textContent).not.toContain("Low stock");
  });

  it("shows a message when there are no inventory items", () => {
    useDataStore.setState({ data: emptyAppData() });
    render(<InventoryStockList />);
    expect(screen.getByText("No inventory items yet.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/InventoryStockList.test.tsx`
Expected: FAIL — cannot resolve `./InventoryStockList`.

- [ ] **Step 3: Write `src/components/InventoryStockList.tsx`**

```tsx
import { useDataStore } from "../store/useDataStore";

export default function InventoryStockList() {
  const inventory = useDataStore((s) => s.data.inventory);

  return (
    <div className="mb-6">
      <h2 className="mb-2 text-lg font-semibold">Current Stock</h2>
      <ul className="divide-y divide-gray-200">
        {inventory.map((item) => {
          const low = item.currentQty <= item.lowStockThreshold;
          return (
            <li key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {item.name} — {item.currentQty} {item.unit}
              </span>
              {low && <span className="text-red-700">Low stock</span>}
            </li>
          );
        })}
        {inventory.length === 0 && <li className="py-2 text-sm text-gray-500">No inventory items yet.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/InventoryStockList.test.tsx`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/InventoryStockList.tsx src/components/InventoryStockList.test.tsx
git commit -m "Add read-only current stock list with low-stock flag"
```

---

### Task 3: Stock Move Form (with Linked Expense)

**Files:**
- Create: `src/components/StockMoveForm.tsx`
- Test: `src/components/StockMoveForm.test.tsx`

**Interfaces:**
- Consumes: `useDataStore` from `../store/useDataStore`; `AppData`, `Expense`, `StockMove`, `StockMoveType` from `../types`.
- Produces: default export `StockMoveForm` (no props) — reads `data.inventory`, `status`, and `mutate` from the store. Renders a field labeled `"Item"` (select, sourced from `data.inventory`), `"Type"` (select, `"in"`/`"out"`), `"Qty"`, `"Note"`, and — only when Type is `"in"` — a checkbox labeled `"Also log this as an Ingredients expense"` which, when checked, reveals a field labeled `"Expense Amount"`. Submit button labeled `"Log Stock Move"`. If `data.inventory` is empty, renders a prompt instead of the form. Consumed by `src/pages/Inventory.tsx` (Task 4).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/StockMoveForm.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StockMoveForm from "./StockMoveForm";
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
      inventory: [{ id: "i1", name: "Paneer", unit: "kg", currentQty: 10, lowStockThreshold: 3 }],
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

describe("StockMoveForm", () => {
  it("prompts to add an inventory item first when none exist", () => {
    useDataStore.setState({ data: emptyAppData() });
    render(<StockMoveForm />);
    expect(screen.getByText(/Add an inventory item in Settings/i)).toBeInTheDocument();
  });

  it("logs a stock-in move and increases currentQty", async () => {
    stubSuccessfulSave();
    render(<StockMoveForm />);

    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "i1" } });
    fireEvent.change(screen.getByLabelText("Qty"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Stock Move" }));

    await waitFor(() => expect(useDataStore.getState().data.stockMoves).toHaveLength(1));
    expect(useDataStore.getState().data.inventory[0].currentQty).toBe(15);
    expect(useDataStore.getState().data.stockMoves[0]).toEqual(
      expect.objectContaining({ inventoryItemId: "i1", type: "in", qty: 5 })
    );
    expect(useDataStore.getState().data.expenses).toEqual([]);
  });

  it("logs a stock-out move and decreases currentQty", async () => {
    stubSuccessfulSave();
    render(<StockMoveForm />);

    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "i1" } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "out" } });
    fireEvent.change(screen.getByLabelText("Qty"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Stock Move" }));

    await waitFor(() => expect(useDataStore.getState().data.stockMoves).toHaveLength(1));
    expect(useDataStore.getState().data.inventory[0].currentQty).toBe(6);
  });

  it("logs a linked Ingredients expense alongside a stock-in move", async () => {
    stubSuccessfulSave();
    render(<StockMoveForm />);

    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "i1" } });
    fireEvent.change(screen.getByLabelText("Qty"), { target: { value: "5" } });
    fireEvent.click(screen.getByLabelText("Also log this as an Ingredients expense"));
    fireEvent.change(screen.getByLabelText("Expense Amount"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Stock Move" }));

    await waitFor(() => expect(useDataStore.getState().data.stockMoves).toHaveLength(1));
    expect(useDataStore.getState().data.expenses).toEqual([
      expect.objectContaining({ category: "Ingredients", amount: 500 }),
    ]);
  });

  it("does not show the expense checkbox for stock-out moves", () => {
    render(<StockMoveForm />);
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "out" } });
    expect(screen.queryByLabelText("Also log this as an Ingredients expense")).not.toBeInTheDocument();
  });

  it("shows a validation error when the expense checkbox is checked but no amount is entered", async () => {
    render(<StockMoveForm />);

    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "i1" } });
    fireEvent.change(screen.getByLabelText("Qty"), { target: { value: "5" } });
    fireEvent.click(screen.getByLabelText("Also log this as an Ingredients expense"));
    fireEvent.click(screen.getByRole("button", { name: "Log Stock Move" }));

    expect(await screen.findByText(/Enter a valid expense amount/)).toBeInTheDocument();
    expect(useDataStore.getState().data.stockMoves).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/StockMoveForm.test.tsx`
Expected: FAIL — cannot resolve `./StockMoveForm`.

- [ ] **Step 3: Write `src/components/StockMoveForm.tsx`**

```tsx
import { FormEvent, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { AppData, Expense, StockMove, StockMoveType } from "../types";

function generateId(): string {
  return crypto.randomUUID();
}

export default function StockMoveForm() {
  const inventory = useDataStore((s) => s.data.inventory);
  const mutate = useDataStore((s) => s.mutate);
  const status = useDataStore((s) => s.status);

  const [inventoryItemId, setInventoryItemId] = useState("");
  const [type, setType] = useState<StockMoveType>("in");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [logExpense, setLogExpense] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const parsedQty = Number(qty);
    if (!inventoryItemId || !Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError("Select an item and enter a quantity greater than 0.");
      return;
    }

    const wantsExpense = type === "in" && logExpense;
    const parsedAmount = Number(expenseAmount);
    if (wantsExpense && !(expenseAmount.trim() && Number.isFinite(parsedAmount) && parsedAmount >= 0)) {
      setError("Enter a valid expense amount.");
      return;
    }
    setError(null);

    const move: StockMove = {
      id: generateId(),
      date: new Date().toISOString(),
      inventoryItemId,
      type,
      qty: parsedQty,
      note,
    };

    const expense: Expense | null = wantsExpense
      ? {
          id: generateId(),
          date: new Date().toISOString(),
          category: "Ingredients",
          amount: parsedAmount,
          note,
        }
      : null;

    await mutate((data: AppData) => {
      const inventoryUpdated = data.inventory.map((item) =>
        item.id === inventoryItemId
          ? { ...item, currentQty: item.currentQty + (type === "in" ? parsedQty : -parsedQty) }
          : item
      );
      return {
        ...data,
        inventory: inventoryUpdated,
        stockMoves: [...data.stockMoves, move],
        expenses: expense ? [...data.expenses, expense] : data.expenses,
      };
    }, wantsExpense ? "Log stock move and expense" : "Log stock move");

    setInventoryItemId("");
    setType("in");
    setQty("1");
    setNote("");
    setLogExpense(false);
    setExpenseAmount("");
  }

  if (inventory.length === 0) {
    return (
      <p className="text-sm text-gray-500">Add an inventory item in Settings before logging a stock move.</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-3">
      {error && <p className="text-sm text-red-700">{error}</p>}
      <label className="flex flex-col text-sm">
        Item
        <select
          value={inventoryItemId}
          onChange={(e) => setInventoryItemId(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
        >
          <option value="">Select item</option>
          {inventory.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-sm">
        Type
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as StockMoveType);
            setLogExpense(false);
            setExpenseAmount("");
          }}
          className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
        >
          <option value="in">In (purchase)</option>
          <option value="out">Out (usage/waste)</option>
        </select>
      </label>
      <label className="flex flex-col text-sm">
        Qty
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-28"
        />
      </label>
      <label className="flex flex-col text-sm">
        Note
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
        />
      </label>
      {type === "in" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={logExpense}
            onChange={(e) => {
              setLogExpense(e.target.checked);
              if (!e.target.checked) setExpenseAmount("");
            }}
          />
          Also log this as an Ingredients expense
        </label>
      )}
      {type === "in" && logExpense && (
        <label className="flex flex-col text-sm">
          Expense Amount
          <input
            type="number"
            step="0.01"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-28"
          />
        </label>
      )}
      <button
        type="submit"
        disabled={status === "saving"}
        className="self-start rounded bg-orange-600 px-4 py-2 text-white disabled:opacity-50"
      >
        Log Stock Move
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/StockMoveForm.test.tsx`
Expected: PASS — 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/StockMoveForm.tsx src/components/StockMoveForm.test.tsx
git commit -m "Add stock move form with optional linked Ingredients expense"
```

---

### Task 4: Stock Move History and Inventory Page Composition

**Files:**
- Create: `src/components/StockMovesList.tsx`
- Test: `src/components/StockMovesList.test.tsx`
- Modify: `src/pages/Inventory.tsx`

**Interfaces:**
- Consumes: `useDataStore` from `../store/useDataStore`; `DateRange`, `isWithinRange` from `../lib/dateRange`; default export `DateRangeFilter` from `./DateRangeFilter`; `StockMove` (type) from `../types`.
- Produces: default export `StockMovesList` (no props) — reads `data.stockMoves`/`data.inventory` from the store, renders a `DateRangeFilter` above a list of moves (newest first), each showing date, item name (or `"Unknown item"` if the referenced item was since deleted — unreachable in practice given Task 1's delete guard, but defensive), signed quantity (`+`/`-`), and note if present. Shows `"No stock moves in this range."` when the filtered list is empty. Consumed by `src/pages/Inventory.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/StockMovesList.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StockMovesList from "./StockMovesList";
import { useDataStore } from "../store/useDataStore";
import { emptyAppData } from "../types";

beforeEach(() => {
  useDataStore.setState({
    data: {
      ...emptyAppData(),
      inventory: [{ id: "i1", name: "Paneer", unit: "kg", currentQty: 10, lowStockThreshold: 3 }],
      stockMoves: [
        {
          id: "m-old",
          date: "2020-01-01T12:00:00.000Z",
          inventoryItemId: "i1",
          type: "in",
          qty: 10,
          note: "Old purchase",
        },
        {
          id: "m-recent",
          date: new Date().toISOString(),
          inventoryItemId: "i1",
          type: "out",
          qty: 2,
          note: "Used for order",
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

describe("StockMovesList", () => {
  it("lists all stock moves, newest first, with item name and note", () => {
    render(<StockMovesList />);
    expect(screen.getAllByText(/Paneer/)).toHaveLength(2);
    expect(screen.getByText("Used for order")).toBeInTheDocument();
  });

  it("filters out stock moves outside the selected date range", () => {
    render(<StockMovesList />);
    fireEvent.click(screen.getByRole("button", { name: "Today" }));

    expect(screen.getAllByText(/Paneer/)).toHaveLength(1);
    expect(screen.getByText("Used for order")).toBeInTheDocument();
    expect(screen.queryByText("Old purchase")).not.toBeInTheDocument();
  });

  it("shows a message when no stock moves fall in the selected range", () => {
    render(<StockMovesList />);
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2099-01-01" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2099-01-02" } });

    expect(screen.getByText("No stock moves in this range.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/StockMovesList.test.tsx`
Expected: FAIL — cannot resolve `./StockMovesList`.

- [ ] **Step 3: Write `src/components/StockMovesList.tsx`**

```tsx
import { useMemo, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { DateRange, isWithinRange } from "../lib/dateRange";
import DateRangeFilter from "./DateRangeFilter";
import type { StockMove } from "../types";

export default function StockMovesList() {
  const stockMoves = useDataStore((s) => s.data.stockMoves);
  const inventory = useDataStore((s) => s.data.inventory);
  const [range, setRange] = useState<DateRange | null>(null);

  const filtered = useMemo(
    () =>
      stockMoves
        .filter((move) => isWithinRange(move.date, range))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [stockMoves, range]
  );

  function itemName(move: StockMove): string {
    const item = inventory.find((i) => i.id === move.inventoryItemId);
    return item ? item.name : "Unknown item";
  }

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">Stock Move History</h2>
      <DateRangeFilter onChange={setRange} />
      <ul className="mt-4 divide-y divide-gray-200">
        {filtered.map((move) => (
          <li key={move.id} className="py-2 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span>
                {new Date(move.date).toLocaleDateString()} · {itemName(move)}
              </span>
              <span>
                {move.type === "in" ? "+" : "-"}
                {move.qty}
              </span>
            </div>
            {move.note && <div className="text-gray-500">{move.note}</div>}
          </li>
        ))}
        {filtered.length === 0 && <li className="py-2 text-sm text-gray-500">No stock moves in this range.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/StockMovesList.test.tsx`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Compose the Inventory page — modify `src/pages/Inventory.tsx`**

Replace the entire file content:

```tsx
import InventoryStockList from "../components/InventoryStockList";
import StockMoveForm from "../components/StockMoveForm";
import StockMovesList from "../components/StockMovesList";

export default function Inventory() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Inventory</h1>
      <InventoryStockList />
      <StockMoveForm />
      <StockMovesList />
    </div>
  );
}
```

- [ ] **Step 6: Run the full test suite and verify the build**

Run: `npm test`
Expected: PASS — all prior test files plus this task's new ones.

Run: `npm run build`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/StockMovesList.tsx src/components/StockMovesList.test.tsx src/pages/Inventory.tsx
git commit -m "Add stock move history and compose the Inventory page"
```

---

### Task 5: Expense Entry Form

**Files:**
- Create: `src/components/ExpenseForm.tsx`
- Test: `src/components/ExpenseForm.test.tsx`

**Interfaces:**
- Consumes: `useDataStore` from `../store/useDataStore`; `AppData`, `Expense`, `ExpenseCategory` from `../types`.
- Produces: default export `ExpenseForm` (no props) — reads `status` and `mutate` from the store. Renders fields labeled `"Category"` (select, all six `ExpenseCategory` values), `"Amount"`, `"Date"` (defaults to today's local date), `"Note"`, and a submit button labeled `"Log Expense"`. Consumed by `src/pages/Expenses.tsx` (Task 6).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/ExpenseForm.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ExpenseForm from "./ExpenseForm";
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

describe("ExpenseForm", () => {
  it("defaults the date field to today", () => {
    render(<ExpenseForm />);
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
    expect(screen.getByLabelText("Date")).toHaveValue(expected);
  });

  it("logs an expense with the selected category, amount, date, and note", async () => {
    stubSuccessfulSave();
    render(<ExpenseForm />);

    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Rent" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "15000" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-03-01" } });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "March rent" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Expense" }));

    await waitFor(() => expect(useDataStore.getState().data.expenses).toHaveLength(1));
    const expense = useDataStore.getState().data.expenses[0];
    expect(expense.category).toBe("Rent");
    expect(expense.amount).toBe(15000);
    expect(expense.note).toBe("March rent");
  });

  it("shows a validation error and does not submit when amount is blank", async () => {
    render(<ExpenseForm />);
    fireEvent.click(screen.getByRole("button", { name: "Log Expense" }));

    expect(await screen.findByText(/Enter a valid amount and date/)).toBeInTheDocument();
    expect(useDataStore.getState().data.expenses).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/ExpenseForm.test.tsx`
Expected: FAIL — cannot resolve `./ExpenseForm`.

- [ ] **Step 3: Write `src/components/ExpenseForm.tsx`**

```tsx
import { FormEvent, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { AppData, Expense, ExpenseCategory } from "../types";

function generateId(): string {
  return crypto.randomUUID();
}

function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const CATEGORIES: ExpenseCategory[] = ["Ingredients", "Rent", "Utilities", "Staff", "Packaging", "Other"];

export default function ExpenseForm() {
  const mutate = useDataStore((s) => s.mutate);
  const status = useDataStore((s) => s.status);

  const [category, setCategory] = useState<ExpenseCategory>("Ingredients");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayDateString());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!amount.trim() || !Number.isFinite(parsedAmount) || parsedAmount < 0 || !date) {
      setError("Enter a valid amount and date.");
      return;
    }
    setError(null);

    const expense: Expense = {
      id: generateId(),
      date: new Date(date).toISOString(),
      category,
      amount: parsedAmount,
      note,
    };

    await mutate((data: AppData) => ({ ...data, expenses: [...data.expenses, expense] }), "Log expense");

    setCategory("Ingredients");
    setAmount("");
    setDate(todayDateString());
    setNote("");
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-3">
      {error && <p className="text-sm text-red-700">{error}</p>}
      <label className="flex flex-col text-sm">
        Category
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-sm">
        Amount
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-28"
        />
      </label>
      <label className="flex flex-col text-sm">
        Date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
        />
      </label>
      <label className="flex flex-col text-sm">
        Note
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
        />
      </label>
      <button
        type="submit"
        disabled={status === "saving"}
        className="self-start rounded bg-orange-600 px-4 py-2 text-white disabled:opacity-50"
      >
        Log Expense
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/ExpenseForm.test.tsx`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExpenseForm.tsx src/components/ExpenseForm.test.tsx
git commit -m "Add expense entry form"
```

---

### Task 6: Expense History and Expenses Page Composition

**Files:**
- Create: `src/components/ExpensesList.tsx`
- Test: `src/components/ExpensesList.test.tsx`
- Modify: `src/pages/Expenses.tsx`

**Interfaces:**
- Consumes: `useDataStore` from `../store/useDataStore`; `DateRange`, `isWithinRange` from `../lib/dateRange`; `formatCurrency` from `../lib/currency`; default export `DateRangeFilter` from `./DateRangeFilter`; `ExpenseCategory` (type) from `../types`.
- Produces: default export `ExpensesList` (no props) — reads `data.expenses` from the store, renders a `DateRangeFilter` plus a field labeled `"Category"` (select: `"All"` + the six `ExpenseCategory` values) above a list of expenses (newest first, filtered by both), each showing date, category, amount, and note if present. Shows `"No expenses in this range."` when the filtered list is empty. Consumed by `src/pages/Expenses.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/ExpensesList.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExpensesList from "./ExpensesList";
import { useDataStore } from "../store/useDataStore";
import { emptyAppData } from "../types";

beforeEach(() => {
  useDataStore.setState({
    data: {
      ...emptyAppData(),
      expenses: [
        {
          id: "e-old",
          date: "2020-01-01T12:00:00.000Z",
          category: "Rent",
          amount: 10000,
          note: "Old rent",
        },
        {
          id: "e-recent",
          date: new Date().toISOString(),
          category: "Ingredients",
          amount: 500,
          note: "Fresh veggies",
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

describe("ExpensesList", () => {
  it("lists all expenses, newest first, with amount and note", () => {
    render(<ExpensesList />);
    expect(screen.getByText("Fresh veggies")).toBeInTheDocument();
    expect(screen.getByText("Old rent")).toBeInTheDocument();
    expect(screen.getByText(/₹500\.00/)).toBeInTheDocument();
  });

  it("filters by date range", () => {
    render(<ExpensesList />);
    fireEvent.click(screen.getByRole("button", { name: "Today" }));

    expect(screen.getByText("Fresh veggies")).toBeInTheDocument();
    expect(screen.queryByText("Old rent")).not.toBeInTheDocument();
  });

  it("filters by category", () => {
    render(<ExpensesList />);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Rent" } });

    expect(screen.getByText("Old rent")).toBeInTheDocument();
    expect(screen.queryByText("Fresh veggies")).not.toBeInTheDocument();
  });

  it("shows a message when no expenses match the filters", () => {
    render(<ExpensesList />);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Staff" } });

    expect(screen.getByText("No expenses in this range.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/ExpensesList.test.tsx`
Expected: FAIL — cannot resolve `./ExpensesList`.

- [ ] **Step 3: Write `src/components/ExpensesList.tsx`**

```tsx
import { useMemo, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { DateRange, isWithinRange } from "../lib/dateRange";
import { formatCurrency } from "../lib/currency";
import DateRangeFilter from "./DateRangeFilter";
import type { ExpenseCategory } from "../types";

const FILTER_CATEGORIES: (ExpenseCategory | "All")[] = [
  "All",
  "Ingredients",
  "Rent",
  "Utilities",
  "Staff",
  "Packaging",
  "Other",
];

export default function ExpensesList() {
  const expenses = useDataStore((s) => s.data.expenses);
  const [range, setRange] = useState<DateRange | null>(null);
  const [category, setCategory] = useState<ExpenseCategory | "All">("All");

  const filtered = useMemo(
    () =>
      expenses
        .filter((expense) => isWithinRange(expense.date, range))
        .filter((expense) => category === "All" || expense.category === category)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, range, category]
  );

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">Expense History</h2>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <DateRangeFilter onChange={setRange} />
        <label className="flex flex-col text-sm">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory | "All")}
            className="mt-1 w-full rounded border border-gray-300 p-1 sm:w-auto"
          >
            {FILTER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className="mt-4 divide-y divide-gray-200">
        {filtered.map((expense) => (
          <li key={expense.id} className="py-2 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span>
                {new Date(expense.date).toLocaleDateString()} · {expense.category}
              </span>
              <span>{formatCurrency(expense.amount)}</span>
            </div>
            {expense.note && <div className="text-gray-500">{expense.note}</div>}
          </li>
        ))}
        {filtered.length === 0 && <li className="py-2 text-sm text-gray-500">No expenses in this range.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/ExpensesList.test.tsx`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Compose the Expenses page — modify `src/pages/Expenses.tsx`**

Replace the entire file content:

```tsx
import ExpenseForm from "../components/ExpenseForm";
import ExpensesList from "../components/ExpensesList";

export default function Expenses() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Expenses</h1>
      <ExpenseForm />
      <ExpensesList />
    </div>
  );
}
```

- [ ] **Step 6: Run the full test suite and verify the build**

Run: `npm test`
Expected: PASS — all test files from the foundation, Sales & Menu Items, and this plan.

Run: `npm run build`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ExpensesList.tsx src/components/ExpensesList.test.tsx src/pages/Expenses.tsx
git commit -m "Add expense history and compose the Expenses page"
```

---

## Self-Review Notes

- **Spec coverage:** this plan covers every item in the Inventory & Expenses spec's "In scope" list — inventory item CRUD with the referenced-item delete guard, the current-stock view with low-stock flag, the stock-move form (in/out, with the linked-expense single-mutate flow), the filterable stock-move history, the expense entry form (with editable date, unlike sales), and the filterable-by-category-and-date expense history. Dashboard/P&L/Insights/CSV export are explicitly deferred, matching the spec's "Out of scope" section.
- **Placeholder scan:** no TBD/TODO markers; every step has complete, runnable code, verified against the actual current codebase — `MenuItemsSection.tsx`, `SaleForm.tsx`, `SalesList.tsx`, `DateRangeFilter.tsx`, `Settings.tsx`, and `Settings.test.tsx` were all read directly (their current, post-Plan-2-fixes state, including the `status === "saving"` disabled-submit pattern and the `connected` derivation in Settings) before writing this plan, and `formatCurrency(500)`'s exact output was re-verified via `node -e`.
- **Type consistency:** `AppData`, `InventoryItem`, `StockMove`, `StockMoveType`, `Expense`, `ExpenseCategory`, `DateRange` are imported with identical names/shapes across every task that uses them, matching `src/types.ts` exactly (confirmed `ExpenseCategory` has six members and no `"Zomato Commission"` entry, correcting a miscount in this increment's design spec text). `mutate`'s signature matches the foundation's actual implementation in every call site, including Task 3's single-call dual-write (inventory + stockMoves + expenses) pattern.
