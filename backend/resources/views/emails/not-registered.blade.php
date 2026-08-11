<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin: 0; padding: 0; background: #f1f5f9;">
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <div style="text-align: center; margin-bottom: 28px;">
            <h2 style="color: #1E3A8A; margin: 0; font-size: 28px; font-weight: 700;">Reset Password</h2>
        </div>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">Hello,</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
            We received a password reset request for <strong>{{ $email }}</strong>, but this email address is not registered in <strong>Supply Chain Dashboard</strong>.
        </p>
        <p style="color: #64748B; font-size: 14px; margin: 0 0 24px;">
            If you have an account, please make sure you're using the correct email address. If you did not make this request, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;">
        <p style="color: #64748B; font-size: 13px; margin: 0 0 4px;">Best regards,<br>SAFF & Co. Team</p>
    </div>
    <div style="text-align: center; margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; color: #64748B; font-size: 12px; max-width: 520px; margin-left: auto; margin-right: auto;">
        © {{ date('Y') }} SAFF & Co. All rights reserved.<br>
        This is an automated generated email. Please do not reply to this email.
    </div>
</body>
</html>
