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
  let parsed: Partial<AppData>;
  try {
    parsed = JSON.parse(base64ToUtf8(body.content)) as Partial<AppData>;
  } catch (err) {
    throw new Error(`data.json contains invalid JSON: ${(err as Error).message}`);
  }
  const data: AppData = { ...emptyAppData(), ...parsed };
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
