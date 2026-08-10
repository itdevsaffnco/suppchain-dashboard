// Sends the password-reset email. Uses SMTP when configured via env vars;
// otherwise falls back to logging the reset link on the server console so the
// flow stays testable in seed/demo mode without an email account.
//
// SMTP env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.

export interface SendResetResult {
  sent: boolean; // true = handed to SMTP; false = dev fallback (logged)
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function sendResetEmail(to: string, resetUrl: string): Promise<SendResetResult> {
  if (!smtpConfigured()) {
    console.log(`[mailer] SMTP not configured — password reset link for ${to}:\n  ${resetUrl}`);
    return { sent: false };
  }

  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Reset Password — Supply Chain Dashboard",
    text: `Kami menerima permintaan reset password untuk akun Anda di Supply Chain Dashboard.

Buka tautan berikut untuk membuat password baru (berlaku 30 menit):
${resetUrl}

Jika Anda tidak meminta reset password, abaikan email ini.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 48px; height: 48px; margin: 0 auto 12px; background: #1E3A8A; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="m20 6-8 5-8-5"/></svg>
          </div>
          <h2 style="color: #1E3A8A; margin: 0; font-size: 28px; font-weight: 700;">Reset Password</h2>
        </div>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">Kami menerima permintaan reset password untuk akun Anda di <strong>Supply Chain Dashboard</strong>.</p>
        <p style="margin: 28px 0 24px; text-align: center;">
          <a href="${resetUrl}" style="background: #1E3A8A; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 2px 6px rgba(30,58,138,0.3);">Buat Password Baru</a>
        </p>
        <p style="color: #64748B; font-size: 13px; line-height: 1.5;">Tautan berlaku selama 30 menit dan hanya dapat digunakan sekali.</p>
        <p style="color: #64748B; font-size: 13px; margin-top: 24px;">Jika Anda tidak meminta reset password, abaikan email ini.</p>
      </div>
    `,
  });
  return { sent: true };
}
