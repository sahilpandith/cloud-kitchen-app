import { useMemo, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { DateRange, isWithinRange } from "../lib/dateRange";
import DateRangeFilter from "./DateRangeFilter";
import type { StockMove } from "../types";

export default function StockMovesList() {
  const stockMoves = useDataStore((s) => s.data.stockMoves);
  const inventory = useDataStore((s) => s.data.inventory);
  const [range, setRange] = useState<DateRange | null>(null);

  const filtered = useMemo(
    () =>
      stockMoves
        .filter((move) => isWithinRange(move.date, range))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [stockMoves, range]
  );

  function itemName(move: StockMove): string {
    const item = inventory.find((i) => i.id === move.inventoryItemId);
    return item ? item.name : "Unknown item";
  }

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">Stock Move History</h2>
      <DateRangeFilter onChange={setRange} />
      <ul className="mt-4 divide-y divide-gray-200">
        {filtered.map((move) => (
          <li key={move.id} className="py-2 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span>
                {new Date(move.date).toLocaleDateString()} · {itemName(move)}
              </span>
              <span>
                {move.type === "in" ? "+" : "-"}
                {move.qty}
              </span>
            </div>
            {move.note && <div className="text-gray-500">{move.note}</div>}
          </li>
        ))}
        {filtered.length === 0 && <li className="py-2 text-sm text-gray-500">No stock moves in this range.</li>}
      </ul>
    </div>
  );
}
