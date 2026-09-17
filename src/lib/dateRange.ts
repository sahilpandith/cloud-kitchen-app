export interface DateRange {
  start: string; // YYYY-MM-DD, inclusive, local calendar date
  end: string; // YYYY-MM-DD, inclusive, local calendar date
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function presetToRange(preset: "today" | "week" | "month", now: Date = new Date()): DateRange {
  const end = toDateString(now);
  if (preset === "today") return { start: end, end };
  if (preset === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { start: toDateString(start), end };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: toDateString(start), end };
}

export function isWithinRange(isoDateTime: string, range: DateRange | null): boolean {
  if (!range) return true;
  const d = toDateString(new Date(isoDateTime));
  return d >= range.start && d <= range.end;
}
