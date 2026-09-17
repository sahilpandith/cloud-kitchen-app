import { FormEvent, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { AppData, Sale, SaleChannel, SaleLineItem } from "../types";
import { formatCurrency } from "../lib/currency";

interface DraftLine {
  menuItemId: string;
  qty: string;
  price: string;
}

function generateId(): string {
  return crypto.randomUUID();
}

function emptyLine(): DraftLine {
  return { menuItemId: "", qty: "1", price: "" };
}

export default function SaleForm() {
  const menuItems = useDataStore((s) => s.data.menuItems);
  const defaultCommissionPct = useDataStore((s) => s.data.settings.defaultZomatoCommissionPct);
  const mutate = useDataStore((s) => s.mutate);

  const [channel, setChannel] = useState<SaleChannel>("direct");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [commission, setCommission] = useState("");
  const [commissionTouched, setCommissionTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = lines.reduce((sum, l) => {
    const qty = Number(l.qty);
    const price = Number(l.price);
    return sum + (Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0);
  }, 0);

  const autoCommission = (subtotal * defaultCommissionPct) / 100;
  const effectiveCommission = commissionTouched ? Number(commission) : autoCommission;

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function selectMenuItem(index: number, menuItemId: string) {
    const item = menuItems.find((m) => m.id === menuItemId);
    updateLine(index, { menuItemId, price: item ? String(item.defaultPrice) : "" });
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const parsedLines: SaleLineItem[] = [];
    for (const l of lines) {
      const qty = Number(l.qty);
      const price = Number(l.price);
      if (!l.menuItemId || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
        setError("Each line needs a menu item, a quantity greater than 0, and a valid price.");
        return;
      }
      parsedLines.push({ menuItemId: l.menuItemId, qty, price });
    }
    setError(null);

    const sale: Sale = {
      id: generateId(),
      date: new Date().toISOString(),
      channel,
      lineItems: parsedLines,
      ...(channel === "zomato" ? { zomatoCommission: effectiveCommission } : {}),
    };

    await mutate((data: AppData) => ({ ...data, sales: [...data.sales, sale] }), "Log sale");

    setChannel("direct");
    setLines([emptyLine()]);
    setCommission("");
    setCommissionTouched(false);
  }

  if (menuItems.length === 0) {
    return <p className="text-sm text-gray-500">Add a menu item in Settings before logging a sale.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-3">
      {error && <p className="text-sm text-red-700">{error}</p>}
      <label className="flex flex-col text-sm">
        Channel
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as SaleChannel)}
          className="mt-1 rounded border border-gray-300 p-2"
        >
          <option value="direct">Direct</option>
          <option value="zomato">Zomato</option>
        </select>
      </label>

      {lines.map((line, index) => (
        <div key={index} className="flex flex-col gap-2 border-b border-gray-100 pb-2 sm:flex-row sm:flex-wrap sm:items-end sm:border-b-0 sm:pb-0">
          <label className="flex flex-col text-sm">
            Item
            <select
              value={line.menuItemId}
              onChange={(e) => selectMenuItem(index, e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-auto"
            >
              <option value="">Select item</option>
              {menuItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            Qty
            <input
              type="number"
              value={line.qty}
              onChange={(e) => updateLine(index, { qty: e.target.value })}
              className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-20"
            />
          </label>
          <label className="flex flex-col text-sm">
            Price
            <input
              type="number"
              step="0.01"
              value={line.price}
              onChange={(e) => updateLine(index, { price: e.target.value })}
              className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-28"
            />
          </label>
          {lines.length > 1 && (
            <button type="button" onClick={() => removeLine(index)} className="self-start text-red-700 underline">
              Remove
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={addLine} className="self-start text-sm text-orange-700 underline">
        Add another item
      </button>

      <p className="text-sm font-medium">Subtotal: {formatCurrency(subtotal)}</p>

      {channel === "zomato" && (
        <label className="flex flex-col text-sm">
          Zomato Commission
          <input
            type="number"
            step="0.01"
            value={commissionTouched ? commission : autoCommission.toFixed(2)}
            onChange={(e) => {
              setCommissionTouched(true);
              setCommission(e.target.value);
            }}
            className="mt-1 w-full rounded border border-gray-300 p-2 sm:w-28"
          />
        </label>
      )}

      <button type="submit" className="self-start rounded bg-orange-600 px-4 py-2 text-white">
        Log Sale
      </button>
    </form>
  );
}
