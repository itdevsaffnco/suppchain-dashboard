"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { translate } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/en";
import LiveWallpaper from "./LiveWallpaper";

// New-password form shown from the emailed reset link. On success it shows a
// confirmation then redirects back to the login page automatically.
export default function ResetPasswordForm({
  token,
  username,
}: {
  token: string;
  username: string | null;
}) {
  const router = useRouter();
  const t = (key: keyof Dict) => translate("en", key);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const newPassword = (form.elements.namedItem("new_password") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirm_password") as HTMLInputElement).value;

    setError("");
    if (newPassword !== confirm) return setError(t("password_mismatch"));
    if (newPassword.length < 6) return setError(t("password_too_short"));

    setSaving(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(t((json.error as keyof Dict) || "reset_link_invalid"));
        return;
      }
      setDone(true);
      // Auto-redirect back to the login page after a short confirmation.
      setTimeout(() => router.replace("/"), 2000);
    } catch {
      setError(t("reset_link_invalid"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="login-overlay">
      <LiveWallpaper variant="hero" />
      <div className="login-box">
        {!username ? (
          <>
            <i className="ph-fill ph-link-break" style={{ fontSize: "2.6rem", color: "var(--brand-red)" }} />
            <h2>{t("reset_link_invalid").split(".")[0]}</h2>
            <p>{t("reset_link_invalid")}</p>
            <button type="button" className="login-btn" onClick={() => router.replace("/")}>
              {t("back_to_login")}
            </button>
          </>
        ) : done ? (
          <>
            <i className="ph-fill ph-check-circle" style={{ fontSize: "2.6rem", color: "var(--brand-green)" }} />
            <h2>{t("reset_title")}</h2>
            <p>{t("reset_success")}</p>
          </>
        ) : (
          <>
            <i className="ph-fill ph-lock-key" style={{ fontSize: "2.6rem", color: "var(--brand-primary)" }} />
            <h2>{t("reset_title")}</h2>
            <p>
              {t("reset_desc")} <strong>{username}</strong>
            </p>
            <form onSubmit={handleSubmit}>
              <input
                name="new_password"
                type="password"
                className="login-input"
                placeholder={t("new_password")}
                minLength={6}
                required
                autoFocus
              />
              <input
                name="confirm_password"
                type="password"
                className="login-input"
                placeholder={t("confirm_password")}
                minLength={6}
                required
              />
              {error && (
                <p style={{ color: "var(--brand-red)", marginBottom: 12, fontSize: "0.85rem" }}>{error}</p>
              )}
              <button type="submit" className="login-btn" disabled={saving}>
                {saving ? "…" : t("save_new_password")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
