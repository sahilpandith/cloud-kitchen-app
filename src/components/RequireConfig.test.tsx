// src/components/RequireConfig.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RequireConfig from "./RequireConfig";
import { useDataStore } from "../store/useDataStore";
import { emptyAppData } from "../types";

function renderWithRoute(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/settings" element={<div>Settings Page</div>} />
        <Route
          path="/"
          element={
            <RequireConfig>
              <div>Protected Dashboard</div>
            </RequireConfig>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useDataStore.setState({
    data: emptyAppData(),
    sha: null,
    status: "idle",
    error: null,
    config: null,
    pendingSave: null,
  });
});

describe("RequireConfig", () => {
  it("redirects to /settings when no config is set", () => {
    renderWithRoute("/");
    expect(screen.getByText("Settings Page")).toBeInTheDocument();
  });

  it("renders children when config is set", () => {
    useDataStore.setState({
      config: { token: "t", owner: "me", repo: "cloud-kitchen-data", path: "data.json" },
    });
    renderWithRoute("/");
    expect(screen.getByText("Protected Dashboard")).toBeInTheDocument();
  });
});
