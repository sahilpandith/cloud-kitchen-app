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
