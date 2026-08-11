<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin: 0; padding: 0; background: #f1f5f9;">
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <div style="text-align: center; margin-bottom: 28px;">
            <div style="width: 52px; height: 52px; margin: 0 auto 16px; background: linear-gradient(135deg, #1E3A8A, #3B82F6); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <path d="m20 6-8 5-8-5"/>
                </svg>
            </div>
            <h2 style="color: #1E3A8A; margin: 0; font-size: 28px; font-weight: 700;">Reset Password</h2>
        </div>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">Hello {{ $name }},</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">We received a request to reset your password for <strong>Supply Chain Dashboard</strong>.</p>
        <p style="margin: 32px 0 28px; text-align: center;">
            <a href="{{ $resetUrl }}" style="background: linear-gradient(135deg, #1E3A8A, #3B82F6); color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 3px 8px rgba(59,130,246,0.35);">Reset My Password</a>
        </p>
        <p style="color: #64748B; font-size: 14px; line-height: 1.5; margin: 0 0 24px;">The link will expire in 30 minutes and can only be used once.</p>
        <p style="color: #64748B; font-size: 14px; margin: 0;">If you did not request this password reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;">
        <p style="color: #64748B; font-size: 13px; margin: 0 0 4px;">Best regards,<br>SAFF & Co. Team</p>
    </div>
    <div style="text-align: center; margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; color: #64748B; font-size: 12px; max-width: 520px; margin-left: auto; margin-right: auto;">
        © {{ date('Y') }} SAFF & Co. All rights reserved.<br>
        This is an automated generated email. Please do not reply to this email.
    </div>
</body>
</html>
