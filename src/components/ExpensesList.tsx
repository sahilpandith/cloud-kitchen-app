import { useMemo, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { DateRange, isWithinRange } from "../lib/dateRange";
import { formatCurrency } from "../lib/currency";
import DateRangeFilter from "./DateRangeFilter";
import type { ExpenseCategory } from "../types";

const FILTER_CATEGORIES: (ExpenseCategory | "All")[] = [
  "All",
  "Ingredients",
  "Rent",
  "Utilities",
  "Staff",
  "Packaging",
  "Other",
];

export default function ExpensesList() {
  const expenses = useDataStore((s) => s.data.expenses);
  const [range, setRange] = useState<DateRange | null>(null);
  const [category, setCategory] = useState<ExpenseCategory | "All">("All");

  const filtered = useMemo(
    () =>
      expenses
        .filter((expense) => isWithinRange(expense.date, range))
        .filter((expense) => category === "All" || expense.category === category)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, range, category]
  );

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">Expense History</h2>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <DateRangeFilter onChange={setRange} />
        <label className="flex flex-col text-sm">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory | "All")}
            className="mt-1 w-full rounded border border-gray-300 p-1 sm:w-auto"
          >
            {FILTER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className="mt-4 divide-y divide-gray-200">
        {filtered.map((expense) => (
          <li key={expense.id} className="py-2 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span>
                {new Date(expense.date).toLocaleDateString()} · {expense.category}
              </span>
              <span>{formatCurrency(expense.amount)}</span>
            </div>
            {expense.note && <div className="text-gray-500">{expense.note}</div>}
          </li>
        ))}
        {filtered.length === 0 && <li className="py-2 text-sm text-gray-500">No expenses in this range.</li>}
      </ul>
    </div>
  );
}
