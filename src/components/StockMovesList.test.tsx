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
