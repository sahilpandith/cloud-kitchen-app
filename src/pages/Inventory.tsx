import InventoryStockList from "../components/InventoryStockList";
import StockMoveForm from "../components/StockMoveForm";
import StockMovesList from "../components/StockMovesList";

export default function Inventory() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Inventory</h1>
      <InventoryStockList />
      <StockMoveForm />
      <StockMovesList />
    </div>
  );
}
