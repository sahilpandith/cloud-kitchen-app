import { FormEvent, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { AppData, MenuItem } from "../types";
import { formatCurrency } from "../lib/currency";

function generateId(): string {
  return crypto.randomUUID();
}

export default function MenuItemsSection() {
  const menuItems = useDataStore((s) => s.data.menuItems);
  const sales = useDataStore((s) => s.data.sales);
  const mutate = useDataStore((s) => s.mutate);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category);
    setDefaultPrice(String(item.defaultPrice));
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setCategory("");
    setDefaultPrice("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const price = Number(defaultPrice);
    if (!name.trim() || !category.trim() || !Number.isFinite(price) || price < 0) {
      setError("Enter a name, category, and a valid price.");
      return;
    }
    setError(null);

    if (editingId) {
      const updated: MenuItem = {
        id: editingId,
        name: name.trim(),
        category: category.trim(),
        defaultPrice: price,
      };
      await mutate(
        (data: AppData) => ({
          ...data,
          menuItems: data.menuItems.map((m) => (m.id === editingId ? updated : m)),
        }),
        `Update menu item: ${updated.name}`
      );
    } else {
      const newItem: MenuItem = {
        id: generateId(),
        name: name.trim(),
        category: category.trim(),
        defaultPrice: price,
      };
      await mutate(
        (data: AppData) => ({ ...data, menuItems: [...data.menuItems, newItem] }),
        `Add menu item: ${newItem.name}`
      );
    }
    resetForm();
  }

  async function handleDelete(id: string) {
    const isReferenced = sales.some((sale) => sale.lineItems.some((li) => li.menuItemId === id));
    if (isReferenced) {
      setError("Can't delete this item — it's used in an existing sale.");
      return;
    }
    setError(null);
    await mutate(
      (data: AppData) => ({ ...data, menuItems: data.menuItems.filter((m) => m.id !== id) }),
      "Delete menu item"
    );
  }

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">Menu Items</h2>
      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
      <ul className="mb-4 divide-y divide-gray-200">
        {menuItems.map((item) => (
          <li key={item.id} className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span>
              {item.name} <span className="text-gray-500">({item.category})</span> —{" "}
              {formatCurrency(item.defaultPrice)}
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
        {menuItems.length === 0 && <li className="py-2 text-sm text-gray-500">No menu items yet.</li>}
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
          Category
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
          />
        </label>
        <label className="flex flex-col text-sm">
          Default Price
          <input
            type="number"
            step="0.01"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-28"
          />
        </label>
        <button type="submit" className="rounded bg-orange-600 px-4 py-2 text-white">
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
