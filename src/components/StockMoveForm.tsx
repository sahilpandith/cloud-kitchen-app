import { FormEvent, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { AppData, Expense, StockMove, StockMoveType } from "../types";

function generateId(): string {
  return crypto.randomUUID();
}

export default function StockMoveForm() {
  const inventory = useDataStore((s) => s.data.inventory);
  const mutate = useDataStore((s) => s.mutate);
  const status = useDataStore((s) => s.status);

  const [inventoryItemId, setInventoryItemId] = useState("");
  const [type, setType] = useState<StockMoveType>("in");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [logExpense, setLogExpense] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const parsedQty = Number(qty);
    if (!inventoryItemId || !Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError("Select an item and enter a quantity greater than 0.");
      return;
    }

    const wantsExpense = type === "in" && logExpense;
    const parsedAmount = Number(expenseAmount);
    if (wantsExpense && !(expenseAmount.trim() && Number.isFinite(parsedAmount) && parsedAmount >= 0)) {
      setError("Enter a valid expense amount.");
      return;
    }
    setError(null);

    const move: StockMove = {
      id: generateId(),
      date: new Date().toISOString(),
      inventoryItemId,
      type,
      qty: parsedQty,
      note,
    };

    const expense: Expense | null = wantsExpense
      ? {
          id: generateId(),
          date: new Date().toISOString(),
          category: "Ingredients",
          amount: parsedAmount,
          note,
        }
      : null;

    await mutate((data: AppData) => {
      const inventoryUpdated = data.inventory.map((item) =>
        item.id === inventoryItemId
          ? { ...item, currentQty: item.currentQty + (type === "in" ? parsedQty : -parsedQty) }
          : item
      );
      return {
        ...data,
        inventory: inventoryUpdated,
        stockMoves: [...data.stockMoves, move],
        expenses: expense ? [...data.expenses, expense] : data.expenses,
      };
    }, wantsExpense ? "Log stock move and expense" : "Log stock move");

    setInventoryItemId("");
    setType("in");
    setQty("1");
    setNote("");
    setLogExpense(false);
    setExpenseAmount("");
  }

  if (inventory.length === 0) {
    return (
      <p className="text-sm text-gray-500">Add an inventory item in Settings before logging a stock move.</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-3">
      {error && <p className="text-sm text-red-700">{error}</p>}
      <label className="flex flex-col text-sm">
        Item
        <select
          value={inventoryItemId}
          onChange={(e) => setInventoryItemId(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
        >
          <option value="">Select item</option>
          {inventory.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-sm">
        Type
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as StockMoveType);
            setLogExpense(false);
            setExpenseAmount("");
          }}
          className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
        >
          <option value="in">In (purchase)</option>
          <option value="out">Out (usage/waste)</option>
        </select>
      </label>
      <label className="flex flex-col text-sm">
        Qty
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-28"
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
      {type === "in" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={logExpense}
            onChange={(e) => {
              setLogExpense(e.target.checked);
              if (!e.target.checked) setExpenseAmount("");
            }}
          />
          Also log this as an Ingredients expense
        </label>
      )}
      {type === "in" && logExpense && (
        <label className="flex flex-col text-sm">
          Expense Amount
          <input
            type="number"
            step="0.01"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-28"
          />
        </label>
      )}
      <button
        type="submit"
        disabled={status === "saving"}
        className="self-start rounded bg-orange-600 px-4 py-2 text-white disabled:opacity-50"
      >
        Log Stock Move
      </button>
    </form>
  );
}
