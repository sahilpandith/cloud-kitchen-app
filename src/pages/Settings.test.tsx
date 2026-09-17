import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import Settings from "./Settings";
import { useDataStore } from "../store/useDataStore";
import { emptyAppData } from "../types";
import { utf8ToBase64 } from "../lib/base64";

beforeEach(() => {
  localStorage.clear();
  useDataStore.setState({
    data: emptyAppData(),
    sha: null,
    status: "idle",
    error: null,
    config: null,
    pendingSave: null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(/Personal Access Token/i), {
    target: { value: "ghp_test" },
  });
  fireEvent.change(screen.getByLabelText(/GitHub Username/i), { target: { value: "sahil" } });
  fireEvent.change(screen.getByLabelText(/Data Repo Name/i), {
    target: { value: "cloud-kitchen-data" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Save & Connect/i }));
}

describe("Settings", () => {
  it("saves config and shows a distinct message when no data.json exists yet (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, ok: false }));

    render(<Settings />);
    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByText(/no data\.json found yet/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/Connected to sahil\/cloud-kitchen-data/)).toBeInTheDocument();

    expect(useDataStore.getState().config).toEqual({
      token: "ghp_test",
      owner: "sahil",
      repo: "cloud-kitchen-data",
      path: "data.json",
    });
  });

  it("shows the plain connected message when data.json already exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ content: utf8ToBase64(JSON.stringify(emptyAppData())), sha: "abc123" }),
      })
    );

    render(<Settings />);
    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByText(/^Connected to sahil\/cloud-kitchen-data\.$/)).toBeInTheDocument()
    );
    expect(screen.queryByText(/no data\.json found yet/i)).not.toBeInTheDocument();
  });

  it("shows an error message when connecting fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 500, ok: false }));

    render(<Settings />);
    fillAndSubmit();

    await waitFor(() => expect(screen.getByText(/Connection failed/)).toBeInTheDocument());
  });

  it("renders the Menu Items section once connected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ content: utf8ToBase64(JSON.stringify(emptyAppData())), sha: "abc123" }),
      })
    );

    render(<Settings />);
    fillAndSubmit();

    expect(await screen.findByText("Menu Items")).toBeInTheDocument();
  });

  it("keeps the Menu Items section mounted while a save is in flight", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ content: utf8ToBase64(JSON.stringify(emptyAppData())), sha: "abc123" }),
      })
    );

    render(<Settings />);
    fillAndSubmit();

    expect(await screen.findByText("Menu Items")).toBeInTheDocument();

    act(() => {
      useDataStore.setState({ status: "saving" });
    });

    expect(screen.getByText("Menu Items")).toBeInTheDocument();
  });

  it("keeps the Menu Items section mounted when a save fails while already connected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ content: utf8ToBase64(JSON.stringify(emptyAppData())), sha: "abc123" }),
      })
    );

    render(<Settings />);
    fillAndSubmit();

    expect(await screen.findByText("Menu Items")).toBeInTheDocument();

    act(() => {
      useDataStore.setState({
        status: "error",
        pendingSave: { mutator: (d) => d, message: "x" },
      });
    });

    expect(screen.getByText("Menu Items")).toBeInTheDocument();
  });

  it("renders the Inventory Items section once connected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ content: utf8ToBase64(JSON.stringify(emptyAppData())), sha: "abc123" }),
      })
    );

    render(<Settings />);
    fillAndSubmit();

    expect(await screen.findByText("Inventory Items")).toBeInTheDocument();
  });
});
