// src/components/DateRangeFilter.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DateRangeFilter from "./DateRangeFilter";
import { presetToRange } from "../lib/dateRange";

afterEach(() => {
  vi.useRealTimers();
});

describe("DateRangeFilter", () => {
  it("calls onChange with null for All Time", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "All Time" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("calls onChange with today's range when Today is selected", () => {
    const fixedNow = new Date(2026, 2, 15, 10, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const onChange = vi.fn();
    render(<DateRangeFilter onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Today" }));

    expect(onChange).toHaveBeenCalledWith(presetToRange("today", fixedNow));
  });

  it("calls onChange with this week's range when This Week is selected", () => {
    const fixedNow = new Date(2026, 2, 15, 10, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const onChange = vi.fn();
    render(<DateRangeFilter onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "This Week" }));

    expect(onChange).toHaveBeenCalledWith(presetToRange("week", fixedNow));
  });

  it("calls onChange with this month's range when This Month is selected", () => {
    const fixedNow = new Date(2026, 2, 15, 10, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const onChange = vi.fn();
    render(<DateRangeFilter onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "This Month" }));

    expect(onChange).toHaveBeenCalledWith(presetToRange("month", fixedNow));
  });

  it("calls onChange with a custom range once both start and end dates are set", () => {
    const onChange = vi.fn();
    render(<DateRangeFilter onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));

    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-01-01" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-01-31" } });
    expect(onChange).toHaveBeenCalledWith({ start: "2026-01-01", end: "2026-01-31" });
  });
});
