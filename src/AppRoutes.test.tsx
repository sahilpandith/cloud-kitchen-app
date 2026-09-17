// src/AppRoutes.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppRoutes from "./AppRoutes";
import { useDataStore } from "./store/useDataStore";
import { emptyAppData } from "./types";

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

describe("AppRoutes", () => {
  it("redirects an unconfigured app to Settings from any protected route", () => {
    render(
      <MemoryRouter initialEntries={["/sales"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByText(/GitHub Personal Access Token/i)).toBeInTheDocument();
  });

  it("renders the Dashboard stub once configured", () => {
    useDataStore.setState({
      config: { token: "t", owner: "me", repo: "cloud-kitchen-data", path: "data.json" },
    });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByText("Dashboard — coming soon")).toBeInTheDocument();
  });

  it("redirects unknown routes to the root", () => {
    useDataStore.setState({
      config: { token: "t", owner: "me", repo: "cloud-kitchen-data", path: "data.json" },
    });
    render(
      <MemoryRouter initialEntries={["/nope"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByText("Dashboard — coming soon")).toBeInTheDocument();
  });
});
