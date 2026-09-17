# Cloud Kitchen App — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the working skeleton of the Cloud Kitchen Manager web app — project scaffold, the GitHub-Contents-API data sync layer, app shell/navigation, and a Settings screen that connects to the user's private data repo — deployed to GitHub Pages.

**Architecture:** A React + Vite + TypeScript single-page app with no backend. All persistence goes through the GitHub Contents API against a private `cloud-kitchen-data` repo, using a PAT the user pastes into the Settings screen. Zustand holds in-memory app state and mediates optimistic local updates with retry-on-conflict saves.

**Tech Stack:** React 18, Vite 5, TypeScript 5 (strict), React Router 6, Zustand 4, Tailwind CSS 3, Vitest 2 + Testing Library, vite-plugin-pwa, GitHub Actions (deploy to Pages).

This is the first of four planned increments for the Cloud Kitchen Manager app (see spec at `docs/superpowers/specs/2026-09-17-cloud-kitchen-management-app-design.md`). Later plans add Sales/Menu Items, Inventory/Expenses, and Dashboard/P&L/Insights — each builds directly on the data layer and app shell created here.

## Global Constraints

- Repos: this code lives in a **public** repo named `cloud-kitchen-app`; data lives in a **separate private** repo named `cloud-kitchen-data`, containing one file, `data.json`, at its root. If either name differs from these defaults, `vite.config.ts`'s `base` and the manifest's icon paths (Task 8) and `SETUP.md` (Task 10) must be updated to match.
- The GitHub PAT must be a **fine-grained token scoped only to the `cloud-kitchen-data` repo**, with "Contents: Read and write" permission — never a classic token with broader repo access.
- `localStorage` keys used for connection config: `ck_github_token`, `ck_github_owner`, `ck_github_repo`.
- Data model (defined in Task 2) must exactly match the shape in the spec's "Data Model" section — later plans depend on these exact field names.
- P&L formula (for future plans to implement): `Profit = Total Sales − Total Expenses − Total Zomato Commission`, where Zomato commission is read from `Sale.zomatoCommission`, not from the `expenses` array.
- Inventory is a simple stock ledger (stock-in/stock-out entries against `currentQty`) — no recipe-based auto-deduction from sales.
- Verified local dev environment: Node v20.9.0, npm 10.1.0. Default git branch is `main`.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/index.css`
- Create: `vitest.setup.ts`
- Create: `.gitignore`
- Test: `src/smoke.test.ts`

**Interfaces:**
- Produces: an `npm run build` pipeline (`tsc --noEmit && vite build`) and an `npm test` pipeline (`vitest run`) that every later task's steps rely on.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "cloud-kitchen-app",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "zustand": "^4.5.4"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "jsdom": "^24.1.1",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.9",
    "typescript": "^5.5.4",
    "vite": "^5.4.1",
    "vite-plugin-pwa": "^0.20.1",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts", "vitest.setup.ts"]
}
```

- [ ] **Step 3: Write `vite.config.ts`**

```typescript
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/cloud-kitchen-app/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    globals: true,
  },
});
```

- [ ] **Step 4: Write `tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 5: Write `postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#EA580C" />
    <title>Cloud Kitchen Manager</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Write `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 8: Write `src/main.tsx`** (minimal placeholder — replaced with routing in Task 7)

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div>Cloud Kitchen Manager</div>
  </React.StrictMode>
);
```

