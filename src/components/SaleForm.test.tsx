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
