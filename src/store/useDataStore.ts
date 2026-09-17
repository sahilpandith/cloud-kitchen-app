import { create } from "zustand";
import { AppData, emptyAppData } from "../types";
import { GithubConfig, fetchAppData, saveAppData, GithubConflictError } from "../lib/github";

const STORAGE_KEYS = {
  token: "ck_github_token",
  owner: "ck_github_owner",
  repo: "ck_github_repo",
};

const DEFAULT_REPO = "cloud-kitchen-data";
const DEFAULT_PATH = "data.json";

export function loadConfigFromStorage(): GithubConfig | null {
  const token = localStorage.getItem(STORAGE_KEYS.token);
  const owner = localStorage.getItem(STORAGE_KEYS.owner);
  const repo = localStorage.getItem(STORAGE_KEYS.repo) ?? DEFAULT_REPO;
  if (!token || !owner) return null;
  return { token, owner, repo, path: DEFAULT_PATH };
}

export function saveConfigToStorage(config: GithubConfig): void {
  localStorage.setItem(STORAGE_KEYS.token, config.token);
  localStorage.setItem(STORAGE_KEYS.owner, config.owner);
  localStorage.setItem(STORAGE_KEYS.repo, config.repo);
}

type Status = "idle" | "loading" | "saving" | "saved" | "error";

interface PendingSave {
  mutator: (data: AppData) => AppData;
  message: string;
}

interface DataStoreState {
  data: AppData;
  sha: string | null;
  status: Status;
  error: string | null;
  config: GithubConfig | null;
  pendingSave: PendingSave | null;
  setConfig: (config: GithubConfig) => void;
  loadData: () => Promise<void>;
  mutate: (mutator: (data: AppData) => AppData, message: string) => Promise<void>;
  retry: () => Promise<void>;
}

export const useDataStore = create<DataStoreState>((set, get) => ({
  data: emptyAppData(),
  sha: null,
  status: "idle",
  error: null,
  config: loadConfigFromStorage(),
  pendingSave: null,

  setConfig: (config) => {
    saveConfigToStorage(config);
    set({ config });
  },

  loadData: async () => {
    const { config } = get();
    if (!config) return;
    set({ status: "loading", error: null });
    try {
      const file = await fetchAppData(config);
      set({ data: file.data, sha: file.sha, status: "saved" });
    } catch (err) {
      set({ status: "error", error: (err as Error).message });
    }
  },

  mutate: async (mutator, message) => {
    const { config, data } = get();
    if (!config) throw new Error("No GitHub config set");
    const newData = mutator(data);
    set({ data: newData, status: "saving", error: null, pendingSave: { mutator, message } });
    try {
      const { sha } = await saveAppData(config, newData, get().sha, message);
      set({ sha, status: "saved", pendingSave: null });
    } catch (err) {
      if (err instanceof GithubConflictError) {
        try {
          const latest = await fetchAppData(config);
          const reapplied = mutator(latest.data);
          const { sha } = await saveAppData(config, reapplied, latest.sha, message);
          set({ data: reapplied, sha, status: "saved", pendingSave: null });
          return;
        } catch (retryErr) {
          set({ status: "error", error: (retryErr as Error).message });
          return;
        }
      }
      set({ status: "error", error: (err as Error).message });
    }
  },

  retry: async () => {
    const { pendingSave } = get();
    if (!pendingSave) return;
    await get().mutate(pendingSave.mutator, pendingSave.message);
  },
}));
