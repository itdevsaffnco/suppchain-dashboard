import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listUsers, addUser, deleteUser } from "@/lib/userStore";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.role !== "Admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  return NextResponse.json({ users: listUsers() });
}

// POST { username, email, role, password } — create a user (admin only).
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body: { username?: string; email?: string; role?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const username = (body.username || "").trim();
  const email = (body.email || "").trim();
  const password = body.password || "";
  const role = body.role === "Admin" ? "Admin" : "User";

  if (!username || !email || !password) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "email_invalid" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }

  const result = addUser({ username, email, role, password });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ user: result });
}

// DELETE ?id=… — remove a user (admin only, not yourself).
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const target = listUsers().find((u) => u.id === id);
  if (target && target.username === auth.session.username) {
    return NextResponse.json({ error: "cannot_delete_self" }, { status: 400 });
  }

  if (!deleteUser(id)) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
