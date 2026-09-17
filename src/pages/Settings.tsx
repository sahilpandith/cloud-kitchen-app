import { FormEvent, useState } from "react";
import { useDataStore } from "../store/useDataStore";

export default function Settings() {
  const config = useDataStore((s) => s.config);
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
  const sha = useDataStore((s) => s.sha);
  const setConfig = useDataStore((s) => s.setConfig);
  const loadData = useDataStore((s) => s.loadData);

  const [token, setToken] = useState(config?.token ?? "");
  const [owner, setOwner] = useState(config?.owner ?? "");
  const [repo, setRepo] = useState(config?.repo ?? "cloud-kitchen-data");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setConfig({ token, owner, repo, path: "data.json" });
    await loadData();
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-xl font-semibold">Settings</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col text-sm">
          GitHub Personal Access Token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="mt-1 rounded border border-gray-300 p-2"
            required
          />
        </label>
        <label className="flex flex-col text-sm">
          GitHub Username (data repo owner)
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="mt-1 rounded border border-gray-300 p-2"
            required
          />
        </label>
        <label className="flex flex-col text-sm">
          Data Repo Name
          <input
            type="text"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            className="mt-1 rounded border border-gray-300 p-2"
            required
          />
        </label>
        <button type="submit" className="rounded bg-orange-600 px-4 py-2 text-white">
          Save & Connect
        </button>
      </form>
      {status === "loading" && <p className="mt-3 text-sm text-gray-500">Connecting…</p>}
      {status === "saved" && config && sha !== null && (
        <p className="mt-3 text-sm text-green-700">
          Connected to {config.owner}/{config.repo}.
        </p>
      )}
      {status === "saved" && config && sha === null && (
        <p className="mt-3 text-sm text-yellow-700">
          Connected to {config.owner}/{config.repo} — no data.json found yet. If you expected existing
          data, double-check the repo name and that your token has access to it; otherwise data.json
          will be created on your first save.
        </p>
      )}
      {status === "error" && <p className="mt-3 text-sm text-red-700">Connection failed: {error}</p>}
    </div>
  );
}
