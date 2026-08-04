import { NextResponse } from "next/server";
import { setSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

interface LoginResponse {
  user: SessionUser;
  token: string;
  error?: string;
}

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const username = (body.username || "").trim();
  const password = body.password || "";

  if (!username || !password) {
    return NextResponse.json({ error: "login_error" }, { status: 400 });
  }

  // The backend resolves the identifier (username OR email) and derives the
  // role from the user record — the role is never chosen at login.
  const res = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: { username, password },
  });

  if (!res.ok || !res.data?.token) {
    return NextResponse.json(
      { error: res.data?.error || "login_error" },
      { status: res.ok ? 401 : res.status }
    );
  }

  const { user, token } = res.data;
  await setSession(user, token);
  return NextResponse.json({ username: user.username, role: user.role });
}
