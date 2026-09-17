export interface MenuItem {
  id: string;
  name: string;
  category: string;
  defaultPrice: number;
}

export type SaleChannel = "zomato" | "direct";

export interface SaleLineItem {
  menuItemId: string;
  qty: number;
  price: number;
}

export interface Sale {
  id: string;
  date: string; // ISO-8601
  channel: SaleChannel;
  lineItems: SaleLineItem[];
  zomatoCommission?: number; // present only when channel === "zomato"
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  currentQty: number;
  lowStockThreshold: number;
}

export type StockMoveType = "in" | "out";

export interface StockMove {
  id: string;
  date: string; // ISO-8601
  inventoryItemId: string;
  type: StockMoveType;
  qty: number;
  note: string;
}

export type ExpenseCategory =
  | "Ingredients"
  | "Rent"
  | "Utilities"
  | "Staff"
  | "Packaging"
  | "Other";

export interface Expense {
  id: string;
  date: string; // ISO-8601
  category: ExpenseCategory;
  amount: number;
  note: string;
}

export interface AppSettings {
  defaultZomatoCommissionPct: number;
}

export interface AppData {
  menuItems: MenuItem[];
  sales: Sale[];
  inventory: InventoryItem[];
  stockMoves: StockMove[];
  expenses: Expense[];
  settings: AppSettings;
}

export function emptyAppData(): AppData {
  return {
    menuItems: [],
    sales: [],
    inventory: [],
    stockMoves: [],
    expenses: [],
    settings: { defaultZomatoCommissionPct: 0 },
  };
}
