import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findByLogin, verifyPassword, setPassword } from "@/lib/userStore";

export const dynamic = "force-dynamic";

// Changes the signed-in user's password against the server user store. When
// the Apps Script backend is wired up, forward the change to the Sheets
// "Users" tab instead.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const current = body.currentPassword || "";
  const next = body.newPassword || "";
  if (!current) return NextResponse.json({ error: "login_error" }, { status: 400 });
  if (next.length < 6) return NextResponse.json({ error: "password_too_short" }, { status: 400 });

  const user = findByLogin(session.username);
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  if (!verifyPassword(user, current)) {
    return NextResponse.json({ error: "login_error" }, { status: 401 });
  }

  setPassword(user.id, next);
  return NextResponse.json({ ok: true });
}
