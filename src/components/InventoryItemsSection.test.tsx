import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InventoryItemsSection from "./InventoryItemsSection";
import { useDataStore } from "../store/useDataStore";
import { emptyAppData } from "../types";
import { utf8ToBase64 } from "../lib/base64";

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

  it("preserves a fresh remote currentQty on a conflict retry instead of clobbering it with the stale value captured at submit time", async () => {
    useDataStore.setState({
      data: {
        ...emptyAppData(),
        inventory: [{ id: "i1", name: "Paneer", unit: "kg", currentQty: 12, lowStockThreshold: 3 }],
      },
    });

    // Simulates another device having logged a stock-in (12kg -> 20kg) on
    // the remote data between when this client last loaded and when its
    // edit-save is retried after a conflict.
    const freshRemoteData = {
      ...emptyAppData(),
      inventory: [{ id: "i1", name: "Paneer", unit: "kg", currentQty: 20, lowStockThreshold: 3 }],
    };

    const fetchMock = vi
      .fn()
      // 1: the initial PUT save from mutate() — conflicts.
      .mockResolvedValueOnce({ status: 409, ok: false })
      // 2: the GET refetch from fetchApplySave() — returns fresh remote data.
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          sha: "fresh-sha",
          content: utf8ToBase64(JSON.stringify(freshRemoteData)),
        }),
      })
      // 3: the retried PUT save from fetchApplySave() — succeeds.
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ content: { sha: "final-sha" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<InventoryItemsSection />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Paneer (grated)" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Item" }));

    await waitFor(() => expect(useDataStore.getState().status).toBe("saved"));

    expect(useDataStore.getState().data.inventory).toEqual([
      { id: "i1", name: "Paneer (grated)", unit: "kg", currentQty: 20, lowStockThreshold: 3 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
