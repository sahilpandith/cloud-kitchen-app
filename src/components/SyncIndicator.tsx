import { useDataStore } from "../store/useDataStore";

const LABELS: Record<string, string> = {
  idle: "",
  loading: "Loading…",
  saving: "Saving…",
  saved: "Saved",
  error: "Sync error — tap to retry",
};

export default function SyncIndicator() {
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
  const retry = useDataStore((s) => s.retry);

  if (status === "idle") return null;

  if (status === "error") {
    return (
      <button onClick={() => retry()} className="px-4 py-1 text-sm text-red-700 underline" title={error ?? undefined}>
        {LABELS.error}
      </button>
    );
  }

  return <div className="px-4 py-1 text-sm text-gray-500">{LABELS[status]}</div>;
}
