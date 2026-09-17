import { FormEvent, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { AppData, InventoryItem } from "../types";

function generateId(): string {
  return crypto.randomUUID();
}

export default function InventoryItemsSection() {
  const inventory = useDataStore((s) => s.data.inventory);
  const stockMoves = useDataStore((s) => s.data.stockMoves);
  const mutate = useDataStore((s) => s.mutate);
  const status = useDataStore((s) => s.status);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [error, setError] = useState<string | null>(null);

  function startEdit(item: InventoryItem) {
    setEditingId(item.id);
    setName(item.name);
    setUnit(item.unit);
    setLowStockThreshold(String(item.lowStockThreshold));
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setUnit("");
    setLowStockThreshold("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const threshold = Number(lowStockThreshold);
    if (
      !name.trim() ||
      !unit.trim() ||
      !lowStockThreshold.trim() ||
      !Number.isFinite(threshold) ||
      threshold < 0
    ) {
      setError("Enter a name, unit, and a valid low-stock threshold.");
      return;
    }
    setError(null);

    if (editingId) {
      await mutate(
        (data: AppData) => ({
          ...data,
          inventory: data.inventory.map((i) =>
            i.id === editingId
              ? { ...i, name: name.trim(), unit: unit.trim(), lowStockThreshold: threshold }
              : i
          ),
        }),
        `Update inventory item: ${name.trim()}`
      );
    } else {
      const newItem: InventoryItem = {
        id: generateId(),
        name: name.trim(),
        unit: unit.trim(),
        currentQty: 0,
        lowStockThreshold: threshold,
      };
      await mutate(
        (data: AppData) => ({ ...data, inventory: [...data.inventory, newItem] }),
        `Add inventory item: ${newItem.name}`
      );
    }
    resetForm();
  }

  async function handleDelete(id: string) {
    const isReferenced = stockMoves.some((move) => move.inventoryItemId === id);
    if (isReferenced) {
      setError("Can't delete this item — it has stock move history.");
      return;
    }
    setError(null);
    await mutate(
      (data: AppData) => ({ ...data, inventory: data.inventory.filter((i) => i.id !== id) }),
      "Delete inventory item"
    );
  }

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">Inventory Items</h2>
      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
      <ul className="mb-4 divide-y divide-gray-200">
        {inventory.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span>
              {item.name} <span className="text-gray-500">({item.unit})</span> — {item.currentQty}{" "}
              {item.unit} in stock, low-stock at {item.lowStockThreshold}
            </span>
            <span className="flex gap-3">
              <button type="button" onClick={() => startEdit(item)} className="text-orange-700 underline">
                Edit
              </button>
              <button type="button" onClick={() => handleDelete(item.id)} className="text-red-700 underline">
                Delete
              </button>
            </span>
          </li>
        ))}
        {inventory.length === 0 && <li className="py-2 text-sm text-gray-500">No inventory items yet.</li>}
      </ul>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col text-sm">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
          />
        </label>
        <label className="flex flex-col text-sm">
          Unit
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
          />
        </label>
        <label className="flex flex-col text-sm">
          Low-Stock Threshold
          <input
            type="number"
            step="0.01"
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-28"
          />
        </label>
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded bg-orange-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {editingId ? "Update Item" : "Add Item"}
        </button>
        {editingId && (
          <button type="button" onClick={resetForm} className="rounded border border-gray-300 px-4 py-2">
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}
