import { describe, it, expect, vi, beforeEach } from "vitest";
import { emptyAppData, type AppData, type Expense } from "../types";
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

// A genuinely non-idempotent mutator (array append) — applying it twice to
// the same base produces two entries, which is exactly the duplication bug
// these regression tests guard against.
const testExpense: Expense = { id: "e1", date: "2026-01-01", category: "Other", amount: 10, note: "test" };
const appendExpense = (data: AppData): AppData => ({ ...data, expenses: [...data.expenses, testExpense] });

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

  it("retries once on a conflict with a non-idempotent mutator without duplicating", async () => {
    useDataStore.getState().setConfig(config);
    useDataStore.setState({ sha: "sha1" });
    saveAppData.mockRejectedValueOnce(new GithubConflictError());
    saveAppData.mockResolvedValueOnce({ sha: "sha3" });
    fetchAppData.mockResolvedValue({ data: emptyAppData(), sha: "sha2" });

    await useDataStore.getState().mutate(appendExpense, "add expense");

    expect(useDataStore.getState().data.expenses).toEqual([testExpense]);
    expect(useDataStore.getState().sha).toBe("sha3");
    expect(useDataStore.getState().status).toBe("saved");
  });

  it("retry() after a non-conflict failure does not re-apply the mutator to already-mutated local data", async () => {
    useDataStore.getState().setConfig(config);
    useDataStore.setState({ sha: "sha1" });
    // First attempt: optimistic apply happens locally, then the save fails
    // with a plain (non-conflict) error.
    saveAppData.mockRejectedValueOnce(new Error("network error"));

    await useDataStore.getState().mutate(appendExpense, "add expense");

    expect(useDataStore.getState().status).toBe("error");
    // Optimistic local apply happened once — exactly one item, not zero.
    expect(useDataStore.getState().data.expenses).toEqual([testExpense]);

    // Retry should fetch the fresh remote state (which doesn't have the
    // expense yet) and apply the mutator to THAT, not to the already-mutated
    // local `data`, otherwise the expense would be duplicated.
    saveAppData.mockReset();
    saveAppData.mockResolvedValue({ sha: "sha5" });
    fetchAppData.mockReset();
    fetchAppData.mockResolvedValue({ data: emptyAppData(), sha: "sha2" });

    await useDataStore.getState().retry();

    expect(useDataStore.getState().status).toBe("saved");
    expect(useDataStore.getState().sha).toBe("sha5");
    expect(useDataStore.getState().data.expenses).toEqual([testExpense]);
  });

  it("retry() falls back to loadData() when there is no pendingSave (failed initial connection)", async () => {
    useDataStore.getState().setConfig(config);
    fetchAppData.mockRejectedValueOnce(new Error("bad credentials"));

    await useDataStore.getState().loadData();

    expect(useDataStore.getState().status).toBe("error");
    expect(useDataStore.getState().pendingSave).toBeNull();

    fetchAppData.mockReset();
    fetchAppData.mockResolvedValue({ data: emptyAppData(), sha: "sha9" });

    await useDataStore.getState().retry();

    expect(fetchAppData).toHaveBeenCalledTimes(1);
    expect(useDataStore.getState().status).toBe("saved");
    expect(useDataStore.getState().sha).toBe("sha9");
  });
});
