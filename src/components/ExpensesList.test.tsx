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
