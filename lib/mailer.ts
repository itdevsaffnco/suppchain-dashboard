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
    subject: "Reset Password — Enterprise SCM Dashboard",
    text: `Kami menerima permintaan reset password untuk akun Anda.\n\nBuka tautan berikut untuk membuat password baru (berlaku 30 menit):\n${resetUrl}\n\nJika Anda tidak meminta reset password, abaikan email ini.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1E3A8A; margin-bottom: 8px;">Reset Password</h2>
        <p style="color: #334155;">Kami menerima permintaan reset password untuk akun Anda di Enterprise SCM Dashboard.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background: #1E3A8A; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Buat Password Baru</a>
        </p>
        <p style="color: #64748B; font-size: 13px;">Tautan berlaku selama 30 menit dan hanya dapat digunakan sekali.</p>
        <p style="color: #64748B; font-size: 13px;">Jika Anda tidak meminta reset password, abaikan email ini.</p>
      </div>`,
  });
  return { sent: true };
}
