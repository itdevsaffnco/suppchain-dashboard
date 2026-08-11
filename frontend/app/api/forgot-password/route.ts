import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

// Forwards forgot-password request to Laravel, which sends the email.
// Always responds with generic success to prevent email enumeration.
export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = (body.email || "").trim();
  if (!email) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }

  const res = await apiFetch<{ ok: boolean }>(
    "/auth/forgot-password",
    { method: "POST", body: { email } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "request_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
