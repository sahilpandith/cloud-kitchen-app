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
