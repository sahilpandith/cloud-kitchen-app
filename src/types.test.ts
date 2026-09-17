import { describe, it, expect } from "vitest";
import { emptyAppData } from "./types";

describe("emptyAppData", () => {
  it("returns an AppData object with all empty collections and default settings", () => {
    expect(emptyAppData()).toEqual({
      menuItems: [],
      sales: [],
      inventory: [],
      stockMoves: [],
      expenses: [],
      settings: { defaultZomatoCommissionPct: 0 },
    });
  });
});
