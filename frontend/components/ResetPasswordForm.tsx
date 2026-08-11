"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { translate } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/en";
import LiveWallpaper from "./LiveWallpaper";

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
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // 0-4 strength score
  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8)  s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return Math.min(s, 4);
  })();
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "var(--brand-red)", "#f59e0b", "#3b82f6", "var(--brand-green)"][strength];
  const passwordsMatch = confirm.length > 0 && password === confirm;
  // Controls which "slide" is visible: "invalid" | "form" | "done"
  const [view, setView] = useState<"invalid" | "form" | "done">(
    !username ? "invalid" : "form"
  );
  // Trigger re-mount animation on view change
  const [animKey, setAnimKey] = useState(0);
  const [slideDir, setSlideDir] = useState<"up" | "down">("up");

  const transitionTo = (next: "invalid" | "form" | "done", dir: "up" | "down" = "up") => {
    setSlideDir(dir);
    setView(next);
    setAnimKey(k => k + 1);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const newPassword = (form.elements.namedItem("new_password") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirm_password") as HTMLInputElement).value;

    setError("");
    if (newPassword !== confirm) return setError(t("password_mismatch"));
    if (newPassword.length < 8) return setError(t("password_too_short"));

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
      transitionTo("done", "up");
      setTimeout(() => router.replace("/"), 2500);
    } catch {
      setError(t("reset_link_invalid"));
    } finally {
      setSaving(false);
    }
  };

  const animClass = slideDir === "up" ? "reset-slide-up" : "reset-slide-down";

  return (
    <div className="login-overlay">
      <LiveWallpaper variant="hero" />
      <div className="login-box" style={{ overflow: "hidden" }}>
        <div key={animKey} className={animClass}>
          {view === "invalid" && (
            <>
              <i className="ph-fill ph-link-break" style={{ fontSize: "2.6rem", color: "var(--brand-red)" }} />
              <h2>{t("reset_link_invalid").split(".")[0]}</h2>
              <p>{t("reset_link_invalid")}</p>
              <button type="button" className="login-btn" onClick={() => router.replace("/")}>
                {t("back_to_login")}
              </button>
            </>
          )}

          {view === "done" && (
            <div className="reset-success-wrap">
              <div className="reset-check-ring">
                <i className="ph-fill ph-check-circle reset-check-icon" />
              </div>
              <h2 style={{ marginTop: 20 }}>{t("reset_title")}</h2>
              <p>{t("reset_success")}</p>
              <div className="reset-redirect-bar">
                <div className="reset-redirect-fill" />
              </div>
            </div>
          )}

          {view === "form" && (
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
                  minLength={8}
                  required
                  autoFocus
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ marginBottom: 6 }}
                />
                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="pw-strength-wrap">
                    <div className="pw-strength-track">
                      {[1,2,3,4].map(i => (
                        <div
                          key={i}
                          className="pw-strength-seg"
                          style={{
                            background: i <= strength ? strengthColor : "var(--border-color)",
                            transition: "background 0.3s cubic-bezier(0.16,1,0.3,1)",
                          }}
                        />
                      ))}
                    </div>
                    <span className="pw-strength-label" style={{ color: strengthColor }}>
                      {strengthLabel}
                    </span>
                  </div>
                )}
                <input
                  name="confirm_password"
                  type="password"
                  className="login-input"
                  placeholder={t("confirm_password")}
                  minLength={8}
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  style={{ marginBottom: 6, borderColor: confirm.length > 0 ? (passwordsMatch ? "var(--brand-green)" : "var(--brand-red)") : undefined, transition: "border-color 0.25s" }}
                />
                {/* Match indicator */}
                {confirm.length > 0 && (
                  <p className="pw-match-label" style={{ color: passwordsMatch ? "var(--brand-green)" : "var(--brand-red)" }}>
                    {passwordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
                  </p>
                )}
                {error && (
                  <p className="reset-error-msg">{error}</p>
                )}
                <button type="submit" className={`login-btn${saving ? " reset-btn-loading" : ""}`} disabled={saving}>
                  {saving ? (
                    <span className="reset-spinner" />
                  ) : (
                    t("save_new_password")
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <style>{`
        /* Slide animations */
        @keyframes resetSlideUp {
          from { opacity: 0; transform: translateY(28px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes resetSlideDown {
          from { opacity: 0; transform: translateY(-28px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        .reset-slide-up   { animation: resetSlideUp   0.48s cubic-bezier(0.16,1,0.3,1) both; }
        .reset-slide-down { animation: resetSlideDown 0.48s cubic-bezier(0.16,1,0.3,1) both; }

        /* Success screen */
        .reset-success-wrap { display: flex; flex-direction: column; align-items: center; }
        @keyframes ringPop {
          0%   { transform: scale(0.5); opacity: 0; }
          65%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes checkBounce {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); }
        }
        .reset-check-ring {
          width: 72px; height: 72px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--brand-green) 15%, transparent);
          display: flex; align-items: center; justify-content: center;
          animation: ringPop 0.55s cubic-bezier(0.16,1,0.3,1) 0.1s both;
        }
        .reset-check-icon {
          font-size: 2.8rem;
          color: var(--brand-green);
          animation: checkBounce 0.45s cubic-bezier(0.16,1,0.3,1) 0.3s both;
        }

        /* Progress bar countdown before redirect */
        .reset-redirect-bar {
          width: 100%; height: 3px; border-radius: 2px;
          background: var(--border-color);
          overflow: hidden; margin-top: 24px;
        }
        @keyframes redirectFill {
          from { width: 100%; }
          to   { width: 0%; }
        }
        .reset-redirect-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--brand-primary), var(--brand-secondary));
          animation: redirectFill 2.5s linear both;
        }

        /* Error message entrance */
        @keyframes errorShake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          40%       { transform: translateX(6px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }
        .reset-error-msg {
          color: var(--brand-red);
          margin-bottom: 12px;
          font-size: 0.85rem;
          animation: errorShake 0.4s cubic-bezier(0.16,1,0.3,1);
        }

        /* Spinner for save button */
        @keyframes spin { to { transform: rotate(360deg); } }
        .reset-spinner {
          display: inline-block;
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          vertical-align: middle;
        }
        .reset-btn-loading { cursor: default; }

        /* Password strength bar */
        .pw-strength-wrap { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
        .pw-strength-track { display: flex; gap: 4px; flex: 1; }
        .pw-strength-seg { height: 4px; flex: 1; border-radius: 2px; }
        .pw-strength-label { font-size: 0.75rem; font-weight: 600; min-width: 38px; text-align: right; transition: color 0.3s; }

        /* Match indicator */
        .pw-match-label {
          font-size: 0.78rem; font-weight: 600;
          margin: -8px 0 12px;
          animation: resetSlideUp 0.25s cubic-bezier(0.16,1,0.3,1) both;
        }
      `}</style>
    </div>
  );
}
