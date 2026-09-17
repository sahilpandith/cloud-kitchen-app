import { describe, it, expect } from "vitest";
import { presetToRange, isWithinRange } from "./dateRange";

describe("presetToRange", () => {
  const fixedNow = new Date(2026, 2, 15); // March 15, 2026 (local)

  it("returns today's date for both start and end", () => {
    expect(presetToRange("today", fixedNow)).toEqual({ start: "2026-03-15", end: "2026-03-15" });
  });

  it("returns a 7-day rolling window ending today for 'week'", () => {
    expect(presetToRange("week", fixedNow)).toEqual({ start: "2026-03-09", end: "2026-03-15" });
  });

  it("returns the calendar month to date for 'month'", () => {
    expect(presetToRange("month", fixedNow)).toEqual({ start: "2026-03-01", end: "2026-03-15" });
  });
});

describe("isWithinRange", () => {
  it("returns true for any date when the range is null (all time)", () => {
    expect(isWithinRange("2020-01-01T12:00:00.000Z", null)).toBe(true);
  });

  it("returns true when the date falls within the range (inclusive)", () => {
    const range = { start: "2026-03-01", end: "2026-03-15" };
    expect(isWithinRange("2026-03-01T12:00:00.000Z", range)).toBe(true);
    expect(isWithinRange("2026-03-15T12:00:00.000Z", range)).toBe(true);
  });

  it("returns false when the date falls outside the range", () => {
    const range = { start: "2026-03-01", end: "2026-03-15" };
    expect(isWithinRange("2026-02-28T12:00:00.000Z", range)).toBe(false);
    expect(isWithinRange("2026-03-16T12:00:00.000Z", range)).toBe(false);
  });
});
