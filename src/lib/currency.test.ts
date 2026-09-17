// src/lib/currency.test.ts
import { describe, it, expect } from "vitest";
import { formatCurrency } from "./currency";

describe("formatCurrency", () => {
  it("formats a small amount with two decimal places and the rupee symbol", () => {
    expect(formatCurrency(1234.5)).toBe("₹1,234.50");
  });

  it("formats a large amount using Indian digit grouping", () => {
    expect(formatCurrency(1234567.891)).toBe("₹12,34,567.89");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("₹0.00");
  });
});
