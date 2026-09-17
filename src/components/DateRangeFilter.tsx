import { useState } from "react";
import { DateRange, presetToRange } from "../lib/dateRange";

type Mode = "all" | "today" | "week" | "month" | "custom";

const LABELS: Record<Mode, string> = {
  all: "All Time",
  today: "Today",
  week: "This Week",
  month: "This Month",
  custom: "Custom",
};

interface Props {
  onChange: (range: DateRange | null) => void;
}

export default function DateRangeFilter({ onChange }: Props) {
  const [mode, setMode] = useState<Mode>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  function selectPreset(next: Mode) {
    setMode(next);
    if (next === "all") {
      onChange(null);
    } else if (next === "today" || next === "week" || next === "month") {
      onChange(presetToRange(next));
    }
  }

  function applyCustom(start: string, end: string) {
    setCustomStart(start);
    setCustomEnd(end);
    if (start && end) {
      onChange({ start, end });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {(["all", "today", "week", "month", "custom"] as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => selectPreset(m)}
          className={`rounded px-3 py-1 ${mode === m ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-700"}`}
        >
          {LABELS[m]}
        </button>
      ))}
      {mode === "custom" && (
        <span className="flex flex-wrap items-center gap-2">
          <label className="flex flex-col text-sm sm:flex-row sm:items-center sm:gap-1">
            Start date
            <input
              type="date"
              aria-label="Start date"
              value={customStart}
              onChange={(e) => applyCustom(e.target.value, customEnd)}
              className="w-full rounded border border-gray-300 p-1 sm:w-auto"
            />
          </label>
          <label className="flex flex-col text-sm sm:flex-row sm:items-center sm:gap-1">
            End date
            <input
              type="date"
              aria-label="End date"
              value={customEnd}
              onChange={(e) => applyCustom(customStart, e.target.value)}
              className="w-full rounded border border-gray-300 p-1 sm:w-auto"
            />
          </label>
        </span>
      )}
    </div>
  );
}
