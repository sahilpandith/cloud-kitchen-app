import { FormEvent, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { AppData, Expense, ExpenseCategory } from "../types";

function generateId(): string {
  return crypto.randomUUID();
}

function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const CATEGORIES: ExpenseCategory[] = ["Ingredients", "Rent", "Utilities", "Staff", "Packaging", "Other"];

export default function ExpenseForm() {
  const mutate = useDataStore((s) => s.mutate);
  const status = useDataStore((s) => s.status);

  const [category, setCategory] = useState<ExpenseCategory>("Ingredients");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayDateString());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!amount.trim() || !Number.isFinite(parsedAmount) || parsedAmount < 0 || !date) {
      setError("Enter a valid amount and date.");
      return;
    }
    setError(null);

    const expense: Expense = {
      id: generateId(),
      date: new Date(date).toISOString(),
      category,
      amount: parsedAmount,
      note,
    };

    await mutate((data: AppData) => ({ ...data, expenses: [...data.expenses, expense] }), "Log expense");

    setCategory("Ingredients");
    setAmount("");
    setDate(todayDateString());
    setNote("");
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-3">
      {error && <p className="text-sm text-red-700">{error}</p>}
      <label className="flex flex-col text-sm">
        Category
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-sm">
        Amount
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-28"
        />
      </label>
      <label className="flex flex-col text-sm">
        Date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
        />
      </label>
      <label className="flex flex-col text-sm">
        Note
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
        />
      </label>
      <button
        type="submit"
        disabled={status === "saving"}
        className="self-start rounded bg-orange-600 px-4 py-2 text-white disabled:opacity-50"
      >
        Log Expense
      </button>
    </form>
  );
}
