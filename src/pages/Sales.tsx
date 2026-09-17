import SaleForm from "../components/SaleForm";
import SalesList from "../components/SalesList";

export default function Sales() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Sales</h1>
      <SaleForm />
      <SalesList />
    </div>
  );
}
