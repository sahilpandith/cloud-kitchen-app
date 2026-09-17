import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Settings from "./Settings";
import { useDataStore } from "../store/useDataStore";
import { emptyAppData } from "../types";

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
  it("saves config and connects on submit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, ok: false }));

    render(<Settings />);
    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByText(/Connected to sahil\/cloud-kitchen-data/)).toBeInTheDocument()
    );

    expect(useDataStore.getState().config).toEqual({
      token: "ghp_test",
      owner: "sahil",
      repo: "cloud-kitchen-data",
      path: "data.json",
    });
  });

  it("shows an error message when connecting fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 500, ok: false }));

    render(<Settings />);
    fillAndSubmit();

    await waitFor(() => expect(screen.getByText(/Connection failed/)).toBeInTheDocument());
  });
});
