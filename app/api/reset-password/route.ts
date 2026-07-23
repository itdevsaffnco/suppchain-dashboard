import { NextResponse } from "next/server";
import { peekResetToken, consumeResetToken, setPassword } from "@/lib/userStore";

export const dynamic = "force-dynamic";

// GET ?token=… — validate a reset token (used by the reset page on load).
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const user = peekResetToken(token);
  if (!user) return NextResponse.json({ valid: false }, { status: 400 });
  return NextResponse.json({ valid: true, username: user.username });
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
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }

  const user = consumeResetToken(token);
  if (!user) {
    return NextResponse.json({ error: "reset_link_invalid" }, { status: 400 });
  }

  setPassword(user.id, newPassword);
  return NextResponse.json({ ok: true });
}
