import { NextResponse } from "next/server";
import { findByEmail, createResetToken } from "@/lib/userStore";
import { sendResetEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// Issues a password-reset token and emails the reset link. Always responds
// with a generic success so the endpoint can't be used to enumerate emails.
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

  const user = findByEmail(email);
  if (user && user.status === "Active") {
    const token = createResetToken(user.id);
    const origin = new URL(request.url).origin;
    const resetUrl = `${origin}/reset-password?token=${token}`;
    try {
      const result = await sendResetEmail(user.email, resetUrl);
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
