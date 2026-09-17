import { useDataStore } from "../store/useDataStore";

export default function InventoryStockList() {
  const inventory = useDataStore((s) => s.data.inventory);

  return (
    <div className="mb-6">
      <h2 className="mb-2 text-lg font-semibold">Current Stock</h2>
      <ul className="divide-y divide-gray-200">
        {inventory.map((item) => {
          const low = item.currentQty <= item.lowStockThreshold;
          return (
            <li key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {item.name} — {item.currentQty} {item.unit}
              </span>
              {low && <span className="text-red-700">Low stock</span>}
            </li>
          );
        })}
        {inventory.length === 0 && <li className="py-2 text-sm text-gray-500">No inventory items yet.</li>}
      </ul>
    </div>
  );
}
