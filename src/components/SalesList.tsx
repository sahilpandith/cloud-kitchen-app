import { useMemo, useState } from "react";
import { useDataStore } from "../store/useDataStore";
import { DateRange, isWithinRange } from "../lib/dateRange";
import { formatCurrency } from "../lib/currency";
import DateRangeFilter from "./DateRangeFilter";
import type { Sale } from "../types";

export default function SalesList() {
  const sales = useDataStore((s) => s.data.sales);
  const menuItems = useDataStore((s) => s.data.menuItems);
  const [range, setRange] = useState<DateRange | null>(null);

  const filtered = useMemo(
    () =>
      sales
        .filter((sale) => isWithinRange(sale.date, range))
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date)),
    [sales, range]
  );

  function itemsSummary(sale: Sale): string {
    return sale.lineItems
      .map((li) => {
        const item = menuItems.find((m) => m.id === li.menuItemId);
        return `${li.qty}x ${item ? item.name : "Unknown item"}`;
      })
      .join(", ");
  }

  function saleTotal(sale: Sale): number {
    return sale.lineItems.reduce((sum, li) => sum + li.qty * li.price, 0);
  }

  return (
    <div>
      <DateRangeFilter onChange={setRange} />
      <ul className="mt-4 divide-y divide-gray-200">
        {filtered.map((sale) => (
          <li key={sale.id} className="py-2 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span>
                {new Date(sale.date).toLocaleDateString()} · {sale.channel === "zomato" ? "Zomato" : "Direct"}
              </span>
              <span>{formatCurrency(saleTotal(sale))}</span>
            </div>
            <div className="text-gray-500">{itemsSummary(sale)}</div>
            {sale.zomatoCommission !== undefined && (
              <div className="text-gray-500">Commission: {formatCurrency(sale.zomatoCommission)}</div>
            )}
          </li>
        ))}
        {filtered.length === 0 && <li className="py-2 text-sm text-gray-500">No sales in this range.</li>}
      </ul>
    </div>
  );
}
