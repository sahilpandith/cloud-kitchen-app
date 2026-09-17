import ExpenseForm from "../components/ExpenseForm";
import ExpensesList from "../components/ExpensesList";

export default function Expenses() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Expenses</h1>
      <ExpenseForm />
      <ExpensesList />
    </div>
  );
}
