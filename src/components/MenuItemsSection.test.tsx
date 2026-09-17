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