- [ ] **Step 9: Write `vitest.setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 10: Write `.gitignore`**

```
node_modules
dist
dist-ssr
*.local
.DS_Store
```

- [ ] **Step 11: Write the smoke test `src/smoke.test.ts`**

```typescript
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("test runner works", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 12: Install dependencies**

Run: `npm install`
Expected: completes without errors, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 13: Run the test suite**

Run: `npm test`
Expected: PASS — 1 test file, 1 test passed.

- [ ] **Step 14: Verify the build**

Run: `npm run build`
Expected: no TypeScript errors, `dist/` is created containing `index.html` and hashed JS/CSS assets.

- [ ] **Step 15: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html src/main.tsx src/index.css vitest.setup.ts src/smoke.test.ts .gitignore
git commit -m "Scaffold Vite + React + TypeScript project with Tailwind and Vitest"
```

---

### Task 2: Data Model Types

**Files:**
- Create: `src/types.ts`
- Test: `src/types.test.ts`

**Interfaces:**
- Produces: `MenuItem`, `Sale`, `SaleLineItem`, `SaleChannel`, `InventoryItem`, `StockMove`, `StockMoveType`, `Expense`, `ExpenseCategory`, `AppSettings`, `AppData` types, and `emptyAppData(): AppData`. Every later task that reads or writes app data imports `AppData` and/or `emptyAppData` from `./types` (or `../types`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/types.test.ts
import { describe, it, expect } from "vitest";
import { emptyAppData } from "./types";

describe("emptyAppData", () => {
  it("returns an AppData object with all empty collections and default settings", () => {
    expect(emptyAppData()).toEqual({
      menuItems: [],
      sales: [],
      inventory: [],
      stockMoves: [],
      expenses: [],
      settings: { defaultZomatoCommissionPct: 0 },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/types.test.ts`
Expected: FAIL — cannot resolve `./types` (file does not exist yet).

- [ ] **Step 3: Write `src/types.ts`**

```typescript
export interface MenuItem {
  id: string;
  name: string;
  category: string;
  defaultPrice: number;
}

export type SaleChannel = "zomato" | "direct";

export interface SaleLineItem {
  menuItemId: string;
  qty: number;
  price: number;
}

export interface Sale {
  id: string;
  date: string; // ISO-8601
  channel: SaleChannel;
  lineItems: SaleLineItem[];
  zomatoCommission?: number; // present only when channel === "zomato"
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  currentQty: number;
  lowStockThreshold: number;
}

export type StockMoveType = "in" | "out";

export interface StockMove {
  id: string;
  date: string; // ISO-8601
  inventoryItemId: string;
  type: StockMoveType;
  qty: number;
  note: string;
}

export type ExpenseCategory =
  | "Ingredients"
  | "Rent"
  | "Utilities"
  | "Staff"
  | "Packaging"
  | "Other";

export interface Expense {
  id: string;
  date: string; // ISO-8601
  category: ExpenseCategory;
  amount: number;
  note: string;
}

export interface AppSettings {
  defaultZomatoCommissionPct: number;
}

export interface AppData {
  menuItems: MenuItem[];
  sales: Sale[];
  inventory: InventoryItem[];
  stockMoves: StockMove[];
  expenses: Expense[];
  settings: AppSettings;
}

export function emptyAppData(): AppData {
  return {
    menuItems: [],
    sales: [],
    inventory: [],
    stockMoves: [],
    expenses: [],
    settings: { defaultZomatoCommissionPct: 0 },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/types.test.ts
git commit -m "Add AppData type definitions"
```

---

### Task 3: Base64 Helpers

**Files:**
- Create: `src/lib/base64.ts`
- Test: `src/lib/base64.test.ts`

**Interfaces:**
- Produces: `utf8ToBase64(str: string): string`, `base64ToUtf8(base64: string): string`. Consumed by Task 4's `github.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/base64.test.ts
import { describe, it, expect } from "vitest";
import { utf8ToBase64, base64ToUtf8 } from "./base64";

describe("base64", () => {
  it("round-trips ASCII text", () => {
    expect(base64ToUtf8(utf8ToBase64("hello world"))).toBe("hello world");
  });

  it("round-trips UTF-8 text with non-ASCII characters", () => {
    const text = "Café ₹500 – 日本語";
    expect(base64ToUtf8(utf8ToBase64(text))).toBe(text);
  });

  it("handles base64 content with embedded newlines (as GitHub's API returns it)", () => {
    const encoded = utf8ToBase64("line one\nline two");
    const withNewlines = encoded.match(/.{1,4}/g)!.join("\n");
    expect(base64ToUtf8(withNewlines)).toBe("line one\nline two");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/base64.test.ts`
Expected: FAIL — cannot resolve `./base64`.

- [ ] **Step 3: Write `src/lib/base64.ts`**

```typescript
export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export function base64ToUtf8(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/base64.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/base64.ts src/lib/base64.test.ts
git commit -m "Add UTF-8 safe base64 helpers"
```

---

### Task 4: GitHub Contents API Sync Module

**Files:**
- Create: `src/lib/github.ts`
- Test: `src/lib/github.test.ts`

**Interfaces:**
- Consumes: `AppData`, `emptyAppData` from `../types`; `utf8ToBase64`, `base64ToUtf8` from `./base64`.
- Produces: `GithubConfig { token, owner, repo, path }`, `GithubFile { data: AppData, sha: string | null }`, `GithubConflictError`, `fetchAppData(config: GithubConfig): Promise<GithubFile>`, `saveAppData(config: GithubConfig, data: AppData, sha: string | null, message: string): Promise<{ sha: string }>`. Consumed by Task 5's `useDataStore.ts`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/github.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/github.test.ts`
Expected: FAIL — cannot resolve `./github`.

- [ ] **Step 3: Write `src/lib/github.ts`**

```typescript
import { AppData, emptyAppData } from "../types";
import { utf8ToBase64, base64ToUtf8 } from "./base64";

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  path: string;
}

export interface GithubFile {
  data: AppData;
  sha: string | null;
}

export class GithubConflictError extends Error {
  constructor() {
    super("The data file was changed elsewhere since it was last loaded.");
    this.name = "GithubConflictError";
  }
}

function contentsUrl(config: GithubConfig): string {
  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`;
}

function authHeaders(config: GithubConfig): HeadersInit {
  return {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/vnd.github+json",
  };
}

export async function fetchAppData(config: GithubConfig): Promise<GithubFile> {
  const response = await fetch(contentsUrl(config), { headers: authHeaders(config) });

  if (response.status === 404) {
    return { data: emptyAppData(), sha: null };
  }

  if (!response.ok) {
    throw new Error(`Failed to load data (status ${response.status})`);
  }

  const body = await response.json();
  const data = JSON.parse(base64ToUtf8(body.content)) as AppData;
  return { data, sha: body.sha as string };
}

export async function saveAppData(
  config: GithubConfig,
  data: AppData,
  sha: string | null,
  message: string
): Promise<{ sha: string }> {
  const response = await fetch(contentsUrl(config), {
    method: "PUT",
    headers: { ...authHeaders(config), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: utf8ToBase64(JSON.stringify(data, null, 2)),
      ...(sha ? { sha } : {}),
    }),
  });

  if (response.status === 409 || response.status === 422) {
    throw new GithubConflictError();
  }

  if (!response.ok) {
    throw new Error(`Failed to save data (status ${response.status})`);
  }

  const body = await response.json();
  return { sha: body.content.sha as string };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/github.test.ts`
Expected: PASS — 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/github.ts src/lib/github.test.ts
git commit -m "Add GitHub Contents API sync module"
```

---

### Task 5: Zustand Data Store

**Files:**
- Create: `src/store/useDataStore.ts`
- Test: `src/store/useDataStore.test.ts`

**Interfaces:**
- Consumes: `AppData`, `emptyAppData` from `../types`; `GithubConfig`, `GithubFile`, `fetchAppData`, `saveAppData`, `GithubConflictError` from `../lib/github`.
- Produces: `useDataStore` Zustand hook with state `{ data: AppData, sha: string | null, status: "idle"|"loading"|"saving"|"saved"|"error", error: string | null, config: GithubConfig | null, pendingSave: {...} | null }` and actions `setConfig(config: GithubConfig): void`, `loadData(): Promise<void>`, `mutate(mutator: (data: AppData) => AppData, message: string): Promise<void>`, `retry(): Promise<void>`. Also produces `loadConfigFromStorage(): GithubConfig | null` and `saveConfigToStorage(config: GithubConfig): void`. Consumed by every page component in Task 6 onward.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/store/useDataStore.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/store/useDataStore.test.ts`
Expected: FAIL — cannot resolve `./useDataStore`.

- [ ] **Step 3: Write `src/store/useDataStore.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/store/useDataStore.test.ts`
Expected: PASS — 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/store/useDataStore.ts src/store/useDataStore.test.ts
git commit -m "Add Zustand data store with optimistic save and conflict retry"
```

---

### Task 6: Settings Screen

**Files:**
- Create: `src/pages/Settings.tsx`
- Test: `src/pages/Settings.test.tsx`

**Interfaces:**
- Consumes: `useDataStore` from `../store/useDataStore`.
- Produces: default export `Settings` component, rendering a form containing labeled fields matched by `/Personal Access Token/i`, `/GitHub Username/i`, `/Data Repo Name/i`, and a submit button named `/Save & Connect/i`. Consumed by Task 7's `AppRoutes.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/pages/Settings.test.tsx
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/pages/Settings.test.tsx`
Expected: FAIL — cannot resolve `./Settings`.

- [ ] **Step 3: Write `src/pages/Settings.tsx`**

```tsx
import { FormEvent, useState } from "react";
import { useDataStore } from "../store/useDataStore";

export default function Settings() {
  const config = useDataStore((s) => s.config);
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
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
      {status === "saved" && config && (
        <p className="mt-3 text-sm text-green-700">
          Connected to {config.owner}/{config.repo}.
        </p>
      )}
      {status === "error" && <p className="mt-3 text-sm text-red-700">Connection failed: {error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/pages/Settings.test.tsx`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Settings.tsx src/pages/Settings.test.tsx
git commit -m "Add Settings screen for GitHub connection config"
```

---

### Task 7: App Shell — Routing, Layout, Navigation, Route Guard

**Files:**
- Create: `src/components/Nav.tsx`
- Create: `src/components/SyncIndicator.tsx`
- Create: `src/components/Layout.tsx`
- Create: `src/components/RequireConfig.tsx`
- Test: `src/components/RequireConfig.test.tsx`
- Create: `src/pages/Dashboard.tsx`
- Create: `src/pages/Sales.tsx`
- Create: `src/pages/Inventory.tsx`
- Create: `src/pages/Expenses.tsx`
- Create: `src/pages/ProfitLoss.tsx`
- Create: `src/pages/Insights.tsx`
- Create: `src/AppRoutes.tsx`
- Test: `src/AppRoutes.test.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `useDataStore` from `./store/useDataStore` (and `../store/useDataStore` from components); `Settings` from `./pages/Settings`.
- Produces: default export `AppRoutes` (a `<Routes>` tree, no `<BrowserRouter>` wrapper — that's added in `main.tsx` so tests can wrap it in `<MemoryRouter>`), routed at `/`, `/sales`, `/inventory`, `/expenses`, `/profit-loss`, `/insights`, `/settings`. Stub pages render exactly the text `"<PageName> — coming soon"` (e.g. `"Sales — coming soon"`) — later plans replace these bodies without changing the route paths.

- [ ] **Step 1: Write `src/components/Nav.tsx`**

```tsx
import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/sales", label: "Sales" },
  { to: "/inventory", label: "Inventory" },
  { to: "/expenses", label: "Expenses" },
  { to: "/profit-loss", label: "P&L" },
  { to: "/insights", label: "Insights" },
  { to: "/settings", label: "Settings" },
];

export default function Nav() {
  return (
    <nav className="flex gap-4 overflow-x-auto border-b border-orange-200 bg-orange-50 px-4 py-2">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/"}
          className={({ isActive }) =>
            `whitespace-nowrap text-sm font-medium ${isActive ? "text-orange-700" : "text-gray-600"}`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Write `src/components/SyncIndicator.tsx`**

```tsx
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
```

- [ ] **Step 3: Write `src/components/Layout.tsx`**

```tsx
import { ReactNode } from "react";
import Nav from "./Nav";
import SyncIndicator from "./SyncIndicator";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <SyncIndicator />
      <main className="p-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Write the failing test for the route guard**

```tsx
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
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test -- src/components/RequireConfig.test.tsx`
Expected: FAIL — cannot resolve `./RequireConfig`.

- [ ] **Step 6: Write `src/components/RequireConfig.tsx`**

```tsx
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useDataStore } from "../store/useDataStore";

export default function RequireConfig({ children }: { children: ReactNode }) {
  const config = useDataStore((s) => s.config);
  if (!config) return <Navigate to="/settings" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- src/components/RequireConfig.test.tsx`
Expected: PASS — 2 tests passed.

- [ ] **Step 8: Write the stub pages**

```tsx
// src/pages/Dashboard.tsx
export default function Dashboard() {
  return <div>Dashboard — coming soon</div>;
}
```

```tsx
// src/pages/Sales.tsx
export default function Sales() {
  return <div>Sales — coming soon</div>;
}
```

```tsx
// src/pages/Inventory.tsx
export default function Inventory() {
  return <div>Inventory — coming soon</div>;
}
```

```tsx
// src/pages/Expenses.tsx
export default function Expenses() {
  return <div>Expenses — coming soon</div>;
}
```

```tsx
// src/pages/ProfitLoss.tsx
export default function ProfitLoss() {
  return <div>P&L — coming soon</div>;
}
```

```tsx
// src/pages/Insights.tsx
export default function Insights() {
  return <div>Insights — coming soon</div>;
}
```

- [ ] **Step 9: Write the failing tests for `AppRoutes`**

```tsx
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
```

- [ ] **Step 10: Run tests to verify they fail**

Run: `npm test -- src/AppRoutes.test.tsx`
Expected: FAIL — cannot resolve `./AppRoutes`.

- [ ] **Step 11: Write `src/AppRoutes.tsx`**

```tsx
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import RequireConfig from "./components/RequireConfig";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Inventory from "./pages/Inventory";
import Expenses from "./pages/Expenses";
import ProfitLoss from "./pages/ProfitLoss";
import Insights from "./pages/Insights";
import Settings from "./pages/Settings";

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/settings"
        element={
          <Layout>
            <Settings />
          </Layout>
        }
      />
      <Route
        path="/"
        element={
          <RequireConfig>
            <Layout>
              <Dashboard />
            </Layout>
          </RequireConfig>
        }
      />
      <Route
        path="/sales"
        element={
          <RequireConfig>
            <Layout>
              <Sales />
            </Layout>
          </RequireConfig>
        }
      />
      <Route
        path="/inventory"
        element={
          <RequireConfig>
            <Layout>
              <Inventory />
            </Layout>
          </RequireConfig>
        }
      />
      <Route
        path="/expenses"
        element={
          <RequireConfig>
            <Layout>
              <Expenses />
            </Layout>
          </RequireConfig>
        }
      />
      <Route
        path="/profit-loss"
        element={
          <RequireConfig>
            <Layout>
              <ProfitLoss />
            </Layout>
          </RequireConfig>
        }
      />
      <Route
        path="/insights"
        element={
          <RequireConfig>
            <Layout>
              <Insights />
            </Layout>
          </RequireConfig>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `npm test -- src/AppRoutes.test.tsx`
Expected: PASS — 3 tests passed.

- [ ] **Step 13: Wire it up in `src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./AppRoutes";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 14: Run the full test suite and verify the build**

Run: `npm test`
Expected: PASS — all test files pass (smoke, types, base64, github, useDataStore, Settings, RequireConfig, AppRoutes).

Run: `npm run build`
Expected: no errors.

- [ ] **Step 15: Commit**

```bash
git add src/components/Nav.tsx src/components/SyncIndicator.tsx src/components/Layout.tsx src/components/RequireConfig.tsx src/components/RequireConfig.test.tsx src/pages/Dashboard.tsx src/pages/Sales.tsx src/pages/Inventory.tsx src/pages/Expenses.tsx src/pages/ProfitLoss.tsx src/pages/Insights.tsx src/AppRoutes.tsx src/AppRoutes.test.tsx src/main.tsx
git commit -m "Add app shell: routing, nav, layout, and route guard"
```

---

### Task 8: PWA Support

**Files:**
- Modify: `vite.config.ts`
- Create: `public/icon.svg`

**Interfaces:**
- Produces: a build that emits `dist/manifest.webmanifest` and a service worker, so the deployed app is installable from Chrome.

- [ ] **Step 1: Write `public/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#EA580C"/>
  <circle cx="50" cy="45" r="28" fill="#FFF7ED"/>
  <rect x="30" y="70" width="40" height="8" rx="4" fill="#FFF7ED"/>
</svg>
```

- [ ] **Step 2: Modify `vite.config.ts`** to add the PWA plugin

```typescript
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/cloud-kitchen-app/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Cloud Kitchen Manager",
        short_name: "CK Manager",
        description: "Personal sales, inventory, expense, and P&L tracker for a cloud kitchen.",
        theme_color: "#EA580C",
        background_color: "#FFF7ED",
        display: "standalone",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    globals: true,
  },
});
```

- [ ] **Step 3: Verify the build produces PWA assets**

Run: `npm run build`
Expected: no errors.

Run: `ls dist/manifest.webmanifest dist/sw.js`
Expected: both files exist.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts public/icon.svg
git commit -m "Add PWA manifest and service worker via vite-plugin-pwa"
```

---

### Task 9: GitHub Actions Deploy Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: a workflow that builds and deploys `dist/` to GitHub Pages on every push to `main`.

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions workflow to deploy to GitHub Pages"
```

*(This workflow can only be verified by pushing to a real GitHub repo — that verification happens in Task 11.)*

---

### Task 10: Manual GitHub Setup Instructions

**Files:**
- Create: `SETUP.md`

**Interfaces:**
- Produces: a document the user follows by hand outside this codebase — no code interface.

- [ ] **Step 1: Write `SETUP.md`**

```markdown
# Setup

One-time setup to get Cloud Kitchen Manager hosted and connected to your own data.

## 1. Create two repositories on GitHub

1. **`cloud-kitchen-app`** — public. This holds the app code (this project).
2. **`cloud-kitchen-data`** — private. This holds nothing but your data; create it empty.

If you name either repo differently, update `base` in `vite.config.ts`, the `icons`/`start_url` in the PWA
manifest, and the repo name you enter in the app's Settings screen, to match.

## 2. Push this code to `cloud-kitchen-app`

    git remote add origin https://github.com/<your-username>/cloud-kitchen-app.git
    git push -u origin main

## 3. Seed the data repo

In `cloud-kitchen-data`, create a file named `data.json` at the repo root with this exact content:

    {
      "menuItems": [],
      "sales": [],
      "inventory": [],
      "stockMoves": [],
      "expenses": [],
      "settings": { "defaultZomatoCommissionPct": 0 }
    }

(The app can also create this file itself on first save if you skip this step — but creating it up front
lets you confirm the repo is set up correctly first.)

## 4. Generate a fine-grained Personal Access Token

1. Go to https://github.com/settings/personal-access-tokens/new
2. Under **Repository access**, choose **Only select repositories** and pick `cloud-kitchen-data` only.
3. Under **Permissions → Repository permissions**, set **Contents** to **Read and write**. Leave everything else as **No access**.
4. Set an expiration you're comfortable with (you'll need to regenerate and re-enter it in Settings when it expires).
5. Generate the token and copy it — GitHub only shows it once.

## 5. Enable GitHub Pages

In `cloud-kitchen-app` → **Settings → Pages**, set **Source** to **GitHub Actions**. The deploy workflow
(`.github/workflows/deploy.yml`) will publish the site automatically on every push to `main`.

## 6. First run

1. Visit `https://<your-username>.github.io/cloud-kitchen-app/`.
2. You'll land on **Settings** (no connection configured yet).
3. Enter the token from step 4, your GitHub username, and `cloud-kitchen-data` as the repo name. Click **Save & Connect**.
4. You should see "Connected to `<your-username>/cloud-kitchen-data`." If you see a connection error instead,
   double check the token's repository access and permissions (step 4).

## What's needed from you, summarized

- A GitHub account.
- The two repos created as described above.
- The fine-grained PAT, scoped only to `cloud-kitchen-data`, pasted into the app once.

Nothing else is required to host this — GitHub Pages and GitHub Actions are both free for public repos.
```

- [ ] **Step 2: Commit**

```bash
git add SETUP.md
git commit -m "Add manual GitHub setup instructions"
```

---

### Task 11: End-to-End Manual Verification

**Files:** none (manual verification against the real, hosted app).

This task has no automated test — it's the user (or whoever holds the GitHub account) performing `SETUP.md` for real and confirming it works end-to-end. It's the acceptance check for this entire plan.

- [ ] **Step 1: Follow `SETUP.md` steps 1–5** to create both repos, push the code, seed `data.json`, generate the PAT, and enable Pages.

- [ ] **Step 2: Confirm the GitHub Actions run succeeds**

In `cloud-kitchen-app` → **Actions** tab, confirm the "Deploy to GitHub Pages" workflow run is green.

- [ ] **Step 3: Open the deployed site** at `https://<username>.github.io/cloud-kitchen-app/` in Chrome and confirm it redirects to Settings.

- [ ] **Step 4: Enter the PAT and connect**, per `SETUP.md` step 6. Confirm the "Connected to ..." message appears and the nav bar with all 7 sections is visible.

- [ ] **Step 5: Confirm a read round-trips against the real API.** In `cloud-kitchen-data` on GitHub, manually edit `data.json`'s `settings.defaultZomatoCommissionPct` to `25` via the GitHub web UI and commit. Reload the app. Confirm it loads without error — full display of settings values arrives in a later plan, but this proves `fetchAppData` correctly parses real GitHub API responses.

- [ ] **Step 6: Confirm mobile/PWA install.** On a phone (or Chrome's device toolbar in desktop devtools), open the deployed URL, open Chrome's menu, and confirm an "Install app" / "Add to Home screen" option appears.

- [ ] **Step 7: Report results.** If any step fails, note which one — that's the starting point for a follow-up fix before moving on to the next plan (Sales & Menu Items).

---

## Self-Review Notes

- **Spec coverage:** this plan covers the spec's Architecture, Data Model, and the connection/config portion of Settings. Sales, Inventory, Expenses, P&L, Insights, menu/inventory item management within Settings, CSV export, and date-range presets are intentionally deferred to the next three plans, as scoped during brainstorming — each of those is independently testable once this foundation exists.
- **Placeholder scan:** no TBD/TODO markers; every step has complete, runnable code.
- **Type consistency:** `AppData`/`GithubConfig`/`GithubFile`/`GithubConflictError` are defined once in Task 2/4 and imported with identical names and shapes in every later task. Store action signatures (`setConfig`, `loadData`, `mutate`, `retry`) are used identically in Task 5's tests and Task 6/7's components.
