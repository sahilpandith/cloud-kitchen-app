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
