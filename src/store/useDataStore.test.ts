import { describe, it, expect, vi, beforeEach } from "vitest";
import { emptyAppData } from "../types";
import { GithubConflictError, type GithubConfig } from "../lib/github";

const fetchAppData = vi.fn();
const saveAppData = vi.fn();

vi.mock("../lib/github", async () => {
  const actual = await vi.importActual<typeof import("../lib/github")>("../lib/github");
  return {
    ...actual,
    fetchAppData: (...args: unknown[]) => fetchAppData(...args),
    saveAppData: (...args: unknown[]) => saveAppData(...args),
  };
});

const { useDataStore } = await import("./useDataStore");

const config: GithubConfig = { token: "t", owner: "me", repo: "cloud-kitchen-data", path: "data.json" };

beforeEach(() => {
  localStorage.clear();
  fetchAppData.mockReset();
  saveAppData.mockReset();
  useDataStore.setState({
    data: emptyAppData(),
    sha: null,
    status: "idle",
    error: null,
    config: null,
    pendingSave: null,
  });
});

describe("useDataStore", () => {
  it("setConfig persists to localStorage and updates state", () => {
    useDataStore.getState().setConfig(config);
    expect(useDataStore.getState().config).toEqual(config);
    expect(localStorage.getItem("ck_github_token")).toBe("t");
  });

  it("loadData fetches and stores data + sha", async () => {
    useDataStore.getState().setConfig(config);
    fetchAppData.mockResolvedValue({ data: emptyAppData(), sha: "sha1" });

    await useDataStore.getState().loadData();

    expect(useDataStore.getState().sha).toBe("sha1");
    expect(useDataStore.getState().status).toBe("saved");
  });

  it("mutate applies the change optimistically and saves it", async () => {
    useDataStore.getState().setConfig(config);
    useDataStore.setState({ sha: "sha1" });
    saveAppData.mockResolvedValue({ sha: "sha2" });

    await useDataStore
      .getState()
      .mutate((data) => ({ ...data, settings: { defaultZomatoCommissionPct: 20 } }), "set commission");

    expect(useDataStore.getState().data.settings.defaultZomatoCommissionPct).toBe(20);
    expect(useDataStore.getState().sha).toBe("sha2");
    expect(useDataStore.getState().status).toBe("saved");
  });

  it("retries once on a conflict by re-fetching and re-applying the mutator", async () => {
    useDataStore.getState().setConfig(config);
    useDataStore.setState({ sha: "sha1" });
    saveAppData.mockRejectedValueOnce(new GithubConflictError());
    saveAppData.mockResolvedValueOnce({ sha: "sha3" });
    fetchAppData.mockResolvedValue({ data: emptyAppData(), sha: "sha2" });

    await useDataStore
      .getState()
      .mutate((data) => ({ ...data, settings: { defaultZomatoCommissionPct: 15 } }), "set commission");

    expect(useDataStore.getState().data.settings.defaultZomatoCommissionPct).toBe(15);
    expect(useDataStore.getState().sha).toBe("sha3");
    expect(useDataStore.getState().status).toBe("saved");
    expect(saveAppData).toHaveBeenCalledTimes(2);
  });

  it("sets status to error and keeps pendingSave when both save attempts fail", async () => {
    useDataStore.getState().setConfig(config);
    useDataStore.setState({ sha: "sha1" });
    saveAppData.mockRejectedValue(new GithubConflictError());
    fetchAppData.mockResolvedValue({ data: emptyAppData(), sha: "sha2" });

    await useDataStore.getState().mutate((data) => data, "noop");

    expect(useDataStore.getState().status).toBe("error");
    expect(useDataStore.getState().pendingSave).not.toBeNull();
  });

  it("retry() re-runs the last failed mutate", async () => {
    useDataStore.getState().setConfig(config);
    useDataStore.setState({ sha: "sha1" });
    saveAppData.mockRejectedValue(new GithubConflictError());
    fetchAppData.mockResolvedValue({ data: emptyAppData(), sha: "sha2" });
    await useDataStore.getState().mutate((data) => data, "noop");

    saveAppData.mockReset();
    saveAppData.mockResolvedValue({ sha: "sha4" });
    fetchAppData.mockReset();
    fetchAppData.mockResolvedValue({ data: emptyAppData(), sha: "sha2" });

    await useDataStore.getState().retry();

    expect(useDataStore.getState().status).toBe("saved");
    expect(useDataStore.getState().sha).toBe("sha4");
  });
});
