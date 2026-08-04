import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();

  // Revoke the backend token too, so a leaked cookie can't outlive the logout.
  if (session) {
    try {
      await apiFetch("/auth/logout", { method: "POST", token: session.apiToken });
    } catch (err) {
      console.error("[logout] failed to revoke backend token:", err);
    }
  }

  await clearSession();
  return NextResponse.json({ ok: true });
}
