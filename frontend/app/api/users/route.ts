import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import { AppUser } from "@/lib/dashboard";
import { Session } from "@/lib/types";

export const dynamic = "force-dynamic";

// The backend enforces this too; checking here avoids a pointless round trip
// and keeps the 401/403 split identical to before.
async function requireAdmin(): Promise<
  { session: Session; error?: never } | { session?: never; error: NextResponse }
> {
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

  const res = await apiFetch<{ users: AppUser[] }>("/users", { token: auth.session.apiToken });
  return NextResponse.json(res.data ?? { error: "data_unavailable" }, {
    status: res.ok ? 200 : res.status,
  });
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

  const res = await apiFetch<{ user: AppUser } | { error: string }>("/users", {
    method: "POST",
    token: auth.session.apiToken,
    body: {
      username: (body.username || "").trim(),
      email: (body.email || "").trim(),
      password: body.password || "",
      role: body.role === "Admin" ? "Admin" : "User",
    },
  });

  return NextResponse.json(res.data ?? { error: "missing_fields" }, {
    status: res.ok ? 200 : res.status,
  });
}

// PATCH { id, username, email, role, password? } — update a user (admin only).
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body: { id?: number; username?: string; email?: string; role?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const payload: Record<string, string> = {
    username: (body.username || "").trim(),
    email: (body.email || "").trim(),
    role: body.role === "Admin" ? "Admin" : "User",
  };
  if (body.password) payload.password = body.password;

  const res = await apiFetch<{ user: AppUser } | { error: string }>(`/users/${id}`, {
    method: "PATCH",
    token: auth.session.apiToken,
    body: payload,
  });

  return NextResponse.json(res.data ?? { error: "missing_fields" }, {
    status: res.ok ? 200 : res.status,
  });
}

// DELETE ?id=… — remove a user (admin only, not yourself).
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const res = await apiFetch<{ ok: true } | { error: string }>(`/users/${id}`, {
    method: "DELETE",
    token: auth.session.apiToken,
  });

  return NextResponse.json(res.data ?? { error: "user_not_found" }, {
    status: res.ok ? 200 : res.status,
  });
}
