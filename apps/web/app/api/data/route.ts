import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import { DashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

// Returns the dashboard dataset { skus, categories, users } from the Laravel
// backend. Derived fields (stock, aging, coverage, status) are still computed
// client-side by enrichAll().
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await apiFetch<DashboardData>("/dashboard", { token: session.apiToken });

  if (!res.ok || !res.data) {
    // A rejected token means the session outlived the backend token.
    const status = res.status === 401 ? 401 : 502;
    return NextResponse.json({ error: "data_unavailable" }, { status });
  }

  return NextResponse.json(res.data);
}
