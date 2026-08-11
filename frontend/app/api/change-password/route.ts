import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

// Changes the signed-in user's password via the Laravel backend.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const currentPassword = body.currentPassword || "";
  const newPassword = body.newPassword || "";
  if (!currentPassword) return NextResponse.json({ error: "login_error" }, { status: 400 });
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }

  const res = await apiFetch<{ ok: true } | { error: string }>("/auth/change-password", {
    method: "POST",
    token: session.apiToken,
    body: { currentPassword, newPassword },
  });

  return NextResponse.json(res.data ?? { error: "login_error" }, {
    status: res.ok ? 200 : res.status,
  });
}
