import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET ?token=… — validate a reset token (used by the reset page on load).
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";

  const res = await apiFetch<{ valid: boolean; username?: string }>("/auth/reset-password", {
    query: { token },
  });

  if (!res.ok || !res.data?.valid) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
  return NextResponse.json({ valid: true, username: res.data.username });
}

// POST { token, newPassword } — set the new password and invalidate the token.
export async function POST(request: Request) {
  let body: { token?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const token = body.token || "";
  const newPassword = body.newPassword || "";
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }

  const res = await apiFetch<{ ok: true } | { error: string }>("/auth/reset-password", {
    method: "POST",
    body: { token, newPassword },
  });

  return NextResponse.json(res.data ?? { error: "reset_link_invalid" }, {
    status: res.ok ? 200 : res.status,
  });
}
