import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Nav from "./Nav";

describe("Nav", () => {
  it("wraps onto multiple lines instead of scrolling horizontally", () => {
    render(
      <MemoryRouter>
        <Nav />
      </MemoryRouter>
    );
    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("flex-wrap");
    expect(nav.className).not.toContain("overflow-x-auto");
  });

  it("still renders all 7 nav links", () => {
    render(
      <MemoryRouter>
        <Nav />
      </MemoryRouter>
    );
    for (const label of ["Dashboard", "Sales", "Inventory", "Expenses", "P&L", "Insights", "Settings"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
