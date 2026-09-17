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
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ content: { sha: "new-sha" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
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
    // The stock move and its linked expense must be written via a single
    // optimistic mutate/save, never two separate saves.
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
