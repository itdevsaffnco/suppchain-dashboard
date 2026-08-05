import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";
import { sendResetEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// Asks the backend for a reset token, then composes and sends the link. Always
// responds with a generic success so the endpoint can't be used to enumerate
// emails — the backend withholds the token for unknown/inactive accounts.
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

  const res = await apiFetch<{ ok: boolean; token?: string; email?: string }>(
    "/auth/forgot-password",
    { method: "POST", body: { email } }
  );

  const token = res.data?.token;
  if (res.ok && token) {
    const origin = new URL(request.url).origin;
    const resetUrl = `${origin}/reset-password?token=${token}`;
    try {
      const result = await sendResetEmail(res.data?.email ?? email, resetUrl);
      // Demo convenience: without SMTP the link is returned so the flow can be
      // completed locally. Never exposed in production builds.
      if (!result.sent && process.env.NODE_ENV !== "production") {
        return NextResponse.json({ ok: true, devResetUrl: resetUrl });
      }
    } catch (err) {
      console.error("[forgot-password] failed to send email:", err);
      return NextResponse.json({ error: "reset_email_failed" }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true });
}
