// Server-only client for the Laravel backend (apps/api).
//
// Never import this from a client component — API_BASE_URL/APP_API_KEY and the
// per-session bearer token must never reach the browser bundle.

const DEFAULT_BASE_URL = "http://127.0.0.1:8000/api";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  /** Parsed JSON body, or null when the response had no JSON payload. */
  data: T | null;
}

interface ApiRequest {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  /** Sanctum personal access token for endpoints that need a signed-in user. */
  token?: string;
  query?: Record<string, string>;
}

function baseUrl(): string {
  return (process.env.API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

/**
 * Calls the Laravel API and hands back the status alongside the payload, so
 * route handlers can forward the backend's error codes verbatim rather than
 * inventing their own.
 */
export async function apiFetch<T = unknown>(
  path: string,
  { method = "GET", body, token, query }: ApiRequest = {}
): Promise<ApiResult<T>> {
  const appKey = process.env.APP_API_KEY;
  if (!appKey) throw new Error("APP_API_KEY is not configured");

  const url = new URL(`${baseUrl()}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-App-Key": appKey,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    // Empty or non-JSON body — callers fall back to the status code.
  }

  return { ok: res.ok, status: res.status, data };
}
