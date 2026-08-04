import { apiFetch } from "@/lib/api";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export const dynamic = "force-dynamic";

// Landing page for the reset link sent by email: /reset-password?token=…
// The token is validated server-side; the client form re-validates on submit.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  let username: string | null = null;
  if (token) {
    const res = await apiFetch<{ valid: boolean; username?: string }>("/auth/reset-password", {
      query: { token },
    });
    if (res.ok && res.data?.valid) username = res.data.username ?? null;
  }

  return <ResetPasswordForm token={token} username={username} />;
}
