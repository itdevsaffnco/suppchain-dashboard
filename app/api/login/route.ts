import { NextResponse } from "next/server";
import { setSession } from "@/lib/session";
import { callAppsScript } from "@/lib/appsScript";
import { Role } from "@/lib/types";
import { findByLogin, verifyPassword } from "@/lib/userStore";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const inputName = (body.username || "").trim();
  const password = body.password || "";

  if (!inputName || !password) {
    return NextResponse.json({ error: "login_error" }, { status: 400 });
  }

  // Role is always derived from the user record — never chosen at login.
  let username = inputName;
  let role: Role;

  if (process.env.APPS_SCRIPT_URL) {
    // Validate against the Google Sheets backend when configured.
    try {
      const user = await callAppsScript<{ role: Role; status: string }>("login", {
        username: inputName,
        password,
      });
      if (user.status !== "Active") {
        return NextResponse.json({ error: "login_inactive" }, { status: 403 });
      }
      role = user.role;
    } catch {
      return NextResponse.json({ error: "login_error" }, { status: 401 });
    }
  } else {
    // Seed/demo mode: the identifier may be a username OR an email address.
    const user = findByLogin(inputName);
    if (!user || !verifyPassword(user, password)) {
      return NextResponse.json({ error: "login_error" }, { status: 401 });
    }
    if (user.status !== "Active") {
      return NextResponse.json({ error: "login_inactive" }, { status: 403 });
    }
    username = user.username;
    role = user.role;
  }

  await setSession({ username, role });
  return NextResponse.json({ username, role });
}
