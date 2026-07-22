// Server-only fetch wrapper to the Google Apps Script Web App.
// Never import this from a client component — APPS_SCRIPT_URL/TOKEN must
// never reach the browser bundle.

interface AppsScriptResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function callAppsScript<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) throw new Error("APPS_SCRIPT_URL is not configured");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, token: process.env.APPS_SCRIPT_TOKEN, ...payload }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Apps Script request failed with status ${res.status}`);
  }

  const json = (await res.json()) as AppsScriptResponse<T>;
  if (!json.ok) {
    throw new Error(json.error || "Apps Script returned an error");
  }
  return json.data as T;
}
