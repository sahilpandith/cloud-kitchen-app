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
