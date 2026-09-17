import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchAppData, saveAppData, GithubConflictError, type GithubConfig } from "./github";
import { utf8ToBase64 } from "./base64";
import { emptyAppData, type AppData } from "../types";

const config: GithubConfig = {
  token: "t",
  owner: "me",
  repo: "cloud-kitchen-data",
  path: "data.json",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAppData", () => {
  it("returns empty data with a null sha when the file does not exist (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, ok: false }));
    const result = await fetchAppData(config);
    expect(result).toEqual({ data: emptyAppData(), sha: null });
  });

  it("decodes and parses existing file content", async () => {
    const stored: AppData = { ...emptyAppData(), settings: { defaultZomatoCommissionPct: 18 } };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ content: utf8ToBase64(JSON.stringify(stored)), sha: "abc123" }),
      })
    );
    const result = await fetchAppData(config);
    expect(result).toEqual({ data: stored, sha: "abc123" });
  });

  it("throws on an unexpected error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 500, ok: false }));
    await expect(fetchAppData(config)).rejects.toThrow("status 500");
  });
});

describe("saveAppData", () => {
  it("PUTs base64-encoded content with the given sha", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ content: { sha: "new-sha" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveAppData(config, emptyAppData(), "old-sha", "update data");

    expect(result).toEqual({ sha: "new-sha" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/me/cloud-kitchen-data/contents/data.json");
    expect(options.method).toBe("PUT");
    const body = JSON.parse(options.body);
    expect(body.sha).toBe("old-sha");
    expect(body.message).toBe("update data");
  });

  it("omits sha from the request body when creating the file for the first time", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => ({ content: { sha: "first-sha" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await saveAppData(config, emptyAppData(), null, "create data");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.sha).toBeUndefined();
  });

  it("throws GithubConflictError on a 409 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 409, ok: false }));
    await expect(saveAppData(config, emptyAppData(), "old-sha", "msg")).rejects.toThrow(
      GithubConflictError
    );
  });
});
